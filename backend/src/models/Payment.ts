import mongoose, { Schema, Document } from "mongoose";

export interface IPayment extends Document {
  tenantId: mongoose.Types.ObjectId;
  workerId: mongoose.Types.ObjectId;
  year: number;
  month: number;
  amount: number;
  paidAt: Date;
  note?: string;
  createdBy: mongoose.Types.ObjectId;
  method?: string;
}

const PaymentSchema = new Schema<IPayment>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  workerId: { type: Schema.Types.ObjectId, ref: "Worker", required: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  amount: { type: Number, required: true, min: 0 },
  paidAt: { type: Date, default: Date.now },
  note: { type: String },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  method: { type: String, enum: ["Cash", "UPI", "Bank Transfer"], default: "Cash" },
});

PaymentSchema.index({ tenantId: 1, workerId: 1, year: 1, month: 1 });

export const Payment = mongoose.model<IPayment>("Payment", PaymentSchema);
