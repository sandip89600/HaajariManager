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

    if (!planId || !billingOptionId) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Plan and billing option are required." });
    }

    const order = await SubscriptionServiceV2.createCheckoutOrder(userId, tenantId, planId, billingOptionId);
    return res.status(201).json(order);
  } catch (err: any) {
    if (err.code) {
      return res.status(400).json(err);
    }
    return res.status(500).json({ error: "CHECKOUT_FAILED", message: "Unable to process checkout." });
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
