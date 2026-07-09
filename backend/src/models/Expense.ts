import mongoose, { Schema, Document } from "mongoose";

export interface IExpense extends Document {
  tenantId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  type: "material" | "machinery" | "labour" | "vendor" | "other";
  amount: number;
  date: Date;
  vendorName?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  photoProofUri?: string;
  recordedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ExpenseSchema = new Schema<IExpense>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  type: {
    type: String,
    enum: ["material", "machinery", "labour", "vendor", "other"],
    required: true,
  },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true, default: Date.now },
  vendorName: { type: String },
  description: { type: String },
  quantity: { type: Number, default: 0 },
  unit: { type: String },
  photoProofUri: { type: String },
  recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

ExpenseSchema.index({ tenantId: 1 });
ExpenseSchema.index({ projectId: 1 });
ExpenseSchema.index({ date: -1 });

export const Expense = mongoose.model<IExpense>("Expense", ExpenseSchema);
