import mongoose, { Schema, Document } from "mongoose";

export interface IOtpCode extends Document {
  phone: string;
  otpCodeHash: string;
  expiresAt: Date;
  verified: boolean;
  attemptsCount: number;
  createdAt: Date;
}

const OtpCodeSchema = new Schema<IOtpCode>({
  phone: { type: String, required: true },
  otpCodeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  verified: { type: Boolean, default: false },
  attemptsCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Auto-expire documents after 5 minutes (300 seconds)
OtpCodeSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });

export const OtpCode = mongoose.model<IOtpCode>("OtpCode", OtpCodeSchema);
