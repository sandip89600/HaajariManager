import { Router } from "express";
import {
  getSubscriptionConfig,
  getAvailablePlans,
  getSubscriptionStatus,
  createCheckout,
  verifyPayment,
  handleRazorpayWebhook,
  activateSubscription,
  cancelSubscription,
  getUserTransactions,
} from "../controllers/subscriptionV2Controller";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

// Public / Unauthenticated routes
router.get("/config", getSubscriptionConfig as any);
router.get("/plans", getAvailablePlans as any);
router.post("/webhook", handleRazorpayWebhook as any);

// Authenticated User Routes
router.use(authenticateJWT as any);

router.get("/status", getSubscriptionStatus as any);
router.post("/checkout", createCheckout as any);
router.post("/create-order", createCheckout as any);
router.post("/verify-payment", verifyPayment as any);
router.post("/activate", activateSubscription as any);
router.post("/cancel", cancelSubscription as any);
router.get("/transactions", getUserTransactions as any);

export default router;
