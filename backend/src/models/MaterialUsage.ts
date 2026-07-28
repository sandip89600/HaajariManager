import mongoose, { Schema, Document } from "mongoose";

export interface IMaterialUsage extends Document {
  tenantId: mongoose.Types.ObjectId;
  siteId: mongoose.Types.ObjectId;
  materialId: mongoose.Types.ObjectId;
  quantityUsed: number;
  notes?: string;
  updatedBy: mongoose.Types.ObjectId;
  timestamp: Date;
}

const MaterialUsageSchema = new Schema<IMaterialUsage>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
  materialId: { type: Schema.Types.ObjectId, ref: "Material", required: true },
  quantityUsed: { type: Number, required: true, min: 0 },
  notes: { type: String, trim: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  timestamp: { type: Date, required: true, default: Date.now }
}, {
  timestamps: true
});

MaterialUsageSchema.index({ tenantId: 1, siteId: 1 });
MaterialUsageSchema.index({ materialId: 1 });

export const MaterialUsage = mongoose.model<IMaterialUsage>("MaterialUsage", MaterialUsageSchema);
