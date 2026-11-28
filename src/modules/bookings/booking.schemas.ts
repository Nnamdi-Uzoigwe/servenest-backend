import { z } from "zod";
import { BOOKING_STATUSES, BOOKING_WINDOWS } from "@/constants/booking";
import { OBJECT_ID } from "@/modules/catalog/catalog.schemas";
import { isRealDate } from "@/utils/lagosTime";

const objectId = z.string().regex(OBJECT_ID, "Invalid id");

const imageSchema = z.object({
  url: z.string().url().max(500),
  publicId: z.string().min(10).max(200),
});

export const createBookingSchema = z.object({
  serviceId: objectId,
  description: z
    .string()
    .trim()
    .min(10, "Describe the problem in at least 10 characters")
    .max(1000, "Keep the description under 1000 characters"),
  photos: z.array(imageSchema).max(5, "You can add up to 5 photos").default([]),
  addressId: objectId,
  contactPhone: z.string().trim().regex(/^\+?\d{10,15}$/, "Enter a valid phone number"),
  preferredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
    .refine(isRealDate, "Enter a real date"),
  preferredWindow: z.enum(BOOKING_WINDOWS),
  clientRequestId: z.string().trim().min(8).max(64).optional(),
});

export const cancelBookingSchema = z
  .object({ reason: z.string().trim().max(300, "Keep the reason under 300 characters").optional() })
  .default({});

export const listBookingsQuerySchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  // "open" is everything still in progress, "history" is completed, cancelled and declined
  group: z.enum(["open", "history"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;