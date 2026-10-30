import crypto from "crypto";
import Razorpay from "razorpay";
import {
  SubscriptionConfigV2,
  SubscriptionPlanV2,
  UserSubscriptionV2,
  SubscriptionTransactionV2,
  ISubscriptionPlanV2,
  IBillingOptionV2,
  Tenant,
  User,
} from "../models";
import { getIO } from "../utils/socket";

// Redesigned Canonical Plans: ₹149 Monthly & ₹1119 Yearly
export const DEFAULT_PLANS = [
  {
    planId: "pro",
    name: "Haajari Pro",
    description: "Complete all-in-one construction management & worker attendance suite.",
    active: true,
    displayOrder: 1,
    features: {
      maxWorkers: -1, // Unlimited workers
      maxProjects: -1, // Unlimited sites
      maxSupervisors: -1, // Unlimited supervisors
      gpsAttendance: true,
      reports: true,
      advancedReports: true,
    },
    billingOptions: [
      {
        optionId: "monthly",
        durationMonths: 1,
        billingLabel: "Monthly",
        price: 149,
        currency: "INR",
        active: true,
        promotionEnabled: false,
      },
      {
        optionId: "yearly",
        durationMonths: 12,
        billingLabel: "Yearly",
        price: 1119,
        currency: "INR",
        active: true,
        promotionEnabled: true,
        promotionalPrice: 1119,
        promotionalDurationMonths: 12,
      },
    ],
  },
];

export class SubscriptionServiceV2 {
  /**
   * Get or initialize the global subscription config. Default is Free Mode (globalEnabled = false).
   */
  static async getGlobalConfig() {
    let config = await SubscriptionConfigV2.findOne();
    if (!config) {
      config = await SubscriptionConfigV2.create({
        globalEnabled: false,
        mode: "free",
      });
    }
    return config;
  }

