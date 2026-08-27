import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/auth/middleware";

/**
 * Logout has to happen server-side now that the session lives in an
 * httpOnly cookie — client script cannot delete a cookie it cannot read.
 */
export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const response = NextResponse.json({ message: "Signed out" });
  return clearSessionCookie(response);
}
