import { Router } from "express";
import { authenticateJWT } from "../middleware/auth";
import {
  createCheckoutSession,
  confirmPayment,
  getBillingHistory,
  manageSubscription
} from "../controllers/subscriptionController";

const router = Router();

// Protect all routes with JWT authentication
router.use(authenticateJWT as any);

router.post("/checkout", createCheckoutSession as any);
router.post("/confirm", confirmPayment as any);
router.get("/history", getBillingHistory as any);
router.post("/manage", manageSubscription as any);

export default router;
