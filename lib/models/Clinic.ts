import mongoose, { Schema, Document } from "mongoose";

export interface IClinic extends Document {
  name: string;
  address: string;
  phone: string;
  email: string;
  state: string; // e.g. "Kwara", "Lagos"
  lga: string; // Local Government Area
  openingTime: string; // e.g. "08:00"
  closingTime: string; // e.g. "17:00"
  slotDurationMinutes: number; // how long each appointment slot is
  workingDays: number[]; // 0=Sun, 1=Mon ... 6=Sat e.g. [1,2,3,4,5]
  adminId: mongoose.Types.ObjectId; // the user who owns/manages this clinic
  isActive: boolean;
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
  },
  { timestamps: true },
);

export default mongoose.models.Clinic ||
  mongoose.model<IClinic>("Clinic", ClinicSchema);
