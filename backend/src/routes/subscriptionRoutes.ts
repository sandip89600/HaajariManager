import { Router } from 'express';
import { authenticateJWT, optionalAuthenticateJWT, requireAdmin } from '../middleware/auth';
import {
  getPublicPlansAndPricing,
  getMySubscription,
  getMyEntitlements,
  createCheckoutOrder,
  verifyPaymentSignature,
  getBillingHistory,
  manageSubscription,
} from '../controllers/subscriptionController';
import { grantManualSubscription } from '../controllers/adminSubscriptionController';

const router = Router();

// Public / optional auth endpoint for plan pricing and promo offer status
router.get('/plans', optionalAuthenticateJWT as any, getPublicPlansAndPricing as any);

// Authenticated user subscription endpoints
router.get('/me', authenticateJWT as any, getMySubscription as any);
router.get('/me/entitlements', authenticateJWT as any, getMyEntitlements as any);
router.post('/checkout', authenticateJWT as any, createCheckoutOrder as any);
router.post('/verify', authenticateJWT as any, verifyPaymentSignature as any);

// Admin manual grant route (alias under /subscriptions/grant)
router.post('/grant', authenticateJWT as any, requireAdmin as any, grantManualSubscription as any);

// Legacy backward-compatible routes
router.post('/confirm', authenticateJWT as any, verifyPaymentSignature as any);
router.get('/history', authenticateJWT as any, getBillingHistory as any);
router.post('/manage', authenticateJWT as any, manageSubscription as any);

export default router;
