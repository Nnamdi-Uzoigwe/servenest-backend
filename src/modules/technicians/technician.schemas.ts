import { z } from "zod";
import { TECHNICIAN_APPROVAL_STATUSES } from "@/constants/enums";

export const listTechniciansQuerySchema = z.object({
  status: z.enum(TECHNICIAN_APPROVAL_STATUSES).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const reasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, "Give a reason of at least 5 characters")
    .max(500, "Reason is too long"),
});

export type ListTechniciansQuery = z.infer<typeof listTechniciansQuerySchema>;