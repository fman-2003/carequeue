import { NextRequest, NextResponse } from "next/server";
import {
  handleIncomingWhatsApp,
  handleButtonPayload,
} from "@/lib/services/webhook.service";
import { validateTwilioSignature } from "@/lib/utils/helper";
import { enforceRateLimit } from "@/lib/security/rateLimit";

/** Twilio expects 200 + TwiML; replies are sent through the API instead. */
const TWIML_OK = () =>
  new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
    { status: 200, headers: { "Content-Type": "text/xml" } },
  );

export async function POST(req: NextRequest) {
  try {
    // Bounds the work an unauthenticated caller can trigger before the
    // signature is even checked.
    const limited = enforceRateLimit(req, "twilio-webhook", {
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const rawBody = await req.text();

    /**
     * The signature check ran in production only.
     *
     * This endpoint confirms and cancels real appointments purely on the
     * strength of a phone number in the request body, so with the check
     * skipped anyone who knows the URL can cancel any patient's
     * appointment by posting a form. Any environment that has a Twilio
     * auth token configured now verifies; only a local setup with no
     * token skips it, and that is stated in the log.
     */
    const hasTwilioCredentials = Boolean(process.env.TWILIO_AUTH_TOKEN);

    if (hasTwilioCredentials) {
      if (!validateTwilioSignature(req, rawBody)) {
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 403 },
        );
      }
    } else if (process.env.NODE_ENV === "production") {
      console.error(
        "[webhooks/whatsapp] TWILIO_AUTH_TOKEN missing — refusing unverified webhook",
      );
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    } else {
      console.warn(
        "[webhooks/whatsapp] no TWILIO_AUTH_TOKEN — signature check skipped (development only)",
      );
    }

    const params = new URLSearchParams(rawBody);

    /**
     * Key fields Twilio sends:
     * From → sender's WhatsApp number e.g. "whatsapp:+2348012345678"
     * Body → the message text e.g. "ACCEPT"
     */
    const from = params.get("From") || "";
    const body = params.get("Body") || "";
    const buttonPayload = params.get("ButtonPayload") || "";

    // Bound the inputs before they reach a database lookup.
    const phone = from.replace("whatsapp:", "").trim().slice(0, 20);

    if (!phone) return TWIML_OK();

    if (buttonPayload) {
      await handleButtonPayload({
        phone,
        payload: buttonPayload.slice(0, 200),
      });
    } else {
      const command = body
        .trim()
        .toUpperCase()
        .split(/\s+/)[0]
        .replace(/[^A-Z]/g, "")
        .slice(0, 20);
      await handleIncomingWhatsApp({ phone, command });
    }

    return TWIML_OK();
  } catch (err) {
    console.error("[webhooks/whatsapp]", err);
    // Still 200: Twilio retries on error responses, and a retry storm on
    // a handler that mutates appointments is worse than a dropped message.
    return TWIML_OK();
  }
}
