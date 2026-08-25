import crypto from "crypto";
import cloudinary from "@/lib/config/cloudinary";
import type { FileKind } from "@/lib/security/fileValidation";
import { AppError } from "@/lib/security/errors";

/**
 * Object storage for patient documents.
 *
 * Two problems with how these were stored before:
 *
 * 1. Uploads were public. Cloudinary's default delivery type serves an
 *    asset to anyone who has the URL, with no reference to who is asking.
 *    A medical document is then one leaked link — a copied URL, a
 *    referrer header, a browser history sync — away from being public.
 *
 * 2. The path was predictable: `carequeue/patients/<patientId>/<type>_<timestamp>`.
 *    Anyone holding a patient id (they appear throughout the API) could
 *    guess document URLs by walking timestamps.
 *
 * Uploads now use Cloudinary's `authenticated` delivery type under a
 * random public id, so the asset is only reachable through a URL signed
 * with the account secret, which the app issues to authorized callers.
 */

export interface StoredAsset {
  publicId: string;
  resourceType: "image" | "raw";
  deliveryType: "authenticated" | "upload";
  bytes: number;
  url: string;
}

function randomId() {
  return crypto.randomBytes(16).toString("hex");
}

export async function uploadMedicalDocument(
  buffer: Buffer,
  { patientId, kind }: { patientId: string; kind: FileKind },
): Promise<StoredAsset> {
  const publicId = `carequeue/patients/${patientId}/${randomId()}`;

  const result = await new Promise<Record<string, unknown>>(
    (resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            public_id: publicId,
            // Pinned from the sniffed bytes, never "auto" — "auto" lets
            // the uploaded content decide how it is stored and served.
            resource_type: kind.resourceType,
            type: "authenticated",
            overwrite: false,
            unique_filename: false,
            use_filename: false,
            // Do not let Cloudinary derive anything from the request.
            invalidate: true,
          },
          (err, uploaded) => {
            if (err || !uploaded) {
              reject(err ?? new Error("Upload failed"));
              return;
            }
            resolve(uploaded as unknown as Record<string, unknown>);
          },
        )
        .end(buffer);
    },
  );

  return {
    publicId: String(result.public_id),
    resourceType: kind.resourceType,
    deliveryType: "authenticated",
    bytes: Number(result.bytes ?? buffer.length),
    url: signedAssetUrl(String(result.public_id), kind.resourceType),
  };
}

export async function uploadAvatar(
  buffer: Buffer,
  { userId, kind }: { userId: string; kind: FileKind },
): Promise<StoredAsset> {
  const result = await new Promise<Record<string, unknown>>(
    (resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "carequeue/avatars",
            public_id: `user_${userId}`,
            resource_type: kind.resourceType,
            overwrite: true, // replace existing avatar
            transformation: [
              { width: 400, height: 400, crop: "fill", gravity: "face" },
              { quality: "auto", fetch_format: "auto" },
            ],
          },
          (err, uploaded) => {
            if (err || !uploaded) {
              reject(err ?? new Error("Upload failed"));
              return;
            }
            resolve(uploaded as unknown as Record<string, unknown>);
          },
        )
        .end(buffer);
    },
  );

  return {
    publicId: String(result.public_id),
    resourceType: kind.resourceType,
    // Avatars stay public: they are shown in the UI and carry no clinical
    // information.
    deliveryType: "upload",
    bytes: Number(result.bytes ?? buffer.length),
    url: String(result.secure_url),
  };
}

/**
 * Builds a signed delivery URL for an authenticated asset.
 *
 * The signature is derived from the account secret, so the URL cannot be
 * forged or guessed. It does not carry an expiry — Cloudinary's expiring
 * URLs need the token-based auth add-on. If that is available on the
 * account, add `auth_token: { duration: 300 }` here and the link becomes
 * short-lived as well.
 */
export function signedAssetUrl(
  publicId: string,
  resourceType: "image" | "raw",
): string {
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: "authenticated",
    sign_url: true,
    secure: true,
  });
}

export async function deleteAsset({
  publicId,
  resourceType,
  deliveryType,
}: {
  publicId: string;
  resourceType: "image" | "raw";
  deliveryType: "authenticated" | "upload";
}) {
  if (!publicId) throw new AppError("Missing asset reference", 400);

  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    type: deliveryType,
    invalidate: true,
  });
}

/**
 * Legacy fallback: documents uploaded before authenticated delivery was
 * introduced stored only a public secure_url and no public id. Their
 * public id is recoverable from the URL path.
 */
export function publicIdFromLegacyUrl(url: string): string | null {
  const marker = "/carequeue/";
  const index = url.indexOf(marker);
  if (index === -1) return null;

  const path = url.slice(index + 1).split("?")[0];
  return path.replace(/\.[^/.]+$/, "");
}
