/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/middleware";
import { getClinic } from "@/lib/services/clinic.service";
import { getAvailableSlots } from "@/lib/utils/generateSlots";
import { isWorkingDay } from "@/lib/utils/helper";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { error } = authenticate(req);
  if (error) return error;

  // await params before accessing id
  const { id } = await params;
  // Expected query params:
  // api/clinics/:id/slots?doctorId=xxx&date=xxx
  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId");
  const date = searchParams.get("date");

  if (!doctorId || !date) {
    return NextResponse.json(
      { error: "doctorId and date are required query params" },
      { status: 400 },
    );
  }

  try {
    // fetching clinic to get opening, closing time and slot duration
    const clinic = await getClinic(id);

    if (!isWorkingDay(date, clinic.workingDays)) {
      return NextResponse.json(
        { error: "The clinic does not operate on this day" },
        { status: 400 },
      );
    }

    const slots = await getAvailableSlots({
      clinicId: id,
      doctorId,
      date,
      openingTime: clinic.openingTime,
      closingTime: clinic.closingTime,
      slotDurationMinutes: clinic.slotDurationMinutes,
    });

    console.log("_________available slots____________", slots)
    return NextResponse.json({ slots });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
