import { NextRequest, NextResponse } from "next/server";
import { authenticate, assertSameOrigin } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signToken } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/session";
import { passwordSchema } from "@/lib/validations/auth.schema";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { handleRouteError, readJson } from "@/lib/security/errors";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required").max(72),
    // Same policy as signup, in one place — a weak-password path here
    // would otherwise undo the rule enforced at registration.
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from your current password",
    path: ["newPassword"],
  });

export async function PATCH(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const { payload, error } = authenticate(req);
  if (error) return error;

  /**
   * Throttled because the endpoint confirms whether a supplied password
   * is correct. Someone with a stolen session could otherwise use it to
   * brute-force the account's actual password at full speed.
   */
  const limited = enforceRateLimit(
    req,
    "password-change",
    RATE_LIMITS.passwordChange,
    payload.userId,
  );
  if (limited) return limited;

  try {
    const body = await readJson(req);
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 },
      );
    }

    await connectDB();

    const user = await User.findById(payload.userId).select("+password");
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isMatch = await bcrypt.compare(
      parsed.data.currentPassword,
      user.password,
    );

    if (!isMatch) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 },
      );
    }

    /**
     * Update password — the pre-save hook in User model
     * automatically hashes it before saving.
     * We use .save() not .findByIdAndUpdate() specifically
     * because findByIdAndUpdate bypasses mongoose middleware
     * including the pre-save hash hook.
     */
    user.password = parsed.data.newPassword;
    await user.save();

    /**
     * Re-issue the session after a credential change.
     *
     * Tokens are self-contained and are not tracked server-side, so any
     * token minted before the change stays valid until it expires. Issuing
     * a fresh one at least rotates the cookie in this browser; a proper
     * "sign out everywhere" needs a token version on the user document
     * that verifyToken checks — noted in SECURITY.md.
     */
    const token = signToken({
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      clinicId: payload.clinicId,
    });

    const response = NextResponse.json({
      message: "Password updated successfully",
    });

    return setSessionCookie(response, token);
  } catch (err) {
    return handleRouteError("users/change-password", err);
  }
}
