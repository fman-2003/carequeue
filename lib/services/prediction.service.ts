import * as tf from "@tensorflow/tfjs";
import { connectDB } from "@/lib/db";
import Appointment from "@/lib/models/Appointment";
import {
  NO_SHOW_MODEL,
  mongoSaveHandler,
  mongoLoadHandler,
  readStoredModel,
  readStoredVersion,
} from "@/lib/services/prediction/storage";

/**
 * No-show risk model.
 *
 * Six normalized features feed a small dense network. Everything must be
 * scaled to roughly 0–1 so no single feature dominates the gradient: lead
 * time alone can range across a year.
 */
interface AppointmentFeatures {
  dayOfWeek: number; // 0-6
  hourOfDay: number; // 0-23
  leadTimeDays: number; // days between booking and appointment
  patientNoShowRate: number; // 0.0 to 1.0
  patientTotalVisits: number; // raw count
  isFirstVisit: number; // 1 or 0
}

export const FEATURE_COUNT = 6;

/** Minimum rows before training is worth attempting. */
export const MIN_TRAINING_ROWS = 50;

function normalizeFeatures(f: AppointmentFeatures): number[] {
  return [
    f.dayOfWeek / 6,
    f.hourOfDay / 23,
    Math.min(f.leadTimeDays, 30) / 30, // max at 30 days
    f.patientNoShowRate, // already 0-1
    Math.min(f.patientTotalVisits, 50) / 50, // max at 50 visits
    f.isFirstVisit, // already 0 or 1
  ];
}

/**
 * The appointment's real hour comes from `timeSlot` ("09:00 - 09:30"),
 * not from `date`.
 *
 * `date` is submitted by the booking form as a calendar day converted to
 * an ISO string, so it is stored as midnight UTC. Reading `getHours()`
 * off it returned the server's UTC offset — a constant — which made
 * hourOfDay a dead input. Time of day is one of the stronger signals for
 * whether someone turns up, so it is worth reading from the right field.
 */
export function hourFromTimeSlot(
  timeSlot: string | undefined,
  fallback: Date,
): number {
  const match = /^\s*(\d{1,2}):(\d{2})/.exec(timeSlot ?? "");
  if (match) {
    const hour = Number(match[1]);
    if (hour >= 0 && hour <= 23) return hour;
  }
  // No usable slot string: fall back to the date's UTC hour rather than
  // local, so the value does not shift with the server's region.
  return fallback.getUTCHours();
}

interface PatientHistory {
  totalVisits: number;
  noShowCount: number;
}

