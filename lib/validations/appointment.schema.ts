import { z } from "zod";

export const createAppointmentSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  clinicId: z.string().min(1, "Clinic is required"),
  doctorId: z.string().min(1, "Doctor is required"),
  // role: z.string().o,
  date: z.iso.datetime("Invalid date format"),
  timeSlot: z.string().min(1, "Time slot is required"),
  reason: z.string().max(500).optional(),
});

export const updateAppointmentSchema = z.object({
  status: z
    .enum(["pending", "confirmed", "cancelled", "completed", "no-show"])
    .optional(),
  timeSlot: z.string().optional(),
  date: z.iso.datetime().optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
