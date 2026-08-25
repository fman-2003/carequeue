import { z } from "zod";

/**
 * Ids are matched against the ObjectId format rather than accepted as any
 * non-empty string. That rejects the object-shaped payloads used for
 * NoSQL operator injection (`{"patientId": {"$ne": null}}`) at the edge,
 * before they can reach a query builder.
 */
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

/** "09:00 - 09:30" — the shape generateSlots produces. */
const timeSlot = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/, "Invalid time slot");

export const createAppointmentSchema = z.object({
  patientId: objectId,
  clinicId: objectId,
  doctorId: objectId,
  date: z.iso.datetime("Invalid date format"),
  timeSlot,
  reason: z.string().trim().max(500).optional(),
});

export const updateAppointmentSchema = z
  .object({
    status: z
      .enum(["pending", "confirmed", "cancelled", "completed", "no-show"])
      .optional(),
    timeSlot: timeSlot.optional(),
    date: z.iso.datetime().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
