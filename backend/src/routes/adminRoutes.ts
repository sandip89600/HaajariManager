import { Router } from "express";
import {
  getAllUsers,
  updateUserInfo,
  toggleUserStatus,
  deleteUser,
  updateTenantPlan,
  getAdminAnalytics,
  getAllWorkers,
  updateWorkerInfo,
  deleteWorkerAdmin,
  getAllAttendance,
  updateAttendanceAdmin,
  deleteAttendanceAdmin,
  getAllPayments,
  updatePaymentAdmin,
  deletePaymentAdmin,
  getAllProblemsAdmin,
  resolveProblemAdmin,
  deleteProblemAdmin,
  getAllFeedbackAdmin,
  deleteFeedbackAdmin,
  getSecurityLogs,
  getActiveSessions,
  forceLogoutUser,
  disableSuspiciousDevice,
  deleteAllUsers,
  logoutAllUsers,
  getActivityLogs,
  getActivityStats,
  getAllTenantsAdmin,
  deleteTenantAdmin,
  getAllMaterialsAdmin,
  getAllExpensesAdmin,
  getAllSalariesAdmin,
  getAllNotificationsAdmin,
  getAllSubscriptionsAdmin,
  getAllSupportTicketsAdmin,
  getAllDevicesAdmin,
} from "../controllers/adminController";
import { getSubscriptionConfig, updateSubscriptionConfig } from "../controllers/adminConfigController";
import {
  sendAdminNotification,
  getAdminNotificationHistory,
  getAdminRecipientList,
} from "../controllers/adminNotificationController";
import {
  sendAdminEmailNotification,
  sendTestEmailNotification,
  saveEmailDraft,
  getEmailNotificationHistory,
  getEmailNotificationDetails,
} from "../controllers/adminEmailNotificationController";
import { getAdminSecurityEvents } from "../controllers/authController";
import { authenticateJWT, requireAdmin } from "../middleware/auth";

const router = Router();

// Apply admin protection to all routes in this sub-router
router.use(authenticateJWT as any);
router.use(requireAdmin as any);

// User Management
router.get("/users", getAllUsers as any);
router.put("/users/:id", updateUserInfo as any);
router.put("/users/:id/status", toggleUserStatus as any);
router.delete("/users/:id", deleteUser as any);
router.delete("/users-wipe", deleteAllUsers as any);

// Subscription / Tenant Plan Management
router.put("/tenants/:tenantId/plan", updateTenantPlan as any);
router.delete("/tenants/:id", deleteTenantAdmin as any);

// Analytics Metrics
router.get("/analytics", getAdminAnalytics as any);

// Worker Management
router.get("/workers", getAllWorkers as any);
router.put("/workers/:id", updateWorkerInfo as any);
router.delete("/workers/:id", deleteWorkerAdmin as any);

// Attendance Management
router.get("/attendance", getAllAttendance as any);
router.put("/attendance/:id", updateAttendanceAdmin as any);
router.delete("/attendance/:id", deleteAttendanceAdmin as any);

// Payment/Payroll Management
router.get("/payments", getAllPayments as any);
router.put("/payments/:id", updatePaymentAdmin as any);
router.delete("/payments/:id", deletePaymentAdmin as any);

// Support Management
router.get("/support/problems", getAllProblemsAdmin as any);
router.put("/support/problems/:id/resolve", resolveProblemAdmin as any);
router.delete("/support/problems/:id", deleteProblemAdmin as any);
router.get("/support/feedback", getAllFeedbackAdmin as any);
router.delete("/support/feedback/:id", deleteFeedbackAdmin as any);

// Admin Security Management
router.get("/security/logs", getSecurityLogs as any);
router.get("/security/sessions", getActiveSessions as any);
router.get("/security-events", getAdminSecurityEvents as any);
router.post("/security/force-logout", forceLogoutUser as any);
router.post("/security/disable-device", disableSuspiciousDevice as any);
router.post("/security/logout-all", logoutAllUsers as any);

// Live Activity & Operational Control Analytics
router.get("/activity", getActivityLogs as any);
router.get("/activity/stats", getActivityStats as any);

// Catalog catalogs & detailed admin metrics
router.get("/tenants", getAllTenantsAdmin as any);
router.get("/materials", getAllMaterialsAdmin as any);
router.get("/expenses", getAllExpensesAdmin as any);
router.get("/salary", getAllSalariesAdmin as any);
router.get("/notifications", getAllNotificationsAdmin as any);
router.post("/notifications/send", sendAdminNotification as any);
router.get("/notifications/history", getAdminNotificationHistory as any);
router.get("/notifications/recipients", getAdminRecipientList as any);

// Email Notifications Management
router.post("/notifications/email/send", sendAdminEmailNotification as any);
router.post("/notifications/email/test", sendTestEmailNotification as any);
router.post("/notifications/email/draft", saveEmailDraft as any);
router.get("/notifications/email/history", getEmailNotificationHistory as any);
router.get("/notifications/email/:id", getEmailNotificationDetails as any);
import {
  getAdminFeedbacks,
  updateAdminFeedbackStatus,
  addAdminFeedbackNote,
} from "../controllers/feedbackController";

// Feedback & Issue Management Endpoints
router.get("/feedback", getAdminFeedbacks as any);
router.patch("/feedback/:id/status", updateAdminFeedbackStatus as any);
router.post("/feedback/:id/notes", addAdminFeedbackNote as any);

export default router;