  /**
   * Update global subscription switch and broadcast via Socket.IO
   */
  static async updateGlobalConfig(globalEnabled: boolean, updatedBy?: string) {
    let config = await SubscriptionConfigV2.findOne();
    const mode = globalEnabled ? "subscription" : "free";

    if (!config) {
      config = await SubscriptionConfigV2.create({
        globalEnabled,
        mode,
        updatedBy,
      });
    } else {
      config.globalEnabled = globalEnabled;
      config.mode = mode;
      config.updatedBy = updatedBy as any;
      await config.save();
    }

    // Sync AppConfig document so legacy app endpoints remain 100% in sync
    try {
      const { AppConfig } = await import("../models/AppConfig");
      let appConfig = await AppConfig.findOne();
      if (!appConfig) {
        await AppConfig.create({ subscriptionsEnabled: globalEnabled });
      } else {
        appConfig.subscriptionsEnabled = globalEnabled;
        await appConfig.save();
      }
    } catch {}

    // Ensure default plans exist in DB
    await this.seedDefaultPlans();

    // Broadcast Socket.IO update to all connected clients
    try {
      const io = getIO();
      if (io) {
        io.emit("subscription:configUpdated", {
          subscriptionEnabled: config.globalEnabled,
          mode: config.mode,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // Socket server optional broadcast catch
    }

    return config;
  }

  /**
   * Seed canonical plans (upsert Pro plan with ₹149 monthly and ₹1119 yearly)
   */
  static async seedDefaultPlans(forceReset: boolean = false) {
    const proPlan = await SubscriptionPlanV2.findOne({ planId: "pro" });
    if (!proPlan || forceReset) {
      await SubscriptionPlanV2.deleteMany({});
      await SubscriptionPlanV2.insertMany(DEFAULT_PLANS);
      console.log("[SubscriptionServiceV2] Seeded canonical plans: ₹149/mo & ₹1119/yr");
    }
  }

  /**
   * Get plans exposed to normal mobile app users
   */
  static async getAvailablePlansForUser() {
    const config = await this.getGlobalConfig();
    if (!config.globalEnabled) {
      return [];
    }

    await this.seedDefaultPlans();

    const plans = await SubscriptionPlanV2.find({ active: true })
      .sort({ displayOrder: 1 })
      .lean();

    // Filter out inactive billing options
    return plans.map((p) => ({
      ...p,
      billingOptions: (p.billingOptions || []).filter((opt) => opt.active),
    }));
  }

  /**
   * Single unified subscription status endpoint for Mobile App
   */
  static async getUserSubscriptionStatus(userId: string, tenantId: string) {
    const config = await this.getGlobalConfig();

    if (!config.globalEnabled) {
      return {
        subscriptionEnabled: false,
        mode: "free",
        userSubscription: null,
        availablePlans: [],
      };
    }

    const availablePlans = await this.getAvailablePlansForUser();

    // Query user's current active subscription
    const activeSub = await UserSubscriptionV2.findOne({
      tenantId,
      status: "active",
      expiresAt: { $gt: new Date() },
    })
      .sort({ expiresAt: -1 })
      .lean();

    let formattedSub = null;
    if (activeSub) {
      formattedSub = {
        subscriptionId: activeSub._id,
        status: activeSub.status,
        planId: activeSub.planId,
        billingOptionId: activeSub.billingOptionId,
        startedAt: activeSub.startedAt,
        expiresAt: activeSub.expiresAt,
        provider: activeSub.provider,
      };
    }

    return {
      subscriptionEnabled: true,
      mode: "subscription",
      userSubscription: formattedSub,
      availablePlans,
    };
  }

  /**
   * Create Razorpay Checkout Order for user
   */
  static async createRazorpayOrder(
    userId: string,
    tenantId: string,
    planId: string = "pro",
    optionId: string = "monthly"
  ) {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    // Check plan in DB (or fallback to canonical Pro plan)
    let plan = await SubscriptionPlanV2.findOne({
      $or: [{ planId }, { planId: "pro" }],
      active: true,
    });
    if (!plan) {
      await this.seedDefaultPlans(true);
      plan = await SubscriptionPlanV2.findOne({ planId: "pro", active: true });
    }
    if (!plan) {
      throw { code: "PLAN_INACTIVE", message: "Requested plan is not available." };
    }

    // Determine billing option (monthly: 149, yearly: 1119)
    const normalizedOption = (optionId || "monthly").toLowerCase();
    const isYearly = normalizedOption.includes("year") || normalizedOption.includes("12");

    const option = plan.billingOptions.find((o) =>
      isYearly ? (o.optionId === "yearly" || o.durationMonths === 12) : (o.optionId === "monthly" || o.durationMonths === 1)
    ) || plan.billingOptions[0];

    const durationMonths = isYearly ? 12 : 1;
    const amountRupees = isYearly ? 1119 : 149;
    const amountInPaise = amountRupees * 100;
    const receipt = `rcpt_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    let orderId = `order_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
    let shortUrl = "";
    const userDoc = await User.findById(userId).select("name email phone").lean();

    // Call real Razorpay SDK if API credentials are configured in backend environment
    if (key_id && key_secret) {
      try {
        const razorpay = new Razorpay({
          key_id,
          key_secret,
        });

        const order = await razorpay.orders.create({
          amount: amountInPaise,
          currency: "INR",
          receipt,
          notes: {
            userId: String(userId),
            tenantId: String(tenantId),
            planId: plan.planId,
            billingOptionId: option.optionId,
            durationMonths: String(durationMonths),
            amountRupees: String(amountRupees),
          },
        });
        orderId = order.id;

        // Generate official Razorpay hosted checkout page link
        try {
          const customerContact =
            userDoc?.phone && userDoc.phone.replace(/\D/g, "").length === 10
              ? `+91${userDoc.phone.replace(/\D/g, "")}`
              : undefined;

          const paymentLink = await razorpay.paymentLink.create({
            amount: amountInPaise,
            currency: "INR",
            accept_partial: false,
            description: `Haajari Pro ${option.billingLabel} Subscription`,
            reference_id: orderId,
            customer: {
              name: userDoc?.name || "Contractor",
              email: userDoc?.email || undefined,
              contact: customerContact,
            },
            notify: {
              sms: false,
              email: false,
            },
            reminder_enable: false,
            notes: {
              userId: String(userId),
              tenantId: String(tenantId),
              orderId,
              planId: plan.planId,
              billingOptionId: option.optionId,
            },
            callback_url: "https://haajari.com/payment-callback",
            callback_method: "get",
          });
          if (paymentLink && paymentLink.short_url) {
            shortUrl = paymentLink.short_url;
          }
        } catch (plErr: any) {
          console.warn("[SubscriptionServiceV2] Payment link note:", plErr?.message || plErr);
        }
      } catch (rzpErr: any) {
        console.error("[SubscriptionServiceV2] Razorpay orders.create error:", rzpErr);
        throw {
          code: "RAZORPAY_ORDER_FAILED",
          message: rzpErr.error?.description || rzpErr.message || "Failed to create Razorpay order.",
        };
      }
    }

    // Create transaction record in database
    const transaction = await SubscriptionTransactionV2.create({
      transactionId: orderId,
      userId,
      tenantId,
      planId: plan.planId,
      planNameSnapshot: plan.name,
      billingOptionId: option.optionId,
      billingSnapshot: {
        durationMonths,
        billingLabel: option.billingLabel,
        price: amountRupees,
        effectivePrice: amountRupees,
        receipt,
      },
      amount: amountRupees,
      currency: "INR",
      status: "pending",
      paymentProvider: "razorpay",
      metadata: {
        orderId,
        receipt,
        amountInPaise,
        paymentUrl: shortUrl,
      },
    });

    return {
      success: true,
      provider: "razorpay",
      orderId,
      transactionId: transaction.transactionId,
      amount: amountRupees,
      amountRupees,
      amountInPaise,
      currency: "INR",
      keyId: key_id || "",
      planId: plan.planId,
      billingOptionId: option.optionId,
      planName: plan.name,
      billingLabel: option.billingLabel,
      durationMonths,
      paymentUrl: shortUrl,
      prefill: {
        name: userDoc?.name || "",
        email: userDoc?.email || "",
        contact: userDoc?.phone || "",
      },
    };
  }

  /**
   * Alias for backward compatibility
   */
  static async createCheckoutOrder(
    userId: string,
    tenantId: string,
    planId: string,
    optionId: string
  ) {
    return this.createRazorpayOrder(userId, tenantId, planId, optionId);
  }

  /**
   * Cryptographically verify Razorpay signature and activate subscription
   */
  static async verifyRazorpayPayment(
    userId: string,
    tenantId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    planId: string = "pro",
    billingOptionId: string = "monthly",
    paymentLinkDetails?: {
      paymentLinkId?: string;
      referenceId?: string;
      status?: string;
    }
  ) {
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    // Signature verification with HMAC-SHA256
    if (key_secret && razorpaySignature && razorpaySignature !== "webhook_verified") {
      const orderBody = `${razorpayOrderId}|${razorpayPaymentId}`;
      const expectedOrderSig = crypto
        .createHmac("sha256", key_secret)
        .update(orderBody)
        .digest("hex");

      let isValid = expectedOrderSig === razorpaySignature;

      // Also check payment link signature if available
      if (!isValid && paymentLinkDetails?.paymentLinkId) {
        const linkBody = `${paymentLinkDetails.paymentLinkId}|${paymentLinkDetails.referenceId || razorpayOrderId}|${paymentLinkDetails.status || "paid"}|${razorpayPaymentId}`;
        const expectedLinkSig = crypto
          .createHmac("sha256", key_secret)
          .update(linkBody)
          .digest("hex");
        if (expectedLinkSig === razorpaySignature) {
          isValid = true;
        }
      }

      if (!isValid) {
        console.warn(`[Razorpay Verification] Signature mismatch for order: ${razorpayOrderId}`);
        await SubscriptionTransactionV2.updateOne(
          { $or: [{ transactionId: razorpayOrderId }, { "metadata.orderId": razorpayOrderId }] },
          { status: "failed", paymentReference: razorpayPaymentId }
        );
        throw {
          code: "INVALID_SIGNATURE",
          message: "Razorpay signature verification failed. Untrusted payment.",
        };
      }
    }

    const txn = await SubscriptionTransactionV2.findOne({
      $or: [{ transactionId: razorpayOrderId }, { "metadata.orderId": razorpayOrderId }],
    });

    const isYearly =
      (billingOptionId || txn?.billingOptionId || "").toLowerCase().includes("year") ||
      txn?.billingSnapshot?.durationMonths === 12;

    const durationMonths = isYearly ? 12 : 1;
    const startedAt = new Date();
    const expiresAt = new Date(startedAt);
    if (durationMonths >= 12) {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    // 1. Update Tenant
    await Tenant.findByIdAndUpdate(tenantId, {
      plan: "pro",
      planExpiresAt: expiresAt,
      status: "Active",
    });

    // 2. Mark previous user subscriptions superseded and create new active subscription
    await UserSubscriptionV2.updateMany(
      { tenantId, status: "active" },
      { $set: { status: "superseded" } }
    );

    const userSub = await UserSubscriptionV2.create({
      userId,
      tenantId,
      planId: txn?.planId || planId || "pro",
      billingOptionId: isYearly ? "yearly" : "monthly",
      status: "active",
      startedAt,
      expiresAt,
      provider: "razorpay",
      providerSubscriptionId: razorpayPaymentId,
    });

    // 3. Mark transaction paid
    if (txn) {
      txn.status = "paid";
      txn.paymentReference = razorpayPaymentId;
      txn.startedAt = startedAt;
      txn.expiresAt = expiresAt;
      txn.metadata = {
        ...txn.metadata,
        razorpayPaymentId,
        razorpaySignature,
        verifiedAt: new Date().toISOString(),
      };
      await txn.save();
    }

    // 4. Socket notifications for real-time app unlock
    try {
      const io = getIO();
      if (io) {
        io.to(`user_${userId}`).emit("subscription:statusUpdated", {
          status: "active",
          planId: "pro",
          expiresAt,
        });
        io.to(`tenant_${tenantId}`).emit("subscription:statusUpdated", {
          status: "active",
          planId: "pro",
          expiresAt,
        });
        io.emit("admin_dashboard_update");
      }
    } catch {}

    return {
      success: true,
      message: "Payment verified and subscription activated successfully!",
      subscription: userSub,
      expiresAt,
    };
  }

  /**
   * Activate User Subscription after Payment verification (backward-compatible)
   */
  static async activateSubscription(
    userId: string,
    tenantId: string,
    transactionId: string,
    paymentReference?: string
  ) {
    const txn = await SubscriptionTransactionV2.findOne({ transactionId });
    if (!txn) {
      throw { code: "TRANSACTION_NOT_FOUND", message: "Transaction record not found." };
    }

    const durationMonths = txn.billingSnapshot?.durationMonths || 1;
    const startedAt = new Date();
    const expiresAt = new Date(startedAt);
    if (durationMonths >= 12) {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + durationMonths);
    }

    // Update transaction
    txn.status = "paid";
    txn.paymentReference = paymentReference || `PAY_${Date.now()}`;
    txn.startedAt = startedAt;
    txn.expiresAt = expiresAt;
    await txn.save();

    // Expire any prior active user subscriptions for this tenant
    await UserSubscriptionV2.updateMany(
      { tenantId, status: "active" },
      { $set: { status: "superseded" } }
    );

    // Update Tenant
    await Tenant.findByIdAndUpdate(tenantId, {
      plan: "pro",
      planExpiresAt: expiresAt,
      status: "Active",
    });

    // Create new active subscription
    const userSub = await UserSubscriptionV2.create({
      userId,
      tenantId,
      planId: txn.planId,
      billingOptionId: txn.billingOptionId,
      status: "active",
      startedAt,
      expiresAt,
      provider: txn.paymentProvider,
      providerSubscriptionId: txn.paymentReference,
    });

    // Real-time socket notification to user & admin
    try {
      const io = getIO();
      if (io) {
        io.to(`user_${userId}`).emit("subscription:statusUpdated", {
          status: "active",
          planId: txn.planId,
          expiresAt,
        });
        io.to(`tenant_${tenantId}`).emit("subscription:statusUpdated", {
          status: "active",
          planId: txn.planId,
          expiresAt,
        });
        io.to("admin:subscription").emit("subscription:subscriptionActivated", {
          transactionId,
          userId,
          tenantId,
          amount: txn.amount,
        });
      }
    } catch {
      // socket catch
    }

    return userSub;
  }

  /**
   * Feature Access & Plan Limit Enforcement
   * Returns allowed: true instantly if Global Subscription is OFF.
   */
  static async checkPlanEnforcement(
    tenantId: string,
    resource: "workers" | "projects" | "supervisors",
    currentCount: number
  ) {
    const config = await this.getGlobalConfig();
    if (!config.globalEnabled) {
      return { allowed: true, limit: -1, current: currentCount, mode: "free" };
    }

    const activeSub = await UserSubscriptionV2.findOne({
      tenantId,
      status: "active",
      expiresAt: { $gt: new Date() },
    });

    let planId = "starter";
    if (activeSub) {
      planId = activeSub.planId;
    }

    const plan = await SubscriptionPlanV2.findOne({ planId });
    const features = plan?.features || {
      maxWorkers: 15,
      maxProjects: 1,
      maxSupervisors: 1,
    };

    let limit = 15;
    if (resource === "workers") limit = features.maxWorkers;
    if (resource === "projects") limit = features.maxProjects;
    if (resource === "supervisors") limit = features.maxSupervisors;

    if (limit === -1 || currentCount < limit) {
      return { allowed: true, limit, current: currentCount, mode: "subscription" };
    }

    return { allowed: false, limit, current: currentCount, mode: "subscription" };
  }
}
