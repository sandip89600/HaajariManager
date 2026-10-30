import { Router } from "express";
import {
  verifyPurchase,
  getSubscriptionStatus,
  restorePurchases,
  handlePubSubWebhook,
} from "../controllers/googlePlayController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

// Public webhook route for Google Cloud Pub/Sub Real-time Developer Notifications
router.post("/pubsub-webhook", handlePubSubWebhook as any);
router.post("/webhook", handlePubSubWebhook as any);

// Authenticated endpoints for mobile client
router.use(authenticateJWT as any);

router.post("/verify-purchase", verifyPurchase as any);
router.get("/subscription-status", getSubscriptionStatus as any);
router.post("/restore-purchases", restorePurchases as any);

export default router;
