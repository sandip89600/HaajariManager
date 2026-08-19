import mongoose, { Schema, Document } from "mongoose";

export type NotificationType =
  | "attendance_reminder"
  | "subscription_reminder"
  | "payment_reminder"
  | "worker_reminder"
  | "site_reminder"
  | "system"
  | "announcement";

export interface INotification extends Document {
  tenantId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  data?: {
    screen?: string;
    params?: any;
    url?: string;
    [key: string]: any;
  };
  isRead: boolean;
  readAt?: Date;
  referenceKey?: string; // For duplicate prevention (e.g., attendance_reminder:USER_ID:2026-08-19)
  createdAt: Date;
  expiresAt?: Date;
}

const NotificationSchema = new Schema<INotification>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: {
    type: String,
    enum: [
      "attendance_reminder",
      "subscription_reminder",
      "payment_reminder",
      "worker_reminder",
      "site_reminder",
      "system",
      "announcement",
    ],
    default: "system",
    index: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: Schema.Types.Mixed, default: {} },
  isRead: { type: Boolean, default: false, index: true },
  readAt: { type: Date },
  referenceKey: { type: String, unique: true, sparse: true, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date },
});

// Compound index for fast queries: unread count & user timeline pagination
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>(
  "Notification",
  NotificationSchema
);
