import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export const joinWaitlistSchema = z.object({
  appointmentId: objectId,
});

export const respondToWaitlistSchema = z.object({
  response: z.enum(["ACCEPT", "DECLINE"]),
});

export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;
export type WaitlistResponseInput = z.infer<typeof respondToWaitlistSchema>;
