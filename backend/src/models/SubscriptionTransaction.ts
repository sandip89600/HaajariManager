import mongoose, { Schema, Document } from "mongoose";

export interface ISubscriptionTransaction extends Document {
  tenantId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  planName: "basic" | "super" | "premium" | "free" | "professional" | "business";
  billingCycle: "monthly" | "3months" | "yearly";
  amount: number;
  gst: number;
  paymentMethod: "UPI" | "Credit Card" | "Debit Card" | "Net Banking" | "Wallet" | "Razorpay";
  status: "Pending" | "Completed" | "Failed";
  date: Date;
  autoRenew: boolean;
}

const SubscriptionTransactionSchema = new Schema<ISubscriptionTransaction>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  invoiceNumber: { type: String, required: true, unique: true },
  planName: { type: String, required: true },
  billingCycle: { type: String, enum: ["monthly", "3months", "yearly"], required: true },
  amount: { type: Number, required: true },
  gst: { type: Number, required: true },
  paymentMethod: { type: String, required: true },
  status: { type: String, enum: ["Pending", "Completed", "Failed"], default: "Pending" },
  date: { type: Date, default: Date.now },
  autoRenew: { type: Boolean, default: true },
});

SubscriptionTransactionSchema.index({ tenantId: 1, date: -1 });

export const SubscriptionTransaction = mongoose.model<ISubscriptionTransaction>(
  "SubscriptionTransaction",
  SubscriptionTransactionSchema
);
