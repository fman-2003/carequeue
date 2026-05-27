/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";

// authenticate is used to check for the presence of authorization header
// and verify the jwt token.
export function authenticate(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      payload: null,
      error: NextResponse.json({ error: "No token provided" }, { status: 401 }),
    };
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = verifyToken(token);
    return { payload, error: null };
  } catch (err: any) {
    return {
      payload: null,
      error: NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      ),
    };
  }
}

// This is a Role Guard helper function to be used in protected routes
// that need role-based access control after authentication
export function requireRole(userRole: string, allowedRoles: string[]) {
  if (!allowedRoles.includes(userRole)) {
    return NextResponse.json(
      { error: "You do not have permission to perform this action" },
      { status: 403 },
    );
  }
  return null;
}
