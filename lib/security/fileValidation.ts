import { AppError } from "@/lib/security/errors";

/**
 * Upload validation.
 *
 * `file.type` and `file.name` come from the browser and are trivially
 * forged — an attacker can label an HTML page as `image/png` and, if it
 * is ever served back from a host the app trusts, get script execution.
 * So the declared type is only a first filter; the bytes decide.
 */

export interface FileKind {
  mime: string;
  extension: string;
  /** How Cloudinary should store and transform it. */
  resourceType: "image" | "raw";
}

const IMAGE_KINDS: Record<string, FileKind> = {
  "image/jpeg": { mime: "image/jpeg", extension: "jpg", resourceType: "image" },
  "image/png": { mime: "image/png", extension: "png", resourceType: "image" },
  "image/webp": { mime: "image/webp", extension: "webp", resourceType: "image" },
};

const DOCUMENT_KINDS: Record<string, FileKind> = {
  ...IMAGE_KINDS,
  "application/pdf": {
    mime: "application/pdf",
    extension: "pdf",
    resourceType: "raw",
  },
};

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5MB
export const DOCUMENT_MAX_BYTES = 15 * 1024 * 1024; // 15MB

/** Reads the leading bytes and reports what the file actually is. */
function sniff(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }

  // WEBP: "RIFF" <4 byte size> "WEBP"
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  // PDF: "%PDF-"
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }

  return null;
}

interface ValidateOptions {
  maxBytes: number;
  allowed: Record<string, FileKind>;
  label: string;
}

export interface ValidatedUpload {
  buffer: Buffer;
  kind: FileKind;
  size: number;
  /** Original filename, stripped of anything path-like. */
  safeName: string;
}

/**
 * Strips directory separators, traversal sequences, and control
 * characters from a client-supplied filename before it is stored or
 * echoed back into the UI.
 */
export function sanitizeFileName(name: string, fallback = "upload"): string {
  const base = (name || "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    // Strip control characters: they can smuggle newlines into log lines
    // and Content-Disposition headers.
    .split("")
    .filter((ch) => ch.charCodeAt(0) > 31 && ch.charCodeAt(0) !== 127)
    .join("")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 120);

  return base.length > 0 ? base : fallback;
}

async function validate(
  file: unknown,
  { maxBytes, allowed, label }: ValidateOptions,
): Promise<ValidatedUpload> {
  if (!(file instanceof File) || file.size === 0) {
    throw new AppError(`No ${label} provided`, 400);
  }

  // Checked before the body is buffered, so an oversized upload is
  // rejected without being read into memory.
  if (file.size > maxBytes) {
    throw new AppError(
      `${label} must be under ${Math.floor(maxBytes / (1024 * 1024))}MB`,
      413,
    );
  }

  const allowedList = Object.keys(allowed);

  if (!allowedList.includes(file.type)) {
    throw new AppError(
      `Unsupported file type. Allowed: ${allowedList.join(", ")}`,
      415,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Re-check after buffering: `file.size` is also client-reported.
  if (buffer.length > maxBytes) {
    throw new AppError(
      `${label} must be under ${Math.floor(maxBytes / (1024 * 1024))}MB`,
      413,
    );
  }

  const actual = sniff(buffer);

  if (!actual || !allowed[actual]) {
    throw new AppError(
      "File content does not match a supported file type",
      415,
    );
  }

  // A PNG announced as a PDF is not a mistake worth accommodating.
  if (actual !== file.type) {
    throw new AppError(
      "File content does not match its declared type",
      415,
    );
  }

  return {
    buffer,
    kind: allowed[actual],
    size: buffer.length,
    safeName: sanitizeFileName(file.name),
  };
}

/** Profile pictures: images only. */
export function validateAvatar(file: unknown) {
  return validate(file, {
    maxBytes: AVATAR_MAX_BYTES,
    allowed: IMAGE_KINDS,
    label: "Profile picture",
  });
}

/** Medical documents: images plus PDF. */
export function validateMedicalDocument(file: unknown) {
  return validate(file, {
    maxBytes: DOCUMENT_MAX_BYTES,
    allowed: DOCUMENT_KINDS,
    label: "Document",
  });
}
