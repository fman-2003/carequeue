/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Waitlist from "@/lib/models/Waitlist";
import Appointment from "@/lib/models/Appointment";
import User from "@/lib/models/User";
import Clinic from "@/lib/models/Clinic";
import { sendWhatsAppMessage } from "@/lib/notifications/whatsapp";
import { notificationTemplates } from "@/lib/notifications/templates";

export async function joinWaitlist(appointmentId: string, patientId: string) {
  await connectDB();

  const appointment = await Appointment.findOne({
    _id: appointmentId,
    patientId,
    status: "confirmed",
  });

  if (!appointment) {
    throw new Error(
      "Appointment not found or is not confirmed. Only confirmed appointments can be added to the waitlist.",
    );
  }

  const existing = await Waitlist.findOne({
    appointmentId,
    patientId,
    status: { $in: ["waiting", "notified"] },
  });

  if (existing) {
    throw new Error("You are already on the waitlist for this appointment.");
  }

  const position =
    (await Waitlist.countDocuments({
      doctorId: appointment.doctorId,
      status: { $in: ["waiting", "notified"] },
    })) + 1;

  const entry = await Waitlist.create({
    patientId: appointment.patientId,
    clinicId: appointment.clinicId,
    doctorId: appointment.doctorId,
    appointmentId: appointment._id,
    date: appointment.date,
    timeSlot: appointment.timeSlot,
    position,
    status: "waiting",
  });

  // notify patient they joined the waitlist
  const [patient, doctor] = await Promise.all([
    User.findById(patientId).lean(),
    User.findById(appointment.doctorId).lean(),
  ]);

  if (patient?.phone) {
    const notification = notificationTemplates.waitlistJoined(
      patient.name,
      doctor.name,
      position,
    );
    await sendWhatsAppMessage({
      to: patient.phone,
      message: notification.message,
      buttons: notification.buttons,
    });
  }

  return entry;
}

export async function triggerWaitlist(
  clinicId: string,
  doctorId: string,
  freedDate: Date,
  freedTimeSlot: string,
) {
  await connectDB();

  function slotToMinutes(slot: string): number {
    const start = slot.split(" - ")[0];
    const [h, m] = start.split(":").map(Number);
    return h * 60 + m;
  }

  /**
   * Build a full comparable datetime for the freed slot.
   * We combine the freed date with the slot's start time
   * into a single Date object for accurate comparison.
   */
  function buildSlotDateTime(date: Date, slot: string): Date {
    const minutes = slotToMinutes(slot);
    const slotDate = new Date(date);
    slotDate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return slotDate;
  }

  const freedSlotDateTime = buildSlotDateTime(freedDate, freedTimeSlot);

  const waitingCandidates = await Waitlist.find({
    clinicId,
    doctorId: new mongoose.Types.ObjectId(doctorId),
    status: "waiting",
  })
    .sort({ position: 1 })
    .lean();

  const next = waitingCandidates.find((entry) => {
    if (!entry.timeSlot || !entry.date) return false;
    const entryDateTime = buildSlotDateTime(
      new Date(entry.date),
      entry.timeSlot,
    );
    return entryDateTime.getTime() > freedSlotDateTime.getTime();
  });

  // The candidate document holds patient identifiers, so only the
  // outcome is logged, not the record.
  console.log(
    `Waitlist: slot freed at ${freedSlotDateTime}; ${next ? "offering to next candidate" : "no candidate waiting"}`,
  );

  if (!next) return null;

  const notifiedAt = new Date();
  const expiresAt = new Date(notifiedAt.getTime() + 45 * 60 * 1000);

  await Waitlist.findByIdAndUpdate(next._id, {
    status: "notified",
    notifiedAt,
    expiresAt,
    offeredDate: freedDate,
    offeredTimeSlot: freedTimeSlot,
  });

  const [patient, doctor, clinic] = await Promise.all([
    User.findById(next.patientId).lean(),
    User.findById(next.doctorId).lean(),
    Clinic.findById(clinicId).lean(),
  ]);

  if (patient?.phone && clinic) {
    const notification = notificationTemplates.waitlistNotification(
      patient.name,
      doctor?.name,
      new Date(freedDate).toDateString(),
      freedTimeSlot,
      clinic.name,
      next._id.toString(),
    );
    await sendWhatsAppMessage({
      to: patient.phone,
      message: notification.message,
      buttons: notification.buttons,
    });
  }

  return next;
}

