import { describe, expect, it } from "vitest";
import { makeSpeakable, splitForSpeech } from "../speakable";

describe("makeSpeakable", () => {
  it("reads slot ranges in 12-hour time", () => {
    expect(makeSpeakable("Your slot is 08:00 - 08:30.")).toBe(
      "Your slot is 8 to 8:30 AM.",
    );
    expect(makeSpeakable("Come at 14:00 - 14:30.")).toBe(
      "Come at 2 to 2:30 PM.",
    );
    expect(makeSpeakable("Slot 11:30 - 12:00.")).toBe(
      "Slot 11:30 AM to 12 PM.",
    );
  });

  it("converts lone 24-hour times and leaves 12-hour times alone", () => {
    expect(makeSpeakable("See you at 09:30.")).toBe("See you at 9:30 AM.");
    expect(makeSpeakable("See you at 15:00.")).toBe("See you at 3 PM.");
    expect(makeSpeakable("See you at 9:30 tomorrow or 10:30 PM.")).toBe(
      "See you at 9:30 tomorrow or 10:30 PM.",
    );
  });

  it("reads ISO dates as a weekday and month", () => {
    // 16 October 2026 is a Friday.
    expect(makeSpeakable("Book 2026-10-16.")).toBe("Book Friday, October 16.");
    expect(makeSpeakable("It is 2026-13-45.")).toBe("It is 2026-13-45.");
  });

  it("says Doctor instead of Dr.", () => {
    expect(makeSpeakable("Dr. Adekunle is free.")).toBe(
      "Doctor Adekunle is free.",
    );
  });

  it("removes emojis and markdown marks", () => {
    expect(makeSpeakable("**Great news!** 😊 I found a slot ✅")).toBe(
      "Great news! I found a slot.",
    );
  });

  it("turns a list into spoken sentences", () => {
    const reply =
      "Here are 2 options:\n1. Dr. A - 2026-10-16 - 08:00 - 08:30\n- Dr. B, 14:00 - 14:30";
    expect(makeSpeakable(reply)).toBe(
      "Here are 2 options: Doctor A, Friday, October 16, 8 to 8:30 AM. Doctor B, 2 to 2:30 PM.",
    );
  });

  it("drops links but keeps link text", () => {
    expect(makeSpeakable("Open [the page](https://example.com/x) now.")).toBe(
      "Open the page now.",
    );
    expect(makeSpeakable("See https://example.com now.")).toBe("See now.");
  });

  it("returns an empty string for empty or non-string input", () => {
    expect(makeSpeakable("")).toBe("");
    expect(makeSpeakable(undefined as unknown as string)).toBe("");
  });
});

describe("splitForSpeech", () => {
  it("keeps short text in one piece", () => {
    expect(splitForSpeech("Hello there. How are you? Fine.")).toEqual([
      "Hello there. How are you? Fine.",
    ]);
  });

  it("packs whole sentences up to the limit", () => {
    expect(splitForSpeech("One two three. Four five six. Seven.", 20)).toEqual([
      "One two three.",
      "Four five six.",
      "Seven.",
    ]);
  });

  it("breaks a sentence that is longer than the limit", () => {
    expect(splitForSpeech("aaa bbb ccc ddd.", 10)).toEqual([
      "aaa bbb",
      "ccc ddd.",
    ]);
  });

  it("returns nothing for empty text", () => {
    expect(splitForSpeech("")).toEqual([]);
  });
});
