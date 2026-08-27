import { connectDB } from "@/lib/db";
import MedicalProfile from "@/lib/models/MedicalProfile";
import VisitRecord from "@/lib/models/VisitRecord";
import MedicalDocument from "@/lib/models/MedicalDocument";
import Appointment from "@/lib/models/Appointment";
import { AppError } from "@/lib/security/errors";
import {
  MedicalProfileInput,
  VisitRecordInput,
  UpdateVisitRecordInput,
} from "@/lib/validations/ehr.schema";

/**
 * These functions assume the caller has already been authorized against
 * the patient — see lib/auth/access.ts. They do not re-derive access,
 * so every route that reaches them must resolve the patient first.
 */

// MEDICAL PROFILE
export async function getMedicalProfile(patientId: string) {
  await connectDB();

  return await MedicalProfile.findOne({ patientId }).lean();
}

export async function upsertMedicalProfile(
  patientId: string,
  clinicId: string,
  data: MedicalProfileInput,
) {
  await connectDB();

  return await MedicalProfile.findOneAndUpdate(
    { patientId },
    // patientId and clinicId are set from the server's own values on
    // insert; `data` has already been through the schema, so it cannot
    // carry either field.
    { $set: { ...data, clinicId }, $setOnInsert: { patientId } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

// VISIT RECORDS
export async function getVisitRecords(patientId: string) {
  await connectDB();

  return await VisitRecord.find({ patientId })
    .populate("doctorId", "name")
    .populate("appointmentId", "date timeSlot")
    .sort({ createdAt: -1 })
    .lean();
}

export async function getVisitRecordByAppointment(appointmentId: string) {
  await connectDB();
  return await VisitRecord.findOne({ appointmentId })
    .populate("doctorId", "name")
    .lean();
}

export async function createVisitRecord(
  data: VisitRecordInput,
  doctorId: string,
  clinicId: string,
) {
  await connectDB();

  /**
   * The appointment must be this doctor's and already completed. This is
   * also what ties the record to a real clinical encounter rather than
   * letting a doctor write notes against an arbitrary appointment id.
   */
  const appointment = await Appointment.findOne({
    _id: data.appointmentId,
    doctorId,
    status: "completed",
  });

  if (!appointment) {
    throw new AppError(
      "Appointment not found, not yours, or not yet completed",
      404,
    );
  }

  // The record's patient must be the appointment's patient — otherwise a
  // valid appointment could be used to file notes on a third party.
  if (appointment.patientId.toString() !== data.patientId) {
    throw new AppError(
      "This patient is not the patient on the appointment",
      400,
    );
  }

  const existing = await VisitRecord.findOne({
    appointmentId: data.appointmentId,
  });
  if (existing) {
    throw new AppError(
      "A visit record already exists for this appointment",
      409,
    );
  }

  return await VisitRecord.create({
    ...data,
    doctorId,
    clinicId,
    patientId: data.patientId,
    followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
  });
}

export async function updateVisitRecord(
  appointmentId: string,
  doctorId: string,
  data: UpdateVisitRecordInput,
) {
  await connectDB();

  // Scoped to the authoring doctor: one clinician cannot rewrite
  // another's clinical notes.
  const record = await VisitRecord.findOneAndUpdate(
    { appointmentId, doctorId },
    {
      $set: {
        ...data,
        ...(data.followUpDate
          ? { followUpDate: new Date(data.followUpDate) }
          : {}),
      },
    },
    { new: true, runValidators: true },
  );

  if (!record) {
    throw new AppError("Visit record not found or access denied", 404);
  }

  return record;
}

// MEDICAL DOCUMENTS
export async function getMedicalDocuments(patientId: string) {
  await connectDB();
  return await MedicalDocument.find({ patientId })
    .populate("uploadedBy", "name role")
    .sort({ createdAt: -1 })
    .lean();
}
