import mongoose, { Schema, Document } from "mongoose";

export interface IMedicalProfile extends Document {
  patientId: mongoose.Types.ObjectId;
  clinicId: mongoose.Types.ObjectId;
  bloodGroup?: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
  genotype?: "AA" | "AS" | "SS" | "AC" | "SC";
  dateOfBirth?: Date;
  gender?: "male" | "female";
  height?: number;
  weight?: number;
  allergies: string[];
  chronicConditions: string[];
  currentMedications: {
    name: string;
    dosage: string;
    frequency: string;
  }[];
  pastSurgeries: string[];
  familyHistory: string[];
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  insuranceProvider?: string;
  insuranceNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MedicalProfileSchema = new Schema<IMedicalProfile>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
    },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    },
    genotype: {
      type: String,
      enum: ["AA", "AS", "SS", "AC", "SC"],
    },
    dateOfBirth: { type: Date },
    gender: {
      type: String,
      enum: ["male", "female"],
    },
    height: { type: Number, min: 0 },
    weight: { type: Number, min: 0 },
    allergies: { type: [String], default: [] },
    chronicConditions: { type: [String], default: [] },
    currentMedications: {
      type: [
        {
          name: { type: String, required: true },
          dosage: { type: String, required: true },
          frequency: { type: String, required: true },
        },
      ],
      default: [],
    },
    pastSurgeries: { type: [String], default: [] },
    familyHistory: { type: [String], default: [] },
    emergencyContact: {
      name: { type: String },
      relationship: { type: String },
      phone: { type: String },
    },
    insuranceProvider: { type: String },
    insuranceNumber: { type: String },
  },
  { timestamps: true },
);

MedicalProfileSchema.index({ patientId: 1 });

export default mongoose.models.MedicalProfile ||
  mongoose.model<IMedicalProfile>("MedicalProfile", MedicalProfileSchema);
