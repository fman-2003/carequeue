import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The full train → save → load → predict loop is exercised here against
 * an in-memory stand-in for the model collection, so the regressions that
 * kept this feature from ever producing a prediction stay fixed.
 */

const mocks = vi.hoisted(() => ({
  connectDB: vi.fn(),
  find: vi.fn(),
  // In-memory stand-in for the PredictionModel collection.
  store: { doc: null as Record<string, unknown> | null },
}));

vi.mock("@/lib/db", () => ({ connectDB: mocks.connectDB }));
vi.mock("@/lib/models/Appointment", () => ({ default: { find: mocks.find } }));
vi.mock("@/lib/models/PredictionModel", () => ({
  default: {
    findOne: (filter: { name: string }) => {
      const match = mocks.store.doc?.name === filter.name ? mocks.store.doc : null;
      return {
        select: () => ({ lean: async () => match }),
        lean: async () => match,
      };
    },
    findOneAndUpdate: async (
      filter: { name: string },
      update: { $set: Record<string, unknown> },
    ) => {
      mocks.store.doc = {
        name: filter.name,
        ...(mocks.store.doc ?? {}),
        ...update.$set,
      };
      return mocks.store.doc;
    },
  },
}));

import {
  extractFeatures,
  predictNoShow,
  trainModel,
  buildTrainingSet,
  hourFromTimeSlot,
  evaluateAt,
  rankAuc,
  __resetModelCache,
  MIN_TRAINING_ROWS,
} from "../prediction.service";

/** Mocks the `.select().lean()` chain used for the appointment query. */
const appointmentQuery = (rows: unknown[]) => ({
  select: () => ({ lean: async () => rows }),
  lean: async () => rows,
});

