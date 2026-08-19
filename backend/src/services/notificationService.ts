import mongoose from "mongoose";
import { Notification, NotificationType, User } from "../models";
import { sendPushNotification } from "../utils/notifications";
import { getIO } from "../utils/socket";

export interface CreateNotificationParams {
  userId: string | mongoose.Types.ObjectId;
  tenantId?: string | mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  referenceKey?: string;
  expiresAt?: Date;
}

export async function createAndSendNotification(
  params: CreateNotificationParams
) {
  try {
    const { userId, tenantId, type, title, message, data, referenceKey, expiresAt } =
      params;

    // 1. Prevent duplicate notifications if referenceKey is provided
    if (referenceKey) {
      const existing = await Notification.findOne({ referenceKey });
      if (existing) {
        return existing;
      }
    }

    // 2. Check User preferences before creating non-critical notification
    const user = await User.findById(userId);
    if (!user) return null;

    if (user.notificationPreferences) {
      const prefs = user.notificationPreferences;
      if (type === "attendance_reminder" && prefs.attendanceAlerts === false) {
        return null;
      }
    }

    // 3. Create Notification Document
    const notification = new Notification({
      tenantId: tenantId || user.tenantId,
      userId: user._id,
      type,
      title,
      message,
      data: data || {},
      referenceKey,
      expiresAt,
      isRead: false,
    });

    await notification.save();

    // 4. Emit Realtime Socket.IO event to authenticated user's room
    try {
      const io = getIO();
      if (io) {
        const unreadCount = await Notification.countDocuments({
          userId: user._id,
          isRead: false,
        });
        io.to(`user_${user._id.toString()}`).emit("notification:new", {
          notification,
          unreadCount,
        });
      }
    } catch (e) {
      // Socket emission failure shouldn't block DB persistence
    }

    // 5. Send Expo Push Notification if push token exists
    if (user.expoPushToken) {
      sendPushNotification(
        user.expoPushToken,
        title,
        message,
        {
          notificationId: notification._id.toString(),
          type: notification.type,
          ...notification.data,
        }
      ).catch((err) => {
        console.warn("[NotificationService] Push notification send error:", err);
      });
    }

    return notification;
  } catch (error: any) {
    if (error.code === 11000) {
      // Duplicate referenceKey caught gracefully
      return null;
    }
    console.error("[NotificationService] Error creating notification:", error);
    return null;
  }
}
