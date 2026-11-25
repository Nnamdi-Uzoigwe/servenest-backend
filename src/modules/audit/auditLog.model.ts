import { Schema, model, type Types } from "mongoose";
import { ROLES, type Role } from "@/constants/enums";

export interface IAuditLog {
  _id: Types.ObjectId;
  actor: Types.ObjectId;
  actorRole: Role;
  action: string; // e.g. "technician.approved"
  entityType: string; // e.g. "TechnicianProfile"
  entityId: Types.ObjectId;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actorRole: { type: String, enum: ROLES, required: true },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    metadata: { type: Schema.Types.Mixed },
    ip: String,
    userAgent: String,
  },
  // Audit logs are append-only, so no updatedAt
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

export const AuditLog = model<IAuditLog>("AuditLog", auditLogSchema);