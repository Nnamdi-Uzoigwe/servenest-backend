import { Router } from "express";
import { authenticate, requireVerifiedEmail } from "@/middleware/auth";
import { customerOnly } from "@/middleware/authorize";
import { validate } from "@/middleware/validate";
import { ApiError } from "@/utils/ApiError";
import {
  cancelBookingSchema,
  createBookingSchema,
  listBookingsQuerySchema,
} from "@/modules/bookings/booking.schemas";
import * as bookings from "@/modules/bookings/booking.service";

const router = Router();

// Business rule 6: a customer only ever reaches their own bookings. The service filters by owner.
router.use(authenticate, customerOnly);

router.post("/", requireVerifiedEmail, validate(createBookingSchema), async (req, res) => {
  const { booking, created } = await bookings.createBooking(req.auth!.userId, req.body);

  res.status(created ? 201 : 200).json({
    success: true,
    message: created ? "Booking request sent" : "We already received this request",
    data: booking,
  });
});

router.get("/", async (req, res) => {
  const parsed = listBookingsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest("Invalid query", parsed.error.flatten().fieldErrors);
  }
  res.json({ success: true, data: await bookings.listMyBookings(req.auth!.userId, parsed.data) });
});

router.get("/:idOrRef", async (req, res) => {
  res.json({
    success: true,
    data: await bookings.getMyBooking(req.auth!.userId, String(req.params.idOrRef)),
  });
});

router.post("/:idOrRef/cancel", validate(cancelBookingSchema), async (req, res) => {
  const data = await bookings.cancelMyBooking(
    req.auth!.userId,
    String(req.params.idOrRef),
    req.body.reason
  );
  res.json({ success: true, message: "Booking cancelled", data });
});

export default router;