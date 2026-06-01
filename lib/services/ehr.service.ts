import { connectDB } from "@/lib/db";
import MedicalProfile from "@/lib/models/MedicalProfile";
import VisitRecord from "@/lib/models/VisitRecord";
import MedicalDocument from "@/lib/models/MedicalDocument";
import Appointment from "@/lib/models/Appointment";
import {
  MedicalProfileInput,
  VisitRecordInput,
} from "@/lib/validations/ehr.schema";

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
    { $set: { ...data, clinicId } },
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

  const appointment = await Appointment.findOne({
    _id: data.appointmentId,
    doctorId,
    status: "completed",
  });

  if (!appointment) {
    throw new Error("Appointment not found, not yours, or not yet completed");
  }

  const existing = await VisitRecord.findOne({
    appointmentId: data.appointmentId,
  });
  if (existing) {
    throw new Error("A visit record already exists for this appointment");
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
  data: Partial<VisitRecordInput>,
) {
  await connectDB();

  const record = await VisitRecord.findOneAndUpdate(
    { appointmentId, doctorId },
    { $set: data },
    { new: true },
  );

  if (!record) {
    throw new Error("Visit record not found or access denied");
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

export async function createMedicalDocument(data: {
  patientId: string;
  clinicId: string;
  uploadedBy: string;
  appointmentId?: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  description?: string;
}) {
  await connectDB();
  return await MedicalDocument.create(data);
}
