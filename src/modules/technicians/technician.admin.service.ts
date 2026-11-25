import { Types } from "mongoose";
import { TECHNICIAN_APPROVAL_STATUSES, type TechnicianApprovalStatus } from "@/constants/enums";
import { ApiError } from "@/utils/ApiError";
import { User } from "@/modules/users/user.model";
import { TechnicianProfile } from "@/modules/technicians/technicianProfile.model";
import { logAudit, type AuditContext } from "@/modules/audit/audit.service";
import type { ListTechniciansQuery } from "@/modules/technicians/technician.schemas";

const USER_FIELDS = "fullName email phone avatar isEmailVerified status suspendedReason createdAt";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Queries

export async function listTechnicians(q: ListTechniciansQuery) {
  const filter: Record<string, unknown> = {};
  if (q.status) filter.approvalStatus = q.status;

  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), "i");
    const userIds = await User.find({
      role: "technician",
      $or: [{ fullName: rx }, { email: rx }, { phone: rx }],
    }).distinct("_id");
    filter.user = { $in: userIds };
  }

  const [items, total] = await Promise.all([
    TechnicianProfile.find(filter)
      .sort({ createdAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate("user", USER_FIELDS)
      .lean(),
    TechnicianProfile.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) },
  };
}

export async function getTechnician(id: string) {
  const profile = await TechnicianProfile.findById(id)
    .populate("user", USER_FIELDS)
    .populate("reviewedBy", "fullName email")
    .lean();
  if (!profile) throw ApiError.notFound("Technician not found");
  return profile;
}

export async function getTechnicianStats() {
  const rows = await TechnicianProfile.aggregate<{ _id: TechnicianApprovalStatus; count: number }>([
    { $group: { _id: "$approvalStatus", count: { $sum: 1 } } },
  ]);

  const stats = Object.fromEntries(TECHNICIAN_APPROVAL_STATUSES.map((s) => [s, 0])) as Record<
    TechnicianApprovalStatus,
    number
  >;
  for (const r of rows) stats[r._id] = r.count;

  return { ...stats, total: Object.values(stats).reduce((a, b) => a + b, 0) };
}

// Transitions

type Action = "approve" | "reject" | "suspend" | "reactivate";

const TRANSITIONS: Record<
  Action,
  { from: TechnicianApprovalStatus[]; to: TechnicianApprovalStatus; audit: string }
> = {
  approve: { from: ["pending", "rejected"], to: "approved", audit: "technician.approved" },
  reject: { from: ["pending"], to: "rejected", audit: "technician.rejected" },
  suspend: { from: ["approved"], to: "suspended", audit: "technician.suspended" },
  reactivate: { from: ["suspended"], to: "approved", audit: "technician.reactivated" },
};

async function transition(id: string, action: Action, ctx: AuditContext, reason?: string) {
  const rule = TRANSITIONS[action];

  const $set: Record<string, unknown> = {
    approvalStatus: rule.to,
    reviewedBy: ctx.actorId,
    reviewedAt: new Date(),
  };
  const $unset: Record<string, 1> = {};

  if (action === "reject") {
    $set.rejectionReason = reason;
    $unset.suspensionReason = 1;
  } else if (action === "suspend") {
    $set.suspensionReason = reason;
  } else {
    // approve and reactivate clear any earlier reasons
    $unset.rejectionReason = 1;
    $unset.suspensionReason = 1;
  }

  // Atomic: only updates if the profile is still in an allowed starting status.
  // Returns the document as it was BEFORE the update.
  const before = await TechnicianProfile.findOneAndUpdate(
    { _id: id, approvalStatus: { $in: rule.from } },
    { $set, $unset }
  );

  if (!before) {
    const current = await TechnicianProfile.findById(id).select("approvalStatus");
    if (!current) throw ApiError.notFound("Technician not found");
    throw ApiError.conflict(`Cannot ${action} a technician whose status is "${current.approvalStatus}"`);
  }

  // Keep the account block in sync with the approval status
  if (action === "suspend") {
    await User.updateOne(
      { _id: before.user },
      { $set: { status: "suspended", suspendedReason: reason, refreshTokens: [] } }
    );
  } else if (action === "reactivate") {
    await User.updateOne(
      { _id: before.user },
      { $set: { status: "active" }, $unset: { suspendedReason: 1 } }
    );
  }

  await logAudit(ctx, {
    action: rule.audit,
    entityType: "TechnicianProfile",
    entityId: before._id,
    metadata: {
      technicianUserId: String(before.user),
      from: before.approvalStatus,
      to: rule.to,
      ...(reason ? { reason } : {}),
    },
  });

  return getTechnician(id);
}

export const approveTechnician = (id: string, ctx: AuditContext) =>
  transition(id, "approve", ctx);
export const rejectTechnician = (id: string, reason: string, ctx: AuditContext) =>
  transition(id, "reject", ctx, reason);
export const suspendTechnician = (id: string, reason: string, ctx: AuditContext) =>
  transition(id, "suspend", ctx, reason);
export const reactivateTechnician = (id: string, ctx: AuditContext) =>
  transition(id, "reactivate", ctx);

export const isValidId = (id: string) => Types.ObjectId.isValid(id);