function buildFeatures(
  appointmentDate: Date,
  bookedAt: Date,
  timeSlot: string | undefined,
  history: PatientHistory,
): number[] {
  const { totalVisits, noShowCount } = history;

  /**
   * A new patient scores 0 here, not 0.5. The old neutral default was a
   * fabricated value sitting exactly on the decision boundary, and it
   * duplicated what `isFirstVisit` already says. Letting the dedicated
   * flag carry "we know nothing about this person" keeps the rate feature
   * meaning only what it measures.
   */
  const noShowRate = totalVisits > 0 ? noShowCount / totalVisits : 0;

  const leadTimeDays = Math.max(
    0,
    Math.floor(
      (appointmentDate.getTime() - bookedAt.getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  return normalizeFeatures({
    // getUTCDay, not getDay: the stored date represents a calendar day at
    // midnight UTC, so local-time reads shifted the weekday by one in any
    // region behind UTC.
    dayOfWeek: appointmentDate.getUTCDay(),
    hourOfDay: hourFromTimeSlot(timeSlot, appointmentDate),
    leadTimeDays,
    patientNoShowRate: noShowRate,
    patientTotalVisits: totalVisits,
    isFirstVisit: totalVisits === 0 ? 1 : 0,
  });
}

/**
 * Serving-time feature extraction: one query for this patient's closed
 * history, which is all a single prediction needs.
 */
export async function extractFeatures(
  patientId: string,
  appointmentDate: Date,
  bookedAt: Date,
  timeSlot?: string,
): Promise<number[]> {
  await connectDB();

  const history = await Appointment.find({
    patientId,
    date: { $lt: appointmentDate },
    status: { $in: ["completed", "no-show"] },
  })
    .select("status")
    .lean<{ status: string }[]>();

  return buildFeatures(appointmentDate, bookedAt, timeSlot, {
    totalVisits: history.length,
    noShowCount: history.filter((a) => a.status === "no-show").length,
  });
}

interface TrainingRow {
  patientId: string;
  date: Date;
  createdAt: Date;
  timeSlot?: string;
  status: string;
}

/**
 * Builds the full training set in a single pass.
 *
 * Training previously called extractFeatures once per appointment, so a
 * dataset of N rows issued N sequential database round trips — which on a
 * serverless function times out long before it finishes. Sorting by
 * patient and date lets the same point-in-time history be accumulated as
 * we walk, with one query total.
 *
 * The point-in-time part matters: each row may only see appointments that
 * happened strictly before it. Counting a later outcome would leak the
 * answer into the features and produce a model that looks excellent in
 * training and is useless in production.
 */
export function buildTrainingSet(rows: TrainingRow[]): {
  features: number[][];
  labels: number[];
  skipped: number;
} {
  const sorted = [...rows].sort((a, b) => {
    if (a.patientId !== b.patientId) {
      return a.patientId < b.patientId ? -1 : 1;
    }
    return a.date.getTime() - b.date.getTime();
  });

  const features: number[][] = [];
  const labels: number[] = [];
  let skipped = 0;

  let currentPatient: string | null = null;
  let history: PatientHistory = { totalVisits: 0, noShowCount: 0 };
  // Rows sharing one date are held back so none of them counts toward the
  // others — matching the `date: { $lt: appointmentDate }` filter used at
  // serving time.
  let pendingDate: number | null = null;
  let pending: TrainingRow[] = [];

  const flushPending = () => {
    for (const row of pending) {
      history.totalVisits += 1;
      if (row.status === "no-show") history.noShowCount += 1;
    }
    pending = [];
    pendingDate = null;
  };

  for (const row of sorted) {
    if (row.patientId !== currentPatient) {
      flushPending();
      currentPatient = row.patientId;
      history = { totalVisits: 0, noShowCount: 0 };
    }

    const time = row.date.getTime();
    if (pendingDate !== null && time !== pendingDate) flushPending();

    if (!Number.isFinite(time) || !row.createdAt) {
      skipped += 1;
      continue;
    }

    features.push(
      buildFeatures(row.date, row.createdAt, row.timeSlot, history),
    );
    labels.push(row.status === "no-show" ? 1 : 0);

    pendingDate = time;
    pending.push(row);
  }

  flushPending();

  return { features, labels, skipped };
}

/**
 * Weight initialisation and dropout are both seeded.
 *
 * Left unseeded, two runs over identical data produce measurably
 * different models — which makes a disappointing retrain impossible to
 * tell apart from bad luck, and makes any regression test on model
 * quality flaky. Fixing the seed means a training run can be reproduced
 * and compared.
 */
export const TRAINING_SEED = 1337;

function buildModel(seed = TRAINING_SEED): tf.Sequential {
  const m = tf.sequential();

  // 6 features in → 16 relu units. relu introduces the non-linearity that
  // lets the model learn patterns which are not straight lines.
  m.add(
    tf.layers.dense({
      inputShape: [FEATURE_COUNT],
      units: 16,
      activation: "relu",
      kernelInitializer: tf.initializers.glorotUniform({ seed }),
    }),
  );

  // Drops 20% of activations during training so the network generalises
  // instead of memorising a small dataset.
  m.add(tf.layers.dropout({ rate: 0.2, seed }));

  m.add(
    tf.layers.dense({
      units: 8,
      activation: "relu",
      kernelInitializer: tf.initializers.glorotUniform({ seed: seed + 1 }),
    }),
  );

  // sigmoid squashes the output into 0-1, read as a probability.
  m.add(
    tf.layers.dense({
      units: 1,
      activation: "sigmoid",
      kernelInitializer: tf.initializers.glorotUniform({ seed: seed + 2 }),
    }),
  );

  m.compile({
    optimizer: "adam",
    loss: "binaryCrossentropy",
    metrics: ["accuracy"],
  });

  return m;
}

/** Deterministic shuffle so a training run can be reproduced from a seed. */
function shuffled<T>(items: T[], seed = 42): T[] {
  const out = [...items];
  let state = seed;
  const next = () => {
    // xorshift32 — small, dependency-free, good enough for splitting.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return Math.abs(state) / 2147483647;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// A type alias rather than an interface: aliases carry an implicit index
// signature, so this satisfies the Record<string, number> the storage
// layer persists metrics as.
export type EvaluationMetrics = {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  auc: number;
};

/**
 * Precision and recall, not accuracy, are what tell you whether this
 * model is any use.
 *
 * No-shows are the minority class. A model that predicts "everyone turns
 * up" scores high accuracy and never once flags the patients the feature
 * exists to catch, so accuracy alone would report a useless model as a
 * good one.
 */
export function evaluateAt(
  scores: number[],
  labels: number[],
  threshold: number,
): EvaluationMetrics {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  for (let i = 0; i < scores.length; i++) {
    const predicted = scores[i] >= threshold ? 1 : 0;
    if (labels[i] === 1 && predicted === 1) tp++;
    else if (labels[i] === 0 && predicted === 1) fp++;
    else if (labels[i] === 0 && predicted === 0) tn++;
    else fn++;
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;

  return {
    accuracy: scores.length > 0 ? (tp + tn) / scores.length : 0,
    precision,
    recall,
    f1:
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0,
    auc: rankAuc(scores, labels),
  };
}

/**
 * AUC via the rank-sum identity — the probability that a random no-show
 * scores above a random attendee. Threshold-independent, so it measures
 * the model rather than the cut-off chosen for it.
 */
export function rankAuc(scores: number[], labels: number[]): number {
  const positives = labels.filter((l) => l === 1).length;
  const negatives = labels.length - positives;
  if (positives === 0 || negatives === 0) return 0.5; // undefined; report chance

  const order = scores
    .map((score, index) => ({ score, label: labels[index] }))
    .sort((a, b) => a.score - b.score);

  // Average ranks across ties so identical scores do not bias the result.
  const ranks = new Array<number>(order.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].score === order[i].score) j++;
    const averageRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[k] = averageRank;
    i = j + 1;
  }

  let positiveRankSum = 0;
  for (let k = 0; k < order.length; k++) {
    if (order[k].label === 1) positiveRankSum += ranks[k];
  }

  return (
    (positiveRankSum - (positives * (positives + 1)) / 2) /
    (positives * negatives)
  );
}

/** Picks the cut-off with the best F1 on held-out data. */
function chooseThreshold(
  scores: number[],
  labels: number[],
): { threshold: number; metrics: EvaluationMetrics } {
  let best = { threshold: 0.5, metrics: evaluateAt(scores, labels, 0.5) };

  for (let t = 0.05; t <= 0.95; t += 0.05) {
    const metrics = evaluateAt(scores, labels, t);
    if (metrics.f1 > best.metrics.f1) {
      best = { threshold: Math.round(t * 100) / 100, metrics };
    }
  }

  return best;
}

export interface TrainingResult {
  sampleCount: number;
  positiveRate: number;
  threshold: number;
  metrics: EvaluationMetrics;
  skipped: number;
}

export async function trainModel(): Promise<TrainingResult | null> {
  await connectDB();

  /**
   * No `.populate()` here.
   *
   * It used to populate patientId, which replaced the ObjectId with a
   * user document — and the loop then called `.toString()` on it, yielding
   * the string "[object Object]". Every feature lookup cast-errored, the
   * bare catch swallowed all of them, and training died on an empty
   * tensor. Nothing needed the populated document in the first place.
   */
  const rows = await Appointment.find({
    status: { $in: ["completed", "no-show"] },
  })
    .select("patientId date createdAt timeSlot status")
    .lean<
      {
        patientId: unknown;
        date: Date;
        createdAt: Date;
        timeSlot?: string;
        status: string;
      }[]
    >();

  if (rows.length < MIN_TRAINING_ROWS) {
    console.warn(
      `[prediction] not enough data to train: ${rows.length}/${MIN_TRAINING_ROWS} closed appointments`,
    );
    return null;
  }

  const { features, labels, skipped } = buildTrainingSet(
    rows.map((r) => ({
      patientId: String(r.patientId),
      date: new Date(r.date),
      createdAt: new Date(r.createdAt),
      timeSlot: r.timeSlot,
      status: r.status,
    })),
  );

  // Loud, not silent: if rows are being dropped, that is a data problem
  // worth seeing rather than a quietly smaller training set.
  if (skipped > 0) {
    console.warn(`[prediction] skipped ${skipped} rows with unusable dates`);
  }

  if (features.length < MIN_TRAINING_ROWS) {
    throw new Error(
      `Only ${features.length} usable rows after feature extraction; need ${MIN_TRAINING_ROWS}.`,
    );
  }

  const positives = labels.filter((l) => l === 1).length;
  const negatives = labels.length - positives;

  if (positives === 0 || negatives === 0) {
    throw new Error(
      "Training data contains only one outcome; a classifier needs both no-shows and attendances.",
    );
  }

  // Shuffle before splitting. fit()'s own validationSplit slices the tail
  // of the array *before* shuffling, which with Mongo's insertion order
  // meant validating against whichever patients happened to be last.
  const indices = shuffled(features.map((_, i) => i));
  const validationSize = Math.max(1, Math.floor(indices.length * 0.2));
  const validationIdx = indices.slice(0, validationSize);
  const trainIdx = indices.slice(validationSize);

  const trainX = trainIdx.map((i) => features[i]);
  const trainY = trainIdx.map((i) => labels[i]);
  const valX = validationIdx.map((i) => features[i]);
  const valY = validationIdx.map((i) => labels[i]);

  const model = buildModel();

  /**
   * Class weights counter the imbalance. Without them the optimizer takes
   * the cheap win of predicting the majority class for everything.
   */
  const classWeight = {
    0: labels.length / (2 * negatives),
    1: labels.length / (2 * positives),
  };

  console.log(
    `[prediction] training on ${trainX.length} rows (${positives}/${labels.length} no-shows), validating on ${valX.length}`,
  );

  const xs = tf.tensor2d(trainX);
  const ys = tf.tensor2d(trainY, [trainY.length, 1]);
  const vxs = tf.tensor2d(valX);
  const vys = tf.tensor2d(valY, [valY.length, 1]);

  try {
    await model.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      validationData: [vxs, vys],
      classWeight,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            // Every field is optional-chained: logs.acc is absent on some
            // configurations, and an unguarded .toFixed() threw mid-run.
            const loss = logs?.loss?.toFixed(4) ?? "n/a";
            const acc = logs?.acc?.toFixed(4) ?? "n/a";
            console.log(`[prediction] epoch ${epoch}: loss=${loss} acc=${acc}`);
          }
        },
      },
    });

    const valScores = tf.tidy(() => {
      const output = model.predict(vxs) as tf.Tensor;
      return Array.from(output.dataSync());
    });

    const { threshold, metrics } = chooseThreshold(valScores, valY);

    console.log(
      `[prediction] validation: precision=${metrics.precision.toFixed(3)} recall=${metrics.recall.toFixed(3)} f1=${metrics.f1.toFixed(3)} auc=${metrics.auc.toFixed(3)} @threshold=${threshold}`,
    );

    const positiveRate = positives / labels.length;

    // Persist before swapping the in-memory copy, so a save failure
    // leaves the previously serving model untouched.
    await model.save(
      mongoSaveHandler(NO_SHOW_MODEL, {
        sampleCount: labels.length,
        positiveRate,
        threshold,
        metrics,
      }),
    );

    setCachedModel(model, await readStoredVersion(NO_SHOW_MODEL), threshold);

    console.log("[prediction] model trained and saved");

    return {
      sampleCount: labels.length,
      positiveRate,
      threshold,
      metrics,
      skipped,
    };
  } finally {
    // tf.js does not garbage collect tensors.
    xs.dispose();
    ys.dispose();
    vxs.dispose();
    vys.dispose();
  }
}

