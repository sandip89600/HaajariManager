import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { IssueFeedback, FeedbackCategory, FeedbackPriority, FeedbackStatus, User } from "../models";

// Helper to sanitize text inputs against XSS/script injection
function sanitizeText(input?: string): string {
  if (!input) return "";
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/<[^>]*>/g, "")
    .trim();
}

// Auto-suggest priority based on category/error status
function calculateAutoPriority(category: FeedbackCategory, httpStatus?: number): FeedbackPriority {
  if (category === "Login / Authentication" || category === "Payments") {
    return "High";
  }
  if (httpStatus && httpStatus >= 500) {
    return "High";
  }
  if (category === "PDF" || category === "CSV" || category === "Attendance" || category === "Attendance Grid") {
    return "Medium";
  }
  if (category === "UI / Design") {
    return "Low";
  }
  return "Medium";
}

// 1. Submit User Feedback / Problem Report
export const submitFeedback = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    let userName = "Anonymous User";
    let userRole = "user";
    let userPhone = "";
    let userEmail = "";

    if (userId) {
      const user = await User.findById(userId).select("name role phone email");
      if (user) {
        userName = user.name || userName;
        userRole = user.role || userRole;
        userPhone = user.phone || userPhone;
        userEmail = user.email || userEmail;
      }
    }

    const {
      category = "Other",
      feature = "General Application",
      message,
      errorType,
      errorMessage,
      httpStatus,
      durationMs,
      platform = "mobile",
      appVersion = "1.0.0",
      guestName,
      guestPhone,
    } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please describe what went wrong before submitting.",
      });
    }

    const sanitizedMessage = sanitizeText(message);
    const sanitizedErrorMessage = sanitizeText(errorMessage);
    const sanitizedFeature = sanitizeText(feature);

    const safeUserName = userId ? userName : sanitizeText(guestName) || "Anonymous User";
    const safeUserPhone = userId ? userPhone : sanitizeText(guestPhone) || "";

    const calculatedPriority = calculateAutoPriority(category as FeedbackCategory, httpStatus);

    const feedbackItem = new IssueFeedback({
      userId: userId ? userId : undefined,
      userName: safeUserName,
      userRole,
      userPhone: safeUserPhone,
      userEmail,
      category,
      feature: sanitizedFeature || "General Application",
      message: sanitizedMessage,
      errorType: sanitizeText(errorType),
      errorMessage: sanitizedErrorMessage,
      httpStatus: typeof httpStatus === "number" ? httpStatus : undefined,
      durationMs: typeof durationMs === "number" ? durationMs : undefined,
      platform: sanitizeText(platform) || "mobile",
      appVersion: sanitizeText(appVersion) || "1.0.0",
      status: "New",
      priority: calculatedPriority,
      internalNotes: [],
    });

    await feedbackItem.save();

    console.log(`[FeedbackSubmitted] Category: "${category}", Feature: "${feature}", User: "${safeUserName}"`);

    return res.status(201).json({
      success: true,
      message: "Thanks for your feedback! We've received your report.",
      feedback: feedbackItem,
    });
  } catch (error: any) {
    console.error("[FeedbackController] Error submitting feedback:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to submit feedback right now. Please try again.",
    });
  }
};

