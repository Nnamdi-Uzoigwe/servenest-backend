import type { NextFunction, Request, Response } from "express";
import type { Role, TechnicianApprovalStatus } from "@/constants/enums";
import { ApiError } from "@/utils/ApiError";
import { TechnicianProfile } from "@/modules/technicians/technicianProfile.model";

export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw ApiError.unauthorized("Authentication required");
    if (!roles.includes(req.auth.role)) {
      throw ApiError.forbidden("You do not have permission to perform this action");
    }
    next();
  };

export const customerOnly = authorize("customer");
export const technicianOnly = authorize("technician");
export const adminOnly = authorize("admin");
export const staffOnly = authorize("admin", "dispatcher");

const APPROVAL_MESSAGES: Record<Exclude<TechnicianApprovalStatus, "approved">, string> = {
  pending: "Your technician account is awaiting admin approval",
  rejected: "Your technician application was rejected",
  suspended: "Your technician account has been suspended",
};

// Business rule 3: technicians cannot access job features until approved
export async function requireApprovedTechnician(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  if (!req.auth) throw ApiError.unauthorized("Authentication required");
  if (req.auth.role !== "technician") {
    throw ApiError.forbidden("You do not have permission to perform this action");
  }

  const profile = await TechnicianProfile.findOne({ user: req.auth.userId }).select(
    "approvalStatus"
  );
  if (!profile) throw ApiError.forbidden("Technician profile not found");

  if (profile.approvalStatus !== "approved") {
    throw ApiError.forbidden(APPROVAL_MESSAGES[profile.approvalStatus]);
  }

  req.auth.technicianProfileId = String(profile._id);
  next();
}