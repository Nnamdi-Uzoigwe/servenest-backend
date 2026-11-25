import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { authenticate } from "@/middleware/auth";
import { adminOnly } from "@/middleware/authorize";
import { ApiError } from "@/utils/ApiError";
import { listAuditLogs } from "@/modules/audit/audit.service";

const router = Router();

const querySchema = z.object({
  entityType: z.string().trim().max(50).optional(),
  entityId: z
    .string()
    .refine((v) => Types.ObjectId.isValid(v), "Invalid entity id")
    .optional(),
  action: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

router.get("/", authenticate, adminOnly, async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid query", parsed.error.flatten().fieldErrors);
  }
  res.json({ success: true, data: await listAuditLogs(parsed.data) });
});

export default router;