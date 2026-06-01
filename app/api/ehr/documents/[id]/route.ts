import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth/middleware";
import cloudinary from "@/lib/config/cloudinary";
import MedicalDocument from "@/lib/models/MedicalDocument";
import { connectDB } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const { id } = await params;

  await connectDB();

  // fetch first to get the cloudinary URL before deleting
  const doc = await MedicalDocument.findOne({
    _id: id,
    uploadedBy: payload!.userId,
  });

  if (!doc) {
    return NextResponse.json(
      { error: "Document not found or access denied" },
      { status: 404 },
    );
  }

  /**
   * Delete from Cloudinary first, then from DB.
   * Extract public_id from the URL — Cloudinary needs
   * this to identify which file to delete.
   * URL format: .../carequeue/patients/[id]/filename
   * public_id is everything after the version number.
   */
  try {
    const urlParts = doc.fileUrl.split("/");
    const publicIdWithExtension = urlParts
      .slice(urlParts.indexOf("carequeue"))
      .join("/");
    const publicId = publicIdWithExtension.replace(/\.[^/.]+$/, "");

    await cloudinary.uploader.destroy(publicId, {
      resource_type: doc.mimeType.startsWith("image") ? "image" : "raw",
    });
  } catch {
    // log but don't block DB deletion
    console.error("Cloudinary delete failed for:", doc.fileUrl);
  }

  await MedicalDocument.findByIdAndDelete(id);

  return NextResponse.json({ message: "Document deleted" });
}
