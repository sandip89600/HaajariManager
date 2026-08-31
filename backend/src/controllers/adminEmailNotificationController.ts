import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { EmailNotification, User } from "../models";
import { sendMailUnified, generateAdminNotificationEmailHTML } from "../utils/mail";

// Helper: Sanitize basic HTML input
function sanitizeHtmlInput(input: string): string {
  if (!input) return "";
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/javascript:/gi, "");
}

// 1. Send Admin Bulk Email Notification
export const sendAdminEmailNotification = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const adminRole = req.user?.role;

    if (!adminId || (adminRole as string) !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access. Only authorized admin roles can send email notifications.",
      });
    }

    const {
      subject,
      type = "Announcement",
      category = "General",
      priority = "Normal",
      recipientRoles = [],
      specificUserIds = [],
      heading,
      message,
      cta = { enabled: false },
      draftId,
    } = req.body;

    // Validation
    if (!subject || typeof subject !== "string" || !subject.trim()) {
      return res.status(400).json({ success: false, message: "Email subject is required." });
    }
    if (!heading || typeof heading !== "string" || !heading.trim()) {
      return res.status(400).json({ success: false, message: "Email heading is required." });
    }
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, message: "Message content is required." });
    }

    // Validate Custom CTA URL if enabled
    if (cta?.enabled && cta?.actionTarget === "Custom Link" && cta?.customUrl) {
      const urlPattern = /^(https?:\/\/)?([\w.-]+)+[\w\-_~:/?#[\]@!$&'()*+,;=.]+$/;
      if (!urlPattern.test(cta.customUrl)) {
        return res.status(400).json({ success: false, message: "Please enter a valid Custom Link URL." });
      }
    }

    // Resolve Recipient Emails from DB
    let targetUsers: any[] = [];
    const rolesArray: string[] = Array.isArray(recipientRoles) ? recipientRoles : [recipientRoles];

    if (rolesArray.includes("All Users")) {
      targetUsers = await User.find({ isArchived: { $ne: true } }).select("email name role");
    } else {
      const queryOr: any[] = [];
      const roleMap: Record<string, string[]> = {
        Contractor: ["contractor", "admin"],
        Supervisor: ["supervisor"],
        Worker: ["worker", "general"],
        User: ["user", "contractor", "supervisor", "worker", "builder"],
      };

      const matchedDbRoles: string[] = [];
      rolesArray.forEach((r) => {
        if (roleMap[r]) matchedDbRoles.push(...roleMap[r]);
      });

      if (matchedDbRoles.length > 0) {
        queryOr.push({ role: { $in: matchedDbRoles } });
      }

      if (Array.isArray(specificUserIds) && specificUserIds.length > 0) {
        const validIds = specificUserIds.filter((id) => id && id.length === 24);
        if (validIds.length > 0) {
          queryOr.push({ _id: { $in: validIds } });
        }
      }

      if (queryOr.length > 0) {
        targetUsers = await User.find({ $or: queryOr, isArchived: { $ne: true } }).select("email name role");
      } else {
        targetUsers = await User.find({ isArchived: { $ne: true } }).select("email name role");
      }
    }

    // Filter valid email addresses
    const emailList = Array.from(
      new Set(
        targetUsers
          .map((u) => u.email?.trim())
          .filter((e) => e && e.includes("@") && !e.endsWith("@example.com"))
      )
    );

    if (emailList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No eligible email recipients found for the selected option.",
      });
    }

    const sanitizedHeading = sanitizeHtmlInput(heading.trim());
    const sanitizedMessage = sanitizeHtmlInput(message.trim());

    // Generate Branded HTML Content
    const emailHtml = generateAdminNotificationEmailHTML(sanitizedHeading, sanitizedMessage, cta, false);

    // Send emails through unified email provider
    let successfulSends = 0;
    let failedSends = 0;
    const failedEmails: string[] = [];

    for (const email of emailList) {
      const sent = await sendMailUnified(email, subject.trim(), emailHtml, `Admin Broadcast: ${type}`);
      if (sent) {
        successfulSends++;
      } else {
        failedSends++;
        failedEmails.push(email);
      }
    }

    const finalStatus =
      successfulSends === emailList.length
        ? "Sent"
        : successfulSends > 0
        ? "Partially Sent"
        : "Failed";

    // Save Email Notification Record in Database
    let emailRecord;
    if (draftId && draftId.length === 24) {
      emailRecord = await EmailNotification.findByIdAndUpdate(
        draftId,
        {
          subject: subject.trim(),
          type,
          category,
          priority,
          recipients: { roles: rolesArray, specificUserIds },
          heading: sanitizedHeading,
          message: sanitizedMessage,
          cta,
          status: finalStatus,
          sentAt: new Date(),
          deliveryStats: {
            totalRecipients: emailList.length,
            successfulSends,
            failedSends,
            failedEmails,
          },
        },
        { new: true }
      );
    }

    if (!emailRecord) {
      emailRecord = new EmailNotification({
        subject: subject.trim(),
        type,
        category,
        priority,
        recipients: { roles: rolesArray, specificUserIds },
        heading: sanitizedHeading,
        message: sanitizedMessage,
        cta,
        createdBy: adminId,
        status: finalStatus,
        sentAt: new Date(),
        deliveryStats: {
          totalRecipients: emailList.length,
          successfulSends,
          failedSends,
          failedEmails,
        },
      });
      await emailRecord.save();
    }

    return res.json({
      success: true,
      message: `Email notification processed. ${successfulSends} sent successfully.`,
      notification: emailRecord,
      stats: {
        totalRecipients: emailList.length,
        successfulSends,
        failedSends,
      },
    });
  } catch (error: any) {
    console.error("[AdminEmailNotificationController] Error sending email notification:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to send email notification. Please try again.",
    });
  }
};

