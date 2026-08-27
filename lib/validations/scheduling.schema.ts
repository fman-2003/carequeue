import { z } from "zod";

export const schedulingSchema = z.object({
  clinicId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid clinic id"),
  /**
   * The message is forwarded to an LLM as user content. The cap bounds
   * per-request token spend and limits how much room a prompt-injection
   * attempt has to work with — the system prompt in scheduling.service
   * already instructs the model never to disclose other users' data.
   */
  message: z
    .string()
    .trim()
    .min(3, "Please describe what you need")
    .max(1000, "Message is too long"),
});

export type SchedulingRequest = z.infer<typeof schedulingSchema>;
