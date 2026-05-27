/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDB } from "@/lib/db";
import Clinic from "@/lib/models/Clinic";
import User from "@/lib/models/User";
import {
  CreateClinicInput,
  UpdateClinicInput,
} from "@/lib/validations/clinic.schema";

export async function createClinic(data: CreateClinicInput, adminId: string) {
  await connectDB();
  
  try {
    const existing = await Clinic.findOne({ email: data.email });
    if (existing) throw new Error("A clinic with this email already exists");

    const clinic = await Clinic.create({ ...data, adminId });
    await User.findByIdAndUpdate(adminId, { clinicId: clinic._id })
    return clinic;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function getClinic(id: string) {
  await connectDB();
  
  try {
    const clinic = await Clinic.findById(id).lean();
    if (!clinic) throw new Error("Clinic not found");
    return clinic;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function updateClinic(
  id: string,
  adminId: string,
  data: UpdateClinicInput,
) {
  await connectDB();
  
  try {
    // it is necessary to check if the clinic exists and belongs to the admin before updating
    // if not, an admin might be able to mutate another clinic's data
    const clinic = await Clinic.findOneAndUpdate(
      { _id: id, adminId },
      { $set: data },
      { new: true },
    );

    if (!clinic)
      throw new Error("Clinic not found or you do not have permission");
    return clinic;
  } catch (error: any) {
    throw new Error(error.message);
  }
}
