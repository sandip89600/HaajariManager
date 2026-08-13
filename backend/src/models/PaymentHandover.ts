import mongoose, { Schema, Document } from "mongoose";

export interface IPaymentHandover extends Document {
  tenantId: mongoose.Types.ObjectId;
  siteId?: mongoose.Types.ObjectId;
  amount: number;
  recipientName: string;
  notes?: string;
  handoverDate: Date;
  status: "Pending" | "Completed";
  createdAt: Date;
}

export interface IPaymentProof extends Document {
  tenantId: mongoose.Types.ObjectId;
  paymentId?: mongoose.Types.ObjectId;
  proofUri: string;
  notes?: string;
  uploadedAt: Date;
}

const PaymentHandoverSchema = new Schema<IPaymentHandover>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  siteId: { type: Schema.Types.ObjectId, ref: "Site" },
  amount: { type: Number, required: true },
  recipientName: { type: String, required: true, trim: true },
  notes: { type: String, trim: true },
  handoverDate: { type: Date, default: Date.now },
  status: { type: String, enum: ["Pending", "Completed"], default: "Completed" }
}, {
  timestamps: true
});

const PaymentProofSchema = new Schema<IPaymentProof>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
  proofUri: { type: String, required: true },
  notes: { type: String, trim: true },
  uploadedAt: { type: Date, default: Date.now }
});

export const PaymentHandover = mongoose.model<IPaymentHandover>("PaymentHandover", PaymentHandoverSchema);
export const PaymentProof = mongoose.model<IPaymentProof>("PaymentProof", PaymentProofSchema);
