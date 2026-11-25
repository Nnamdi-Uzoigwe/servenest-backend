import type { Request, Response } from "express";
import { ApiError } from "@/utils/ApiError";
import type { AuditContext } from "@/modules/audit/audit.service";
import { listTechniciansQuerySchema } from "@/modules/technicians/technician.schemas";
import * as service from "@/modules/technicians/technician.admin.service";

const ctx = (req: Request): AuditContext => ({
  actorId: req.auth!.userId,
  actorRole: req.auth!.role,
  ip: req.ip,
  userAgent: req.get("user-agent"),
});

function idParam(req: Request): string {
  const id = String(req.params.id);
  if (!service.isValidId(id)) throw ApiError.badRequest("Invalid technician id");
  return id;
}

export async function list(req: Request, res: Response) {
  const parsed = listTechniciansQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid query", parsed.error.flatten().fieldErrors);
  }
  res.json({ success: true, data: await service.listTechnicians(parsed.data) });
}

export async function stats(_req: Request, res: Response) {
  res.json({ success: true, data: await service.getTechnicianStats() });
}

export async function getOne(req: Request, res: Response) {
  res.json({ success: true, data: await service.getTechnician(idParam(req)) });
}

export async function approve(req: Request, res: Response) {
  const data = await service.approveTechnician(idParam(req), ctx(req));
  res.json({ success: true, message: "Technician approved", data });
}

export async function reject(req: Request, res: Response) {
  const data = await service.rejectTechnician(idParam(req), req.body.reason, ctx(req));
  res.json({ success: true, message: "Technician rejected", data });
}

export async function suspend(req: Request, res: Response) {
  const data = await service.suspendTechnician(idParam(req), req.body.reason, ctx(req));
  res.json({ success: true, message: "Technician suspended", data });
}

export async function reactivate(req: Request, res: Response) {
  const data = await service.reactivateTechnician(idParam(req), ctx(req));
  res.json({ success: true, message: "Technician reactivated", data });
}