export async function respondToWaitlist(
  waitlistId: string,
  patientId: string,
  response: "ACCEPT" | "DECLINE",
) {
  await connectDB();

  const entry = await Waitlist.findOne({ _id: waitlistId, patientId });
  if (!entry) throw new Error("Waitlist entry not found");

  if (entry.status !== "notified") {
    throw new Error("This offer is no longer active");
  }

  // check if 45 min window has passed
  if (entry.expiresAt && new Date() > entry.expiresAt) {
    await Waitlist.findByIdAndUpdate(waitlistId, { status: "expired" });

    if (!entry.offeredDate || !entry.offeredTimeSlot) {
      console.error(
        "Waitlist entry missing offeredDate or offeredTimeSlot:",
        entry._id,
      );
      return { message: "Offer processed but could not notify next patient." };
    }

    await triggerWaitlist(
      entry.clinicId.toString(),
      entry.doctorId.toString(),
      entry.offeredDate,
      entry.offeredTimeSlot,
    );

    throw new Error(
      "Your offer has expired. We have moved to the next patient.",
    );
  }

  if (response === "DECLINE") {
    await Waitlist.findByIdAndUpdate(waitlistId, { status: "declined" });

    await triggerWaitlist(
      entry.clinicId.toString(),
      entry.doctorId.toString(),
      entry.offeredDate, // ✅ freed slot date
      entry.offeredTimeSlot, // ✅ freed slot timeslot
    );

    return { message: "You have declined the slot." };
  }

  if (response === "ACCEPT") {
    // conflict check on the offered slot
    const conflict = await Appointment.findOne({
      doctorId: entry.doctorId,
      date: entry.offeredDate,
      timeSlot: entry.offeredTimeSlot,
      status: { $nin: ["cancelled"] },
    });

    if (conflict) {
      await Waitlist.findByIdAndUpdate(waitlistId, { status: "waiting" });
      throw new Error(
        "Sorry, this slot was just taken. We will find the next available.",
      );
    }

    // create appointment for the freed earlier slot
    const newAppointment = await Appointment.create({
      patientId: entry.patientId,
      clinicId: entry.clinicId,
      doctorId: entry.doctorId,
      date: entry.offeredDate,
      timeSlot: entry.offeredTimeSlot,
      status: "confirmed",
    });

    // cancel the patient original later appointment
    const originalAppointment = await Appointment.findById(entry.appointmentId);

    if (originalAppointment) {
      await Appointment.findByIdAndUpdate(entry.appointmentId, {
        status: "cancelled",
      });

      // trigger waitlist for the new freed original slot
      await triggerWaitlist(
        originalAppointment.clinicId.toString(),
        originalAppointment.doctorId.toString(),
        originalAppointment.date,
        originalAppointment.timeSlot,
      );
    }

    // change waitlist entry status to accepted
    await Waitlist.findByIdAndUpdate(waitlistId, { status: "accepted" });

    const patient = await User.findById(entry.patientId).lean();
    const clinic = await Clinic.findById(entry.clinicId).lean();

    if (patient?.phone && clinic) {
      const notification = notificationTemplates.appointmentConfirmedByDoctor(
        patient.name,
        new Date(entry.offeredDate).toDateString(),
        entry.offeredTimeSlot,
        clinic.name,
        newAppointment._id.toString(),
      );
      await sendWhatsAppMessage({
        to: patient.phone,
        message: notification.message,
        buttons: notification.buttons,
      });
    }

    return { message: "Appointment confirmed!", appointment: newAppointment };
  }
}

export async function getWaitlist(
  clinicId: string,
  patientId?: string,
  doctorId?: string,
) {
  await connectDB();

  const filter: Record<string, any> = {
    clinicId,
    status: { $in: ["waiting", "notified"] },
  };

  // scope patient, patients only see their own entries
  if (patientId) filter.patientId = patientId;

  // scope doctor
  if (doctorId) filter.doctorId = doctorId;

  return await Waitlist.find(filter)
    .populate("patientId", "name phone")
    .populate("doctorId", "name")
    .sort({ position: 1 })
    .lean();
}
