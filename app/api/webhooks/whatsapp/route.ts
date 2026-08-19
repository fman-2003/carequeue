/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { handleIncomingWhatsApp, handleButtonPayload } from "@/lib/services/webhook.service";
import { validateTwilioSignature } from "@/lib/utils/helper";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const params = new URLSearchParams(rawBody);

     // Validate signature in production only.     
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
