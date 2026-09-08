import mongoose, { Schema, Document } from 'mongoose';
import { PlanCode } from './Plan';

export type PaymentStatus = 'CREATED' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export interface IPaymentTransaction extends Document {
  tenantId: string;
  userId?: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  amount: number; // in INR
  currency: string;
  status: PaymentStatus;
  planCode: PlanCode;
  billingCycle: string;
  isPromo: boolean;
  campaignCode?: string;
  failureReason?: string;
  rawPayload?: any;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentTransactionSchema: Schema = new Schema(
  {
    tenantId: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    razorpayOrderId: { type: String, required: true, index: true },
    razorpayPaymentId: { type: String, index: true },
    razorpaySignature: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      required: true,
      enum: ['CREATED', 'SUCCESS', 'FAILED', 'REFUNDED'],
      default: 'CREATED',
    },
    planCode: {
      type: String,
      required: true,
      enum: ['FREE', 'SUPER', 'PREMIUM'],
    },
    billingCycle: { type: String, required: true },
    isPromo: { type: Boolean, default: false },
    campaignCode: { type: String },
    failureReason: { type: String },
    rawPayload: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const PaymentTransaction = mongoose.model<IPaymentTransaction>(
  'PaymentTransaction',
  PaymentTransactionSchema
);
