import mongoose, { Schema, Document } from "mongoose";

export interface IDailySiteWorkUpdate extends Document {
  tenantId: mongoose.Types.ObjectId;
  siteId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  dateStr: string; // YYYY-MM-DD format for fast per-day lookup
  status: "not_started" | "in_progress" | "completed";

  // Morning Data
  workType?: string;
  description?: string;
  startingPoint?: string;
  morningPhoto?: string;
  morningTimestamp?: Date;
  morningLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };

  // Evening Data
  completionDescription?: string;
  endingPoint?: string;
  eveningPhoto?: string;
  eveningTimestamp?: Date;
  eveningLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  progress?: string;
  progressPercent?: number;
  issues?: string;

  createdAt: Date;
  updatedAt: Date;
}

const DailySiteWorkUpdateSchema = new Schema<IDailySiteWorkUpdate>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dateStr: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed"],
      default: "in_progress",
    },

    // Morning Data
    workType: { type: String, trim: true },
    description: { type: String, trim: true },
    startingPoint: { type: String, trim: true },
    morningPhoto: { type: String, trim: true },
    morningTimestamp: { type: Date },
    morningLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      address: { type: String, trim: true },
    },

    // Evening Data
    completionDescription: { type: String, trim: true },
    endingPoint: { type: String, trim: true },
    eveningPhoto: { type: String, trim: true },
    eveningTimestamp: { type: Date },
    eveningLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      address: { type: String, trim: true },
    },
    progress: { type: String, trim: true },
    progressPercent: { type: Number, min: 0, max: 100, default: 0 },
    issues: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

DailySiteWorkUpdateSchema.index({ tenantId: 1, siteId: 1, dateStr: 1 }, { unique: true });
DailySiteWorkUpdateSchema.index({ siteId: 1, createdAt: -1 });

export const DailySiteWorkUpdate = mongoose.model<IDailySiteWorkUpdate>(
  "DailySiteWorkUpdate",
  DailySiteWorkUpdateSchema
);
