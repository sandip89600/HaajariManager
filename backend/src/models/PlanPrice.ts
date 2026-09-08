import mongoose, { Schema, Document } from 'mongoose';
import { PlanCode } from './Plan';

export type BillingCycle = '3_MONTH' | '6_MONTH' | '12_MONTH';

export interface IPlanPrice extends Document {
  planCode: PlanCode;
  billingCycle: BillingCycle;
  price: number; // Price in INR
  discountPercent?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlanPriceSchema: Schema = new Schema(
  {
    planCode: {
      type: String,
      required: true,
      enum: ['FREE', 'SUPER', 'PREMIUM'],
    },
    billingCycle: {
      type: String,
      required: true,
      enum: ['3_MONTH', '6_MONTH', '12_MONTH'],
    },
    price: { type: Number, required: true },
    discountPercent: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

PlanPriceSchema.index({ planCode: 1, billingCycle: 1 }, { unique: true });

export const PlanPrice = mongoose.model<IPlanPrice>('PlanPrice', PlanPriceSchema);
