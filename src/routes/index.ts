import { Router } from "express";
import mongoose from "mongoose";
import authRoutes from "@/modules/auth/auth.routes";

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

export default router;