// 2. Admin Get All Feedbacks with Filters & Summary Statistics
export const getAdminFeedbacks = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const adminRole = req.user?.role;

    if (!adminId || (adminRole as string) !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access. Admin privileges required.",
      });
    }

    const {
      search,
      category,
      status,
      role,
      priority,
      page = "1",
      limit = "50",
    } = req.query;

    const query: any = {};

    if (category && category !== "All") {
      query.category = category;
    }
    if (status && status !== "All") {
      query.status = status;
    }
    if (role && role !== "All") {
      query.userRole = role;
    }
    if (priority && priority !== "All") {
      query.priority = priority;
    }

    if (search && typeof search === "string" && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$or = [
        { message: searchRegex },
        { feature: searchRegex },
        { userName: searchRegex },
        { errorMessage: searchRegex },
        { userPhone: searchRegex },
      ];
    }

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [feedbacks, totalCount] = await Promise.all([
      IssueFeedback.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      IssueFeedback.countDocuments(query),
    ]);

    // Aggregate Global Summary Counts
    const statusCounts = await IssueFeedback.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const summary = {
      total: 0,
      new: 0,
      inReview: 0,
      investigating: 0,
      resolved: 0,
      closed: 0,
    };

    statusCounts.forEach((sc) => {
      summary.total += sc.count;
      if (sc._id === "New") summary.new = sc.count;
      if (sc._id === "In Review") summary.inReview = sc.count;
      if (sc._id === "Investigating") summary.investigating = sc.count;
      if (sc._id === "Resolved") summary.resolved = sc.count;
      if (sc._id === "Closed") summary.closed = sc.count;
    });

    // Aggregate Top Categories
    const categoryCounts = await IssueFeedback.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);

    const topCategories = categoryCounts.map((c) => ({
      category: c._id,
      count: c.count,
    }));

    // Detect Systemic / Repeated Issues (Grouped by Category & Feature)
    const groupedIssues = await IssueFeedback.aggregate([
      {
        $group: {
          _id: { category: "$category", feature: "$feature" },
          count: { $sum: 1 },
          latestReportAt: { $max: "$createdAt" },
        },
      },
      { $match: { count: { $gte: 2 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    return res.json({
      success: true,
      feedbacks,
      pagination: {
        total: totalCount,
        page: pageNum,
        pages: Math.ceil(totalCount / limitNum),
      },
      summary,
      topCategories,
      systemicIssues: groupedIssues.map((g) => ({
        category: g._id.category,
        feature: g._id.feature,
        reportCount: g.count,
        latestReportAt: g.latestReportAt,
      })),
    });
  } catch (error: any) {
    console.error("[FeedbackController] Error fetching admin feedbacks:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch feedback reports.",
    });
  }
};

// 3. Admin Update Feedback Status & Priority
export const updateAdminFeedbackStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const adminRole = req.user?.role;

    if (!adminId || (adminRole as string) !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access. Admin privileges required.",
      });
    }

    const { id } = req.params;
    const { status, priority } = req.body;

    const updateData: any = {};
    if (status) {
      const validStatuses = ["New", "In Review", "Investigating", "Resolved", "Closed"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status value." });
      }
      updateData.status = status;
    }

    if (priority) {
      const validPriorities = ["Low", "Medium", "High", "Critical"];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({ success: false, message: "Invalid priority value." });
      }
      updateData.priority = priority;
    }

    const updatedFeedback = await IssueFeedback.findByIdAndUpdate(id, updateData, { new: true });
    if (!updatedFeedback) {
      return res.status(404).json({ success: false, message: "Feedback report not found." });
    }

    return res.json({
      success: true,
      message: "Feedback updated successfully.",
      feedback: updatedFeedback,
    });
  } catch (error: any) {
    console.error("[FeedbackController] Error updating feedback:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update feedback status.",
    });
  }
};

// 4. Admin Add Internal Note
export const addAdminFeedbackNote = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const adminRole = req.user?.role;

    if (!adminId || (adminRole as string) !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access. Admin privileges required.",
      });
    }

    const { id } = req.params;
    const { note } = req.body;

    if (!note || typeof note !== "string" || !note.trim()) {
      return res.status(400).json({ success: false, message: "Internal note text is required." });
    }

    const sanitizedNote = sanitizeText(note);
    const adminUser = await User.findById(adminId).select("name");
    const adminName = adminUser?.name || "Administrator";

    const updatedFeedback = await IssueFeedback.findByIdAndUpdate(
      id,
      {
        $push: {
          internalNotes: {
            note: sanitizedNote,
            adminId,
            adminName,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!updatedFeedback) {
      return res.status(404).json({ success: false, message: "Feedback report not found." });
    }

    return res.json({
      success: true,
      message: "Internal note added successfully.",
      feedback: updatedFeedback,
    });
  } catch (error: any) {
    console.error("[FeedbackController] Error adding internal note:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to add internal note.",
    });
  }
};
