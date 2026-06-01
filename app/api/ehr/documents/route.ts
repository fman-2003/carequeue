/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import MedicalDocument from "@/lib/models/MedicalDocument";
import cloudinary from "@/lib/config/cloudinary";

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  await connectDB();

  const { searchParams } = new URL(req.url);

  // patients fetch their own docs
  // doctors fetch specific patient documents via ?patientId= query param.
  const patientId =
    payload!.role === "patient"
      ? payload!.userId
      : searchParams.get("patientId");

  if (!patientId) {
    return NextResponse.json(
      { error: "patientId is required" },
      { status: 400 },
    );
  }

  const documents = await MedicalDocument.find({ patientId })
    .populate("uploadedBy", "name role")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ documents });
}

export async function POST(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const patientId = formData.get("patientId") as string;
    const fileType = formData.get("fileType") as string;
    const description = formData.get("description") as string | null;
    const appointmentId = formData.get("appointmentId") as string | null;

    if (!file || !patientId || !fileType) {
      return NextResponse.json(
        { error: "file, patientId and fileType are required" },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    /**
     * Upload to Cloudinary.
     * We use upload_stream for buffer uploads.
     * folder organises files in Cloudinary dashboard.
     * resource_type 'auto' handles both PDFs and images.
     */
    const uploadResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: `carequeue/patients/${patientId}`,
            resource_type: "auto",
            public_id: `${fileType}_${Date.now()}`,
            // unique_filename: false, // we generate our own unique filename using timestamp,
          },
          (err, result) => {
            if (err) reject(err);
            else resolve(result);
          },
        )
        .end(buffer);
    });

    await connectDB();

    const document = await MedicalDocument.create({
      patientId,
      clinicId: payload!.clinicId,
      uploadedBy: payload!.userId,
      appointmentId: appointmentId || undefined,
      fileName: file.name,
      fileType,
      fileUrl: uploadResult.secure_url,
      fileSize: file.size,
      mimeType: file.type,
      description: description || undefined,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
