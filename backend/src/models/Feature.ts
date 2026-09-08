import mongoose, { Schema, Document } from 'mongoose';

export interface IFeature extends Document {
  code: string;
  name: string;
  description: string;
  category: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FeatureSchema: Schema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true, default: 'General' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Feature = mongoose.model<IFeature>('Feature', FeatureSchema);
