import mongoose, { Schema, Document } from "mongoose";

export interface IFeatureConfig {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  premium: boolean;
  minPlan: "free" | "basic" | "super" | "premium";
}

export interface IAppConfig extends Document {
  subscriptionsEnabled: boolean;
  features: IFeatureConfig[];
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FeatureConfigSchema = new Schema<IFeatureConfig>({
  key: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  enabled: { type: Boolean, required: true, default: true },
  premium: { type: Boolean, required: true, default: false },
  minPlan: { 
    type: String, 
    enum: ["free", "basic", "super", "premium"], 
    default: "free" 
  }
});

const AppConfigSchema = new Schema<IAppConfig>({
  subscriptionsEnabled: { type: Boolean, required: true, default: false },
  features: [FeatureConfigSchema],
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
}, {
  timestamps: true
});

export const AppConfig = mongoose.model<IAppConfig>("AppConfig", AppConfigSchema);
