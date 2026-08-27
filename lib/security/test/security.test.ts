import { describe, expect, it, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { assertSameOrigin, requireClinic, isValidObjectId } from "@/lib/auth/middleware";
import { rateLimit, resetRateLimit } from "@/lib/security/rateLimit";
import { safeCompare } from "@/lib/security/secrets";
import {
  validateMedicalDocument,
  validateAvatar,
  sanitizeFileName,
} from "@/lib/security/fileValidation";
import { signToken, verifyToken } from "@/lib/auth/jwt";
import { handleServiceError } from "@/lib/security/errors";

const request = (headers: Record<string, string>) =>
  new NextRequest("http://care.test/api/thing", { method: "POST", headers });

describe("assertSameOrigin (CSRF)", () => {
  it("allows a request with no Origin header (server-to-server)", () => {
    expect(assertSameOrigin(request({ host: "care.test" }))).toBeNull();
  });

  it("allows a same-host Origin regardless of scheme", () => {
    // Behind a TLS-terminating proxy the app is reached over http while
    // the browser reports https, so only the host is compared.
    expect(
      assertSameOrigin(
        request({ host: "care.test", origin: "https://care.test" }),
      ),
    ).toBeNull();
    expect(
      assertSameOrigin(
        request({ host: "care.test", origin: "http://care.test" }),
      ),
    ).toBeNull();
  });

  it("rejects a foreign Origin", () => {
    const result = assertSameOrigin(
      request({ host: "care.test", origin: "https://evil.example" }),
    );
    expect(result?.status).toBe(403);
  });

  it("rejects a subdomain that only looks like the host", () => {
    const result = assertSameOrigin(
      request({ host: "care.test", origin: "https://care.test.evil.example" }),
    );
    expect(result?.status).toBe(403);
  });

  it("rejects an unparseable Origin", () => {
    const result = assertSameOrigin(
      request({ host: "care.test", origin: "not a url" }),
    );
    expect(result?.status).toBe(403);
  });
});

describe("requireClinic", () => {
  it("denies a session with no clinic", () => {
    // Mongoose drops undefined keys from a filter, so an unguarded
    // clinic-scoped query would return every record in the collection.
    const result = requireClinic({
      userId: "u",
      email: "e@test",
      role: "admin",
    });
    expect(result.clinicId).toBeNull();
    expect(result.error?.status).toBe(403);
  });

  it("denies a clinicId that is not an ObjectId", () => {
    const result = requireClinic({
      userId: "u",
      email: "e@test",
      role: "admin",
      clinicId: "../../etc",
    });
    expect(result.error?.status).toBe(403);
  });

  it("passes a valid clinic through", () => {
    const result = requireClinic({
      userId: "u",
      email: "e@test",
      role: "admin",
      clinicId: "652f1a2b3c4d5e6f70819210",
    });
    expect(result.error).toBeNull();
    expect(result.clinicId).toBe("652f1a2b3c4d5e6f70819210");
  });
});

describe("isValidObjectId", () => {
  it("rejects operator-injection payloads and junk", () => {
    expect(isValidObjectId({ $ne: null })).toBe(false);
    expect(isValidObjectId(["652f1a2b3c4d5e6f70819210"])).toBe(false);
    expect(isValidObjectId(null)).toBe(false);
    expect(isValidObjectId("")).toBe(false);
  });

  it("accepts a real id", () => {
    expect(isValidObjectId("652f1a2b3c4d5e6f70819210")).toBe(true);
  });
});

describe("rateLimit", () => {
  beforeEach(() => resetRateLimit("test-bucket"));

  it("allows up to the limit then blocks with a retry hint", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("test-bucket", { limit: 3, windowMs: 60_000 }).allowed).toBe(true);
    }
    const blocked = rateLimit("test-bucket", { limit: 3, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keeps buckets independent", () => {
    rateLimit("bucket-a", { limit: 1, windowMs: 60_000 });
    expect(rateLimit("bucket-b", { limit: 1, windowMs: 60_000 }).allowed).toBe(true);
    resetRateLimit("bucket-a");
    resetRateLimit("bucket-b");
  });
});

