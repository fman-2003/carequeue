import { z } from "zod";

export const createClinicSchema = z.object({
  name: z.string().min(2, "Clinic name too short"),
  address: z.string().min(5, "Address too short"),
  phone: z
    .string()
    .regex(
      /^(\+234|0)[789][01]\d{8}$/,
      "Invalid phone number (Use nigerian format)",
    ),
  email: z.email("Invalid email"),
  state: z.string().min(2, "State is required"),
  lga: z.string().min(2, "LGA is required"),
  openingTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Format must be HH:MM")
    .optional(),
  closingTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Format must be HH:MM")
    .optional(),
  slotDurationMinutes: z.number().min(10).max(120).optional(),
  workingDays: z.array(z.number().min(0).max(6)).optional(),
});

export const updateClinicSchema = createClinicSchema.partial();

export type CreateClinicInput = z.infer<typeof createClinicSchema>;
export type UpdateClinicInput = z.infer<typeof updateClinicSchema>;
