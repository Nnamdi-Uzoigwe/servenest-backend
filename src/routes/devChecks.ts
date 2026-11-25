import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import {
  adminOnly,
  customerOnly,
  requireApprovedTechnician,
  staffOnly,
} from "@/middleware/authorize";

const router = Router();

router.use(authenticate);

const reply = (label: string) => (req: any, res: any) =>
  res.json({ success: true, passed: label, role: req.auth.role });

router.get("/customer", customerOnly, reply("customer"));
router.get("/staff", staffOnly, reply("staff"));
router.get("/admin", adminOnly, reply("admin"));
router.get("/technician", requireApprovedTechnician, reply("approved technician"));

export default router;