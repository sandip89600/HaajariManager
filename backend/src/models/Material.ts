import mongoose, { Schema, Document } from "mongoose";

export interface IMaterial extends Document {
  tenantId: mongoose.Types.ObjectId;
  siteId: mongoose.Types.ObjectId;
  name: string;
  category: "Cement" | "Sand" | "Steel" | "Bricks" | "Aggregate" | "Tiles" | "Paint" | "Electrical" | "Plumbing" | "Wood" | "Hardware" | "Custom";
  unit: "Bag" | "Kg" | "Ton" | "Cubic Feet" | "Cubic Meter" | "Piece" | "Box" | "Liter" | "Meter";
  quantityPurchased: number;
  quantityUsed: number;
  remainingStock: number;
  minStockLevel: number;
  unitPrice: number;
  totalCost: number;
  supplierName?: string;
  purchaseDate: Date;
  invoiceNumber?: string;
  storageLocation?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MaterialSchema = new Schema<IMaterial>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
  name: { type: String, required: true, trim: true },
  category: { 
    type: String, 
    enum: ["Cement", "Sand", "Steel", "Bricks", "Aggregate", "Tiles", "Paint", "Electrical", "Plumbing", "Wood", "Hardware", "Custom"],
    required: true 
  },
  unit: { 
    type: String, 
    enum: ["Bag", "Kg", "Ton", "Cubic Feet", "Cubic Meter", "Piece", "Box", "Liter", "Meter"],
    required: true 
  },
  quantityPurchased: { type: Number, required: true, default: 0, min: 0 },
  quantityUsed: { type: Number, required: true, default: 0, min: 0 },
  remainingStock: { type: Number, required: true, default: 0, min: 0 },
  minStockLevel: { type: Number, required: true, default: 0, min: 0 },
  unitPrice: { type: Number, required: true, default: 0, min: 0 },
  totalCost: { type: Number, required: true, default: 0, min: 0 },
  supplierName: { type: String, trim: true },
  purchaseDate: { type: Date, required: true, default: Date.now },
  invoiceNumber: { type: String, trim: true },
  storageLocation: { type: String, trim: true },
  notes: { type: String, trim: true },
}, {
  timestamps: true
});

MaterialSchema.index({ tenantId: 1, siteId: 1 });
MaterialSchema.index({ siteId: 1, name: 1 });

export const Material = mongoose.model<IMaterial>("Material", MaterialSchema);
