import mongoose, { Schema, Document } from 'mongoose';
import { PlanCode } from './Plan';

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PENDING_PAYMENT';
export type SubscriptionCycle = '1_MONTH_PROMO' | '3_MONTH' | '6_MONTH' | '12_MONTH' | 'LIFETIME';

export interface IUserSubscription extends Document {
  tenantId: string;
  userId?: string;
  planCode: PlanCode;
  billingCycle: SubscriptionCycle;
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  isPromo: boolean;
  campaignCode?: string;
  razorpaySubscriptionId?: string;
  razorpayCustomerId?: string;
  assignedByAdmin?: boolean;
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSubscriptionSchema: Schema = new Schema(
  {
    tenantId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, index: true },
    planCode: {
      type: String,
      required: true,
      enum: ['FREE', 'SUPER', 'PREMIUM'],
      default: 'FREE',
    },
    billingCycle: {
      type: String,
      required: true,
      enum: ['1_MONTH_PROMO', '3_MONTH', '6_MONTH', '12_MONTH', 'LIFETIME'],
      default: 'LIFETIME',
    },
    status: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING_PAYMENT'],
      default: 'ACTIVE',
    },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    autoRenew: { type: Boolean, default: false },
    isPromo: { type: Boolean, default: false },
    campaignCode: { type: String },
    razorpaySubscriptionId: { type: String },
    razorpayCustomerId: { type: String },
    assignedByAdmin: { type: Boolean, default: false },
    adminNotes: { type: String },
  },
  { timestamps: true }
);

export const UserSubscription = mongoose.model<IUserSubscription>(
  'UserSubscription',
  UserSubscriptionSchema
);
