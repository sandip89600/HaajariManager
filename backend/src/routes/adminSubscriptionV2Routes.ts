import { Router } from "express";
import {
  getAdminConfig,
  updateAdminConfig,
  getAdminPlans,
  createAdminPlan,
  updateAdminPlan,
  deleteAdminPlan,
  togglePlanStatus,
  toggleBillingOptionStatus,
  getAdminTransactions,
  getAdminAnalytics,
} from "../controllers/adminSubscriptionV2Controller";
import { authenticateJWT, requireAdmin } from "../middleware/auth";

const router = Router();

// Protect all admin subscription routes
router.use(authenticateJWT as any);
router.use(requireAdmin as any);

router.get("/config", getAdminConfig as any);
router.put("/config", updateAdminConfig as any);

router.get("/plans", getAdminPlans as any);
router.post("/plans", createAdminPlan as any);
router.put("/plans/:planId", updateAdminPlan as any);
router.delete("/plans/:planId", deleteAdminPlan as any);

router.put("/plans/:planId/status", togglePlanStatus as any);
router.put("/plans/:planId/billing-options/:optionId/status", toggleBillingOptionStatus as any);

router.get("/transactions", getAdminTransactions as any);
router.get("/analytics", getAdminAnalytics as any);

export default router;
