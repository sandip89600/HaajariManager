import mongoose, { Schema, Document } from 'mongoose';

export interface IRazorpayCustomer extends Document {
  tenantId: string;
  userId?: string;
  razorpayCustomerId: string;
  email?: string;
  phone?: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RazorpayCustomerSchema: Schema = new Schema(
  {
    tenantId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, index: true },
    razorpayCustomerId: { type: String, required: true, unique: true },
    email: { type: String },
    phone: { type: String },
    name: { type: String },
  },
  { timestamps: true }
);

export const RazorpayCustomer = mongoose.model<IRazorpayCustomer>(
  'RazorpayCustomer',
  RazorpayCustomerSchema
);
