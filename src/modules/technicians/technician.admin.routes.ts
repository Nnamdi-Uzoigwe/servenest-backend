import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { adminOnly, staffOnly } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { reasonSchema } from "@/modules/technicians/technician.schemas";
import * as c from "@/modules/technicians/technician.admin.controller";

const router = Router();

router.use(authenticate);

// Read access: admin and dispatcher
router.get("/stats", staffOnly, c.stats);
router.get("/", staffOnly, c.list);
router.get("/:id", staffOnly, c.getOne);

// Review actions: admin only
router.post("/:id/approve", adminOnly, c.approve);
router.post("/:id/reject", adminOnly, validate(reasonSchema), c.reject);
router.post("/:id/suspend", adminOnly, validate(reasonSchema), c.suspend);
router.post("/:id/reactivate", adminOnly, c.reactivate);

export default router;