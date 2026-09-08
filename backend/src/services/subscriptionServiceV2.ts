import crypto from "crypto";
import {
  SubscriptionConfigV2,
  SubscriptionPlanV2,
  UserSubscriptionV2,
  SubscriptionTransactionV2,
  ISubscriptionPlanV2,
  IBillingOptionV2,
} from "../models";
import { getIO } from "../utils/socket";

// Default seed plans if database has no plans configured
const DEFAULT_PLANS = [
  {
    planId: "starter",
    name: "Starter",
    description: "Ideal for small contractors and growing teams.",
    active: true,
    displayOrder: 1,
    features: {
      maxWorkers: 25,
      maxProjects: 3,
      maxSupervisors: 2,
      gpsAttendance: true,
      reports: true,
      advancedReports: false,
    },
    billingOptions: [
      {
        optionId: "monthly",
        durationMonths: 1,
        billingLabel: "Monthly",
        price: 99,
        currency: "INR",
        active: true,
        promotionEnabled: true,
        promotionalPrice: 2,
        promotionalDurationMonths: 1,
      },
      {
        optionId: "3_months",
        durationMonths: 3,
        billingLabel: "3 Months",
        price: 249,
        currency: "INR",
        active: true,
        promotionEnabled: false,
      },
      {
        optionId: "6_months",
        durationMonths: 6,
        billingLabel: "6 Months",
        price: 449,
        currency: "INR",
        active: true,
        promotionEnabled: false,
      },
      {
        optionId: "12_months",
        durationMonths: 12,
        billingLabel: "12 Months",
        price: 799,
        currency: "INR",
        active: true,
        promotionEnabled: false,
      },
    ],
  },
  {
    planId: "professional",
    name: "Professional",
    description: "Designed for expanding multi-site contractors.",
    active: true,
    displayOrder: 2,
    features: {
      maxWorkers: 100,
      maxProjects: 10,
      maxSupervisors: 5,
      gpsAttendance: true,
      reports: true,
      advancedReports: true,
    },
    billingOptions: [
      {
        optionId: "monthly",
        durationMonths: 1,
        billingLabel: "Monthly",
        price: 299,
        currency: "INR",
        active: true,
        promotionEnabled: false,
      },
      {
        optionId: "3_months",
        durationMonths: 3,
        billingLabel: "3 Months",
        price: 749,
        currency: "INR",
        active: true,
        promotionEnabled: false,
      },
      {
        optionId: "6_months",
        durationMonths: 6,
        billingLabel: "6 Months",
        price: 1399,
        currency: "INR",
        active: true,
        promotionEnabled: false,
      },
      {
        optionId: "12_months",
        durationMonths: 12,
        billingLabel: "12 Months",
        price: 2499,
        currency: "INR",
        active: true,
        promotionEnabled: false,
      },
    ],
  },
  {
    planId: "business",
    name: "Business",
    description: "Unlimited operational capacity for enterprise construction managers.",
    active: true,
    displayOrder: 3,
    features: {
      maxWorkers: -1,
      maxProjects: -1,
      maxSupervisors: -1,
      gpsAttendance: true,
      reports: true,
      advancedReports: true,
    },
    billingOptions: [
      {
        optionId: "monthly",
        durationMonths: 1,
        billingLabel: "Monthly",
        price: 599,
        currency: "INR",
        active: true,
        promotionEnabled: false,
      },
      {
        optionId: "3_months",
        durationMonths: 3,
        billingLabel: "3 Months",
        price: 1499,
        currency: "INR",
        active: true,
        promotionEnabled: false,
      },
      {
        optionId: "6_months",
        durationMonths: 6,
        billingLabel: "6 Months",
        price: 2799,
        currency: "INR",
        active: true,
        promotionEnabled: false,
      },
      {
        optionId: "12_months",
        durationMonths: 12,
        billingLabel: "12 Months",
        price: 4999,
        currency: "INR",
        active: true,
        promotionEnabled: false,
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
   * Seed canonical plans if database has none
   */
  static async seedDefaultPlans() {
    const existingCount = await SubscriptionPlanV2.countDocuments();
    if (existingCount === 0) {
      await SubscriptionPlanV2.insertMany(DEFAULT_PLANS);
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
   * Create Checkout Order for user
   */
  static async createCheckoutOrder(
    userId: string,
    tenantId: string,
    planId: string,
    optionId: string
  ) {
    const config = await this.getGlobalConfig();
    if (!config.globalEnabled) {
      throw { code: "SUBSCRIPTION_DISABLED", message: "Subscription system is currently in Free Mode." };
    }

    const plan = await SubscriptionPlanV2.findOne({ planId, active: true });
    if (!plan) {
      throw { code: "PLAN_INACTIVE", message: "Requested plan is not available." };
    }

    const option = plan.billingOptions.find((o) => o.optionId === optionId && o.active);
    if (!option) {
      throw { code: "BILLING_OPTION_INACTIVE", message: "Requested billing duration is not active." };
    }

    // Effective price calculation
    const effectivePrice =
      option.promotionEnabled && typeof option.promotionalPrice === "number"
        ? option.promotionalPrice
        : option.price;

    const transactionId = `TXN_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    const transaction = await SubscriptionTransactionV2.create({
      transactionId,
      userId,
      tenantId,
      planId,
      planNameSnapshot: plan.name,
      billingOptionId: optionId,
      billingSnapshot: {
        durationMonths: option.durationMonths,
        billingLabel: option.billingLabel,
        price: option.price,
        promotionalPrice: option.promotionalPrice,
        promotionEnabled: option.promotionEnabled,
        effectivePrice,
      },
      amount: effectivePrice,
      currency: option.currency || "INR",
      status: "pending",
      paymentProvider: "razorpay",
    });

    // Notify admin socket room of new transaction
    try {
      const io = getIO();
      if (io) {
        io.to("admin:subscription").emit("subscription:transactionCreated", {
          transactionId: transaction.transactionId,
          amount: transaction.amount,
          planName: plan.name,
          timestamp: transaction.createdAt,
        });
      }
    } catch {
      // socket catch
    }

    return {
      transactionId: transaction.transactionId,
      amount: transaction.amount,
      currency: transaction.currency,
      planName: plan.name,
      billingLabel: option.billingLabel,
      effectivePrice,
    };
  }

  /**
   * Activate User Subscription after Payment verification
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
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

    // Update transaction
    txn.status = "paid";
    txn.paymentReference = paymentReference || `PAY_${Date.now()}`;
    txn.startedAt = startedAt;
    txn.expiresAt = expiresAt;
    await txn.save();

    // Expire any prior active user subscriptions for this tenant
    await UserSubscriptionV2.updateMany(
      { tenantId, status: "active" },
      { $set: { status: "expired" } }
    );

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
