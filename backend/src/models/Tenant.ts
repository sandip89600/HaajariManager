import mongoose, { Schema, Document } from "mongoose";

export interface ITenant extends Document {
  name: string;
  code: string;
  plan: "free" | "professional" | "business";
  planExpiresAt?: Date;
  createdAt: Date;
}

const TenantSchema = new Schema<ITenant>({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true, lowercase: true, trim: true },
  plan: { type: String, enum: ["free", "professional", "business"], default: "free" },
  planExpiresAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

export const Tenant = mongoose.model<ITenant>("Tenant", TenantSchema);
