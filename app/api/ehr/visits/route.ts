/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { authenticate, requireRole } from "@/lib/auth/middleware";
import { visitRecordSchema } from "@/lib/validations/ehr.schema";
import { getVisitRecords, createVisitRecord } from "@/lib/services/ehr.service";

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const patientId =
    payload!.role === "patient"
      ? payload!.userId
      : searchParams.get("patientId");

  if (!patientId) {
    return NextResponse.json(
      { error: "patientId is required" },
      { status: 400 },
    );
  }

  try {
    const records = await getVisitRecords(patientId);
    return NextResponse.json({ records });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  // only doctors can create visit records
  const roleError = requireRole(payload!.role, ["doctor"]);
  if (roleError) return roleError;

  try {
    const body = await req.json();
    const parsed = visitRecordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const record = await createVisitRecord(
      parsed.data,
      payload!.userId,
      payload!.clinicId!,
    );

    return NextResponse.json({ record }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
