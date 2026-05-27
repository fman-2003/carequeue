import mongoose, { Schema, Document } from "mongoose";

export interface IAppointment extends Document {
  patientId: mongoose.Types.ObjectId;
  clinicId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  date: Date;
  timeSlot: string;
  reason?: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no-show";
  noShowRisk?: number;
  reminderSent: boolean;
  hasVisitRecord?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    timeSlot: { type: String, required: true },
    reason: { type: String, trim: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "completed", "no-show"],
      default: "pending",
    },
    noShowRisk: { type: Number, min: 0, max: 1 },
    reminderSent: { type: Boolean, default: false },
    hasVisitRecord: { type: Boolean, default: false },
  },  
  { timestamps: true },
);

AppointmentSchema.index({ clinicId: 1, date: 1 });

export default mongoose.models.Appointment ||
  mongoose.model<IAppointment>("Appointment", AppointmentSchema);
