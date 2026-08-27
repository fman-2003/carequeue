const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const FROM_NUMBER = process.env.TWILIO_WHATSAPP_FROM!;

if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
  throw new Error("Twilio credentials missing from local env");
}

interface WhatsAppButton {
  id: string; // payload object sent back when button is pressed
  title: string; // button label
}

interface WhatsAppPayload {
  to: string;
  message: string;
  buttons?: WhatsAppButton[]; // optional as not every message will have buttons
}

export async function sendWhatsAppMessage({
  to,
  message,
  buttons,
}: WhatsAppPayload) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;

  let body: URLSearchParams;

  if (buttons && buttons.length > 0) {
    /**
     * NOTE TO SELF:
     * Twilio WhatsApp interactive buttons use a different
     * body format. Encode the buttons as JSON in the
     * PersistentAction field using Twilio's format.
     */
    body = new URLSearchParams({
      From: `whatsapp:${FROM_NUMBER}`,
      To: `whatsapp:${to}`,
      Body: message,
      PersistentAction: JSON.stringify(
        buttons.map((b) => ({
          type: "reply",
          reply: {
            id: b.id,
            title: b.title,
          },
        })),
      ),
    });
  } else {
    body = new URLSearchParams({
      From: `whatsapp:${FROM_NUMBER}`,
      To: `whatsapp:${to}`,
      Body: message,
    });
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const errData = await res.json();
    // only log error of failed appoinment reminders
    // do not throw so as not to disrupt flow of appointment creation or update
    console.error("WhatsApp send failed:", errData);
    return null;
  }

  const result = await res.json();
  // The recipient number is not logged: application logs are widely
  // readable and a phone number is patient-identifying.
  console.log(`WhatsApp message queued — SID: ${result.sid}`);
  return result;
}
