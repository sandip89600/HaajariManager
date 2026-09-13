import mongoose, { Schema, Document } from "mongoose";

export interface IWorker extends Document {
  tenantId: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  uniqueId?: string;
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
  isClaimed?: boolean;
  claimedAt?: Date;
  createdAt: Date;
}

export function generateWorkerUniqueId(): string {
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `HM-W-${randomNum}`;
}

const WorkerSchema = new Schema<IWorker>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  projectId: { type: Schema.Types.ObjectId, ref: "Project" },
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  uniqueId: { type: String, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  dailyRate: { type: Number, required: true, min: 0 },
  skillCategory: { type: String, enum: ["skilled", "semi_skilled", "unskilled"], default: "unskilled" },
  paymentType: { type: String, enum: ["daily", "piece_rate", "contract"], default: "daily" },
  pieceRateAmount: { type: Number, default: 0 },
  subContractorName: { type: String, trim: true },
  phone: { type: String, trim: true },
  address: { type: String },
  notes: { type: String },
  photoUri: { type: String },
  isArchived: { type: Boolean, default: false },
  isClaimed: { type: Boolean, default: false },
  claimedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

WorkerSchema.index({ tenantId: 1 });
WorkerSchema.index({ tenantId: 1, isArchived: 1 });
WorkerSchema.index({ tenantId: 1, name: 1 });
WorkerSchema.index({ tenantId: 1, projectId: 1, isArchived: 1 });
WorkerSchema.index({ uniqueId: 1 }, { sparse: true });
WorkerSchema.index({ phone: 1 });
WorkerSchema.index({ userId: 1 }, { sparse: true });

WorkerSchema.pre<IWorker>("save", async function (next) {
  if (!this.uniqueId) {
    let uId = generateWorkerUniqueId();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await mongoose.models.Worker?.findOne({ uniqueId: uId });
      if (!existing) {
        this.uniqueId = uId;
        break;
      }
      uId = generateWorkerUniqueId();
      attempts++;
    }
    if (!this.uniqueId) {
      this.uniqueId = uId;
    }
  }
  next();
});

export const Worker = mongoose.model<IWorker>("Worker", WorkerSchema);
