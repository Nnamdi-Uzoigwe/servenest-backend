import { Router } from "express";
import { validate } from "@/middleware/validate";
import { authenticate } from "@/middleware/auth";
import { authLimiter, codeLimiter } from "@/middleware/rateLimit";
import * as c from "@/modules/auth/auth.controller";
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerCustomerSchema,
  registerTechnicianSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@/modules/auth/auth.schemas";

const router = Router();

router.post("/register/customer", authLimiter, validate(registerCustomerSchema), c.registerCustomer);
router.post("/register/technician", authLimiter, validate(registerTechnicianSchema), c.registerTechnician);
router.post("/login", authLimiter, validate(loginSchema), c.login);
router.post("/refresh", authLimiter, validate(refreshSchema), c.refresh);
router.post("/logout", validate(refreshSchema), c.logout);
router.post("/logout-all", authenticate, c.logoutAll);

router.get("/me", authenticate, c.me);

router.post("/verify-email", authenticate, codeLimiter, validate(verifyEmailSchema), c.verifyEmail);
router.post("/resend-verification", authenticate, codeLimiter, c.resendVerification);

router.post("/forgot-password", codeLimiter, validate(forgotPasswordSchema), c.forgotPassword);
router.post("/reset-password", codeLimiter, validate(resetPasswordSchema), c.resetPassword);

export default router;