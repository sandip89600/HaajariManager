import mongoose, { Schema, Document } from "mongoose";

export interface ISubscriptionTransactionV2 extends Document {
  transactionId: string;
  userId: mongoose.Types.ObjectId | string;
  tenantId: mongoose.Types.ObjectId | string;
  planId: string;
  planNameSnapshot: string;
  billingOptionId: string;
  billingSnapshot: Record<string, any>;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "failed" | "refunded" | "cancelled";
  paymentProvider: string;
  paymentReference?: string;
  startedAt?: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionTransactionV2Schema = new Schema<ISubscriptionTransactionV2>(
  {
    transactionId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.Mixed, required: true, index: true },
    tenantId: { type: Schema.Types.Mixed, required: true, index: true },
    planId: { type: String, required: true },
    planNameSnapshot: { type: String, required: true },
    billingOptionId: { type: String, required: true },
    billingSnapshot: { type: Schema.Types.Mixed, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["paid", "pending", "failed", "refunded", "cancelled"],
      default: "pending",
      index: true,
    },
    paymentProvider: { type: String, default: "razorpay" },
    paymentReference: { type: String },
    startedAt: { type: Date },
    expiresAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const SubscriptionTransactionV2 = mongoose.model<ISubscriptionTransactionV2>(
  "SubscriptionTransactionV2",
  SubscriptionTransactionV2Schema
);
