import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { verifyToken, TokenPayload } from "@/lib/auth/jwt";
import { SESSION_COOKIE } from "@/lib/auth/session";

type AuthResult =
  | { payload: TokenPayload; error: null }
  | { payload: null; error: NextResponse };

const unauthorized = (message: string) =>
  NextResponse.json({ error: message }, { status: 401 });

/**
 * Reads the session from the httpOnly cookie and verifies it.
 *
 * The Authorization header is still accepted so non-browser callers
 * (integration tests, scripts) keep working, but browsers now
 * authenticate purely through the cookie — no token is exposed to
 * client-side JavaScript.
 */
export function authenticate(req: NextRequest): AuthResult {
  const cookieToken = req.cookies?.get?.(SESSION_COOKIE)?.value;

  let token = cookieToken;

  if (!token) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length).trim();
    }
  }

  if (!token) {
    return { payload: null, error: unauthorized("Not authenticated") };
  }

  try {
    return { payload: verifyToken(token), error: null };
  } catch {
    // The reason (expired vs. tampered vs. wrong issuer) is deliberately
    // not echoed back — it only helps someone probing the token format.
    return { payload: null, error: unauthorized("Invalid or expired session") };
  }
}

/**
 * Role guard, used after authentication on routes that are limited to
 * specific roles.
 */
export function requireRole(userRole: string, allowedRoles: string[]) {
  if (!allowedRoles.includes(userRole)) {
    return NextResponse.json(
      { error: "You do not have permission to perform this action" },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Guards every clinic-scoped query.
 *
 * Mongoose strips `undefined` values out of a filter, so a query written
 * as `{ clinicId: payload.clinicId }` for a user with no clinic silently
 * becomes `{}` and returns *every* record in the database. Any route that
 * filters by clinic must go through this first.
 */
export function requireClinic(payload: TokenPayload):
  | { clinicId: string; error: null }
  | { clinicId: null; error: NextResponse } {
  const clinicId = payload.clinicId;

  if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId)) {
    return {
      clinicId: null,
      error: NextResponse.json(
        { error: "No clinic is associated with your account" },
        { status: 403 },
      ),
    };
  }

  return { clinicId, error: null };
}

/**
 * Validates an id taken from a URL segment, query string, or body before
 * it reaches a query. Rejects the object-shaped values (`{"$ne": null}`)
 * used for NoSQL operator injection, and keeps malformed ids from
 * surfacing as 500s.
 */
export function isValidObjectId(value: unknown): value is string {
  return typeof value === "string" && mongoose.Types.ObjectId.isValid(value);
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function forbidden(message = "You do not have permission to perform this action") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

/**
 * Second line of defence against CSRF, behind the SameSite=Lax cookie.
 *
 * Any state-changing request from a browser carries an Origin header; if
 * it is present and does not match this deployment, the request came from
 * another site and is rejected. Requests with no Origin at all (server to
 * server, curl) are allowed through — they carry no ambient cookie, so
 * they are not a forgery risk.
 */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return null;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    // An unparseable Origin is not something a browser sends.
    return NextResponse.json(
      { error: "Cross-origin request rejected" },
      { status: 403 },
    );
  }

  /**
   * Hosts are compared, not full origins. The scheme in the Origin header
   * is the public one the browser saw, which need not match how the app
   * itself is served — behind a TLS-terminating proxy the request arrives
   * as http while the browser reports https. A forged cross-site request
   * always carries a different *host*, so that is the part that matters.
   */
  const allowedHosts = new Set<string>();

  const host = req.headers.get("host");
  if (host) allowedHosts.add(host);

  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      allowedHosts.add(new URL(configured).host);
    } catch {
      // ignore a malformed NEXT_PUBLIC_APP_URL
    }
  }

  if (!allowedHosts.has(originHost)) {
    return NextResponse.json(
      { error: "Cross-origin request rejected" },
      { status: 403 },
    );
  }

  return null;
}