// ─────────────────────────────────────────────
// SERVING
// ─────────────────────────────────────────────

interface CachedModel {
  model: tf.LayersModel;
  version: number | null;
  threshold: number;
  checkedAt: number;
}

let cached: CachedModel | null = null;
let inflight: Promise<CachedModel | null> | null = null;

/** How long a warm instance trusts its copy before re-checking the version. */
const VERSION_CHECK_MS = 5 * 60 * 1000;

function setCachedModel(
  model: tf.LayersModel,
  version: number | null,
  threshold: number,
) {
  // Free the tensors held by the copy being replaced.
  if (cached && cached.model !== model) cached.model.dispose();
  cached = { model, version, threshold, checkedAt: Date.now() };
}

/** Test seam: drops the cached model. */
export function __resetModelCache() {
  if (cached) cached.model.dispose();
  cached = null;
  inflight = null;
}

async function loadFromStore(): Promise<CachedModel | null> {
  const stored = await readStoredModel(NO_SHOW_MODEL);
  if (!stored) return null;

  const model = await tf.loadLayersModel(mongoLoadHandler(stored));
  setCachedModel(model, stored.version, stored.threshold ?? 0.5);
  return cached;
}

/**
 * Returns the active model, loading it from Mongo on a cold start and
 * periodically re-checking whether a newer version has been trained.
 */
