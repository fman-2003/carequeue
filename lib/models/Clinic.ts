import mongoose, { Schema, Document } from "mongoose";

export interface IClinic extends Document {
  name: string;
  address: string;
  phone: string;
  email: string;
  state: string;
  lga: string;
  openingTime: string;
  closingTime: string;
  slotDurationMinutes: number;
  workingDays: number[];
  adminId: mongoose.Types.ObjectId;
  isActive: boolean;
  inviteCodes: {
    code: string;
    role: "doctor" | "receptionist";
    usedBy: mongoose.Types.ObjectId | null;
    expiresAt?: Date;
    isUsed: boolean;
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const ClinicSchema = new Schema<IClinic>(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    state: { type: String, required: true },
    lga: { type: String, required: true },
    openingTime: { type: String, required: true, default: "08:00" },
    closingTime: { type: String, required: true, default: "17:00" },
    slotDurationMinutes: { type: Number, required: true, default: 30 },
    workingDays: { type: [Number], default: [1, 2, 3, 4, 5] },
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true },
    inviteCodes: {
      type: [
        {
          code: { type: String, required: true, unique: true },
          role: {
            type: String,
            enum: ["doctor", "receptionist"],
            required: true,
          },
          usedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
          isUsed: { type: Boolean, default: false },
          // Unredeemed codes stop working after their window; see
          // clinics/invite. Undefined means a code issued before expiry
          // existed, which signupUser treats as still valid.
          expiresAt: { type: Date },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

export default mongoose.models.Clinic ||
  mongoose.model<IClinic>("Clinic", ClinicSchema);
