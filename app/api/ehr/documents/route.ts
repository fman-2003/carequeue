import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  assertSameOrigin,
  requireClinic,
} from "@/lib/auth/middleware";
import { resolvePatientAccess } from "@/lib/auth/access";
import { connectDB } from "@/lib/db";
import MedicalDocument from "@/lib/models/MedicalDocument";
import { documentUploadSchema } from "@/lib/validations/ehr.schema";
import { validateMedicalDocument } from "@/lib/security/fileValidation";
import {
  uploadMedicalDocument,
  signedAssetUrl,
} from "@/lib/services/storage.service";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { handleServiceError } from "@/lib/security/errors";

interface StoredDocument {
  publicId?: string;
  resourceType?: "image" | "raw";
  fileUrl: string;
}

/** Swaps the stored handle for a freshly signed, short-lived delivery URL. */
function withDeliveryUrl<T extends StoredDocument>(doc: T) {
  if (doc.publicId) {
    return {
      ...doc,
      fileUrl: signedAssetUrl(doc.publicId, doc.resourceType ?? "raw"),
    };
  }
  // Legacy document stored before authenticated delivery existed.
  return doc;
}

export async function GET(req: NextRequest) {
  const { payload, error } = authenticate(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);

  /**
   * Previously any signed-in account that was not a patient could pass
   * `?patientId=` for anyone in the system — including patients at other
   * clinics — and receive their lab results and scans. Access is now
   * proven against the caller's identity and clinic.
   */
  const access = await resolvePatientAccess(
    payload,
    searchParams.get("patientId"),
  );
  if (access.error) return access.error;

  try {
    await connectDB();

    const documents = await MedicalDocument.find({
      patientId: access.patientId,
    })
      .populate("uploadedBy", "name role")
      .sort({ createdAt: -1 })
      .lean<StoredDocument[]>();

    return NextResponse.json({ documents: documents.map(withDeliveryUrl) });
  } catch (err) {
    return handleServiceError("ehr/documents GET", err, 500);
  }
}

export async function POST(req: NextRequest) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const { payload, error } = authenticate(req);
  if (error) return error;

  const limited = enforceRateLimit(
    req,
    "document-upload",
    RATE_LIMITS.upload,
    payload.userId,
  );
  if (limited) return limited;

  const { clinicId, error: clinicError } = requireClinic(payload);
  if (clinicError) return clinicError;

  try {
    const formData = await req.formData();

    const parsed = documentUploadSchema.safeParse({
      patientId: formData.get("patientId"),
      fileType: formData.get("fileType"),
      description: formData.get("description") || undefined,
      appointmentId: formData.get("appointmentId") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    /**
     * The upload used to accept any patientId with no check at all, so
     * one patient could file documents onto another patient's chart.
     */
    const access = await resolvePatientAccess(payload, parsed.data.patientId);
    if (access.error) return access.error;

    // Size, declared type, and actual file signature are all checked
    // before a single byte reaches Cloudinary.
    const file = await validateMedicalDocument(formData.get("file"));

    const stored = await uploadMedicalDocument(file.buffer, {
      patientId: access.patientId,
      kind: file.kind,
    });

    await connectDB();

    const document = await MedicalDocument.create({
      patientId: access.patientId,
      clinicId,
      uploadedBy: payload.userId,
      appointmentId: parsed.data.appointmentId || undefined,
      fileName: file.safeName,
      fileType: parsed.data.fileType,
      fileUrl: stored.url,
      publicId: stored.publicId,
      resourceType: stored.resourceType,
      deliveryType: stored.deliveryType,
      // Recorded from the sniffed bytes, not from the browser's claim.
      fileSize: file.size,
      mimeType: file.kind.mime,
      description: parsed.data.description || undefined,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    return handleServiceError("ehr/documents POST", err, 400);
  }
}
