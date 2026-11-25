import { z } from "zod";
import { WEEKDAYS } from "@/constants/enums";

const email = z.string().trim().toLowerCase().email("Enter a valid email address");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password is too long")
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/\d/, "Password must contain a number");

const phone = z.string().trim().regex(/^\+?\d{10,15}$/, "Enter a valid phone number");

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm format");

export const registerCustomerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(100),
  email,
  phone: phone.optional(),
  password,
});

export const registerTechnicianSchema = registerCustomerSchema.extend({
  phone,
  residentialAddress: z.string().trim().min(5).max(300),
  bio: z.string().trim().max(1000).optional(),
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
    .max(14)
    .default([]),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const verifyEmailSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6 digit code"),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  email,
  code: z.string().regex(/^\d{6}$/, "Enter the 6 digit code"),
  newPassword: password,
});

export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema>;
export type RegisterTechnicianInput = z.infer<typeof registerTechnicianSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;