async function getModel(): Promise<CachedModel | null> {
  if (cached && Date.now() - cached.checkedAt < VERSION_CHECK_MS) {
    return cached;
  }

  // Collapse concurrent cold-start loads into one round trip.
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      if (cached) {
        const latest = await readStoredVersion(NO_SHOW_MODEL);
        if (latest !== null && latest === cached.version) {
          cached.checkedAt = Date.now();
          return cached;
        }
      }
      return await loadFromStore();
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export interface NoShowAssessment {
  /** Predicted probability of a no-show, 0-1. */
  score: number;
  /** Whether the score clears the threshold chosen during training. */
  highRisk: boolean;
}

/**
 * Scores one appointment.
 *
 * Returns null when no trained model exists. It used to return 0.5, which
 * the dashboard then displayed as a genuine "50% risk" for every single
 * patient — a fabricated number presented as a prediction. Null lets the
 * UI show "—" and say nothing rather than something untrue.
 */
export async function predictNoShow(
  patientId: string,
  appointmentDate: Date,
  bookedAt: Date = new Date(),
  timeSlot?: string,
): Promise<NoShowAssessment | null> {
  const active = await getModel();

  if (!active) return null;

  const features = await extractFeatures(
    patientId,
    appointmentDate,
    bookedAt,
    timeSlot,
  );

  const score = tf.tidy(() => {
    const input = tf.tensor2d([features], [1, FEATURE_COUNT]);
    const prediction = active.model.predict(input) as tf.Tensor;
    return prediction.dataSync()[0];
  });

  const rounded = Math.round(score * 100) / 100;

  return { score: rounded, highRisk: rounded >= active.threshold };
}
