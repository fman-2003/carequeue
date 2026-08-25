import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  requireClinic,
  isValidObjectId,
  badRequest,
  forbidden,
} from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { getClinic } from "@/lib/services/clinic.service";
import { getAvailableSlots } from "@/lib/utils/generateSlots";
import { isWorkingDay } from "@/lib/utils/helper";
import { handleServiceError } from "@/lib/security/errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const { id } = await params;
  if (!isValidObjectId(id)) return badRequest("Invalid clinic id");

  const { clinicId, error: clinicError } = requireClinic(payload);
  if (clinicError) return clinicError;

  // A caller may only read the calendar of the clinic they belong to.
  // Previously any clinic id worked, exposing every clinic's doctor
  // schedule and booked-slot pattern.
  if (id !== clinicId) {
    return forbidden("You can only view availability for your own clinic");
  }

  const { searchParams } = new URL(req.url);
  const doctorId = searchParams.get("doctorId");
  const date = searchParams.get("date");

  if (!isValidObjectId(doctorId)) {
    return badRequest("A valid doctorId is required");
  }

  // Guards the Date parsing in isWorkingDay/getAvailableSlots.
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return badRequest("date is required in YYYY-MM-DD format");
  }

  try {
    await connectDB();

    const doctorInClinic = await User.exists({
      _id: doctorId,
      role: "doctor",
      clinicId,
    });

    if (!doctorInClinic) {
      return NextResponse.json(
        { error: "Doctor not found at this clinic" },
        { status: 404 },
      );
    }

    // fetching clinic to get opening, closing time and slot duration
    const clinic = await getClinic(id);

    if (!isWorkingDay(date, clinic.workingDays)) {
      return badRequest("The clinic does not operate on this day");
    }

    const slots = await getAvailableSlots({
      clinicId: id,
      doctorId,
      date,
      openingTime: clinic.openingTime,
      closingTime: clinic.closingTime,
      slotDurationMinutes: clinic.slotDurationMinutes,
    });

    return NextResponse.json({ slots });
  } catch (err) {
    return handleServiceError("clinics/[id]/slots GET", err, 500);
  }
}
