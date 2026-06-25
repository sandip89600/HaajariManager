import mongoose, { Schema, Document } from "mongoose";

export interface IProject extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  location?: string;
  status: "active" | "inactive";
  createdAt: Date;
}

const ProjectSchema = new Schema<IProject>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  name: { type: String, required: true, trim: true },
  location: { type: String },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  createdAt: { type: Date, default: Date.now },
});

ProjectSchema.index({ tenantId: 1 });

export const Project = mongoose.model<IProject>("Project", ProjectSchema);
