import crypto from "crypto";

/**
 * Constant-time comparison for shared secrets and signatures.
 *
 * `a !== b` on a string short-circuits at the first differing byte, so
 * the time it takes leaks how much of the secret a guess got right. The
 * comparison is done over SHA-256 digests so that inputs of different
 * lengths can be compared safely — `crypto.timingSafeEqual` throws when
 * the two buffers differ in length, and a thrown error is itself a signal
 * (and, in the webhook's case, was being swallowed into a 200 response).
 */
export function safeCompare(a: string, b: string): boolean {
  const digestA = crypto.createHash("sha256").update(a, "utf8").digest();
  const digestB = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(digestA, digestB);
}
