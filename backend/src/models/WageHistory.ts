import mongoose, { Schema, Document } from "mongoose";

export interface IWageHistory extends Document {
  tenantId: mongoose.Types.ObjectId;
  workerId: mongoose.Types.ObjectId;
  dailyRate: number;
  startDate: Date;
  endDate?: Date;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const WageHistorySchema = new Schema<IWageHistory>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  workerId: { type: Schema.Types.ObjectId, ref: "Worker", required: true },
  dailyRate: { type: Number, required: true, min: 0 },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

WageHistorySchema.index({ tenantId: 1, workerId: 1, startDate: 1 });

export const WageHistory = mongoose.model<IWageHistory>("WageHistory", WageHistorySchema);
