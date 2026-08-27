import { NextResponse } from "next/server";

/**
 * Session transport.
 *
 * The JWT lives in an httpOnly cookie, never in localStorage. A token in
 * localStorage is readable by any script on the page, so a single XSS bug
 * (or a compromised dependency) leaks a bearer token carrying a patient's
 * or clinician's role for its full lifetime. httpOnly keeps it out of
 * reach of JavaScript entirely.
 *
 * SameSite=Lax is what stops cross-site request forgery here: the browser
 * withholds the cookie on cross-site POST/PATCH/DELETE, so an attacker's
 * page cannot drive a state change with the victim's session. Top-level
 * GET navigations (the WhatsApp deep links this app sends) still work.
 * `assertSameOrigin` in lib/auth/middleware.ts backs this up.
 */
export const SESSION_COOKIE = "cq_session";

/** Parses "1d" / "12h" / "30m" / "3600" into seconds. */
function expiresInSeconds(value: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());
  if (!match) return 60 * 60 * 24; // fall back to one day

  const amount = Number(match[1]);
  const unit = match[2] ?? "s";
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit] ?? 1;
  return amount * multiplier;
}

export const SESSION_MAX_AGE = expiresInSeconds(
  process.env.JWT_EXPIRES_IN || "1d",
);

const baseCookieOptions = {
  httpOnly: true,
  // Secure is dropped in development so the cookie still works over
  // plain http://localhost; every deployed environment gets it.
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/** Attaches the signed session token to a response as an httpOnly cookie. */
export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    ...baseCookieOptions,
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

/** Expires the session cookie (logout, or after a credential change). */
export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", {
    ...baseCookieOptions,
    maxAge: 0,
  });
  return res;
}