describe("safeCompare", () => {
  it("matches equal secrets and rejects everything else", () => {
    expect(safeCompare("Bearer abc123", "Bearer abc123")).toBe(true);
    expect(safeCompare("Bearer abc123", "Bearer abc124")).toBe(false);
    // Different lengths must return false rather than throw — the old
    // timingSafeEqual call raised here, and the caller swallowed it.
    expect(safeCompare("short", "a much longer value")).toBe(false);
    expect(safeCompare("", "Bearer undefined")).toBe(false);
  });
});

describe("JWT hardening", () => {
  const payload = {
    userId: "652f1a2b3c4d5e6f70819200",
    email: "a@test",
    role: "patient",
  };

  it("round-trips a token it signed", () => {
    const decoded = verifyToken(signToken(payload));
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.role).toBe("patient");
  });

  it("rejects an unsigned alg=none token claiming admin", () => {
    const header = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url");
    const body = Buffer.from(
      JSON.stringify({
        ...payload,
        role: "admin",
        iss: "carequeue",
        aud: "carequeue-app",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");

    expect(() => verifyToken(`${header}.${body}.`)).toThrow();
  });

  it("rejects a token signed with a different secret", () => {
    // Header/body copied from a valid token, signature replaced.
    const valid = signToken(payload);
    const tampered = valid.slice(0, valid.lastIndexOf(".")) + ".AAAAAAAA";
    expect(() => verifyToken(tampered)).toThrow();
  });

  it("rejects a token whose payload was edited", () => {
    const valid = signToken(payload);
    const [header, , signature] = valid.split(".");
    const escalated = Buffer.from(
      JSON.stringify({ ...payload, role: "admin" }),
    ).toString("base64url");
    expect(() => verifyToken(`${header}.${escalated}.${signature}`)).toThrow();
  });
});

describe("file upload validation", () => {
  const file = (bytes: number[], type: string, name = "x") =>
    new File([new Uint8Array(bytes)], name, { type });

  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
  const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0, 0, 0, 0];
  const HTML = Array.from("<script>alert(1)</script>").map((c) =>
    c.charCodeAt(0),
  );

  it("accepts a real PNG declared as a PNG", async () => {
    const result = await validateAvatar(file(PNG, "image/png"));
    expect(result.kind.mime).toBe("image/png");
  });

  it("accepts a PDF as a medical document", async () => {
    const result = await validateMedicalDocument(
      file(PDF, "application/pdf", "results.pdf"),
    );
    expect(result.kind.resourceType).toBe("raw");
  });

  it("rejects HTML wearing an image content-type", async () => {
    // The declared type is the browser's claim; the bytes are what decide.
    await expect(validateAvatar(file(HTML, "image/png"))).rejects.toThrow(
      /does not match a supported file type/,
    );
  });

  it("rejects a PDF declared as an image", async () => {
    await expect(validateAvatar(file(PDF, "image/png"))).rejects.toThrow();
  });

  it("rejects a PDF upload to the avatar endpoint even when honest", async () => {
    await expect(
      validateAvatar(file(PDF, "application/pdf")),
    ).rejects.toThrow(/Unsupported file type/);
  });

  it("rejects an empty file", async () => {
    await expect(
      validateMedicalDocument(new File([], "empty.pdf", { type: "application/pdf" })),
    ).rejects.toThrow(/No Document provided/);
  });

  it("strips path traversal from filenames", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("..\\..\\windows\\system32\\cfg.ini")).toBe("cfg.ini");
    expect(sanitizeFileName("")).toBe("upload");
    expect(sanitizeFileName("...")).toBe("upload");
  });
});

describe("error responses", () => {
  it("passes through a message we wrote", async () => {
    const res = handleServiceError("test", new Error("Appointment not found"), 404);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Appointment not found" });
  });

  it("hides driver internals behind a generic message", async () => {
    const err = Object.assign(
      new Error("E11000 duplicate key error collection: carequeue.users index: email_1"),
      { name: "MongoServerError" },
    );
    const res = handleServiceError("test", err, 400);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).not.toContain("carequeue.users");
    expect(body.error).toBe("Something went wrong. Please try again.");
  });

  it("hides connection strings", async () => {
    const res = handleServiceError(
      "test",
      new Error("failed to connect to mongodb+srv://user:pass@cluster.example.net"),
      500,
    );
    const body = await res.json();
    expect(body.error).not.toContain("mongodb+srv");
  });
});
