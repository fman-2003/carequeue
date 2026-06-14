import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z
    .string()
    .regex(
      /^(\+234|0)[789][01]\d{8}$/,
      "Invalid phone number (Use nigerian format)",
    )
    .optional(),
  role: z
    .enum(["admin", "doctor", "receptionist", "patient"])
    .default("patient"),
  inviteCode: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.email("Invalid combination of email address and password"),
  password: z
    .string()
    .min(6, "Invalid combination of email address and password"),
});

// inferred types to savE from writing duplicate typescript interfaces
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
