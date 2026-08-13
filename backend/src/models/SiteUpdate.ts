import mongoose, { Schema, Document } from "mongoose";

export interface ISiteUpdate extends Document {
  tenantId: mongoose.Types.ObjectId;
  siteId: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  type: "work" | "material" | "expense" | "photo" | "gps" | "issue";
  
  // Work/Progress fields
  workType?: string;
  progressPercent?: number;
  workNotes?: string;
  
  // Material fields
  materialName?: string;
  materialQty?: number;
  materialUnit?: string;
  materialNotes?: string;
  
  // Expense fields
  expenseAmount?: number;
  expenseCategory?: string;
  expenseNotes?: string;
  expenseDate?: Date;
  
  // Photo fields
  photoUris?: string[];
  
  // GPS fields
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  
  // Issue fields
  issueDescription?: string;
  issuePriority?: "Low" | "Medium" | "High";
  issueStatus?: "Open" | "Resolved";
  
  timestamp: Date;
}

const SiteUpdateSchema = new Schema<ISiteUpdate>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  type: { 
    type: String, 
    enum: ["work", "material", "expense", "photo", "gps", "issue"], 
    required: true 
  },
  
  // Work/Progress fields
  workType: { type: String, trim: true },
  progressPercent: { type: Number, min: 0, max: 100 },
  workNotes: { type: String, trim: true },
  
  // Material fields
  materialName: { type: String, trim: true },
  materialQty: { type: Number, min: 0 },
  materialUnit: { type: String, trim: true },
  materialNotes: { type: String, trim: true },
  
  // Expense fields
  expenseAmount: { type: Number, min: 0 },
  expenseCategory: { type: String, trim: true },
  expenseNotes: { type: String, trim: true },
  expenseDate: { type: Date },
  
  // Photo fields
  photoUris: [{ type: String }],
  
  // GPS fields
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
    address: { type: String, trim: true }
  },
  
  // Issue fields
  issueDescription: { type: String, trim: true },
  issuePriority: { type: String, enum: ["Low", "Medium", "High"] },
  issueStatus: { type: String, enum: ["Open", "Resolved"] },
  
  timestamp: { type: Date, required: true, default: Date.now }
}, {
  timestamps: true
});

SiteUpdateSchema.index({ tenantId: 1, siteId: 1 });
SiteUpdateSchema.index({ siteId: 1, type: 1 });
SiteUpdateSchema.index({ siteId: 1, timestamp: -1 });

export const SiteUpdate = mongoose.model<ISiteUpdate>("SiteUpdate", SiteUpdateSchema);
