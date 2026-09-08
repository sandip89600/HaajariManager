import mongoose, { Schema, Document } from 'mongoose';

export interface IPromotionRedemption extends Document {
  campaignId: mongoose.Types.ObjectId;
  campaignCode: string;
  tenantId: string;
  userId?: string;
  redeemedAt: Date;
  expiresAt: Date;
  transactionId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PromotionRedemptionSchema: Schema = new Schema(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'PromotionCampaign', required: true },
    campaignCode: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    redeemedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    transactionId: { type: Schema.Types.ObjectId, ref: 'PaymentTransaction' },
  },
  { timestamps: true }
);

PromotionRedemptionSchema.index({ campaignCode: 1, tenantId: 1 }, { unique: true });

export const PromotionRedemption = mongoose.model<IPromotionRedemption>(
  'PromotionRedemption',
  PromotionRedemptionSchema
);
