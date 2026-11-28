import { z } from "zod";

const label = z.string().trim().min(1, "Give this address a name").max(30);
const street = z.string().trim().min(5, "Enter the street address").max(200);
const landmark = z.string().trim().max(120);
const city = z.string().trim().min(2, "Enter the city or area").max(60);
const state = z.string().trim().min(2, "Choose a state").max(50);

export const createAddressSchema = z.object({
  label,
  street,
  landmark: landmark.default(""),
  city,
  state,
  isDefault: z.boolean().optional(),
});

export const updateAddressSchema = z
  .object({ label, street, landmark, city, state, isDefault: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;