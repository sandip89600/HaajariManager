import mongoose, { Schema, Document } from "mongoose";

export interface IConnectionRequest extends Document {
  senderId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  workerId?: mongoose.Types.ObjectId;
  targetRole: "contractor" | "supervisor" | "labor" | "worker";
  method: "mobile" | "id";
  status: "pending" | "active" | "accepted" | "declined" | "expired" | "rejected" | "cancelled" | "disconnected";
  code?: string;
  codeHash?: string;
  codeExpiresAt?: Date;
  codeAttempts?: number;
  connectedAt?: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  disconnectedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ConnectionRequestSchema = new Schema<IConnectionRequest>(
  {
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    workerId: { type: Schema.Types.ObjectId, ref: "Worker" },
    targetRole: { type: String, enum: ["contractor", "supervisor", "labor", "worker"], required: true },
    method: { type: String, enum: ["mobile", "id"], default: "id" },
    status: {
      type: String,
      enum: ["pending", "active", "accepted", "declined", "expired", "rejected", "cancelled", "disconnected"],
      default: "pending",
    },
    code: { type: String },
    codeHash: { type: String },
    codeExpiresAt: { type: Date },
    codeAttempts: { type: Number, default: 0 },
    connectedAt: { type: Date },
    acceptedAt: { type: Date },
    rejectedAt: { type: Date },
    disconnectedAt: { type: Date },
    notes: { type: String },
  },
  { timestamps: true }
);

ConnectionRequestSchema.index({ senderId: 1, receiverId: 1 });
ConnectionRequestSchema.index({ senderId: 1, status: 1 });
ConnectionRequestSchema.index({ receiverId: 1, status: 1 });
ConnectionRequestSchema.index({ tenantId: 1, targetRole: 1 });
ConnectionRequestSchema.index({ workerId: 1 }, { sparse: true });
ConnectionRequestSchema.index({ codeExpiresAt: 1 });

export const ConnectionRequest = mongoose.model<IConnectionRequest>(
  "ConnectionRequest",
  ConnectionRequestSchema
);
