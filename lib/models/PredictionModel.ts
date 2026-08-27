import mongoose, { Schema, Document } from "mongoose";

/**
 * Persisted TensorFlow model artifacts.
 *
 * The trained model used to live only in a module-level variable, which
 * meant it existed for exactly as long as one Node process. On a
 * serverless deployment every cold start begins with no model, and the
 * instance that ran training is almost never the instance that serves the
 * next booking — so predictions fell back to a neutral score essentially
 * always.
 *
 * Storing the artifacts in Mongo keeps this to infrastructure the app
 * already has. The network is small — a 6→16→8→1 dense stack is a few
 * hundred parameters, low single-digit kilobytes — so a document is a
 * perfectly reasonable home for it. If the architecture ever grows,
 * object storage would be the next step.
 */
export interface IPredictionModel extends Document {
  /** Singleton key; there is one active model per name. */
  name: string;
  version: number;

  // tf.io.ModelArtifacts, split across fields Mongo can store.
  modelTopology: unknown;
  weightSpecs: unknown[];
  weightData: Buffer;
  format?: string;
  generatedBy?: string;
  convertedBy?: string;

  /** Provenance and quality, so a bad model can be spotted and rolled back. */
  trainedAt: Date;
  sampleCount: number;
  positiveRate: number;
  metrics?: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1?: number;
    auc?: number;
    loss?: number;
  };
  /** Score above which an appointment is treated as high risk. */
  threshold: number;
}

const PredictionModelSchema = new Schema<IPredictionModel>(
  {
    name: { type: String, required: true, unique: true },
    version: { type: Number, required: true, default: 1 },

    modelTopology: { type: Schema.Types.Mixed, required: true },
    weightSpecs: { type: [Schema.Types.Mixed], required: true },
    weightData: { type: Buffer, required: true },
    format: { type: String },
    generatedBy: { type: String },
    convertedBy: { type: String },

    trainedAt: { type: Date, required: true, default: Date.now },
    sampleCount: { type: Number, required: true },
    positiveRate: { type: Number, required: true },
    metrics: {
      accuracy: { type: Number },
      precision: { type: Number },
      recall: { type: Number },
      f1: { type: Number },
      auc: { type: Number },
      loss: { type: Number },
    },
    threshold: { type: Number, required: true, default: 0.5 },
  },
  { timestamps: true },
);

export default mongoose.models.PredictionModel ||
  mongoose.model<IPredictionModel>("PredictionModel", PredictionModelSchema);
