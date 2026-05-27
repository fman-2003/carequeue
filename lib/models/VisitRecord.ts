import mongoose, { Schema, Document } from "mongoose";

export interface IVisitRecord extends Document {
  appointmentId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  clinicId: mongoose.Types.ObjectId;
  vitals?: {
    bloodPressure?: string; // "120/80"
    temperature?: number; // celsius
    pulseRate?: number; // bpm
    respiratoryRate?: number; // breaths per minute
    oxygenSaturation?: number; // percentage
    weight?: number; // kg
    height?: number; // cm
  };
  chiefComplaint: string;
  diagnosis: string;
  clinicalNotes: string;
  treatmentPlan: string;
  prescriptions: {
    medication: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string; // for example "take after meal"
  }[];
  labTestsOrdered: string[];
  followUpDate?: Date;
  referral?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VisitRecordSchema = new Schema<IVisitRecord>(
  {
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      unique: true,
    },
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true },

    vitals: {
      bloodPressure: { type: String },
      temperature: { type: Number },
      pulseRate: { type: Number },
      respiratoryRate: { type: Number },
      oxygenSaturation: { type: Number },
      weight: { type: Number },
      height: { type: Number },
    },
    chiefComplaint: { type: String, required: true },
    diagnosis: { type: String, required: true },
    clinicalNotes: { type: String, required: true },
    treatmentPlan: { type: String, required: true },
    prescriptions: {
      type: [
        {
          medication: { type: String, required: true },
          dosage: { type: String, required: true },
          frequency: { type: String, required: true },
          duration: { type: String, required: true },
          instructions: { type: String },
        },
      ],
      default: [],
    },
    labTestsOrdered: { type: [String], default: [] },
    followUpDate: { type: Date },
    referral: { type: String },
  },
  { timestamps: true },
);

VisitRecordSchema.index({ patientId: 1, createdAt: -1 });
VisitRecordSchema.index({ appointmentId: 1 });

export default mongoose.models.VisitRecord ||
  mongoose.model<IVisitRecord>("VisitRecord", VisitRecordSchema);
