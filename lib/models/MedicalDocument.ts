import mongoose, { Schema, Document } from "mongoose";

export interface IMedicalDocument extends Document {
  patientId: mongoose.Types.ObjectId;
  clinicId: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  appointmentId?: mongoose.Types.ObjectId;
  fileName: string;
  fileType: "lab_result" | "scan" | "referral" | "prescription" | "other";
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  description?: string;
  createdAt: Date;
}

const MedicalDocumentSchema = new Schema<IMedicalDocument>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment" },
    fileName: { type: String, required: true },
    fileType: {
      type: String,
      enum: ["lab_result", "scan", "referral", "prescription", "other"],
      required: true,
    },
    fileUrl: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    description: { type: String },
  },
  { timestamps: true },
);

MedicalDocumentSchema.index({ patientId: 1, createdAt: -1 });

export default mongoose.models.MedicalDocument ||
  mongoose.model<IMedicalDocument>("MedicalDocument", MedicalDocumentSchema);
