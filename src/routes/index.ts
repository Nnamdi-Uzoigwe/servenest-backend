import { Router } from "express";
import mongoose from "mongoose";
import { env } from "@/config/env";
import authRoutes from "@/modules/auth/auth.routes";
import userSelfRoutes from "@/modules/users/user.self.routes";
import technicianSelfRoutes from "@/modules/technicians/technician.self.routes";
import technicianAdminRoutes from "@/modules/technicians/technician.admin.routes";
import catalogPublicRoutes from "@/modules/catalog/catalog.public.routes";
import catalogAdminRoutes from "@/modules/catalog/catalog.admin.routes";
import addressRoutes from "@/modules/addresses/address.routes";
import bookingRoutes from "@/modules/bookings/booking.routes";
import uploadRoutes from "@/modules/uploads/uploads.routes";
import auditRoutes from "@/modules/audit/audit.routes";
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
router.use("/users", userSelfRoutes);
router.use("/technicians", technicianSelfRoutes);
router.use("/catalog", catalogPublicRoutes);
router.use("/customers/me/addresses", addressRoutes);
router.use("/bookings", bookingRoutes);
router.use("/uploads", uploadRoutes);
router.use("/admin/technicians", technicianAdminRoutes);
router.use("/admin/catalog", catalogAdminRoutes);
router.use("/admin/audit-logs", auditRoutes);

// Temporary guard checks, never exposed in production
if (!env.isProd) router.use("/dev", devChecks);

export default router;