import mongoose, { Schema, Document } from "mongoose";

export interface IBillingOptionV2 {
  optionId: string;
  durationMonths: number;
  billingLabel: string;
  price: number;
  currency: string;
  active: boolean;
  promotionEnabled: boolean;
  promotionalPrice?: number;
  promotionalDurationMonths?: number;
}

export interface IPlanFeaturesV2 {
  maxWorkers: number; // -1 for unlimited
  maxProjects: number; // -1 for unlimited
  maxSupervisors: number; // -1 for unlimited
  gpsAttendance: boolean;
  reports: boolean;
  advancedReports: boolean;
}

export interface ISubscriptionPlanV2 extends Document {
  planId: string;
  name: string;
  description: string;
  active: boolean;
  displayOrder: number;
  features: IPlanFeaturesV2;
  billingOptions: IBillingOptionV2[];
  createdAt: Date;
  updatedAt: Date;
}

const BillingOptionV2Schema = new Schema<IBillingOptionV2>({
  optionId: { type: String, required: true },
  durationMonths: { type: Number, required: true, default: 1 },
  billingLabel: { type: String, required: true, default: "Monthly" },
  price: { type: Number, required: true, default: 0 },
  currency: { type: String, default: "INR" },
  active: { type: Boolean, default: true },
  promotionEnabled: { type: Boolean, default: false },
  promotionalPrice: { type: Number },
  promotionalDurationMonths: { type: Number, default: 1 },
});

const PlanFeaturesV2Schema = new Schema<IPlanFeaturesV2>({
  maxWorkers: { type: Number, default: 15 },
  maxProjects: { type: Number, default: 1 },
  maxSupervisors: { type: Number, default: 1 },
  gpsAttendance: { type: Boolean, default: true },
  reports: { type: Boolean, default: true },
  advancedReports: { type: Boolean, default: false },
});

const SubscriptionPlanV2Schema = new Schema<ISubscriptionPlanV2>(
  {
    planId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    active: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
    features: { type: PlanFeaturesV2Schema, required: true },
    billingOptions: { type: [BillingOptionV2Schema], default: [] },
  },
  { timestamps: true }
);

export const SubscriptionPlanV2 = mongoose.model<ISubscriptionPlanV2>(
  "SubscriptionPlanV2",
  SubscriptionPlanV2Schema
);
