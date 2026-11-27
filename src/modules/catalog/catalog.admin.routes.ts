import { Router, type Request } from "express";
import { authenticate } from "@/middleware/auth";
import { adminOnly, staffOnly } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { ApiError } from "@/utils/ApiError";
import type { AuditContext } from "@/modules/audit/audit.service";
import {
  OBJECT_ID,
  adminServicesQuerySchema,
  createCategorySchema,
  createServiceSchema,
  updateCategorySchema,
  updateServiceSchema,
} from "@/modules/catalog/catalog.schemas";
import * as catalog from "@/modules/catalog/catalog.admin.service";

const router = Router();

// Dispatchers can read everything, including hidden items. Only administrators can change anything.
router.use(authenticate);

const ctx = (req: Request): AuditContext => ({
  actorId: req.auth!.userId,
  actorRole: req.auth!.role,
  ip: req.ip,
  userAgent: req.get("user-agent"),
});

function idParam(req: Request): string {
  const id = String(req.params.id);
  if (!OBJECT_ID.test(id)) throw ApiError.badRequest("Invalid id");
  return id;
}

// Categories

router.get("/categories", staffOnly, async (_req, res) => {
  res.json({ success: true, data: await catalog.listCategories() });
});

router.get("/categories/:id", staffOnly, async (req, res) => {
  res.json({ success: true, data: await catalog.getCategory(idParam(req)) });
});

router.post("/categories", adminOnly, validate(createCategorySchema), async (req, res) => {
  const data = await catalog.createCategory(req.body, ctx(req));
  res.status(201).json({ success: true, message: "Category created", data });
});

router.patch("/categories/:id", adminOnly, validate(updateCategorySchema), async (req, res) => {
  const data = await catalog.updateCategory(idParam(req), req.body, ctx(req));
  res.json({ success: true, message: "Category updated", data });
});

router.delete("/categories/:id", adminOnly, async (req, res) => {
  await catalog.deleteCategory(idParam(req), ctx(req));
  res.json({ success: true, message: "Category deleted" });
});

// Services

router.get("/services", staffOnly, async (req, res) => {
  const parsed = adminServicesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid query", parsed.error.flatten().fieldErrors);
  }
  res.json({ success: true, data: await catalog.listServices(parsed.data) });
});

router.get("/services/:id", staffOnly, async (req, res) => {
  res.json({ success: true, data: await catalog.getService(idParam(req)) });
});

router.post("/services", adminOnly, validate(createServiceSchema), async (req, res) => {
  const data = await catalog.createService(req.body, ctx(req));
  res.status(201).json({ success: true, message: "Service created", data });
});

router.patch("/services/:id", adminOnly, validate(updateServiceSchema), async (req, res) => {
  const data = await catalog.updateService(idParam(req), req.body, ctx(req));
  res.json({ success: true, message: "Service updated", data });
});

export default router;