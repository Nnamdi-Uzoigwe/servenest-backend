import rateLimit from "express-rate-limit";
import { env } from "@/config/env";

const message = { success: false, message: "Too many attempts. Please try again later." };

// Login, register, refresh
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isProd ? 30 : 500,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message,
});

// Verification codes and password reset
export const codeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isProd ? 10 : 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message,
});