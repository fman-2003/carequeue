import { NextRequest, NextResponse } from "next/server";
import { authenticate, requireRole } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import Clinic from "@/lib/models/Clinic";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const roleError = requireRole(payload!.role, ["admin"]);
  if (roleError) return roleError;

  const { role } = await req.json();

  if (!["doctor", "receptionist"].includes(role)) {
    return NextResponse.json(
      {
        error:
          "Invalid role. Only doctor or receptionist codes can be generated.",
      },
      { status: 400 },
    );
  }

  await connectDB();

  const code = "CQ-" + crypto.randomBytes(4).toString("hex").toUpperCase();

  const clinic = await Clinic.findOneAndUpdate(
    { adminId: payload!.userId },
    {
      $push: {
        inviteCodes: { code, role },
      },
    },
    { returnDocument: "after" },
  );

  if (!clinic) {
    return NextResponse.json(
      { error: "Clinic not found. Create your clinic first." },
      { status: 404 },
    );
  }

  return NextResponse.json({ code, role });
}

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const roleError = requireRole(payload!.role, ["admin"]);
  if (roleError) return roleError;

  await connectDB();

  const clinic = await Clinic.findOne({ adminId: payload!.userId })
    .select("inviteCodes")
    .lean();

  return NextResponse.json({
    codes: clinic?.inviteCodes || [],
  });
}
