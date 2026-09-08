import mongoose, { Schema, Document } from "mongoose";

export interface IConnectionRequest extends Document {
  senderId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  targetRole: "supervisor" | "labor";
  status: "pending" | "accepted" | "declined";
  createdAt: Date;
  updatedAt: Date;
}

const ConnectionRequestSchema = new Schema<IConnectionRequest>(
  {
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    targetRole: { type: String, enum: ["supervisor", "labor"], required: true },
    status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
  },
  { timestamps: true }
);

ConnectionRequestSchema.index({ senderId: 1, receiverId: 1 });
ConnectionRequestSchema.index({ receiverId: 1, status: 1 });
ConnectionRequestSchema.index({ tenantId: 1, targetRole: 1 });

export const ConnectionRequest = mongoose.model<IConnectionRequest>(
  "ConnectionRequest",
  ConnectionRequestSchema
);
