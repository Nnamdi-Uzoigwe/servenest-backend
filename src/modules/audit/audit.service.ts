import type { Types } from "mongoose";
import type { Role } from "@/constants/enums";
import { AuditLog } from "@/modules/audit/auditLog.model";

export interface AuditContext {
  actorId: string;
  actorRole: Role;
  ip?: string;
  userAgent?: string;
}

interface AuditEntry {
  action: string;
  entityType: string;
  entityId: Types.ObjectId | string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(ctx: AuditContext, entry: AuditEntry) {
  try {
    await AuditLog.create({
      actor: ctx.actorId,
      actorRole: ctx.actorRole,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  } catch (err) {
    // The action already happened, so do not fail the request over the log write
    console.error("Audit log write failed:", err);
  }
}

export async function listAuditLogs(query: {
  entityType?: string;
  entityId?: string;
  action?: string;
  page: number;
  limit: number;
}) {
  const filter: Record<string, unknown> = {};
  if (query.entityType) filter.entityType = query.entityType;
  if (query.entityId) filter.entityId = query.entityId;
  if (query.action) filter.action = query.action;

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate("actor", "fullName email role")
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit),
    },
  };
}