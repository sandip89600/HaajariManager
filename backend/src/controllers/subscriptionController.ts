import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { SubscriptionService } from '../services/subscriptionService';
import { PlanCode } from '../models';

// 1. Get Public / Authenticated Plans & Pricing & Promo Information
export const getPublicPlansAndPricing = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId ? req.user.tenantId.toString() : undefined;
    const data = await SubscriptionService.getPlansAndPricing(tenantId);
    return res.json({ success: true, ...data });
  } catch (error: any) {
    console.error('[SubscriptionController] Error in getPublicPlansAndPricing:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to fetch plans' });
  }
};

// 2. Get My Active Subscription Details
export const getMySubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId?.toString();
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const data = await SubscriptionService.getUserEntitlements(tenantId);
    return res.json({ success: true, ...data });
  } catch (error: any) {
    console.error('[SubscriptionController] Error in getMySubscription:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// 3. Get My Active Feature Entitlements & Usage
export const getMyEntitlements = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId?.toString();
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const data = await SubscriptionService.getUserEntitlements(tenantId);
    return res.json({ success: true, entitlements: data.entitlements, usage: data.usage });
  } catch (error: any) {
    console.error('[SubscriptionController] Error in getMyEntitlements:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// 4. Create Server Checkout Order
export const createCheckoutOrder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId?.toString();
    const userId = req.user?.id?.toString() || (req.user as any)?._id?.toString();

    if (!tenantId || !userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { planCode = 'SUPER', billingCycle = '3_MONTH', isPromo = false } = req.body;

    const checkoutData = await SubscriptionService.createCheckoutOrder(
      tenantId,
      userId,
      planCode as PlanCode,
      billingCycle,
      Boolean(isPromo)
    );

    return res.status(201).json({
      success: true,
      message: 'Checkout order created successfully.',
      ...checkoutData,
    });
  } catch (error: any) {
    console.error('[SubscriptionController] Error in createCheckoutOrder:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
};

// 5. Verify Razorpay HMAC Payment Signature
export const verifyPaymentSignature = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId?.toString();
    const userId = req.user?.id?.toString() || (req.user as any)?._id?.toString();

    if (!tenantId || !userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId) {
      return res.status(400).json({ success: false, error: 'Missing payment signature verification parameters' });
    }

    const updatedEntitlements = await SubscriptionService.verifyPayment(tenantId, userId, {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature: razorpaySignature || '',
    });

    return res.json({
      success: true,
      message: 'Payment verified and entitlement unlocked successfully!',
      ...updatedEntitlements,
    });
  } catch (error: any) {
    console.error('[SubscriptionController] Error in verifyPaymentSignature:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
};

// Legacy / Backward Compatible aliases
export const createCheckoutSession = createCheckoutOrder;
export const confirmPayment = verifyPaymentSignature;
export const getBillingHistory = getMySubscription;
export const manageSubscription = getMySubscription;
