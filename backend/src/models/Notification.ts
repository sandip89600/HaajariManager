import mongoose, { Schema, Document } from "mongoose";

export type NotificationType =
  | "general"
  | "announcement"
  | "important"
  | "update"
  | "maintenance"
  | "security"
  | "attendance_reminder"
  | "subscription_reminder"
  | "payment_reminder"
  | "worker_reminder"
  | "site_reminder"
  | "system";

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
  senderId?: mongoose.Types.ObjectId;
  recipientType?: string;
  recipientIds?: mongoose.Types.ObjectId[];
  status?: string;
  deliveryStats?: {
    total: number;
    socketSent: number;
    pushSent: number;
  };
  referenceKey?: string; // For duplicate prevention
  createdAt: Date;
  expiresAt?: Date;
}

const NotificationSchema = new Schema<INotification>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: {
    type: String,
    enum: [
      "general",
      "announcement",
      "important",
      "update",
      "maintenance",
      "security",
      "attendance_reminder",
      "subscription_reminder",
      "payment_reminder",
      "worker_reminder",
      "site_reminder",
      "system",
    ],
    default: "general",
    index: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: Schema.Types.Mixed, default: {} },
  isRead: { type: Boolean, default: false, index: true },
  readAt: { type: Date },
  senderId: { type: Schema.Types.ObjectId, ref: "User" },
  recipientType: { type: String },
  recipientIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
  status: { type: String, default: "sent" },
  deliveryStats: {
    total: { type: Number, default: 0 },
    socketSent: { type: Number, default: 0 },
    pushSent: { type: Number, default: 0 },
  },
  referenceKey: { type: String, unique: true, sparse: true, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date },
});

// Compound index for fast queries: unread count & user timeline pagination
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ senderId: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>(
  "Notification",
  NotificationSchema
);
