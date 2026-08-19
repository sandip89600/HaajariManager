import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { Notification } from "../models";

export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized access." });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;
    const typeFilter = req.query.type as string;

    const query: any = { userId };
    if (typeFilter) {
      query.type = typeFilter;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    return res.json({
      success: true,
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      unreadCount,
    });
  } catch (error: any) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getUnreadCount = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized access." });
    }

    const unreadCount = await Notification.countDocuments({ userId, isRead: false });

    return res.json({
      success: true,
      unreadCount,
    });
  } catch (error: any) {
    console.error("Error fetching unread count:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const markAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized access." });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found." });
    }

    const unreadCount = await Notification.countDocuments({ userId, isRead: false });

    return res.json({
      success: true,
      notification,
      unreadCount,
    });
  } catch (error: any) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const markAllAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized access." });
    }

    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return res.json({
      success: true,
      modifiedCount: result.modifiedCount,
      unreadCount: 0,
    });
  } catch (error: any) {
    console.error("Error marking all notifications as read:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const deleteNotification = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized access." });
    }

    const notification = await Notification.findOneAndDelete({ _id: id, userId });
    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found." });
    }

    const unreadCount = await Notification.countDocuments({ userId, isRead: false });

    return res.json({
      success: true,
      message: "Notification deleted successfully.",
      unreadCount,
    });
  } catch (error: any) {
    console.error("Error deleting notification:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
