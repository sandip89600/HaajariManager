import { Response } from "express";
import { Tenant, User, SubscriptionTransaction } from "../models";
import { AuthenticatedRequest } from "../middleware/auth";
import { logActivity } from "../services/activityLogger";

// Helper to generate Invoice Number
const generateInvoiceNumber = () => {
  return `INV-SUB-${Math.floor(100000 + Math.random() * 900000)}`;
};

// Plan details definitions
const PLAN_PRICES = {
  basic: { monthly: 70, "3months": 149, yearly: 499 },
  super: { monthly: 149, "3months": 249, yearly: 999 },
  premium: { monthly: 199, "3months": 499, yearly: 1599 },
};

// 1. Initialize Subscription Payment (Create pending invoice/transaction)
export const createCheckoutSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { planName, billingCycle, paymentMethod } = req.body;

    if (!["basic", "super", "premium"].includes(planName)) {
      return res.status(400).json({ error: "Invalid plan name" });
    }
    if (!["monthly", "3months", "yearly"].includes(billingCycle)) {
      return res.status(400).json({ error: "Invalid billing cycle" });
    }
    if (!["UPI", "Credit Card", "Debit Card", "Net Banking", "Wallet"].includes(paymentMethod)) {
      return res.status(400).json({ error: "Invalid payment method" });
    }

    // Prevent duplicate subscriptions or duplicate pending transactions
    const existingPending = await SubscriptionTransaction.findOne({
      tenantId,
      status: "Pending",
      planName,
      billingCycle,
    });

    if (existingPending) {
      return res.json({
        success: true,
        message: "Resuming existing pending payment session.",
        transaction: existingPending,
      });
    }

    const baseAmount = PLAN_PRICES[planName as "basic" | "super" | "premium"][billingCycle as "monthly" | "3months" | "yearly"];
    const gst = Math.round(baseAmount * 0.18); // 18% GST
    const totalAmount = baseAmount + gst;

    const transaction = new SubscriptionTransaction({
      tenantId,
      userId,
      invoiceNumber: generateInvoiceNumber(),
      planName,
      billingCycle,
      amount: totalAmount,
      gst,
      paymentMethod,
      status: "Pending",
      autoRenew: true,
    });

    await transaction.save();

    res.status(201).json({
      success: true,
      message: "Payment transaction initialized.",
      transaction,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Complete Payment Flow (Simulate success, failure, or pending)
export const confirmPayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { transactionId, status } = req.body; // status: "Completed" | "Failed" | "Pending"

    if (!transactionId) {
      return res.status(400).json({ error: "Transaction ID is required" });
    }
    if (!["Completed", "Failed", "Pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid status type" });
    }

    const txn = await SubscriptionTransaction.findById(transactionId);
    if (!txn || txn.tenantId.toString() !== tenantId.toString()) {
      return res.status(404).json({ error: "Transaction session not found" });
    }

    if (txn.status === "Completed") {
      return res.status(400).json({ error: "Transaction is already completed." });
    }

    txn.status = status as any;
    await txn.save();

    if (status === "Completed") {
      const tenant = await Tenant.findById(tenantId);
      if (tenant) {
        tenant.plan = txn.planName;
        
        let days = 30;
        if (txn.billingCycle === "3months") days = 90;
        else if (txn.billingCycle === "yearly") days = 365;

        tenant.planExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        await tenant.save();

        await logActivity({
          req,
          action: "PLAN_UPGRADE",
          targetType: "Tenant",
          targetId: tenantId.toString(),
          userId: userId.toString(),
          tenantId: tenantId.toString(),
          changes: { after: { plan: txn.planName } }
        });
      }
    }

    res.json({
      success: true,
      message: `Transaction processed as: ${status}`,
      transaction: txn,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Billing & Invoice History
export const getBillingHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const transactions = await SubscriptionTransaction.find({ tenantId })
      .sort({ date: -1 })
      .populate("userId", "name email");

    res.json({ success: true, transactions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Manage auto renewal, renewals, cancels, or upgrades
export const manageSubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { action } = req.body; // "cancel_renew" | "enable_renew" | "downgrade"

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    // Toggle autorenew flag on last transaction
    const lastTxn = await SubscriptionTransaction.findOne({ tenantId, status: "Completed" }).sort({ date: -1 });

    if (action === "cancel_renew") {
      if (lastTxn) {
        lastTxn.autoRenew = false;
        await lastTxn.save();
      }
      return res.json({ success: true, message: "Auto renewal has been cancelled.", plan: tenant.plan, autoRenew: false });
    } else if (action === "enable_renew") {
      if (lastTxn) {
        lastTxn.autoRenew = true;
        await lastTxn.save();
      }
      return res.json({ success: true, message: "Auto renewal has been re-enabled.", plan: tenant.plan, autoRenew: true });
    } else if (action === "downgrade") {
      // Downgrade immediately or set plan to basic
      tenant.plan = "basic";
      tenant.planExpiresAt = undefined;
      await tenant.save();

      return res.json({ success: true, message: "Subscription downgraded to Basic Plan.", plan: tenant.plan });
    }

    res.status(400).json({ error: "Invalid action type" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
