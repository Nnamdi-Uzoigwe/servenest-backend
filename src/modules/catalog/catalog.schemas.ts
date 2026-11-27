import { z } from "zod";
import { ICON_KEYS } from "@/constants/catalog";

export const OBJECT_ID = /^[a-f0-9]{24}$/i;

const objectId = z.string().regex(OBJECT_ID, "Invalid id");

const imageSchema = z.object({
  url: z.string().url().max(500),
  publicId: z.string().min(10).max(200),
});

const flag = z.enum(["true", "false"]).transform((v) => v === "true");
const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(50).default(20);

// Public catalogue

export const publicServicesQuerySchema = z.object({
  // A category slug or id
  category: z.string().trim().min(1).max(80).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  featured: flag.optional(),
  page,
  limit,
});

// Admin lists

export const adminServicesQuerySchema = z.object({
  category: objectId.optional(),
  q: z.string().trim().min(1).max(100).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  availability: z.enum(["available", "unavailable"]).optional(),
  page,
  limit,
});

// Categories

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(60),
  description: z.string().trim().max(300).default(""),
  iconKey: z.enum(ICON_KEYS).default("other"),
  image: imageSchema.optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    description: z.string().trim().max(300),
    iconKey: z.enum(ICON_KEYS),
    // null removes the image
    image: imageSchema.nullable(),
    isActive: z.boolean(),
    sortOrder: z.number().int().min(0).max(1000),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

// Services. Prices are whole kobo.

const price = z.number().int().min(0).max(1_000_000_000);
const minutes = z.number().int().min(15).max(1440);

export const createServiceSchema = z.object({
  category: objectId,
  name: z.string().trim().min(2, "Enter a name").max(80),
  description: z.string().trim().max(1000).default(""),
  image: imageSchema.optional(),
  startingPrice: price,
  pricingNote: z.string().trim().max(200).default(""),
  estimatedDurationMinutes: minutes,
  isActive: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

export const updateServiceSchema = z
  .object({
    category: objectId,
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(1000),
    image: imageSchema.nullable(),
    startingPrice: price,
    pricingNote: z.string().trim().max(200),
    estimatedDurationMinutes: minutes,
    isActive: z.boolean(),
    isAvailable: z.boolean(),
    isFeatured: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export type PublicServicesQuery = z.infer<typeof publicServicesQuerySchema>;
export type AdminServicesQuery = z.infer<typeof adminServicesQuerySchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;