import mongoose, { Schema, Document } from 'mongoose';

export type PlanCode = 'FREE' | 'SUPER' | 'PREMIUM';

export interface IPlan extends Document {
  code: PlanCode;
  name: string;
  description: string;
  badge?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema: Schema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      enum: ['FREE', 'SUPER', 'PREMIUM'],
    },
    name: { type: String, required: true },
    description: { type: String, required: true },
    badge: { type: String },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Plan = mongoose.model<IPlan>('Plan', PlanSchema);
