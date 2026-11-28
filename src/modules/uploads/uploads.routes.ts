import { Router } from "express";
import { z } from "zod";
import type { Role } from "@/constants/enums";
import { authenticate } from "@/middleware/auth";
import { uploadLimiter } from "@/middleware/rateLimit";
import { validate } from "@/middleware/validate";
import { ApiError } from "@/utils/ApiError";
import { signUpload } from "@/services/cloudinary.service";

const router = Router();

const signSchema = z.object({
  purpose: z.enum(["avatar", "technician_document", "service_image", "booking_photo"]),
});

// Who may upload what
const ALLOWED: Record<z.infer<typeof signSchema>["purpose"], Role[]> = {
  avatar: ["customer", "technician"],
  technician_document: ["technician"],
  service_image: ["admin"],
  booking_photo: ["customer"],
};

router.post("/sign", authenticate, uploadLimiter, validate(signSchema), (req, res) => {
  const { purpose } = req.body as z.infer<typeof signSchema>;
  const { userId, role } = req.auth!;

  if (!ALLOWED[purpose].includes(role)) {
    throw ApiError.forbidden("You do not have permission to upload this");
  }

  res.json({ success: true, data: signUpload(purpose, userId) });
});

export default router;