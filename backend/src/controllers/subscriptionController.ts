import { Response } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { Tenant, User, SubscriptionTransaction } from "../models";
import { AuthenticatedRequest } from "../middleware/auth";
import { logActivity } from "../services/activityLogger";

// Helper to generate Invoice Number
const generateInvoiceNumber = () => {
  return `INV-SUB-${Math.floor(100000 + Math.random() * 900000)}`;
};

// Plan details definitions (in INR)
const PLAN_PRICES = {
  basic: { monthly: 70, "3months": 149, yearly: 499 },
  super: { monthly: 149, "3months": 249, yearly: 999 },
  premium: { monthly: 199, "3months": 499, yearly: 1599 },
};

const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error("Razorpay API credentials missing in environment variables.");
  }

  return new Razorpay({ key_id, key_secret });
};

// 1. Create Razorpay Subscription Order
export const createCheckoutSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { planName, billingCycle, paymentMethod = "Razorpay" } = req.body;

    if (!["basic", "super", "premium"].includes(planName)) {
      return res.status(400).json({ error: "Invalid plan name" });
    }
    if (!["monthly", "3months", "yearly"].includes(billingCycle)) {
      return res.status(400).json({ error: "Invalid billing cycle" });
    }

    const baseAmount = PLAN_PRICES[planName as "basic" | "super" | "premium"][billingCycle as "monthly" | "3months" | "yearly"];
    const gst = Math.round(baseAmount * 0.18); // 18% GST
    const totalAmountINR = baseAmount + gst;
    const totalAmountPaise = totalAmountINR * 100; // Convert to paise for Razorpay

    const invoiceNumber = generateInvoiceNumber();

    const transaction = new SubscriptionTransaction({
      tenantId,
      userId,
      invoiceNumber,
      planName,
      billingCycle,
      amount: totalAmountINR,
      gst,
      paymentMethod,
      status: "Pending",
      autoRenew: true,
    });

    await transaction.save();

    // Create Razorpay Order
    let razorpayOrderId = "";
    try {
      const razorpay = getRazorpayInstance();
      const razorpayOrder = await razorpay.orders.create({
        amount: totalAmountPaise,
        currency: "INR",
        receipt: invoiceNumber,
        notes: {
          tenantId: tenantId.toString(),
          userId: userId.toString(),
          planName,
          billingCycle,
        },
      });
      razorpayOrderId = razorpayOrder.id;
    } catch (e: any) {
      console.warn("[SubscriptionController] Razorpay order creation warning:", e.message);
    }

    res.status(201).json({
      success: true,
      message: "Razorpay order created for subscription.",
      key_id: process.env.RAZORPAY_KEY_ID,
      order_id: razorpayOrderId,
      amount: totalAmountPaise,
      amountINR: totalAmountINR,
      currency: "INR",
      transactionId: transaction._id,
      transaction,
    });
  } catch (error: any) {
    console.error("[SubscriptionController] Error in createCheckoutSession:", error);
    res.status(500).json({ error: error.message || "Failed to create checkout session." });
  }
};

// 2. Verify Razorpay Payment Signature & Complete Subscription Upgrade
export const confirmPayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      transactionId,
      status,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: "Transaction ID is required" });
    }

    // Verify HMAC-SHA256 signature if Razorpay fields are present
    if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        return res.status(500).json({ error: "Razorpay Key Secret is missing on server." });
      }

      const body = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(body.toString())
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        console.warn("[SubscriptionController] Razorpay signature mismatch!");
        return res.status(400).json({
          success: false,
          error: "Invalid Razorpay payment signature verification failed.",
        });
      }
    }

    const txn = await SubscriptionTransaction.findById(transactionId);
    if (!txn || txn.tenantId.toString() !== tenantId.toString()) {
      return res.status(404).json({ error: "Transaction session not found" });
    }

    if (txn.status === "Completed") {
      return res.status(400).json({ error: "Transaction is already completed." });
    }

    const newStatus = status || "Completed";
    txn.status = newStatus as any;
    if (razorpay_payment_id) {
      txn.paymentMethod = "Razorpay";
    }
    await txn.save();

    if (newStatus === "Completed") {
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
          changes: { after: { plan: txn.planName } },
        });
      }
    }

    res.json({
      success: true,
      message: `Transaction processed as: ${newStatus}`,
      transaction: txn,
    });
  } catch (error: any) {
    console.error("[SubscriptionController] Error confirming payment:", error);
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

    const { action } = req.body;

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

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
