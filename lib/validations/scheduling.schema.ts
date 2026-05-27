import { z } from "zod";

export const schedulingSchema = z.object({
  clinicId: z.string().min(1),
  message: z.string().min(3, "Please describe what you need"),
});

export type SchedulingRequest = z.infer<typeof schedulingSchema>;