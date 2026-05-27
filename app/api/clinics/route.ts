/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { authenticate, requireRole } from "@/lib/auth/middleware";
import { createClinicSchema } from "@/lib/validations/clinic.schema";
import { createClinic } from "@/lib/services/clinic.service";
import { signToken } from "@/lib/auth/jwt";
// import User from "@/lib/models/User";

export async function POST(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  // only admins can register a clinic
  const roleError = requireRole(payload!.role, ["admin"]);
  if (roleError) return roleError;

  try {
    const body = await req.json();
    const parsed = createClinicSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(", ") },
        { status: 400 },
      );
    }

    const clinic = await createClinic(parsed.data, payload!.userId);
    const newToken = signToken({
      userId: payload!.userId,
      email: payload!.email,
      role: payload!.role,
      clinicId: clinic._id.toString(),
    });

    return NextResponse.json({ clinic, token: newToken }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
