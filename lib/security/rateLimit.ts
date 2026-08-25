import { NextRequest, NextResponse } from "next/server";

/**
 * Fixed-window rate limiter.
 *
 * Scope note: this counter lives in the process, so on a multi-instance
 * or serverless deployment each instance keeps its own window and the
 * effective limit is (limit x instances). That is still a large reduction
 * in brute-force throughput and costs nothing to run. Move the counters
 * to Redis/Upstash when the app runs on more than one instance and you
 * need an exact global limit.
 */

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

// Keeps the map from growing without bound on a long-lived server.
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 60_000;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, window] of buckets) {
    if (window.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Best-effort client identity. On Vercel/most proxies the left-most entry
 * of x-forwarded-for is the real client. It is spoofable in principle,
 * which is why this is throttling and not authorization.
 */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export interface RateLimitOptions {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000),
      ),
    };
  }

  return {
    allowed: true,
    remaining: limit - existing.count,
    retryAfterSeconds: 0,
  };
}

/** Clears a bucket — used after a successful login so a legitimate user
 *  is not throttled by their own earlier typos. */
export function resetRateLimit(key: string) {
  buckets.delete(key);
}

/**
 * Returns a 429 response when the caller is over budget, otherwise null.
 */
export function enforceRateLimit(
  req: NextRequest,
  scope: string,
  options: RateLimitOptions,
  identifier?: string,
): NextResponse | null {
  const key = `${scope}:${identifier ?? clientIp(req)}`;
  const result = rateLimit(key, options);

  if (result.allowed) return null;

  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    },
  );
}

/** Tuned windows for the endpoints that are worth protecting. */
export const RATE_LIMITS = {
  /** Credential stuffing / password guessing. */
  login: { limit: 8, windowMs: 15 * 60 * 1000 },
  /** Automated account creation. */
  signup: { limit: 5, windowMs: 60 * 60 * 1000 },
  /** Password change attempts (also an oracle for the current password). */
  passwordChange: { limit: 5, windowMs: 15 * 60 * 1000 },
  /** File uploads — bandwidth and storage cost. */
  upload: { limit: 20, windowMs: 60 * 60 * 1000 },
  /** LLM-backed endpoint — direct spend per request. */
  ai: { limit: 15, windowMs: 60 * 60 * 1000 },
  /** Invite code generation. */
  invite: { limit: 20, windowMs: 60 * 60 * 1000 },
  /** General write traffic. */
  write: { limit: 120, windowMs: 60 * 1000 },
} satisfies Record<string, RateLimitOptions>;
