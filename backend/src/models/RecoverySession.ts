import mongoose, { Schema, Document } from "mongoose";

export interface IRecoverySession extends Document {
  userId: mongoose.Types.ObjectId;
  sessionTokenHash: string;
  scope: "password_reset_only";
  phone?: string;
  email?: string;
  requiresEmailConfirmation: boolean;
  emailConfirmed: boolean;
  emailConfirmTokenHash?: string;
  emailConfirmExpires?: Date;
  expiresAt: Date;
  used: boolean;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const RecoverySessionSchema = new Schema<IRecoverySession>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  sessionTokenHash: { type: String, required: true },
  scope: { type: String, enum: ["password_reset_only"], default: "password_reset_only", required: true },
  phone: { type: String },
  email: { type: String },
  requiresEmailConfirmation: { type: Boolean, default: false },
  emailConfirmed: { type: Boolean, default: true },
  emailConfirmTokenHash: { type: String },
  emailConfirmExpires: { type: Date },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
  ipAddress: { type: String },
  userAgent: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Auto-expire recovery sessions after 10 minutes (600 seconds)
RecoverySessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });
RecoverySessionSchema.index({ userId: 1, used: 1 });
RecoverySessionSchema.index({ sessionTokenHash: 1 });

export const RecoverySession = mongoose.model<IRecoverySession>("RecoverySession", RecoverySessionSchema);
