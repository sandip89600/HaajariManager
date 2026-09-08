import mongoose, { Schema, Document } from 'mongoose';
import { PlanCode } from './Plan';

export interface IPlanEntitlement extends Document {
  planCode: PlanCode;
  featureCode: string;
  enabled: boolean;
  limit: number; // -1 for unlimited
  createdAt: Date;
  updatedAt: Date;
}

const PlanEntitlementSchema: Schema = new Schema(
  {
    planCode: {
      type: String,
      required: true,
      enum: ['FREE', 'SUPER', 'PREMIUM'],
    },
    featureCode: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    limit: { type: Number, default: -1 },
  },
  { timestamps: true }
);

PlanEntitlementSchema.index({ planCode: 1, featureCode: 1 }, { unique: true });

export const PlanEntitlement = mongoose.model<IPlanEntitlement>(
  'PlanEntitlement',
  PlanEntitlementSchema
);
