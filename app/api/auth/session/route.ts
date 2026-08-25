import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { handleRouteError } from "@/lib/security/errors";

/**
 * The small amount of session state the UI needs (display name, role,
 * whether a clinic is attached).
 *
 * The dashboard used to get this by base64-decoding the JWT in the
 * browser. That only worked because the token was reachable from
 * JavaScript, and it meant the UI trusted an unverified payload. Now the
 * server reads its own verified session and returns just these fields.
 */
export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  try {
    await connectDB();

    const user = await User.findById(payload.userId)
      .select("_id name email role clinicId")
      .lean<{
        _id: unknown;
        name: string;
        email: string;
        role: string;
        clinicId?: unknown;
      }>();

    if (!user) {
      // The account was deleted while a valid token was still in flight.
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId ? String(user.clinicId) : null,
      },
    });
  } catch (error) {
    return handleRouteError("auth/session", error);
  }
}
