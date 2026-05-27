import { z } from "zod";

export const joinWaitlistSchema = z.object({
  appointmentId: z.string().min(1, "Appointment is required"),
});

export const respondToWaitlistSchema = z.object({
  response: z.enum(["ACCEPT", "DECLINE"]),
});

export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;
export type WaitlistResponseInput = z.infer<typeof respondToWaitlistSchema>;
