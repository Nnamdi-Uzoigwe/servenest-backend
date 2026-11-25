import { Types } from "mongoose";
import { ApiError } from "@/utils/ApiError";
import { assertOwnedAsset, deleteAsset } from "@/services/cloudinary.service";
import { logAudit, type AuditContext } from "@/modules/audit/audit.service";
import { TechnicianProfile } from "@/modules/technicians/technicianProfile.model";
import type {
  AddDocumentInput,
  ResubmitInput,
  UpdateTechnicianInput,
} from "@/modules/technicians/technician.self.schemas";

const MAX_DOCUMENTS = 10;

const defined = (o: object) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export async function getMyProfile(userId: string) {
  const profile = await TechnicianProfile.findOne({ user: userId }).lean();
  if (!profile) throw ApiError.notFound("Technician profile not found");
  return profile;
}

export async function updateMyProfile(userId: string, input: UpdateTechnicianInput) {
  const profile = await TechnicianProfile.findOneAndUpdate(
    { user: userId, approvalStatus: { $in: ["pending", "rejected"] } },
    { $set: defined(input) },
    { new: true, runValidators: true }
  ).lean();

  if (!profile) {
    const exists = await TechnicianProfile.exists({ user: userId });
    if (!exists) throw ApiError.notFound("Technician profile not found");
    throw ApiError.conflict("Approved or suspended profiles cannot be edited here. Contact support.");
  }
  return profile;
}

// Rejected goes back to pending, optionally with corrected details, in one atomic update
export async function resubmit(userId: string, input: ResubmitInput, ctx: AuditContext) {
  const before = await TechnicianProfile.findOneAndUpdate(
    { user: userId, approvalStatus: "rejected" },
    { $set: { ...defined(input), approvalStatus: "pending" }, $unset: { rejectionReason: 1 } },
    { runValidators: true }
  );

  if (!before) {
    const exists = await TechnicianProfile.exists({ user: userId });
    if (!exists) throw ApiError.notFound("Technician profile not found");
    throw ApiError.conflict("Only rejected applications can be resubmitted");
  }

  await logAudit(ctx, {
    action: "technician.resubmitted",
    entityType: "TechnicianProfile",
    entityId: before._id,
    metadata: { from: "rejected", to: "pending" },
  });

  return TechnicianProfile.findById(before._id).lean();
}

export async function addDocument(userId: string, input: AddDocumentInput) {
  assertOwnedAsset("technician_document", userId, {
    url: input.url,
    publicId: input.publicId,
  });

  // Atomic: refuses a duplicate upload, and refuses an 11th document
  const profile = await TechnicianProfile.findOneAndUpdate(
    {
      user: userId,
      "documents.publicId": { $ne: input.publicId },
      [`documents.${MAX_DOCUMENTS - 1}`]: { $exists: false },
    },
    {
      $push: {
        documents: {
          type: input.type,
          name: input.name,
          url: input.url,
          publicId: input.publicId,
          uploadedAt: new Date(),
        },
      },
    },
    { new: true, runValidators: true }
  ).lean();

  if (!profile) {
    const current = await TechnicianProfile.findOne({ user: userId }).select("documents.publicId").lean();
    if (!current) throw ApiError.notFound("Technician profile not found");
    if (current.documents.some((d) => d.publicId === input.publicId)) {
      throw ApiError.conflict("This document was already added");
    }
    throw ApiError.conflict(`You can upload up to ${MAX_DOCUMENTS} documents`);
  }

  return profile.documents;
}

export async function removeDocument(userId: string, docId: string) {
  if (!Types.ObjectId.isValid(docId)) throw ApiError.badRequest("Invalid document id");

  // Returns the profile as it was before the pull, so we can find the file to delete
  const before = await TechnicianProfile.findOneAndUpdate(
    { user: userId, "documents._id": docId },
    { $pull: { documents: { _id: docId } } }
  );
  if (!before) throw ApiError.notFound("Document not found");

  const removed = before.documents.find((d) => String(d._id) === docId);
  if (removed) void deleteAsset(removed.publicId);

  const updated = await TechnicianProfile.findById(before._id).select("documents").lean();
  return updated?.documents ?? [];
}