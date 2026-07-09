import mongoose, { Schema, Document } from "mongoose";

export interface IMBEntry extends Document {
  tenantId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  taskName: string;
  quantity: number;
  unit: string;
  photoProofUri?: string;
  recordedBy: mongoose.Types.ObjectId;
  date: Date;
  createdAt: Date;
}

const MBEntrySchema = new Schema<IMBEntry>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  taskName: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true },
  photoProofUri: { type: String },
  recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: Date, required: true, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

MBEntrySchema.index({ tenantId: 1 });
MBEntrySchema.index({ projectId: 1 });
MBEntrySchema.index({ date: -1 });

export const MBEntry = mongoose.model<IMBEntry>("MBEntry", MBEntrySchema);
