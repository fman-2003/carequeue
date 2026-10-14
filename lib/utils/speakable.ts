/**
 * Turns a chat reply into text that sounds right when read aloud.
 * The text on screen is not changed, only what the voice says.
 */

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Built from a string so older TypeScript targets do not complain about \p{...}.
const EMOJI = new RegExp("[\\p{Extended_Pictographic}\\uFE0F\\u200D]", "gu");

function to12Hour(hour: number, minute: number) {
  const meridiem = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const clock =
    minute === 0 ? `${h}` : `${h}:${String(minute).padStart(2, "0")}`;
  return { clock, meridiem };
}

function speakRange(h1: number, m1: number, h2: number, m2: number): string {
  const a = to12Hour(h1, m1);
  const b = to12Hour(h2, m2);
  return a.meridiem === b.meridiem
    ? `${a.clock} to ${b.clock} ${b.meridiem}`
    : `${a.clock} ${a.meridiem} to ${b.clock} ${b.meridiem}`;
}

function speakDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${WEEKDAYS[date.getUTCDay()]}, ${MONTHS[month - 1]} ${day}`;
}

export function makeSpeakable(input: string): string {
  if (typeof input !== "string") return "";

  const text = input
    // [label](url) becomes label. Bare links are dropped.
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    // 08:00 - 08:30 becomes "8 to 8:30 AM"
    .replace(
      /\b(\d{2}):(\d{2})\s*[-–—]\s*(\d{2}):(\d{2})\b/g,
      (match: string, h1: string, m1: string, h2: string, m2: string) => {
        const [a, b, c, d] = [h1, m1, h2, m2].map(Number);
        if (a > 23 || c > 23 || b > 59 || d > 59) return match;
        return speakRange(a, b, c, d);
      },
    )
    // 2026-10-16 becomes "Friday, October 16"
    .replace(
      /\b(\d{4})-(\d{2})-(\d{2})\b/g,
      (match: string, y: string, m: string, d: string) =>
        speakDate(Number(y), Number(m), Number(d)) ?? match,
    )
    // A lone 24-hour time like 09:30 or 15:00. Only two-digit hours are
    // changed, so a 12-hour "2:30" is never guessed wrong. Times that
    // already have AM or PM are left alone.
    .replace(
      /\b([01]\d|2[0-3]):([0-5]\d)\b(?!\s*[ap]\.?m\b)/gi,
      (_match: string, h: string, m: string) => {
        const t = to12Hour(Number(h), Number(m));
        return `${t.clock} ${t.meridiem}`;
      },
    )
    // "Dr." is sometimes read as "Drive".
    .replace(/\bDr\.?(?=\s)/g, "Doctor")
    // Emojis and markdown marks.
    .replace(EMOJI, "")
    .replace(/[*_#`~>]/g, "");

  // One sentence per line. List markers are dropped.
  const joined = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
    .map((line) => (/[.!?:;,]$/.test(line) ? line : `${line}.`))
    .join(" ");

  return joined
    .replace(/[→•·|]/g, ", ")
    .replace(/\s[-–—]+\s/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/,(\s*,)+/g, ",")
    .trim();
}

function breakLongSentence(sentence: string, maxLength: number): string[] {
  const parts: string[] = [];
  let current = "";
  for (const word of sentence.split(" ")) {
    if (current && current.length + 1 + word.length > maxLength) {
      parts.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/**
 * Cuts text into short pieces at sentence ends. Some browsers stop long
 * speech part-way without any error, so each piece is spoken on its own.
 */
export function splitForSpeech(text: string, maxLength = 200): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [];
  const chunks: string[] = [];
  let current = "";

  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;

    const pieces =
      sentence.length > maxLength
        ? breakLongSentence(sentence, maxLength)
        : [sentence];

    for (const piece of pieces) {
      if (current && current.length + 1 + piece.length > maxLength) {
        chunks.push(current);
        current = piece;
      } else {
        current = current ? `${current} ${piece}` : piece;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks;
}
