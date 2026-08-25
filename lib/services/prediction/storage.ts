import * as tf from "@tensorflow/tfjs";
import { connectDB } from "@/lib/db";
import PredictionModel from "@/lib/models/PredictionModel";

/**
 * A TensorFlow.js IOHandler backed by MongoDB.
 *
 * tf.js talks to storage through the `save`/`load` pair below, so the
 * same `model.save()` / `tf.loadLayersModel()` calls work against Mongo
 * with no special-casing at the call site.
 */

/** There is one no-show model for the whole platform. */
export const NO_SHOW_MODEL = "no-show";

export interface ModelMetadata {
  version: number;
  trainedAt: Date;
  sampleCount: number;
  positiveRate: number;
  threshold: number;
  metrics?: Readonly<Record<string, number>>;
}

/** Everything about the stored model except the weights themselves. */
type StoredModelDoc = {
  version: number;
  modelTopology: unknown;
  weightSpecs: unknown[];
  weightData: Buffer;
  format?: string;
  generatedBy?: string;
  convertedBy?: string;
  trainedAt: Date;
  sampleCount: number;
  positiveRate: number;
  threshold: number;
  metrics?: Readonly<Record<string, number>>;
};

/**
 * Node Buffers are views into a larger pooled ArrayBuffer, so handing
 * `buffer.buffer` straight to tf.js would expose neighbouring memory and
 * produce garbage weights. Copy out just this Buffer's bytes.
 */
function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const copy = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(copy).set(buffer);
  return copy;
}

export function mongoSaveHandler(
  name: string,
  meta: Omit<ModelMetadata, "version" | "trainedAt">,
): tf.io.IOHandler {
  return {
    async save(artifacts: tf.io.ModelArtifacts): Promise<tf.io.SaveResult> {
      await connectDB();

      const weightData = Buffer.from(artifacts.weightData as ArrayBuffer);

      // Bump the version on every save so warm instances holding an older
      // copy can notice and reload.
      const existing = await PredictionModel.findOne({ name })
        .select("version")
        .lean<{ version?: number }>();

      const doc = await PredictionModel.findOneAndUpdate(
        { name },
        {
          $set: {
            version: (existing?.version ?? 0) + 1,
            modelTopology: artifacts.modelTopology,
            weightSpecs: artifacts.weightSpecs,
            weightData,
            format: artifacts.format,
            generatedBy: artifacts.generatedBy,
            convertedBy: artifacts.convertedBy,
            trainedAt: new Date(),
            sampleCount: meta.sampleCount,
            positiveRate: meta.positiveRate,
            threshold: meta.threshold,
            metrics: meta.metrics,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      return {
        modelArtifactsInfo: {
          dateSaved: doc.trainedAt,
          modelTopologyType: "JSON",
          weightDataBytes: weightData.byteLength,
        },
      };
    },
  };
}

export function mongoLoadHandler(stored: StoredModelDoc): tf.io.IOHandler {
  return {
    async load(): Promise<tf.io.ModelArtifacts> {
      return {
        modelTopology: stored.modelTopology as tf.io.ModelArtifacts["modelTopology"],
        weightSpecs: stored.weightSpecs as tf.io.WeightsManifestEntry[],
        weightData: toArrayBuffer(stored.weightData),
        format: stored.format,
        generatedBy: stored.generatedBy,
        convertedBy: stored.convertedBy,
      };
    },
  };
}

/** Reads the stored model document, weights included. */
export async function readStoredModel(
  name: string,
): Promise<StoredModelDoc | null> {
  await connectDB();
  return await PredictionModel.findOne({ name }).lean<StoredModelDoc | null>();
}

/**
 * Reads only the version, so a warm instance can check whether its cached
 * model is stale without pulling the weights over the wire every time.
 */
export async function readStoredVersion(name: string): Promise<number | null> {
  await connectDB();
  const doc = await PredictionModel.findOne({ name })
    .select("version")
    .lean<{ version?: number } | null>();
  return doc?.version ?? null;
}
