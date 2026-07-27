import mongoose, { Schema, Document } from "mongoose";

export interface ISite extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  projectType: string;
  clientName?: string;
  address: string;
  startDate: Date;
  description?: string;
  status: "Planning" | "Started" | "In Progress" | "On Hold" | "Delayed" | "Completed";
  supervisor?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  isArchived: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SiteSchema = new Schema<ISite>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  name: { type: String, required: true, trim: true },
  projectType: { type: String, required: true, trim: true },
  clientName: { type: String, trim: true },
  address: { type: String, required: true, trim: true },
  startDate: { type: Date, required: true },
  description: { type: String, trim: true },
  status: { 
    type: String, 
    enum: ["Planning", "Started", "In Progress", "On Hold", "Delayed", "Completed"], 
    default: "Planning" 
  },
  supervisor: { type: Schema.Types.ObjectId, ref: "User" },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  isArchived: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Indexes for search and optimization
SiteSchema.index({ tenantId: 1, isDeleted: 1 });
SiteSchema.index({ tenantId: 1, name: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } }); // Prevent duplicates for active sites
SiteSchema.index({ supervisor: 1 });

export const Site = mongoose.model<ISite>("Site", SiteSchema);
