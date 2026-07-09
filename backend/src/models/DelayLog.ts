import mongoose, { Schema, Document } from "mongoose";

export interface IDelayLog extends Document {
  tenantId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  delayDays: number;
  reasonCode: "weather" | "material_shortage" | "labour_shortage" | "design_change" | "machinery_breakdown" | "other";
  description?: string;
  date: Date;
  createdAt: Date;
}

const DelayLogSchema = new Schema<IDelayLog>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  delayDays: { type: Number, required: true, min: 0 },
  reasonCode: {
    type: String,
    enum: ["weather", "material_shortage", "labour_shortage", "design_change", "machinery_breakdown", "other"],
    required: true,
  },
  description: { type: String },
  date: { type: Date, required: true, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

DelayLogSchema.index({ tenantId: 1 });
DelayLogSchema.index({ projectId: 1 });
DelayLogSchema.index({ date: -1 });

export const DelayLog = mongoose.model<IDelayLog>("DelayLog", DelayLogSchema);
