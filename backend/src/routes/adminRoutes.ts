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
} from "../controllers/adminController";
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

// Subscription / Tenant Plan Management
router.put("/tenants/:tenantId/plan", updateTenantPlan as any);

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
router.post("/security/force-logout", forceLogoutUser as any);
router.post("/security/disable-device", disableSuspiciousDevice as any);

export default router;
