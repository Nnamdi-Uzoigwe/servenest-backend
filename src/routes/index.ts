import { Router } from "express";
import mongoose from "mongoose";
import { env } from "@/config/env";
import authRoutes from "@/modules/auth/auth.routes";
import devChecks from "@/routes/devChecks";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    success: true,
    service: "servenest-backend",
    uptime: process.uptime(),
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

router.use("/auth", authRoutes);

// Temporary guard checks, never exposed in production
if (!env.isProd) router.use("/dev", devChecks);

export default router;