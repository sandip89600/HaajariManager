import mongoose, { Schema, Document } from "mongoose";

export interface ISubscriptionConfigV2 extends Document {
  globalEnabled: boolean;
  mode: "free" | "subscription";
  updatedAt: Date;
  updatedBy?: mongoose.Types.ObjectId | string;
}

const SubscriptionConfigV2Schema = new Schema<ISubscriptionConfigV2>(
  {
    globalEnabled: { type: Boolean, default: false },
    mode: { type: String, enum: ["free", "subscription"], default: "free" },
    updatedBy: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const SubscriptionConfigV2 = mongoose.model<ISubscriptionConfigV2>(
  "SubscriptionConfigV2",
  SubscriptionConfigV2Schema
);
