import { NextRequest } from "next/server";
import crypto from "crypto";

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function isWorkingDay(date: string, workingDays: number[]): boolean {
  const [year, month, day] = date.split("-").map(Number);
  const localDate = new Date(year, month - 1, day);
  return workingDays.includes(localDate.getDay());
}

/**
 * Verifies Twilio's request signature.
 *
 * Three problems with the previous implementation:
 *   - crypto.timingSafeEqual throws when the two buffers differ in
 *     length, so a short forged signature raised instead of returning
 *     false, and the webhook's catch-all turned that into a 200;
 *   - the URL was built from NEXT_PUBLIC_APP_URL with no check that it
 *     was set, silently producing undefined/api/webhooks/whatsapp;
 *   - the auth token was asserted non-null rather than verified.
 *
 * Twilio signs the exact URL it posted to, so the host is taken from the
 * request when no canonical URL is configured.
 */
export function validateTwilioSignature(
  req: NextRequest,
  body: string,
): boolean {
  const twilioSignature = req.headers.get("x-twilio-signature");
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!twilioSignature || !authToken) return false;

  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  const host = req.headers.get("host");

  const webhookUrl = configuredUrl
    ? `${configuredUrl.replace(/\/+$/, "")}/api/webhooks/whatsapp`
    : host
      ? `https://${host}/api/webhooks/whatsapp`
      : null;

  if (!webhookUrl) return false;

  const expected = crypto
    .createHmac("sha1", authToken)
    .update(Buffer.from(webhookUrl + body, "utf8"))
    .digest("base64");

  const received = Buffer.from(twilioSignature, "utf8");
  const computed = Buffer.from(expected, "utf8");

  // Length is checked first so timingSafeEqual cannot throw.
  if (received.length !== computed.length) return false;

  return crypto.timingSafeEqual(received, computed);
}
