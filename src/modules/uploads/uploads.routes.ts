import { Router } from "express";
import { z } from "zod";
import { authenticate } from "@/middleware/auth";
import { uploadLimiter } from "@/middleware/rateLimit";
import { validate } from "@/middleware/validate";
import { ApiError } from "@/utils/ApiError";
import { signUpload } from "@/services/cloudinary.service";

const router = Router();

const signSchema = z.object({
  purpose: z.enum(["avatar", "technician_document", "service_image"]),
});

router.post("/sign", authenticate, uploadLimiter, validate(signSchema), (req, res) => {
  const { purpose } = req.body as z.infer<typeof signSchema>;
  const { userId, role } = req.auth!;

  const allowed =
    purpose === "avatar"
      ? role === "customer" || role === "technician"
      : purpose === "technician_document"
        ? role === "technician"
        : role === "admin";
  if (!allowed) throw ApiError.forbidden("You do not have permission to upload this");

  res.json({ success: true, data: signUpload(purpose, userId) });
});

export default router;