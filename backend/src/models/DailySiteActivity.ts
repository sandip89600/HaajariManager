import mongoose, { Schema, Document } from "mongoose";

export interface IDailySiteActivity extends Document {
  tenantId: mongoose.Types.ObjectId;
  siteId: mongoose.Types.ObjectId;
  workerId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  userName: string;
  workerRole?: string;
  activityType: "MORNING_WORK" | "EVENING_WORK" | "ISSUE" | "INSTRUCTION";
  photo?: string;
  description: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
  };
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // e.g. "09:12 AM"
  status?: "OPEN" | "RESOLVED" | "ACTIVE" | "ARCHIVED";
  clientRequestId?: string;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  capturedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DailySiteActivitySchema = new Schema<IDailySiteActivity>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    workerId: { type: Schema.Types.ObjectId, ref: "Worker" },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true, trim: true },
    workerRole: { type: String, trim: true },
    activityType: {
      type: String,
      enum: ["MORNING_WORK", "EVENING_WORK", "ISSUE", "INSTRUCTION"],
      required: true,
    },
    photo: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      accuracy: { type: Number },
      address: { type: String, trim: true },
    },
    dateStr: { type: String, required: true, trim: true },
    timeStr: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["OPEN", "RESOLVED", "ACTIVE", "ARCHIVED"],
      default: function (this: IDailySiteActivity) {
        if (this.activityType === "ISSUE") return "OPEN";
        if (this.activityType === "INSTRUCTION") return "ACTIVE";
        return undefined;
      },
    },
    clientRequestId: { type: String, trim: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
    capturedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

DailySiteActivitySchema.index({ tenantId: 1, siteId: 1, dateStr: 1, createdAt: -1 });
DailySiteActivitySchema.index({ tenantId: 1, workerId: 1, dateStr: 1, activityType: 1 });
DailySiteActivitySchema.index({ tenantId: 1, siteId: 1, activityType: 1 });
DailySiteActivitySchema.index({ clientRequestId: 1 }, { sparse: true });

export const DailySiteActivity = mongoose.model<IDailySiteActivity>(
  "DailySiteActivity",
  DailySiteActivitySchema
);
