import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { Notification, User } from "../models";
import { sendPushNotification } from "../utils/notifications";
import { getIO } from "../utils/socket";

// Send Admin Broadcast Notification
export const sendAdminNotification = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const adminRole = req.user?.role;

    if (!adminId || (adminRole as string) !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access. Only authorized admin roles can send notifications.",
      });
    }

    const {
      title,
      message,
      type = "general",
      recipientType = "all",
      recipientIds,
      actionType = "none",
      actionTarget = "",
    } = req.body;

    // 1. Validation
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ success: false, message: "Notification title is required." });
    }
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, message: "Notification message is required." });
    }
    if (title.length > 100) {
      return res.status(400).json({ success: false, message: "Title exceeds maximum length of 100 characters." });
    }
    if (message.length > 1000) {
      return res.status(400).json({ success: false, message: "Message exceeds maximum length of 1000 characters." });
    }

    const validTypes = ["general", "announcement", "important", "update", "maintenance", "security"];
    const finalType = validTypes.includes(type) ? type : "general";

    // 2. Anti-Spam / Rate-limiting check (10s window)
    const recentDuplicate = await Notification.findOne({
      senderId: adminId,
      title: title.trim(),
      message: message.trim(),
      createdAt: { $gte: new Date(Date.now() - 10000) },
    });

    if (recentDuplicate) {
      return res.status(429).json({
        success: false,
        message: "Duplicate notification detected. Please wait a few seconds before resending.",
      });
    }

    // 3. Resolve Target Recipient Users
    let targetUsers: any[] = [];
    if (recipientType === "all") {
      targetUsers = await User.find({ isArchived: { $ne: true } }).select("_id expoPushToken name role tenantId");
    } else if (recipientType === "contractor") {
      targetUsers = await User.find({ role: { $in: ["contractor", "admin"] }, isArchived: { $ne: true } }).select("_id expoPushToken name role tenantId");
    } else if (recipientType === "supervisor") {
      targetUsers = await User.find({ role: "supervisor", isArchived: { $ne: true } }).select("_id expoPushToken name role tenantId");
    } else if (recipientType === "worker") {
      targetUsers = await User.find({ role: { $in: ["worker", "general"] }, isArchived: { $ne: true } }).select("_id expoPushToken name role tenantId");
    } else if (recipientType === "user" || recipientType === "multiple_users") {
      const idsArray = Array.isArray(recipientIds) ? recipientIds : [recipientIds];
      const validIds = idsArray.filter((id) => id && id.length === 24);
      if (validIds.length === 0) {
        return res.status(400).json({ success: false, message: "Please select at least one valid recipient user." });
      }
      targetUsers = await User.find({ _id: { $in: validIds } }).select("_id expoPushToken name role tenantId");
    } else {
      targetUsers = await User.find({ isArchived: { $ne: true } }).select("_id expoPushToken name role tenantId");
    }

    if (targetUsers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No eligible recipient users found for the selected option.",
      });
    }

    // 4. Action / Deep Link Payload
    let actionData: any = {};
    if (actionType !== "none" && actionTarget) {
      if (actionTarget === "Open Reports") actionData = { screen: "Payments" };
      else if (actionTarget === "Open Profile") actionData = { screen: "Settings" };
      else if (actionTarget === "Open Site Management") actionData = { screen: "SiteManagement" };
      else if (actionTarget === "Open Workers") actionData = { screen: "Workers" };
      else if (actionTarget === "Open Attendance") actionData = { screen: "Attendance" };
      else actionData = { screen: actionTarget };
    }

    // 5. Batch Create Notification Documents in Database
    const notificationsToCreate = targetUsers.map((u) => ({
      tenantId: u.tenantId,
      userId: u._id,
      senderId: adminId,
      type: finalType,
      title: title.trim(),
      message: message.trim(),
      data: actionData,
      recipientType,
      recipientIds: targetUsers.map((tu) => tu._id),
      isRead: false,
      status: "sent",
      createdAt: new Date(),
    }));

    const createdNotifications = await Notification.insertMany(notificationsToCreate);

    // 6. Deliver via Socket.IO & Expo Push Notification
    let socketSentCount = 0;
    let pushSentCount = 0;
    let io: any = null;
    try {
      io = getIO();
    } catch (e) {}

    for (let i = 0; i < targetUsers.length; i++) {
      const u = targetUsers[i];
      const notifDoc = createdNotifications[i];

      // Socket emission to user-specific room
      if (io) {
        try {
          const unreadCount = await Notification.countDocuments({ userId: u._id, isRead: false });
          io.to(`user_${u._id.toString()}`).emit("notification:new", {
            notification: notifDoc,
            unreadCount,
          });
          socketSentCount++;
        } catch (e) {}
      }

      // Expo Push Notification
      if (u.expoPushToken) {
        sendPushNotification(u.expoPushToken, title.trim(), message.trim(), {
          notificationId: notifDoc._id.toString(),
          type: finalType,
          ...actionData,
        })
          .then((success) => {
            if (success) pushSentCount++;
          })
          .catch(() => {});
      }
    }

    // Update deliveryStats on created documents
    const deliveryStats = {
      total: targetUsers.length,
      socketSent: socketSentCount,
      pushSent: pushSentCount,
    };

    await Notification.updateMany(
      { _id: { $in: createdNotifications.map((n) => n._id) } },
      { $set: { deliveryStats } }
    );

    return res.json({
      success: true,
      message: "Notification sent successfully.",
      deliveryStats,
      createdCount: createdNotifications.length,
    });
  } catch (error: any) {
    console.error("[AdminNotificationController] Error sending notification:", error);
    return res.status(500).json({ success: false, message: "Unable to send notification. Please try again." });
  }
};

// Get Admin Broadcast History
export const getAdminNotificationHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ senderId: { $exists: true } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("senderId", "name email")
      .populate("userId", "name role email")
      .lean();

    const total = await Notification.countDocuments({ senderId: { $exists: true } });

    const formatted = notifications.map((n) => ({
      _id: n._id,
      title: n.title,
      message: n.message,
      type: n.type,
      recipientType: n.recipientType || "all",
      recipientName: (n.userId as any)?.name || "All Users",
      senderName: (n.senderId as any)?.name || "Admin",
      createdAt: n.createdAt,
      status: n.status || "sent",
      isRead: n.isRead,
      deliveryStats: n.deliveryStats || { total: 1, socketSent: 1, pushSent: 0 },
    }));

    return res.json({
      success: true,
      notifications: formatted,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("[AdminNotificationController] Error fetching history:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Get Eligible Recipient Users for Dropdown Selection
export const getAdminRecipientList = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await User.find({ isArchived: { $ne: true } })
      .select("_id name email role tenantId")
      .populate("tenantId", "name")
      .sort({ name: 1 })
      .lean();

    const formatted = users.map((u) => ({
      _id: u._id,
      name: u.name || "Unnamed User",
      email: u.email || "",
      role: u.role || "user",
      company: (u.tenantId as any)?.name || "General",
    }));

    return res.json({
      success: true,
      users: formatted,
    });
  } catch (error: any) {
    console.error("[AdminNotificationController] Error fetching recipient list:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
