import mongoose, { Schema, Document } from "mongoose";

export interface IWorker extends Document {
  tenantId: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  name: string;
  category: string;
  dailyRate: number;
  skillCategory?: "skilled" | "semi_skilled" | "unskilled";
  paymentType?: "daily" | "piece_rate" | "contract";
  pieceRateAmount?: number;
  subContractorName?: string;
  phone?: string;
  address?: string;
  notes?: string;
  photoUri?: string;
  isArchived: boolean;
  createdAt: Date;
}

const WorkerSchema = new Schema<IWorker>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  projectId: { type: Schema.Types.ObjectId, ref: "Project" },
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  dailyRate: { type: Number, required: true, min: 0 },
  skillCategory: { type: String, enum: ["skilled", "semi_skilled", "unskilled"], default: "unskilled" },
  paymentType: { type: String, enum: ["daily", "piece_rate", "contract"], default: "daily" },
  pieceRateAmount: { type: Number, default: 0 },
  subContractorName: { type: String, trim: true },
  phone: { type: String },
  address: { type: String },
  notes: { type: String },
  photoUri: { type: String },
  isArchived: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

WorkerSchema.index({ tenantId: 1 });
WorkerSchema.index({ tenantId: 1, name: 1 });

export const Worker = mongoose.model<IWorker>("Worker", WorkerSchema);