describe("prediction service", () => {
  beforeEach(() => {
    mocks.connectDB.mockResolvedValue(undefined);
    mocks.find.mockReturnValue(appointmentQuery([]));
    mocks.store.doc = null;
    __resetModelCache();
  });

  describe("feature extraction", () => {
    it("reads the appointment hour from timeSlot, not from the date", () => {
      // The date is stored as midnight UTC, so its hour carries no
      // information — the real time lives in the slot string.
      const midnightUtc = new Date("2026-09-01T00:00:00.000Z");
      expect(hourFromTimeSlot("09:00 - 09:30", midnightUtc)).toBe(9);
      expect(hourFromTimeSlot("14:30 - 15:00", midnightUtc)).toBe(14);
      expect(hourFromTimeSlot("8:00 - 8:30", midnightUtc)).toBe(8);
    });

    it("falls back to the date's UTC hour when the slot is unusable", () => {
      const date = new Date("2026-09-01T13:00:00.000Z");
      expect(hourFromTimeSlot(undefined, date)).toBe(13);
      expect(hourFromTimeSlot("not a time", date)).toBe(13);
      expect(hourFromTimeSlot("99:00 - 99:30", date)).toBe(13);
    });

    it("scores a first-time patient at zero rather than a made-up 0.5", async () => {
      const features = await extractFeatures(
        "patient-1",
        new Date("2026-08-23T00:00:00.000Z"),
        new Date("2026-08-20T00:00:00.000Z"),
        "12:00 - 12:30",
      );

      // [dayOfWeek/6, hour/23, leadTime/30, noShowRate, visits/50, isFirst]
      expect(features).toHaveLength(6);
      expect(features[1]).toBeCloseTo(12 / 23, 5); // hour came from timeSlot
      expect(features[2]).toBeCloseTo(3 / 30, 5); // 3 days lead time
      expect(features[3]).toBe(0); // no history -> 0, not 0.5
      expect(features[5]).toBe(1); // isFirstVisit carries the signal
    });

    it("produces the same weekday regardless of the server's timezone", async () => {
      // 2026-09-01T00:00Z is a Tuesday in UTC. Reading it with local-time
      // getDay() returned Monday anywhere behind UTC.
      const features = await extractFeatures(
        "patient-1",
        new Date("2026-09-01T00:00:00.000Z"),
        new Date("2026-08-30T00:00:00.000Z"),
        "09:00 - 09:30",
      );
      expect(features[0]).toBeCloseTo(2 / 6, 5); // Tuesday
    });
  });

  describe("buildTrainingSet", () => {
    const row = (
      patientId: string,
      date: string,
      status: string,
      timeSlot = "09:00 - 09:30",
    ) => ({
      patientId,
      date: new Date(date),
      createdAt: new Date(new Date(date).getTime() - 5 * 86400000),
      timeSlot,
      status,
    });

    it("accumulates each patient's history point-in-time", () => {
      const { features, labels } = buildTrainingSet([
        row("p1", "2026-01-01T00:00:00Z", "no-show"),
        row("p1", "2026-02-01T00:00:00Z", "completed"),
        row("p1", "2026-03-01T00:00:00Z", "completed"),
      ]);

      expect(labels).toEqual([1, 0, 0]);
      // First row: no prior history at all.
      expect(features[0][3]).toBe(0); // noShowRate
      expect(features[0][5]).toBe(1); // isFirstVisit
      // Second row sees exactly one prior appointment, a no-show.
      expect(features[1][3]).toBe(1);
      expect(features[1][5]).toBe(0);
      // Third row sees two priors, one of which was a no-show.
      expect(features[2][3]).toBeCloseTo(0.5, 5);
    });

    it("never lets a row see its own outcome or a later one", () => {
      // If the future leaked in, the first row's rate would be 2/3, and
      // the model would learn to read the answer instead of predicting it.
      const { features } = buildTrainingSet([
        row("p1", "2026-01-01T00:00:00Z", "no-show"),
        row("p1", "2026-02-01T00:00:00Z", "no-show"),
        row("p1", "2026-03-01T00:00:00Z", "completed"),
      ]);
      expect(features[0][3]).toBe(0);
      expect(features[1][3]).toBe(1);
    });

    it("keeps same-day appointments from counting toward each other", () => {
      const { features } = buildTrainingSet([
        row("p1", "2026-01-01T00:00:00Z", "no-show", "09:00 - 09:30"),
        row("p1", "2026-01-01T00:00:00Z", "completed", "14:00 - 14:30"),
      ]);
      // Serving-time extraction filters on `date < appointmentDate`, so
      // neither same-day row may see the other.
      expect(features[0][3]).toBe(0);
      expect(features[1][3]).toBe(0);
      expect(features[0][5]).toBe(1);
      expect(features[1][5]).toBe(1);
    });

    it("keeps patients independent of one another", () => {
      const { features } = buildTrainingSet([
        row("p1", "2026-01-01T00:00:00Z", "no-show"),
        row("p2", "2026-02-01T00:00:00Z", "completed"),
      ]);
      expect(features[1][5]).toBe(1); // p2 is still a first visit
    });
  });

  describe("evaluation metrics", () => {
    it("exposes the all-negative model that accuracy alone would hide", () => {
      // 9 attendees, 1 no-show; the model predicts "shows up" every time.
      const labels = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
      const scores = labels.map(() => 0.1);
      const m = evaluateAt(scores, labels, 0.5);

      expect(m.accuracy).toBeCloseTo(0.9, 5); // looks great
      expect(m.recall).toBe(0); // catches nothing
      expect(m.precision).toBe(0);
      expect(m.f1).toBe(0);
    });

    it("scores a perfect ranking at 1 and a random one at 0.5", () => {
      expect(rankAuc([0.1, 0.2, 0.8, 0.9], [0, 0, 1, 1])).toBeCloseTo(1, 5);
      expect(rankAuc([0.5, 0.5, 0.5, 0.5], [0, 0, 1, 1])).toBeCloseTo(0.5, 5);
      expect(rankAuc([0.9, 0.8, 0.2, 0.1], [0, 0, 1, 1])).toBeCloseTo(0, 5);
    });

    it("reports chance when only one class is present", () => {
      expect(rankAuc([0.2, 0.7], [0, 0])).toBe(0.5);
    });
  });

  describe("training", () => {
    it("returns null rather than throwing when history is too thin", async () => {
      mocks.find.mockReturnValue(appointmentQuery([]));
      await expect(trainModel()).resolves.toBeNull();
    });

    const syntheticRows = (count: number, statusFor: (i: number) => string) =>
      Array.from({ length: count }, (_, i) => ({
        patientId: `p${i}`,
        date: new Date(
          `2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`,
        ),
        createdAt: new Date("2025-12-01T00:00:00Z"),
        timeSlot: "09:00 - 09:30",
        status: statusFor(i),
      }));

    it("refuses data containing only one outcome", async () => {
      // A classifier cannot be fit on a single class, and silently
      // producing one would give every patient the same score.
      mocks.find.mockReturnValue(
        appointmentQuery(syntheticRows(MIN_TRAINING_ROWS + 5, () => "completed")),
      );

      await expect(trainModel()).rejects.toThrow(/only one outcome/i);
    });

    it("reports unusable rows instead of silently dropping them", async () => {
      // The original code swallowed every failed row in a bare catch,
      // which is exactly how the populate/toString bug stayed invisible.
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const rows = syntheticRows(MIN_TRAINING_ROWS + 5, () => "completed");
      rows[0].date = new Date("not a date");
      mocks.find.mockReturnValue(appointmentQuery(rows));

      await expect(trainModel()).rejects.toThrow();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("skipped 1 rows"),
      );
      warn.mockRestore();
    });

    it("trains, persists, reloads, and then scores an appointment", async () => {
      // Two clean signals so the tiny network has something to learn:
      // patients who have no-showed before, and long lead times.
      const rows: {
        patientId: string;
        date: Date;
        createdAt: Date;
        timeSlot: string;
        status: string;
      }[] = [];

      for (let p = 0; p < 60; p++) {
        const noShowProne = p % 2 === 0;
        for (let visit = 0; visit < 3; visit++) {
          const day = String(visit * 9 + 1).padStart(2, "0");
          rows.push({
            patientId: `patient-${p}`,
            date: new Date(`2026-0${visit + 1}-${day}T00:00:00Z`),
            createdAt: new Date(`2025-12-0${visit + 1}T00:00:00Z`),
            timeSlot: noShowProne ? "08:00 - 08:30" : "14:00 - 14:30",
            status: noShowProne ? "no-show" : "completed",
          });
        }
      }

      mocks.find.mockReturnValue(appointmentQuery(rows));

      const result = await trainModel();

      expect(result).not.toBeNull();
      expect(result!.sampleCount).toBe(rows.length);
      expect(result!.positiveRate).toBeCloseTo(0.5, 1);
      // The model must actually separate the classes, not just fit.
      expect(result!.metrics.auc).toBeGreaterThan(0.8);

      // The artifacts reached the store rather than only a local variable.
      expect(mocks.store.doc).not.toBeNull();
      expect(mocks.store.doc!.weightData).toBeInstanceOf(Buffer);
      expect(mocks.store.doc!.version).toBe(1);

      // Drop the in-process copy: this is what a serverless cold start
      // looks like, and it is where the old code fell back to 0.5 forever.
      __resetModelCache();

      // Serving-time history lookup for the patient being scored.
      mocks.find.mockReturnValue(
        appointmentQuery([{ status: "no-show" }, { status: "no-show" }]),
      );

      const assessment = await predictNoShow(
        "patient-0",
        new Date("2026-06-01T00:00:00Z"),
        new Date("2026-05-01T00:00:00Z"),
        "08:00 - 08:30",
      );

      expect(assessment).not.toBeNull();
      expect(assessment!.score).toBeGreaterThanOrEqual(0);
      expect(assessment!.score).toBeLessThanOrEqual(1);
      expect(typeof assessment!.highRisk).toBe("boolean");
      // 50 epochs on the pure-JS CPU backend is genuinely slow — which is
      // also why tfjs-node is worth adopting for the real training job.
    }, 60_000);

    it("returns null, not a fabricated score, when no model is stored", async () => {
      mocks.store.doc = null;
      __resetModelCache();
      await expect(
        predictNoShow("patient-1", new Date("2026-08-23T00:00:00Z")),
      ).resolves.toBeNull();
    });
  });
});
