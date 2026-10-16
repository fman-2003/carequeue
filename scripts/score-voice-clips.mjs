// Sends each clip in tests/fixtures/voice to Groq and scores the transcript
// against expected.json. Uses plain Node, no extra packages.
//
// Run:  npm run voice:score
// Try another model:   $env:GROQ_MODEL="whisper-large-v3"; npm run voice:score
// Try a name hint:     $env:VOICE_PROMPT="Doctors: Adekunle Olatunji, Ada Obi"; npm run voice:score
import { readFile } from "node:fs/promises";
import path from "node:path";

const DIR = path.resolve("tests/fixtures/voice");
const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = process.env.GROQ_MODEL || "whisper-large-v3-turbo";
const PROMPT = process.env.VOICE_PROMPT || "";
const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  console.error("GROQ_API_KEY is missing. Run this with: npm run voice:score");
  process.exit(1);
}

const MIME = {
  ".wav": "audio/wav",
  ".webm": "audio/webm",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".mp3": "audio/mpeg",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/\bdr\.?(?=\s|$)/g, "doctor")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...new Array(b.length).fill(0),
  ]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

/** Word error rate: 0 is perfect. It can go above 1 if the text is very wrong. */
function wer(expected, actual) {
  const e = normalize(expected);
  const a = normalize(actual);
  if (e.length === 0) return a.length === 0 ? 0 : 1;
  return editDistance(e, a) / e.length;
}

function termsFound(actual, terms) {
  const haystack = ` ${normalize(actual).join(" ")} `;
  return terms.filter((term) =>
    haystack.includes(` ${normalize(term).join(" ")} `),
  );
}

async function transcribe(file, attempt = 0) {
  const mime = MIME[path.extname(file).toLowerCase()];
  if (!mime) throw new Error(`Unsupported file type: ${file}`);

  const bytes = await readFile(path.join(DIR, file));
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), file);
  form.append("model", MODEL);
  form.append("language", "en");
  form.append("response_format", "json");
  form.append("temperature", "0");
  if (PROMPT) form.append("prompt", PROMPT);

  const started = performance.now();
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (res.status === 429 && attempt < 1) {
    const wait = Number(res.headers.get("retry-after")) || 10;
    console.log(`Rate limited. Waiting ${wait}s...`);
    await sleep(wait * 1000);
    return transcribe(file, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const data = await res.json();
  return {
    text: String(data.text ?? "").trim(),
    ms: Math.round(performance.now() - started),
  };
}

let items;
try {
  items = JSON.parse(await readFile(path.join(DIR, "expected.json"), "utf8"));
} catch (err) {
  console.error(
    `Could not read tests/fixtures/voice/expected.json: ${err.message}`,
  );
  process.exit(1);
}

console.log(`Model: ${MODEL}${PROMPT ? " (with prompt)" : ""}\n`);

const rows = [];
for (const item of items) {
  try {
    const { text, ms } = await transcribe(item.file);
    const terms = (item.terms ?? []).filter((t) => normalize(t).length > 0);
    const found = termsFound(text, terms);
    rows.push({
      file: item.file,
      wer: wer(item.expected, text),
      found: found.length,
      total: terms.length,
      missed: terms.filter((t) => !found.includes(t)),
      ms,
      text,
    });
  } catch (err) {
    console.error(`${item.file}: ${err.message}`);
    rows.push({ file: item.file, failed: true });
  }
  await sleep(1500);
}

const done = rows.filter((r) => !r.failed);
console.table(
  done.map((r) => ({
    file: r.file,
    "WER %": Math.round(r.wer * 100),
    terms: `${r.found}/${r.total}`,
    missed: r.missed.join(", "),
    ms: r.ms,
    heard: r.text,
  })),
);

if (done.length > 0) {
  const avg = (key) => done.reduce((sum, r) => sum + r[key], 0) / done.length;
  const foundTotal = done.reduce((sum, r) => sum + r.found, 0);
  const termTotal = done.reduce((sum, r) => sum + r.total, 0);
  console.log(`\nClips scored:   ${done.length}/${rows.length}`);
  console.log(`Average WER:    ${(avg("wer") * 100).toFixed(1)}%`);
  console.log(`Terms correct:  ${foundTotal}/${termTotal}`);
  console.log(`Average time:   ${Math.round(avg("ms"))}ms`);
}
