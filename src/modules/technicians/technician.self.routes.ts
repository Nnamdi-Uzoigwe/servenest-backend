import { Router, type Request } from "express";
import { authenticate } from "@/middleware/auth";
import { technicianOnly } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import type { AuditContext } from "@/modules/audit/audit.service";
import {
  addDocumentSchema,
  resubmitSchema,
  updateTechnicianSchema,
} from "@/modules/technicians/technician.self.schemas";
import * as service from "@/modules/technicians/technician.self.service";

const router = Router();

// Any technician status can reach these, so a pending or rejected technician can finish their application
router.use(authenticate, technicianOnly);

const ctx = (req: Request): AuditContext => ({
  actorId: req.auth!.userId,
  actorRole: req.auth!.role,
  ip: req.ip,
  userAgent: req.get("user-agent"),
});

router.get("/me", async (req, res) => {
  res.json({ success: true, data: await service.getMyProfile(req.auth!.userId) });
});

router.patch("/me", validate(updateTechnicianSchema), async (req, res) => {
  const profile = await service.updateMyProfile(req.auth!.userId, req.body);
  res.json({ success: true, message: "Application updated", data: profile });
});

router.post("/me/resubmit", validate(resubmitSchema), async (req, res) => {
  const profile = await service.resubmit(req.auth!.userId, req.body, ctx(req));
  res.json({ success: true, message: "Application resubmitted", data: profile });
});

router.post("/me/documents", validate(addDocumentSchema), async (req, res) => {
  const documents = await service.addDocument(req.auth!.userId, req.body);
  res.status(201).json({ success: true, data: { documents } });
});

router.delete("/me/documents/:docId", async (req, res) => {
  const documents = await service.removeDocument(req.auth!.userId, String(req.params.docId));
  res.json({ success: true, data: { documents } });
});

export default router;