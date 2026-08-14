import mongoose, { Schema, Document } from "mongoose";

export interface ISecurityEvent extends Document {
  userId: mongoose.Types.ObjectId;
  eventType:
    | "LOGIN"
    | "NEW_DEVICE_LOGIN"
    | "TRUST_DEVICE"
    | "UNTRUST_DEVICE"
    | "LOGOUT_DEVICE"
    | "LOGOUT_ALL_DEVICES"
    | "PASSWORD_CHANGED"
    | "SECURITY_ALERT";
  deviceId?: string;
  deviceName?: string;
  platform?: string;
  browser?: string;
  ipAddress?: string;
  approximateLocation?: string;
  status: "confirmed_by_user" | "marked_suspicious" | "new_device_login" | "revoked" | "normal";
  timestamp: Date;
  metadata?: Record<string, any>;
}

const SecurityEventSchema = new Schema<ISecurityEvent>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  eventType: {
    type: String,
    enum: [
      "LOGIN",
      "NEW_DEVICE_LOGIN",
      "TRUST_DEVICE",
      "UNTRUST_DEVICE",
      "LOGOUT_DEVICE",
      "LOGOUT_ALL_DEVICES",
      "PASSWORD_CHANGED",
      "SECURITY_ALERT",
    ],
    required: true,
  },
  deviceId: { type: String },
  deviceName: { type: String },
  platform: { type: String },
  browser: { type: String },
  ipAddress: { type: String },
  approximateLocation: { type: String, default: "Location unavailable" },
  status: {
    type: String,
    enum: ["confirmed_by_user", "marked_suspicious", "new_device_login", "revoked", "normal"],
    default: "normal",
  },
  timestamp: { type: Date, default: Date.now, index: true },
  metadata: { type: Schema.Types.Mixed },
});

SecurityEventSchema.index({ userId: 1, timestamp: -1 });

export const SecurityEvent = mongoose.model<ISecurityEvent>("SecurityEvent", SecurityEventSchema);
