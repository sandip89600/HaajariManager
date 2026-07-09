"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var adminController_1 = require("../controllers/adminController");
var auth_1 = require("../middleware/auth");
var router = (0, express_1.Router)();
// Apply admin protection to all routes in this sub-router
router.use(auth_1.authenticateJWT);
router.use(auth_1.requireAdmin);
// User Management
router.get("/users", adminController_1.getAllUsers);
router.put("/users/:id", adminController_1.updateUserInfo);
router.put("/users/:id/status", adminController_1.toggleUserStatus);
router.delete("/users/:id", adminController_1.deleteUser);
// Subscription / Tenant Plan Management
router.put("/tenants/:tenantId/plan", adminController_1.updateTenantPlan);
// Analytics Metrics
router.get("/analytics", adminController_1.getAdminAnalytics);
// Worker Management
router.get("/workers", adminController_1.getAllWorkers);
router.put("/workers/:id", adminController_1.updateWorkerInfo);
router.delete("/workers/:id", adminController_1.deleteWorkerAdmin);
// Attendance Management
router.get("/attendance", adminController_1.getAllAttendance);
router.put("/attendance/:id", adminController_1.updateAttendanceAdmin);
router.delete("/attendance/:id", adminController_1.deleteAttendanceAdmin);
// Payment/Payroll Management
router.get("/payments", adminController_1.getAllPayments);
router.put("/payments/:id", adminController_1.updatePaymentAdmin);
router.delete("/payments/:id", adminController_1.deletePaymentAdmin);
// Support Management
router.get("/support/problems", adminController_1.getAllProblemsAdmin);
router.put("/support/problems/:id/resolve", adminController_1.resolveProblemAdmin);
router.delete("/support/problems/:id", adminController_1.deleteProblemAdmin);
router.get("/support/feedback", adminController_1.getAllFeedbackAdmin);
router.delete("/support/feedback/:id", adminController_1.deleteFeedbackAdmin);
// Admin Security Management
router.get("/security/logs", adminController_1.getSecurityLogs);
router.get("/security/sessions", adminController_1.getActiveSessions);
router.post("/security/force-logout", adminController_1.forceLogoutUser);
router.post("/security/disable-device", adminController_1.disableSuspiciousDevice);
exports.default = router;
