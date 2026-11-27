import { Router } from "express";
import { publicLimiter } from "@/middleware/rateLimit";
import { ApiError } from "@/utils/ApiError";
import { publicServicesQuerySchema } from "@/modules/catalog/catalog.schemas";
import * as catalog from "@/modules/catalog/catalog.public.service";

const router = Router();

// No sign in needed. Anyone can browse the catalogue.
router.use(publicLimiter);

router.get("/categories", async (_req, res) => {
  res.json({ success: true, data: await catalog.listCategories() });
});

router.get("/services", async (req, res) => {
  const parsed = publicServicesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid query", parsed.error.flatten().fieldErrors);
  }
  res.json({ success: true, data: await catalog.listServices(parsed.data) });
});

router.get("/services/:idOrSlug", async (req, res) => {
  res.json({ success: true, data: await catalog.getService(String(req.params.idOrSlug)) });
});

export default router;