import { Router } from "express";
import {
  getSubscriptionConfig,
  getAvailablePlans,
  getSubscriptionStatus,
  createCheckout,
  activateSubscription,
  cancelSubscription,
  getUserTransactions,
} from "../controllers/subscriptionV2Controller";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

// Public / Unauthenticated route for app config check
router.get("/config", getSubscriptionConfig as any);
router.get("/plans", getAvailablePlans as any);

// Authenticated User Routes
router.use(authenticateJWT as any);

router.get("/status", getSubscriptionStatus as any);
router.post("/checkout", createCheckout as any);
router.post("/activate", activateSubscription as any);
router.post("/cancel", cancelSubscription as any);
router.get("/transactions", getUserTransactions as any);

export default router;
