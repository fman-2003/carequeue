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
  aiText: { limit: 15, windowMs: 60 * 60 * 1000 },
  /** Speech-to-text — each call is a request to Groq. */
  voice: { limit: 30, windowMs: 60 * 60 * 1000 },
  /** Invite code generation. */
  invite: { limit: 20, windowMs: 60 * 60 * 1000 },
  /** General write traffic. */
  write: { limit: 120, windowMs: 60 * 1000 },
} satisfies Record<string, RateLimitOptions>;

/** 
I read the chat panel, the scheduling route, `proxy.ts`, the rate limiter and the upload validator, so this plan fits how CareQueue is built today. No files were changed.

## Things in the codebase that would block voice

1. **The security policy would block Kokoro.** The CSP in [proxy.ts](proxy.ts) has three problems:
   - `connect-src` only allows your own site and Cloudinary, so the model download from Hugging Face would fail.
   - `script-src` is missing `'wasm-unsafe-eval'`, so the browser can't run the WASM code Kokoro needs.
   - `media-src` is missing `blob:`, so the generated audio couldn't play.
2. **Rate limits are shared.** `RATE_LIMITS.ai` allows 15 requests per hour per user. Each voice turn is one speech-to-text call plus one chat call, so voice needs its own limit (scope) and testers may hit the cap quickly.
3. **Sending only works from the text box.** `handleSend` in [AISchedulingPanel.tsx](components/layout/AISchedulingPanel.tsx) reads the typed input. It needs a small change to accept any text, so voice and typing can share it.

## Step-by-step process

**Phase 0: Setup**
- Create a Groq API key and add `GROQ_API_KEY` to `.env.local`. 
- Add a `NEXT_PUBLIC_VOICE_ENABLED` flag so only testers see the voice option.
- Prepare fake patient scripts and record about 20 short clips with Nigerian accents. These become your fixed test set.
- Read the route-handler and `formData` docs in `node_modules/next/dist/docs/`, as AGENTS.md requires.

**Phase 1: Unblock the browser**
- Fix the Permissions-Policy and CSP issues above. Nothing else will work until this is done.

**Phase 2: Speech-to-text on the server**
- Add audio types to `fileValidation.ts`. It should check the file's actual bytes, the same way it already does for images and PDFs: WebM and OGG from Chrome and Firefox, MP4 from Safari, and WAV.
- Cap uploads at about 2MB, and stop recording on the client after 30 seconds.
- Add `transcription.service.ts`. It sends a plain `fetch` with `FormData` to Groq's `/audio/transcriptions` endpoint, like the style in `scheduling.service.ts`, so no new dependency is needed.
- Add `/api/voice/transcribe`. It should use the same checks as `/api/scheduling`: same-origin check, login check, rate limit and clinic check. It returns `{ text }` only (not a response since it is just a transcription that will become the input for the text to speech model) and never stores audio.
- Add unit tests with a mocked `fetch`, like the existing scheduling test.

**Phase 3: Push-to-talk input**
- Add a hook that records with `getUserMedia` and `MediaRecorder`, and a mic button.
- The transcript goes into the text box so the patient can check it before sending. A misheard date or doctor name means a wrong booking, and how often testers correct the transcript is a useful thing to measure.
- **First milestone:** voice in, text out. Test this before building any speech output.

**Phase 4: Connect to the chat**
- Change `handleSend` to `sendMessage(text)` so the text box and the mic use the same path to `/api/scheduling`. The chat route doesn't change.

**Phase 5: Speech output with the built-in browser voice**
- Use `speechSynthesis` first, since it needs no setup.
- Add a helper that makes replies easier to listen to, e.g. "08:00 - 08:30" becomes "8 to 8:30 AM", and emojis and symbols are removed.
- Add a speaker on/off toggle.

**Phase 6: Kokoro**
- Import `kokoro-js` only when the user first taps voice, to save mobile data. Show download progress, and let the browser cache the model after that.
- Speak the first sentence while the rest is still being generated (sentence streaming).
- If the model fails to load or the device is slow, fall back to `speechSynthesis`.
- If the chat panel freezes while Kokoro generates audio, move it into a Web Worker.
- iOS note: audio only plays after a tap, so start the audio setup inside the push-to-talk tap.

**Phase 7: Measure**
- Log the time for each step: recording stops → transcript ready → reply ready → first audio plays.
- Automate mic tests in Playwright with a fake audio device. You already have Playwright set up.
- Score transcription accuracy against the fixed test set, especially doctor names and dates.

**Phase 8: Test with users, then decide on upgrades**
- Run sessions with testers using fake data only.
- After that, add hands-free mode with `@ricky0123/vad-web`, and use the timing numbers to decide what's worth paying for.

## File structure

```
app/api/voice/transcribe/route.ts            NEW   POST audio → Groq Whisper → { text }
lib/services/transcription.service.ts        NEW   Groq call (server-only)
lib/services/test/transcription.service.test.ts  NEW
lib/security/fileValidation.ts               EDIT  audio types + validateVoiceClip()
lib/security/rateLimit.ts                    EDIT  RATE_LIMITS.voice
proxy.ts                                     EDIT  microphone=(self), CSP for HF / WASM / blob audio
lib/hooks/useVoiceRecorder.ts                NEW   getUserMedia + MediaRecorder, 30s cap
lib/hooks/useTextToSpeech.ts                 NEW   lazy Kokoro, speechSynthesis fallback
lib/utils/speakable.ts                       NEW   reply text → speech-friendly text
lib/utils/test/speakable.test.ts             NEW
components/voice/VoiceControls.tsx           NEW   mic button + speaker toggle
components/layout/AISchedulingPanel.tsx      EDIT  sendMessage(text), mount VoiceControls
tests/e2e/voice.spec.ts                      NEW   Playwright with fake mic audio
.env.local                                   EDIT  GROQ_API_KEY, NEXT_PUBLIC_VOICE_ENABLED
```

Speech-to-text gets its own route, separate from `/api/scheduling`. That keeps the working chat route untouched, lets the patient check the transcript, and makes it easy to swap providers later. The cost is one extra round trip per turn, which is small.

## Tools to improve the test phase

| Need | Tool | Why |
|---|---|---|
| Better transcription, free | Groq `whisper-large-v3-turbo`, plus the `prompt` and `language` settings | Passing your clinic's doctor names in `prompt` helps Whisper spell names correctly. Compare turbo with `large-v3` on your test set. |
| Hands-free mode | `@ricky0123/vad-web` | Detects when the user stops talking, in the browser |
| Streaming speech-to-text to compare | Deepgram (free starting credit) | Shows how much faster streaming feels than push-to-talk |
| Nigerian languages and accents | Spitch; Intron Health | Spitch covers speech-to-text and text-to-speech for Yoruba, Igbo and Hausa. Intron focuses on African-accented clinical speech. Check current pricing for both. |
| Premium voice to compare | ElevenLabs, Cartesia | Low-latency voices for side-by-side tests |
| Measuring timing and quality | Langfuse or PostHog (free tiers) | Tracks per-turn timing and failed transcripts across testers |
| Automated mic tests | Playwright's fake audio device flags | Repeatable voice tests in CI with no real mic |
| Full real-time voice later | LiveKit Agents or Pipecat (open source) | Handles streaming both ways and letting users interrupt, once push-to-talk has proven the idea |

Tell me which phase to start with and I'll implement it. I can also turn this plan into a shareable page if your team will review it.
*/