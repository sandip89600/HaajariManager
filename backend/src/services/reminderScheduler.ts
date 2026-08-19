import { User, Attendance, Tenant } from "../models";
import { createAndSendNotification } from "./notificationService";

export async function checkDailyAttendanceReminders() {
  try {
    const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const activeUsers = await User.find({ isActive: true, role: { $in: ["contractor", "builder"] } });

    for (const user of activeUsers) {
      const referenceKey = `attendance_reminder:${user._id.toString()}:${todayStr}`;

      // Check if attendance for today has already been recorded by this user
      const todayAttendance = await Attendance.findOne({
        userId: user._id,
        date: todayStr,
      });

      if (!todayAttendance) {
        await createAndSendNotification({
          userId: user._id,
          tenantId: user.tenantId,
          type: "attendance_reminder",
          title: "Attendance Reminder 📝",
          message: "Don't forget to mark today's worker attendance in Haajari Manager.",
          data: { screen: "Attendance" },
          referenceKey,
        });
      }
    }
  } catch (error) {
    console.error("[ReminderScheduler] Error checking attendance reminders:", error);
  }
}

export async function checkSubscriptionReminders() {
  try {
    const tenants = await Tenant.find({ plan: { $ne: "free" } });

    for (const tenant of tenants) {
      if (!tenant.planExpiresAt) continue;

      const now = Date.now();
      const expiry = new Date(tenant.planExpiresAt).getTime();
      const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

      let threshold: string | null = null;
      let title = "";
      let message = "";

      if (diffDays === 7) {
        threshold = "7_DAYS";
        title = "Subscription Renewal Notice ⏳";
        message = `Your ${tenant.plan.toUpperCase()} plan expires in 7 days. Renew now to maintain uninterrupted access.`;
      } else if (diffDays === 3) {
        threshold = "3_DAYS";
        title = "Subscription Expiring Soon ⚠️";
        message = `Your ${tenant.plan.toUpperCase()} plan expires in 3 days. Upgrade or renew today.`;
      } else if (diffDays === 1) {
        threshold = "1_DAY";
        title = "Subscription Expires Tomorrow 🔴";
        message = `Your ${tenant.plan.toUpperCase()} plan expires tomorrow. Renew to avoid account limitations.`;
      } else if (diffDays <= 0) {
        threshold = "EXPIRED";
        title = "Subscription Expired ❌";
        message = `Your ${tenant.plan.toUpperCase()} plan has expired. Renew your plan to continue using business features.`;
      }

      if (threshold) {
        const users = await User.find({ tenantId: tenant._id, role: "admin" });
        const todayStr = new Date().toISOString().split("T")[0];

        for (const user of users) {
          const referenceKey = `subscription_reminder:${user._id.toString()}:${threshold}:${todayStr}`;
          await createAndSendNotification({
            userId: user._id,
            tenantId: tenant._id,
            type: "subscription_reminder",
            title,
            message,
            data: { screen: "Settings", params: { openUpgrade: true } },
            referenceKey,
          });
        }
      }
    }
  } catch (error) {
    console.error("[ReminderScheduler] Error checking subscription reminders:", error);
  }
}

export function startReminderScheduler() {
  console.log("[ReminderScheduler] Background reminder scheduler initialized.");
  
  // Run checks once at startup
  setTimeout(() => {
    checkDailyAttendanceReminders();
    checkSubscriptionReminders();
  }, 10000);

  // Interval check every 6 hours (21,600,000 ms)
  setInterval(() => {
    checkDailyAttendanceReminders();
    checkSubscriptionReminders();
  }, 6 * 60 * 60 * 1000);
}
