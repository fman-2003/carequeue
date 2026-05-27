import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import Clinic from "@/lib/models/Clinic";

export async function GET(req: NextRequest) {
  const { error } = authenticate(req);
  if (error) return error;

  await connectDB();

  const clinics = await Clinic.find({ isActive: true })
    .select("_id name address state lga")
    .lean();

  return NextResponse.json({ clinics });
}
