/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { handleIncomingWhatsApp, handleButtonPayload } from "@/lib/services/webhook.service";
import { validateTwilioSignature } from "@/lib/utils/helper";

/**
 * TWILIO SIGNATURE VALIDATION
 * Twilio signs every webhook request with your auth token.
 * Validating this signature ensures the request genuinely
 * came from Twilio and not someone spoofing your endpoint.
 *
 * Without this check, anyone who knows your webhook URL
 * could send fake "ACCEPT" messages on behalf of patients.
 */

export async function POST(req: NextRequest) {
  try {
    /**
     * Twilio sends webhook data as URL-encoded form data,
     * NOT JSON — this is a common gotcha.
     * We must parse it as text first then as URLSearchParams.
     */
    const rawBody = await req.text();
    const params = new URLSearchParams(rawBody);

    /**
     * Validate signature in production only.
     * In development Twilio uses a tunnel (like ngrok)
     * and the URL changes every session, making
     * signature validation impractical.
     */
    if (process.env.NODE_ENV === "production") {
      const isValid = validateTwilioSignature(req, rawBody);
      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 403 },
        );
      }
    }

    /**
     * Key fields Twilio sends:
     * From → sender's WhatsApp number e.g. "whatsapp:+2348012345678"
     * Body → the message text e.g. "ACCEPT"
     */
    const from = params.get("From") || "";
    const body = params.get("Body") || "";
    const buttonPayload = params.get("ButtonPayload") || "";

    const phone = from.replace("whatsapp:", "").trim();

    if (buttonPayload) {
      await handleButtonPayload({ phone, payload: buttonPayload });
    } else {
      const command = body
        .trim()
        .toUpperCase()
        .split(/\s+/)[0]
        .replace(/[^A-Z]/g, "");
      await handleIncomingWhatsApp({ phone, command });
    }

    // const command = body
    //   .trim()
    //   .toUpperCase()
    //   .split(/\s+/)[0]
    //   .replace(/[^A-Z]/g, "");

    // if (!phone || !command) {
    //   return NextResponse.json(
    //     { error: "Missing phone or message body" },
    //     { status: 400 },
    //   );
    // }

    // await handleIncomingWhatsApp({ phone, command });

    /**
     * Twilio expects a 200 response with TwiML markup.
     * An empty <Response/> tells Twilio "got it, no
     * reply needed from your side" — we handle replies
     * ourselves via the API, not TwiML.
     */
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } },
    );
  } catch (err: any) {
    console.error("Webhook error:", err.message);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } },
    );
  }
}
