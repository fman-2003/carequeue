/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/middleware";
import { medicalProfileSchema } from "@/lib/validations/ehr.schema";
import {
  getMedicalProfile,
  upsertMedicalProfile,
} from "@/lib/services/ehr.service";

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
    const profile = await getMedicalProfile(patientId);
    return NextResponse.json({ profile });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  try {
    const body = await req.json();
    const parsed = medicalProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const patientId =
      payload!.role === "patient" ? payload!.userId : body.patientId;

    if (!patientId) {
      return NextResponse.json(
        { error: "patientId is required" },
        { status: 400 },
      );
    }

    const profile = await upsertMedicalProfile(
      patientId,
      payload!.clinicId!,
      parsed.data,
    );

    return NextResponse.json({ profile });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
