import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_PATIENT_EMAIL;
const password = process.env.E2E_PATIENT_PASSWORD;
const clipMs = Number(process.env.E2E_VOICE_CLIP_MS) || 6000;
const keyword = process.env.E2E_VOICE_KEYWORD;

interface Timing {
  step: string;
  ms: number | null;
  details: Record<string, unknown>;
}

function readTimings(page: Page): Promise<Timing[]> {
  return page.evaluate(
    () =>
      (window as unknown as { __voiceTimings?: Timing[] }).__voiceTimings ?? [],
  );
}

test.describe("voice input", () => {
  test("records a clip, shows the transcript, and sends it to the chat", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "voice-chromium",
      "The fake microphone only exists in the voice-chromium project",
    );
    test.skip(
      !email || !password,
      "Set E2E_PATIENT_EMAIL and E2E_PATIENT_PASSWORD in .env",
    );
    test.setTimeout(90_000);

    // Log in as the test patient.
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email!);
    await page.locator('input[type="password"]').fill(password!);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

    // The first-visit tour covers the page, so close it if it shows up.
    await page
      .getByRole("button", { name: "Skip tour" })
      .click({ timeout: 3_000 })
      .catch(() => undefined);

    // Open the chat panel and record the clip.
    await page.getByRole("button", { name: /AI Scheduler/ }).click();
    await page.getByRole("button", { name: "Start recording" }).click();
    await expect(
      page.getByRole("button", { name: "Stop recording" }),
    ).toBeVisible();
    await page.waitForTimeout(clipMs);
    await page.getByRole("button", { name: "Stop recording" }).click();

    // The transcript lands in the box.
    const box = page.getByPlaceholder("Describe what you need...");
    await expect(box).not.toHaveValue("", { timeout: 30_000 });
    const transcript = await box.inputValue();
    testInfo.annotations.push({ type: "transcript", description: transcript });
    expect(transcript.trim().length).toBeGreaterThan(2);
    if (keyword) {
      expect(transcript.toLowerCase()).toContain(keyword.toLowerCase());
    }

    // Send it. This makes one real Claude request.
    await box.press("Enter");
    await page.waitForFunction(
      () =>
        (
          window as unknown as { __voiceTimings?: { step: string }[] }
        ).__voiceTimings?.some((t) => t.step === "chat") ?? false,
      undefined,
      { timeout: 45_000 },
    );

    const timings = await readTimings(page);
    await testInfo.attach("voice-timings.json", {
      body: JSON.stringify(timings, null, 2),
      contentType: "application/json",
    });

    const stt = timings.find((t) => t.step === "stt");
    expect(stt?.details.ok).toBe(true);
    expect(stt?.details.heardSpeech).toBe(true);

    const chat = timings.find((t) => t.step === "chat");
    expect(chat?.details.fromVoice).toBe(true);
    expect(chat?.details.ok).toBe(true);
  });
});
