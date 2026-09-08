import mongoose, { Schema, Document } from "mongoose";

export interface IUserSubscriptionV2 extends Document {
  userId: mongoose.Types.ObjectId | string;
  tenantId: mongoose.Types.ObjectId | string;
  planId: string;
  billingOptionId: string;
  status: "active" | "expired" | "cancelled" | "pending";
  startedAt: Date;
  expiresAt: Date;
  autoRenew: boolean;
  provider: string;
  providerSubscriptionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSubscriptionV2Schema = new Schema<IUserSubscriptionV2>(
  {
    userId: { type: Schema.Types.Mixed, required: true, index: true },
    tenantId: { type: Schema.Types.Mixed, required: true, index: true },
    planId: { type: String, required: true },
    billingOptionId: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled", "pending"],
      default: "active",
      index: true,
    },
    startedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    autoRenew: { type: Boolean, default: false },
    provider: { type: String, default: "razorpay" },
    providerSubscriptionId: { type: String },
  },
  { timestamps: true }
);

export const UserSubscriptionV2 = mongoose.model<IUserSubscriptionV2>(
  "UserSubscriptionV2",
  UserSubscriptionV2Schema
);