// 2. Send Test Email Notification
export const sendTestEmailNotification = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const adminRole = req.user?.role;

    if (!adminId || (adminRole as string) !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access. Only authorized admin roles can send test emails.",
      });
    }

    const { testEmail, subject, heading, message, cta } = req.body;

    if (!testEmail || typeof testEmail !== "string" || !testEmail.includes("@")) {
      return res.status(400).json({ success: false, message: "Please enter a valid test email address." });
    }
    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, message: "Subject is required for test email." });
    }
    if (!heading || !heading.trim()) {
      return res.status(400).json({ success: false, message: "Heading is required for test email." });
    }

    const sanitizedHeading = sanitizeHtmlInput(heading.trim());
    const sanitizedMessage = sanitizeHtmlInput((message || "").trim());

    const testHtml = generateAdminNotificationEmailHTML(sanitizedHeading, sanitizedMessage, cta, true);

    const sent = await sendMailUnified(
      testEmail.trim(),
      `[TEST] ${subject.trim()}`,
      testHtml,
      "Test Admin Email"
    );

    if (sent) {
      return res.json({
        success: true,
        message: `Test email sent successfully to ${testEmail.trim()}`,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: `Failed to deliver test email to ${testEmail.trim()}. Check backend mail logs.`,
      });
    }
  } catch (error: any) {
    console.error("[AdminEmailNotificationController] Error sending test email:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to send test email. Please try again.",
    });
  }
};

// 3. Save Draft Email Notification
export const saveEmailDraft = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const adminRole = req.user?.role;

    if (!adminId || (adminRole as string) !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access. Only authorized admin roles can save drafts.",
      });
    }

    const { draftId, subject, type, category, priority, recipientRoles, specificUserIds, heading, message, cta } = req.body;

    let draftDoc;
    if (draftId && draftId.length === 24) {
      draftDoc = await EmailNotification.findByIdAndUpdate(
        draftId,
        {
          subject: (subject || "Untitled Draft").trim(),
          type: type || "Announcement",
          category: category || "General",
          priority: priority || "Normal",
          recipients: { roles: recipientRoles || ["All Users"], specificUserIds },
          heading: (heading || "").trim(),
          message: (message || "").trim(),
          cta,
          status: "Draft",
        },
        { new: true }
      );
    }

    if (!draftDoc) {
      draftDoc = new EmailNotification({
        subject: (subject || "Untitled Draft").trim(),
        type: type || "Announcement",
        category: category || "General",
        priority: priority || "Normal",
        recipients: { roles: recipientRoles || ["All Users"], specificUserIds },
        heading: (heading || "").trim(),
        message: (message || "").trim(),
        cta,
        createdBy: adminId,
        status: "Draft",
      });
      await draftDoc.save();
    }

    return res.json({
      success: true,
      message: "Email draft saved successfully.",
      notification: draftDoc,
    });
  } catch (error: any) {
    console.error("[AdminEmailNotificationController] Error saving draft:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to save email draft. Please try again.",
    });
  }
};

// 4. Get Email Notification History List
export const getEmailNotificationHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      EmailNotification.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name email")
        .lean(),
      EmailNotification.countDocuments(),
    ]);

    const formatted = list.map((item) => ({
      _id: item._id,
      subject: item.subject,
      type: item.type,
      category: item.category,
      priority: item.priority,
      recipients: item.recipients?.roles?.join(", ") || "All Users",
      heading: item.heading,
      message: item.message,
      cta: item.cta,
      status: item.status,
      createdAt: item.createdAt,
      sentAt: item.sentAt,
      createdByName: (item.createdBy as any)?.name || "Admin",
      deliveryStats: item.deliveryStats || { totalRecipients: 0, successfulSends: 0, failedSends: 0 },
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
    console.error("[AdminEmailNotificationController] Error fetching email history:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 5. Get Email Notification Single Details
export const getEmailNotificationDetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const emailDoc = await EmailNotification.findById(id).populate("createdBy", "name email").lean();

    if (!emailDoc) {
      return res.status(404).json({ success: false, message: "Email notification record not found." });
    }

    // Generate preview HTML
    const previewHtml = generateAdminNotificationEmailHTML(emailDoc.heading, emailDoc.message, emailDoc.cta, false);

    return res.json({
      success: true,
      notification: emailDoc,
      previewHtml,
    });
  } catch (error: any) {
    console.error("[AdminEmailNotificationController] Error fetching email details:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
