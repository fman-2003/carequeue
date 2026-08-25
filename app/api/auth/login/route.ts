import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/validations/auth.schema";
import { loginUser } from "@/lib/services/auth.service";
import { setSessionCookie } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/middleware";
import {
  enforceRateLimit,
  resetRateLimit,
  clientIp,
  RATE_LIMITS,
} from "@/lib/security/rateLimit";
import { handleServiceError, readJson } from "@/lib/security/errors";

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const ip = clientIp(req);

  // Throttle by IP first — this is the only check that applies before we
  // know which account is being targeted.
  const ipLimited = enforceRateLimit(req, "login:ip", RATE_LIMITS.login, ip);
  if (ipLimited) return ipLimited;

  try {
    const body = await readJson(req);

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
        { status: 422 },
      );
    }

    /**
     * A second bucket keyed on the account. Without it, a distributed
     * attempt from many IPs against one mailbox never trips a limit.
     */
    const accountLimited = enforceRateLimit(
      req,
      "login:account",
      RATE_LIMITS.login,
      parsed.data.email,
    );
    if (accountLimited) return accountLimited;

    const { token, user } = await loginUser(parsed.data);

    // A successful sign-in clears the counters so a user who mistyped
    // twice is not locked out of their own account.
    resetRateLimit(`login:ip:${ip}`);
    resetRateLimit(`login:account:${parsed.data.email}`);

    /**
     * The token goes back as an httpOnly cookie, not in the JSON body.
     * The client never holds it, so it cannot be read by injected script
     * or leaked through localStorage.
     */
    const response = NextResponse.json({ user }, { status: 200 });
    return setSessionCookie(response, token);
  } catch (error) {
    return handleServiceError("auth/login", error, 401);
  }
}
