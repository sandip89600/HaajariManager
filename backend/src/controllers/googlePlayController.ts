import { Request, Response } from "express";
import { GooglePlayService, VALID_PRODUCT_IDS } from "../services/googlePlayService";
import { UserSubscriptionV2, SubscriptionPlanV2 } from "../models";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    _id?: string;
    tenantId: string;
    email?: string;
    role?: string;
  };
}

/**
 * Verify Google Play Purchase Token & Activate PRO
 * POST /api/google-play/verify-purchase (or /api/v2/google-play/verify-purchase)
 */
export const verifyPurchase = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User or Tenant ID missing from authentication session.",
      });
    }

    const { productId, purchaseToken, packageName, orderId } = req.body;

    if (!productId || !purchaseToken) {
      return res.status(400).json({
        success: false,
        message: "Both 'productId' and 'purchaseToken' are required in request body.",
      });
    }

    const result = await GooglePlayService.verifySubscriptionPurchase({
      userId: String(userId),
      tenantId: String(tenantId),
      productId,
      purchaseToken,
      packageName,
      orderId,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[GooglePlayController] verifyPurchase error:", error);
    return res.status(error.code === "TOKEN_ALREADY_USED" ? 409 : 400).json({
      success: false,
      code: error.code || "VERIFICATION_ERROR",
      message: error.message || "Failed to verify Google Play purchase.",
    });
  }
};

/**
 * Get User Google Play Subscription Status
 * GET /api/google-play/subscription-status
 */
export const getSubscriptionStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Tenant ID missing.",
      });
    }

    // Query active or recently active subscription
    const sub = await UserSubscriptionV2.findOne({
      tenantId,
      status: { $in: ["active", "in_grace_period", "on_hold", "cancelled"] },
      expiresAt: { $gt: new Date() },
    })
      .sort({ expiresAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      hasActiveSubscription: Boolean(sub),
      subscription: sub
        ? {
            subscriptionId: sub._id,
            planId: sub.planId,
            billingOptionId: sub.billingOptionId,
            status: sub.status,
            startedAt: sub.startedAt,
            expiresAt: sub.expiresAt,
            autoRenew: sub.autoRenew,
            cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
            cancelledAt: sub.cancelledAt,
            provider: sub.provider,
            orderId: (sub as any).orderId,
            productId: (sub as any).lineItems?.[0]?.productId || (sub.billingOptionId === "yearly" ? "haajari_pro_annual" : "haajari_pro_monthly"),
          }
        : null,
    });
  } catch (error: any) {
    console.error("[GooglePlayController] getSubscriptionStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching subscription status.",
    });
  }
};

/**
 * Restore User Purchases
 * POST /api/google-play/restore-purchases
 */
export const restorePurchases = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const tenantId = req.user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User or Tenant ID missing.",
      });
    }

    const { purchases } = req.body;

    if (!purchases || !Array.isArray(purchases)) {
      return res.status(400).json({
        success: false,
        message: "An array of 'purchases' is required.",
      });
    }

    const result = await GooglePlayService.restorePurchases({
      userId: String(userId),
      tenantId: String(tenantId),
      purchases,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[GooglePlayController] restorePurchases error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to restore Google Play purchases.",
    });
  }
};

/**
 * Google Cloud Pub/Sub Webhook for Real-Time Developer Notifications (RTDN)
 * POST /api/google-play/pubsub-webhook
 * Note: Must return 200 OK to acknowledge receipt to Cloud Pub/Sub
 */
export const handlePubSubWebhook = async (req: Request, res: Response) => {
  try {
    // Cloud Pub/Sub sends messages with structure: { message: { data, messageId, publishTime }, subscription }
    const { message } = req.body;

    if (!message) {
      // Just acknowledge empty ping
      return res.status(200).send("OK");
    }

    await GooglePlayService.handlePubSubNotification(message);

    // Always respond 200 OK to acknowledge Pub/Sub message delivery
    return res.status(200).send("OK");
  } catch (error: any) {
    console.error("[GooglePlayController] handlePubSubWebhook error:", error);
    // Still return 200 so Pub/Sub doesn't storm retries on malformed messages, but log the event
    return res.status(200).send("OK");
  }
};
