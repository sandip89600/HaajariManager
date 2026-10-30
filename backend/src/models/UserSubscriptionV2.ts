import mongoose, { Schema, Document } from "mongoose";

export interface IUserSubscriptionV2 extends Document {
  userId: mongoose.Types.ObjectId | string;
  tenantId: mongoose.Types.ObjectId | string;
  planId: string;
  billingOptionId: string;
  status: "active" | "expired" | "cancelled" | "pending" | "in_grace_period" | "on_hold" | "superseded";
  startedAt: Date;
  expiresAt: Date;
  autoRenew: boolean;
  cancelAtPeriodEnd?: boolean;
  cancelledAt?: Date;
  cancellationReason?: string;
  provider: string; // "google_play" | "razorpay" | "manual"
  providerSubscriptionId?: string;
  // Google Play Billing fields
  purchaseToken?: string;
  orderId?: string;
  linkedPurchaseToken?: string;
  googlePlayState?: string;
  lineItems?: Array<{
    productId: string;
    expiryTime: Date;
    autoRenewing: boolean;
  }>;
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
      enum: ["active", "expired", "cancelled", "pending", "in_grace_period", "on_hold", "superseded"],
      default: "active",
      index: true,
    },
    startedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    autoRenew: { type: Boolean, default: false },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
    provider: { type: String, default: "google_play" },
    providerSubscriptionId: { type: String },
    purchaseToken: { type: String, index: true },
    orderId: { type: String, index: true },
    linkedPurchaseToken: { type: String },
    googlePlayState: { type: String },
    lineItems: [
      {
        productId: { type: String },
        expiryTime: { type: Date },
        autoRenewing: { type: Boolean },
      },
    ],
  },
  { timestamps: true }
);

export const UserSubscriptionV2 = mongoose.model<IUserSubscriptionV2>(
  "UserSubscriptionV2",
  UserSubscriptionV2Schema
);
