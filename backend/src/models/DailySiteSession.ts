import mongoose, { Schema, Document } from "mongoose";

export interface IDailySiteSession extends Document {
  tenantId: mongoose.Types.ObjectId;
  workerId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  siteId: mongoose.Types.ObjectId;
  dateStr: string; // YYYY-MM-DD
  startTime: Date;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  source: "DEFAULT_SITE" | "SMART_DETECTED_SITE" | "WORKER_SELECTED";
  createdAt: Date;
  updatedAt: Date;
}

const DailySiteSessionSchema = new Schema<IDailySiteSession>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    workerId: { type: Schema.Types.ObjectId, ref: "Worker", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    dateStr: { type: String, required: true, trim: true },
    startTime: { type: Date, default: Date.now },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      accuracy: { type: Number },
    },
    source: {
      type: String,
      enum: ["DEFAULT_SITE", "SMART_DETECTED_SITE", "WORKER_SELECTED"],
      default: "DEFAULT_SITE",
    },
  },
  {
    timestamps: true,
  }
);

// Unique index: exactly 1 active work session per worker per day
DailySiteSessionSchema.index(
  { tenantId: 1, workerId: 1, dateStr: 1 },
  { unique: true }
);
DailySiteSessionSchema.index({ tenantId: 1, siteId: 1, dateStr: 1 });

export const DailySiteSession = mongoose.model<IDailySiteSession>(
  "DailySiteSession",
  DailySiteSessionSchema
);
