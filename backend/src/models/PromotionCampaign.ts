import mongoose, { Schema, Document } from 'mongoose';
import { PlanCode } from './Plan';

export type PromoEligibility = 'NEW_USERS_ONLY' | 'ALL_USERS' | 'EXPIRED_USERS_ONLY';

export interface IPromotionCampaign extends Document {
  code: string;
  name: string;
  description: string;
  promoPrice: number; // in INR (e.g. 2)
  durationDays: number; // e.g. 30
  targetPlanCode: PlanCode;
  eligibility: PromoEligibility;
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  maxRedemptions: number; // -1 for unlimited
  currentRedemptions: number;
  createdAt: Date;
  updatedAt: Date;
}

const PromotionCampaignSchema: Schema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    promoPrice: { type: Number, required: true, default: 2 },
    durationDays: { type: Number, required: true, default: 30 },
    targetPlanCode: {
      type: String,
      required: true,
      enum: ['FREE', 'SUPER', 'PREMIUM'],
      default: 'SUPER',
    },
    eligibility: {
      type: String,
      required: true,
      enum: ['NEW_USERS_ONLY', 'ALL_USERS', 'EXPIRED_USERS_ONLY'],
      default: 'NEW_USERS_ONLY',
    },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true },
    maxRedemptions: { type: Number, default: -1 },
    currentRedemptions: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const PromotionCampaign = mongoose.model<IPromotionCampaign>(
  'PromotionCampaign',
  PromotionCampaignSchema
);
