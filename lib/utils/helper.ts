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

export function validateTwilioSignature(
  req: NextRequest,
  body: string,
): boolean {
  const twilioSignature = req.headers.get("x-twilio-signature");
  const authToken = process.env.TWILIO_AUTH_TOKEN!;
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp`;

  if (!twilioSignature) return false;

  /**
   * Twilio's signature is an HMAC-SHA1 hash of the
   * full webhook URL + sorted POST params, signed
   * with your auth token. We recreate that hash
   * and compare it against what Twilio sent.
   */
  const expectedSignature = crypto
    .createHmac("sha1", authToken)
    .update(Buffer.from(webhookUrl + body))
    .digest("base64");

  return crypto.timingSafeEqual(
    Buffer.from(twilioSignature),
    Buffer.from(expectedSignature),
  );
}
