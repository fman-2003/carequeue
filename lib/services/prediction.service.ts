import * as tf from "@tensorflow/tfjs";
import { connectDB } from "@/lib/db";
import Appointment from "@/lib/models/Appointment";

// we do not want to re-train model on every prediction request
let model: tf.Sequential | null = null;

// we extract needed features so that everything must be a
// normalized number (0 to 1) for the model to understand
interface AppointmentFeatures {
  dayOfWeek: number; // 0-6
  hourOfDay: number; // 0-23
  leadTimeDays: number; // days between booking and appointment
  patientNoShowRate: number; // 0.0 to 1.0
  patientTotalVisits: number; // normal raw count
  isFirstVisit: number; // 1 or 0 (boolean as number for the model)
}

// we need to squish values into ranges of 0 - 1 so that the model can learn effectively.
// otherwise a feature like leadTimeDays can range from 0 to 365
// and the model might not be able to learn patterns from it
function normalizeFeatures(f: AppointmentFeatures): number[] {
  return [
    f.dayOfWeek / 6,
    f.hourOfDay / 23, // 0-23  → 0-1
    Math.min(f.leadTimeDays, 30) / 30, // max at 30 days
    f.patientNoShowRate, // already 0-1
    Math.min(f.patientTotalVisits, 50) / 50, // max at 50 visits
    f.isFirstVisit, // already 0 or 1
  ];
}

// we now extract the features we defined
// above from the raw data in our db
export async function extractFeatures(
  patientId: string,
  appointmentDate: Date,
  bookedAt: Date,
): Promise<number[]> {
  await connectDB();

  // fetching all of past appointments for this patient
  const history = await Appointment.find({
    patientId,
    date: { $lt: appointmentDate },
    status: { $in: ["completed", "no-show"] },
  }).lean();

  const totalVisits = history.length;
  const noShowCount = history.filter((a) => a.status === "no-show").length;
  // 0.5 is our neutral default for brand new patients
  // as no evidence of patient behaviour
  const noShowRate = totalVisits > 0 ? noShowCount / totalVisits : 0.5;

  const leadTimeDays = Math.floor(
    (appointmentDate.getTime() - bookedAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  const features: AppointmentFeatures = {
    dayOfWeek: appointmentDate.getDay(),
    hourOfDay: appointmentDate.getHours(),
    leadTimeDays,
    patientNoShowRate: noShowRate,
    patientTotalVisits: totalVisits,
    isFirstVisit: totalVisits === 0 ? 1 : 0,
  };

  return normalizeFeatures(features);
}

// ─────────────────────────────────────────────
// BUILD MODEL ARCHITECTURE
// A simple neural network with 2 hidden layers.
// For a binary classification problem like this
// (show vs no-show), this is more than enough.
// ─────────────────────────────────────────────
function buildModel(): tf.Sequential {
  const m = tf.sequential();

  /**
   * INPUT LAYER — 6 features coming in
   * units: 16 → 16 neurons in first hidden layer
   * relu activation → standard for hidden layers,
   * introduces non-linearity so the model can learn
   * patterns that aren't just straight lines
   */
  m.add(
    tf.layers.dense({
      inputShape: [6],
      units: 16,
      activation: "relu",
    }),
  );

  /**
   * DROPOUT LAYER
   * Randomly "turns off" 20% of neurons during training.
   * This prevents overfitting — stops the model from
   * just memorizing training data instead of learning patterns.
   */
  m.add(tf.layers.dropout({ rate: 0.2 }));

  // second hidden layer
  m.add(
    tf.layers.dense({
      units: 8,
      activation: "relu",
    }),
  );

  /**
   * OUTPUT LAYER
   * units: 1 → single output value (the risk score)
   * sigmoid → squishes output to 0-1 range,
   * perfect for probability outputs
   */
  m.add(
    tf.layers.dense({
      units: 1,
      activation: "sigmoid",
    }),
  );

  /**
   * COMPILE
   * adam → adaptive optimizer, works well out of the box
   * binaryCrossentropy → standard loss for binary classification
   * accuracy → metric we track during training
   */
  m.compile({
    optimizer: "adam",
    loss: "binaryCrossentropy",
    metrics: ["accuracy"],
  });

  return m;
}

// ─────────────────────────────────────────────
// TRAIN MODEL
// Pulls historical data from DB and trains the model.
// This should be called:
// 1. Once when you have enough historical data
// 2. Periodically (e.g. weekly) via a cron job to retrain
//    on new data — model improves over time
// ─────────────────────────────────────────────
export async function trainModel() {
  await connectDB();

  console.log("Fetching training data...");

  // fetch all completed/no-show appointments with patient info
  const appointments = await Appointment.find({
    status: { $in: ["completed", "no-show"] },
  })
    .populate("patientId")
    .lean();

  if (appointments.length < 50) {
    console.warn("Not enough data to train. Need at least 50 appointments.");
    return null;
  }

  console.log(`Training on ${appointments.length} appointments...`);

  // build feature vectors and labels for every appointment
  const featureArrays: number[][] = [];
  const labels: number[] = [];

  for (const appt of appointments) {
    try {
      const features = await extractFeatures(
        appt.patientId.toString(),
        new Date(appt.date),
        new Date(appt.createdAt),
      );
      featureArrays.push(features);

      // 1 = no-show (positive class), 0 = showed up
      labels.push(appt.status === "no-show" ? 1 : 0);
    } catch {
      // skip appointments with missing data
      continue;
    }
  }

  /**
   * Convert to tensors — TensorFlow works with
   * tensors, not plain JS arrays.
   * Think of a tensor as a multi-dimensional array
   * optimized for mathematical operations.
   */
  const xs = tf.tensor2d(featureArrays); // shape: [n, 6]
  const ys = tf.tensor2d(labels, [labels.length, 1]); // shape: [n, 1]

  model = buildModel();

  await model.fit(xs, ys, {
    epochs: 50, // passes through the full dataset 50 times
    batchSize: 32, // process 32 samples at a time
    validationSplit: 0.2, // hold back 20% of data to validate against
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        // log progress every 10 epochs so you can see it training
        if (epoch % 10 === 0) {
          console.log(
            `Epoch ${epoch}: loss=${logs?.loss.toFixed(4)}, accuracy=${logs?.acc.toFixed(4)}`,
          );
        }
      },
    },
  });

  // clean up tensors from memory — TF.js doesn't GC these automatically
  xs.dispose();
  ys.dispose();

  console.log("Model training complete ✅");
  return model;
}

// ─────────────────────────────────────────────
// PREDICT — the function everything else calls
// ─────────────────────────────────────────────
export async function predictNoShow(
  patientId: string,
  appointmentDate: Date,
  bookedAt: Date = new Date(),
): Promise<number> {
  /**
   * If model hasn't been trained yet, we can't predict.
   * Return 0.5 (neutral) rather than crashing.
   * Once enough data exists and trainModel() is called,
   * this will return real predictions.
   */
  if (!model) {
    console.warn("Model not trained yet — returning neutral score");
    return 0.5;
  }

  const features = await extractFeatures(patientId, appointmentDate, bookedAt);

  // wrap in tf.tidy() — automatically cleans up intermediate tensors
  const score = tf.tidy(() => {
    const input = tf.tensor2d([features]); // shape: [1, 6]
    const prediction = model!.predict(input) as tf.Tensor;
    return prediction.dataSync()[0]; // extract the single number
  });

  return Math.round(score * 100) / 100;
}
