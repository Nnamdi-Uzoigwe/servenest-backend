import { z } from "zod";
import { DOCUMENT_TYPES, WEEKDAYS } from "@/constants/enums";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm format");

// Defined separately from the register schema on purpose: a .default([]) there would
// reset availability to empty whenever the field is left out of an update
const fields = z.object({
  residentialAddress: z.string().trim().min(5).max(300),
  bio: z.string().trim().max(1000),
  yearsOfExperience: z.number().int().min(0).max(60),
  specializations: z.array(z.string().trim().min(2).max(50)).min(1).max(10),
  workingLocations: z
    .array(
      z.object({
        state: z.string().trim().min(2).max(50),
        city: z.string().trim().min(2).max(50),
      })
    )
    .min(1)
    .max(10),
  weeklyAvailability: z
    .array(
      z
        .object({ day: z.enum(WEEKDAYS), startTime: time, endTime: time })
        .refine((s) => s.startTime < s.endTime, "End time must be after start time")
    )
    .max(14),
});

// Edit a pending or rejected application: at least one field
export const updateTechnicianSchema = fields
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

// Resubmit after rejection: any fields, or none
export const resubmitSchema = fields.partial();

export const addDocumentSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  name: z.string().trim().min(2).max(80),
  url: z.string().url().max(500),
  publicId: z.string().min(10).max(200),
});

export type UpdateTechnicianInput = z.infer<typeof updateTechnicianSchema>;
export type ResubmitInput = z.infer<typeof resubmitSchema>;
export type AddDocumentInput = z.infer<typeof addDocumentSchema>;