import Appointment from "@/lib/models/Appointment";
import { minutesToTime } from "./helper";
import { connectDB } from "@/lib/db";

interface GenerateSlotsParams {
  openingTime: string; // "08:00"
  closingTime: string; // "17:00"
  slotDurationMinutes: number; // 30
}

interface AvailableSlot {
  timeSlot: string; // "08:00 - 08:30"
  available: boolean;
}

// generate all timeslots for clinics
export function generateAllSlots({
  openingTime,
  closingTime,
  slotDurationMinutes,
}: GenerateSlotsParams): string[] {
  const slots: string[] = [];

  // conversion of time to minutes for simpler arithmetic operation
  const [openHour, openMin] = openingTime.split(":").map(Number);
  const [closeHour, closeMin] = closingTime.split(":").map(Number);

  const openingMinutes = openHour * 60 + openMin;
  const closingMinutes = closeHour * 60 + closeMin;

  let current = openingMinutes;

  while (current + slotDurationMinutes <= closingMinutes) {
    const slotEnd = current + slotDurationMinutes;

    // convert minutes back to time format
    const startStr = minutesToTime(current);
    const endStr = minutesToTime(slotEnd);

    slots.push(`${startStr} - ${endStr}`);

    current = slotEnd;
  }

  return slots;
}

// get available slots for clinics
export async function getAvailableSlots({
  clinicId,
  doctorId,
  date,
  openingTime,
  closingTime,
  slotDurationMinutes,
}: GenerateSlotsParams & {
  clinicId: string;
  doctorId: string;
  date: string;
}) {
  await connectDB();

  // generate every possible slot for the day
  const allSlots = generateAllSlots({
    openingTime,
    closingTime,
    slotDurationMinutes,
  });

  const existingBookings = await Appointment.find({
    clinicId,
    doctorId,
    date: new Date(date),
    status: "confirmed",
  })
    .select("timeSlot")
    .lean();

  // a Set is used for booked slots
  const bookedSlots = new Set(existingBookings.map((a) => a.timeSlot));

  const slots: AvailableSlot[] = allSlots.map((slot) => ({
    timeSlot: slot,
    available: !bookedSlots.has(slot),
  }));

  return slots;
}
