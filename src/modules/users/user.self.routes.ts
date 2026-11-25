import { Router } from "express";
import { z } from "zod";
import { authenticate } from "@/middleware/auth";
import { authorize } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { setAvatar } from "@/modules/users/user.self.service";

const router = Router();

const avatarSchema = z.object({
  url: z.string().url().max(500),
  publicId: z.string().min(10).max(200),
});

router.patch(
  "/me/avatar",
  authenticate,
  authorize("customer", "technician"),
  validate(avatarSchema),
  async (req, res) => {
    const user = await setAvatar(req.auth!.userId, req.body);
    res.json({ success: true, data: { user } });
  }
);

export default router;