import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  assertSameOrigin,
  isValidObjectId,
  badRequest,
  notFound,
} from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db";
import MedicalDocument from "@/lib/models/MedicalDocument";
import {
  deleteAsset,
  publicIdFromLegacyUrl,
} from "@/lib/services/storage.service";
import { handleServiceError } from "@/lib/security/errors";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const { payload, error } = authenticate(req);
  if (error) return error;

  const { id } = await params;

  // Rejects `{"$ne": null}`-style values and keeps a malformed id from
  // surfacing as a cast error.
  if (!isValidObjectId(id)) return badRequest("Invalid document id");

  try {
    await connectDB();

    // Deletion stays limited to whoever uploaded the document — a doctor
    // cannot remove a record another clinician filed.
    const doc = await MedicalDocument.findOne({
      _id: id,
      uploadedBy: payload.userId,
    });

    if (!doc) {
      return notFound("Document not found or access denied");
    }

    try {
      const publicId: string | undefined =
        doc.publicId ?? publicIdFromLegacyUrl(doc.fileUrl) ?? undefined;

      if (publicId) {
        await deleteAsset({
          publicId,
          resourceType:
            doc.resourceType ??
            (doc.mimeType?.startsWith("image") ? "image" : "raw"),
          deliveryType: doc.deliveryType ?? "upload",
        });
      }
    } catch (cloudinaryError) {
      // Logged, but the database row is still removed so the document
      // stops being reachable through the app.
      console.error(
        "[ehr/documents DELETE] Cloudinary delete failed",
        cloudinaryError,
      );
    }

    await MedicalDocument.deleteOne({ _id: id, uploadedBy: payload.userId });

    return NextResponse.json({ message: "Document deleted" });
  } catch (err) {
    return handleServiceError("ehr/documents/[id] DELETE", err, 500);
  }
}
