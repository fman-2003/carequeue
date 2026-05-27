/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDB } from "@/lib/db";
import Clinic from "@/lib/models/Clinic";
import User from "@/lib/models/User";
import Appointment from "@/lib/models/Appointment";
import { getAvailableSlots } from "@/lib/utils/generateSlots";

interface SchedulingRequest {
  clinicId: string;
  patientId: string;
  message: string; // the patient's plain English request
}

interface SlotSuggestion {
  doctorId: string;
  doctorName: string;
  date: string;
  timeSlot: string;
}

// FETCH AVAILABLE SLOTS FOR NEXT 14 DAYS
async function fetchWeekAvailability(
  clinicId: string,
  doctors: any[],
): Promise<SlotSuggestion[]> {
  await connectDB();

  const clinic = await Clinic.findById(clinicId).lean();
  if (!clinic) throw new Error("Clinic not found");

  const available: SlotSuggestion[] = [];
  const today = new Date();

  // Loop through the next 14 days and every doctor
  // to build a complete picture of what is available.
  for (let i = 1; i <= 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    const dateStr = date.toISOString().split("T")[0]; // "2025-01-06"
    const dayOfWeek = date.getDay();

    // skip non-working days for the clinic
    if (!clinic.workingDays.includes(dayOfWeek)) continue;

    for (const doctor of doctors) {
      const slots = await getAvailableSlots({
        clinicId,
        doctorId: doctor._id.toString(),
        date: dateStr,
        openingTime: clinic.openingTime,
        closingTime: clinic.closingTime,
        slotDurationMinutes: clinic.slotDurationMinutes,
      });

      // include only slots that are actually free
      slots
        .filter((s) => s.available)
        .forEach((s) => {
          available.push({
            doctorId: doctor._id.toString(),
            doctorName: doctor.name,
            date: dateStr,
            timeSlot: s.timeSlot,
          });
        });
    }
  }

  return available;
}

// ACTUAL SCHEDULING FUNCTION
export async function smartSchedule({
  clinicId,
  patientId,
  message,
}: SchedulingRequest) {
  await connectDB();

  // fetch patient's history to give Claude more context
  const [doctors, patient, history] = await Promise.all([
    User.find({ clinicId, role: "doctor" }).select("_id name").lean(),
    User.findById(patientId).select("name").lean(),
    Appointment.find({ patientId })
      .sort({ date: -1 })
      .limit(5)
      .select("date timeSlot status")
      .lean(),
  ]);

  if (!doctors.length) throw new Error("No doctors found at this clinic");

  // get real availability for the next 14 days
  const availableSlots = await fetchWeekAvailability(clinicId, doctors);

  if (!availableSlots.length) {
    return {
      reply:
        "Unfortunately there are no available slots in the next 14 days. Please try again later or join the waitlist.",
      slots: [],
    };
  }

  // SYSTEM PROMPT
  const systemPrompt = `
You are CareQueue's smart scheduling assistant for a Nigerian healthcare clinic.
Your job is to help patients find and book appointments based on their request.

AVAILABLE SLOTS FOR THE NEXT 14 DAYS:
${JSON.stringify(availableSlots, null, 2)}

PATIENT CONTEXT:
- Name: ${patient?.name || "Patient"}
- Recent appointments: ${JSON.stringify(history)}

RULES YOU MUST FOLLOW:
1. Only suggest slots from the AVAILABLE SLOTS list above. Never invent slots.
2. Match the patient's preferences (morning/afternoon, specific doctor, specific day) against the available slots.
3. Never, in any way, disclose information about other users on the platform.
4. Suggest a maximum of 3 slots that best match their request.
5. Respond in a friendly, concise, conversational tone.
6. Format each suggestion clearly: Doctor name, Date, Time.
7. If no slots match their preference, suggest the closest alternatives from the available list.
8. End your response by asking the patient to confirm which slot they want.
9. Always respond in the same language the patient used.
10. If patient has a preffered doctor set at the moment, you must only give slot suggestions under that doctor unless they change the doctor in the settings or remove that preference. This is to encourage patients to build a relationship with a specific doctor and improve continuity of care.
11. In the case where patient or doctor does not specify a date, search the web for the present day and use it relative to what the user asks. For example, if today is January 1st and the patient says "I want an appointment tomorrow", you should look for slots on January 2nd.
12. If patient does not have their clinicId currently set, make sure to only advice them to set it in the settings page. Explain that this is for their own security and to ensure they get accurate scheduling suggestions. Never suggest they input their clinic in the chat or any other personal information. Always direct them to the settings page to update their clinic or any other personal information.
13. Return your response as JSON in this exact format:
{
  "reply": "your conversational message to the patient",
  "suggestions": [
    { "doctorId": "...", "doctorName": "...", "date": "...", "timeSlot": "..." }
  ]
}
`;

  // we use CLAUDE api to generate the response based on the system prompt and patient's message
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: message }],
    }),
  });

  if (!response.ok) {
    throw new Error("Scheduling AI is temporarily unavailable");
  }

  const data = await response.json();
  const raw = data.content[0].text;

  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return {
      reply: parsed.reply,
      suggestions: parsed.suggestions as SlotSuggestion[],
    };
  } catch {
    // if parsing fails for any reason, return raw text gracefully
    return {
      reply: raw,
      suggestions: [],
    };
  }
}
