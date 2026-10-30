import { Request, Response } from "express";
import { SubscriptionServiceV2 } from "../services/subscriptionServiceV2";
import { SubscriptionTransactionV2, UserSubscriptionV2 } from "../models";

export const getSubscriptionConfig = async (req: Request, res: Response) => {
  try {
    const config = await SubscriptionServiceV2.getGlobalConfig();
    return res.json({
      subscriptionEnabled: config.globalEnabled,
      mode: config.mode,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch subscription config." });
  }
};

export const getAvailablePlans = async (req: Request, res: Response) => {
  try {
    const plans = await SubscriptionServiceV2.getAvailablePlansForUser();
    return res.json(plans);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch plans." });
  }
};

export const getSubscriptionStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const tenantId = (req as any).user?.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "User authentication required." });
    }

    const status = await SubscriptionServiceV2.getUserSubscriptionStatus(userId, tenantId);
    return res.json(status);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to retrieve subscription status." });
  }
};

export const createCheckout = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const tenantId = (req as any).user?.tenantId;
    const { planId, billingOptionId } = req.body;

    const resolvedPlanId = planId || "pro";
    const resolvedOptionId = billingOptionId || "monthly";

    const order = await SubscriptionServiceV2.createRazorpayOrder(
      userId,
      tenantId,
      resolvedPlanId,
      resolvedOptionId
    );
    return res.status(201).json(order);
  } catch (err: any) {
    if (err.code) {
      return res.status(400).json(err);
    }
    return res.status(500).json({ error: "CHECKOUT_FAILED", message: err.message || "Unable to process checkout." });
  }
};

export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const tenantId = (req as any).user?.tenantId;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
      billingOptionId,
      razorpay_payment_link_id,
      razorpay_payment_link_reference_id,
      razorpay_payment_link_status,
    } = req.body;

    const resolvedOrderId = razorpay_order_id || razorpay_payment_link_reference_id;

    if (!resolvedOrderId || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing required Razorpay parameters: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.",
      });
    }

    const result = await SubscriptionServiceV2.verifyRazorpayPayment(
      userId,
      tenantId,
      resolvedOrderId,
      razorpay_payment_id,
      razorpay_signature,
      planId,
      billingOptionId,
      {
        paymentLinkId: razorpay_payment_link_id,
        referenceId: razorpay_payment_link_reference_id,
        status: razorpay_payment_link_status,
      }
    );

    return res.status(200).json(result);
  } catch (err: any) {
    if (err.code === "INVALID_SIGNATURE") {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: err.message || "Failed to verify payment." });
  }
};

export const handleRazorpayWebhook = async (req: Request, res: Response) => {
  try {
    const crypto = await import("crypto");
    const webhookSignature = req.headers["x-razorpay-signature"] as string;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;

    if (webhookSecret && webhookSignature) {
      const shasum = crypto.createHmac("sha256", webhookSecret);
      shasum.update(JSON.stringify(req.body));
      const digest = shasum.digest("hex");

      if (digest !== webhookSignature) {
        return res.status(400).json({ error: "Invalid webhook signature" });
      }
    }

    const event = req.body.event;
    if (event === "payment.captured" || event === "order.paid") {
      const paymentEntity = req.body.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;
      const notes = paymentEntity?.notes || {};

      if (orderId && notes.tenantId) {
        const txn = await SubscriptionTransactionV2.findOne({
          $or: [{ transactionId: orderId }, { "metadata.orderId": orderId }],
        });
        if (txn && txn.status !== "paid") {
          await SubscriptionServiceV2.verifyRazorpayPayment(
            notes.userId || txn.userId,
            notes.tenantId || txn.tenantId,
            orderId,
            paymentId,
            webhookSignature || "webhook_verified",
            notes.planId,
            notes.billingOptionId
          );
        }
      }
    }

    return res.status(200).json({ status: "ok" });
  } catch (err: any) {
    console.error("[Razorpay Webhook Error]:", err);
    return res.status(500).json({ error: "Webhook processing error" });
  }
};

export const activateSubscription = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const tenantId = (req as any).user?.tenantId;
    const { transactionId, paymentReference } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Transaction ID is required." });
    }

    const sub = await SubscriptionServiceV2.activateSubscription(
      userId,
      tenantId,
      transactionId,
      paymentReference
    );

    return res.json({ message: "Subscription activated successfully.", subscription: sub });
  } catch (err: any) {
    if (err.code) {
      return res.status(400).json(err);
    }
    return res.status(500).json({ error: "ACTIVATION_FAILED", message: "Unable to activate subscription." });
  }
};

export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    await UserSubscriptionV2.updateMany(
      { tenantId, status: "active" },
      { $set: { status: "cancelled" } }
    );
    return res.json({ message: "Subscription cancelled successfully." });
  } catch (err: any) {
    return res.status(500).json({ error: "CANCEL_FAILED", message: "Failed to cancel subscription." });
  }
};

export const getUserTransactions = async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId;
    const transactions = await SubscriptionTransactionV2.find({ tenantId })
      .sort({ createdAt: -1 })
      .lean();
    return res.json(transactions);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch transactions." });
  }
};
