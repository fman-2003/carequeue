import { NextRequest, NextResponse } from "next/server";
import { signupSchema } from "@/lib/validations/auth.schema";
import { signupUser } from "@/lib/services/auth.service";
import { setSessionCookie } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/middleware";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { handleServiceError, readJson } from "@/lib/security/errors";

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  // Caps automated account creation, which is also how someone would
  // grind through invite codes.
  const limited = enforceRateLimit(req, "signup", RATE_LIMITS.signup);
  if (limited) return limited;

  try {
    const body = await readJson(req);

    // validate user input before it hits db
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
        { status: 422 },
      );
    }

    const { token, user } = await signupUser(parsed.data);

    const response = NextResponse.json({ user }, { status: 201 });
    return setSessionCookie(response, token);
  } catch (error) {
    return handleServiceError("auth/signup", error, 400);
  }
}
