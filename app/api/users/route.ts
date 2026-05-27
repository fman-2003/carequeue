/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  await connectDB();
console.log("Payload in GET /api/users:", payload);
  try {
    // if (!payload.clinicId) {
    //   return NextResponse.json({ error: "Clinic not found" }, { status: 400 });
    // }
    if (payload!.role === "patient") {
      const [doctors, patient] = await Promise.all([
        User.find({ clinicId: payload?.clinicId, role: "doctor" })
          .select("_id name clinicId")
          .lean(),
        User.findOne({
          _id: payload!.userId,
          clinicId: payload?.clinicId,
          role: "patient",
        })
          .select("_id name")
          .lean(),
      ]);

      // serialize ObjectIds to plain strings
      const serializedDoctors = doctors.map((d) => ({
        ...d,
        _id: d._id.toString(),
        clinicId: d.clinicId?.toString(),
      }));

      const serializedPatient = { ...patient, _id: patient?._id.toString() };

      return NextResponse.json({
        doctors: serializedDoctors,
        patient: [serializedPatient],
      });
    }

    const [doctors, patients] = await Promise.all([
      User.find({ clinicId: payload?.clinicId, role: "doctor" })
        .select("_id name clinicId")
        .lean(),
      User.find({ clinicId: payload?.clinicId, role: "patient" })
        .select("_id name")
        .lean(),
    ]);

    // serialize ObjectIds to plain strings
    const serializedDoctors = doctors.map((d) => ({
      ...d,
      _id: d._id.toString(),
      clinicId: d.clinicId?.toString(),
    }));

    const serializedPatients = patients.map((p) => ({
      ...p,
      _id: p._id.toString(),
    }));

    return NextResponse.json({
      doctors: serializedDoctors,
      patients: serializedPatients,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
