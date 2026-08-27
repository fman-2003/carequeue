import { z } from "zod";

/**
 * bcrypt silently ignores everything past 72 bytes, so a 200-character
 * password is no stronger than its first 72 and the extra bytes are just
 * hashing work an attacker can force us to do. Cap it explicitly.
 */
const MAX_PASSWORD_LENGTH = 72;

/** The passwords that show up first in every credential-stuffing list. */
const BANNED_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyuiop",
  "letmein1",
  "iloveyou",
  "admin123",
  "welcome1",
  "carequeue",
  "carequeue1",
]);

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(
    MAX_PASSWORD_LENGTH,
    `Password must be at most ${MAX_PASSWORD_LENGTH} characters`,
  )
  .refine((value) => /[a-zA-Z]/.test(value) && /[0-9]/.test(value), {
    message: "Password must contain at least one letter and one number",
  })
  .refine((value) => !BANNED_PASSWORDS.has(value.toLowerCase()), {
    message: "That password is too common. Please choose another.",
  });

export const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must be at most 100 characters"),
    email: z.email("Invalid email address").max(254).toLowerCase().trim(),
    password: passwordSchema,
    phone: z
      .string()
      .trim()
      .regex(
        /^(\+234|0)[789][01]\d{8}$/,
        "Invalid phone number (Use nigerian format)",
      )
      .optional(),
    /**
     * `admin` here means "clinic owner registering their own clinic", and
     * `patient` is self-service. `doctor` and `receptionist` are the
     * privileged in-clinic roles and are gated on a single-use invite code
     * issued by that clinic's admin — see auth.service.signupUser.
     */
    role: z
      .enum(["admin", "doctor", "receptionist", "patient"])
      .default("patient"),
    inviteCode: z
      .string()
      .trim()
      .max(64)
      .regex(/^[A-Za-z0-9-]+$/, "Invalid invite code")
      .optional(),
  })
  /**
   * An invite code is only meaningful for the two invited roles. Rejecting
   * it elsewhere keeps anyone from probing which codes are live by
   * attaching one to a patient signup.
   */
  .refine(
    (data) =>
      !data.inviteCode ||
      data.role === "doctor" ||
      data.role === "receptionist",
    {
      message: "Invite codes only apply to doctor and receptionist accounts",
      path: ["inviteCode"],
    },
  );

export const loginSchema = z.object({
  // Both fields use one shared message. Distinct errors ("no such email"
  // vs. "wrong password") let anyone confirm which addresses are
  // registered on a healthcare platform.
  email: z
    .email("Invalid combination of email address and password")
    .max(254)
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(1, "Invalid combination of email address and password")
    .max(MAX_PASSWORD_LENGTH),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
