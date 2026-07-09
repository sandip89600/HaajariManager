import mongoose, { Schema, Document } from "mongoose";

export interface IProject extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  location?: string;
  status: "active" | "inactive";
  clientName?: string;
  budget?: number;
  startDate?: Date;
  endDate?: Date;
  retentionPercentage?: number;
  mobilizationAdvance?: number;
  labourLicenseNumber?: string;
  pfEsicStatus?: "applicable" | "not_applicable";
  wcPolicyNumber?: string;
  progressUnit?: string;
  plannedQty?: number;
  completedQty?: number;
  phases?: {
    name: string;
    weight: number;
    status: "pending" | "in_progress" | "completed";
    percentDone: number;
  }[];
  createdAt: Date;
}

const ProjectSchema = new Schema<IProject>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  name: { type: String, required: true, trim: true },
  location: { type: String },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  clientName: { type: String },
  budget: { type: Number, default: 0 },
  startDate: { type: Date },
  endDate: { type: Date },
  retentionPercentage: { type: Number, default: 0 },
  mobilizationAdvance: { type: Number, default: 0 },
  labourLicenseNumber: { type: String },
  pfEsicStatus: { type: String, enum: ["applicable", "not_applicable"], default: "not_applicable" },
  wcPolicyNumber: { type: String },
  progressUnit: { type: String, default: "cum" },
  plannedQty: { type: Number, default: 0 },
  completedQty: { type: Number, default: 0 },
  phases: [{
    name: { type: String, required: true },
    weight: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ["pending", "in_progress", "completed"], default: "pending" },
    percentDone: { type: Number, default: 0 },
  }],
  createdAt: { type: Date, default: Date.now },
});

ProjectSchema.index({ tenantId: 1 });

export const Project = mongoose.model<IProject>("Project", ProjectSchema);
