import crypto from 'crypto';
import Razorpay from 'razorpay';
import {
  Plan,
  PlanPrice,
  Feature,
  PlanEntitlement,
  PromotionCampaign,
  PromotionRedemption,
  UserSubscription,
  PaymentTransaction,
  SubscriptionAuditLog,
  Tenant,
  Worker,
  Site,
  User,
  PlanCode,
  BillingCycle,
} from '../models';

const razorpayKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy_key';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || 'dummy_secret';

const razorpayInstance = new Razorpay({
  key_id: razorpayKeyId,
  key_secret: razorpayKeySecret,
});

export class SubscriptionService {
  /**
   * Check if a tenant is eligible for the New Users Only promotion (e.g. ₹2 promo)
   */
  static async isEligibleForPromo(tenantId: string): Promise<boolean> {
    if (!tenantId) return false;

    // Check if tenant has ever redeemed a promotion
    const existingRedemption = await PromotionRedemption.findOne({ tenantId });
    if (existingRedemption) return false;

    // Check if tenant has ever completed a paid subscription transaction
    const successfulPaidTx = await PaymentTransaction.findOne({
      tenantId,
      status: 'SUCCESS',
      amount: { $gt: 0 },
    });

    if (successfulPaidTx) return false;

    // Check if tenant currently has a paid plan
    const sub = await UserSubscription.findOne({ tenantId });
    if (sub && sub.planCode !== 'FREE' && !sub.isPromo) return false;

    return true;
  }

  /**
   * Get all active plans, prices, feature entitlements and active promo info
   */
  static async getPlansAndPricing(tenantId?: string) {
    const plans = await Plan.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
    const prices = await PlanPrice.find({ isActive: true }).lean();
    const entitlements = await PlanEntitlement.find({ enabled: true }).lean();
    const features = await Feature.find({ isActive: true }).lean();

    // Check active ₹2 promotion campaign
    const promoCampaign = await PromotionCampaign.findOne({
      code: 'PROMO_2RS',
      isActive: true,
    }).lean();

    let promoEligible = false;
    if (tenantId && promoCampaign) {
      promoEligible = await this.isEligibleForPromo(tenantId);
    }

    // Attach prices and entitlements to plans
    const formattedPlans = plans.map((plan) => {
      const planPrices = prices.filter((p) => p.planCode === plan.code);
      const planEntitlements = entitlements.filter((e) => e.planCode === plan.code);

      return {
        ...plan,
        prices: planPrices,
        entitlements: planEntitlements,
      };
    });

    return {
      plans: formattedPlans,
      features,
      promotion: promoCampaign
        ? {
            ...promoCampaign,
            isEligible: promoEligible,
          }
        : null,
      razorpayKeyId,
    };
  }

  /**
   * Resolve current entitlements, active subscription status, and live usage for a tenant
   */
  static async getUserEntitlements(tenantId: string) {
    let subscription = await UserSubscription.findOne({ tenantId });

    if (!subscription) {
      // Auto-create FREE subscription if non-existent
      subscription = await UserSubscription.create({
        tenantId,
        planCode: 'FREE',
        billingCycle: 'LIFETIME',
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
      });
    }

    // Check expiry for non-FREE plans
    if (subscription.planCode !== 'FREE' && subscription.endDate < new Date()) {
      if (subscription.status === 'ACTIVE') {
        subscription.status = 'EXPIRED';
        await subscription.save();
      }
    }

    const activePlanCode: PlanCode =
      subscription.status === 'ACTIVE' ? subscription.planCode : 'FREE';

    const plan = await Plan.findOne({ code: activePlanCode }).lean();
    const entitlements = await PlanEntitlement.find({ planCode: activePlanCode }).lean();

    // Calculate usage metrics
    const workersCount = await Worker.countDocuments({ tenantId, isDeleted: { $ne: true } });
    const sitesCount = await Site.countDocuments({ tenantId, isDeleted: { $ne: true } });
    const supervisorsCount = await User.countDocuments({
      tenantId,
      role: 'supervisor',
      isDeleted: { $ne: true },
    });

    // Helper map for feature caps
    const entitlementMap: Record<string, { enabled: boolean; limit: number }> = {};
    for (const e of entitlements) {
      entitlementMap[e.featureCode] = { enabled: e.enabled, limit: e.limit };
    }

    return {
      subscription: {
        planCode: subscription.planCode,
        activePlanCode,
        billingCycle: subscription.billingCycle,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        autoRenew: subscription.autoRenew,
        isPromo: subscription.isPromo,
        daysRemaining: Math.max(
          0,
          Math.ceil((new Date(subscription.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        ),
      },
      plan,
      entitlements: entitlementMap,
      usage: {
        workers: {
          used: workersCount,
          limit: entitlementMap['workers_limit']?.limit ?? 10,
        },
        sites: {
          used: sitesCount,
          limit: entitlementMap['sites_limit']?.limit ?? 1,
        },
        supervisors: {
          used: supervisorsCount,
          limit: entitlementMap['supervisors_limit']?.limit ?? 0,
        },
      },
    };
  }

  /**
   * Create Razorpay Checkout Order on backend
   */
  static async createCheckoutOrder(
    tenantId: string,
    userId: string,
    planCode: PlanCode,
    billingCycle: string,
    isPromo: boolean
  ) {
    let amountInINR = 0;
    let campaignCode: string | undefined = undefined;

    if (isPromo) {
      const isEligible = await this.isEligibleForPromo(tenantId);
      if (!isEligible) {
        throw new Error('Tenant is not eligible for the ₹2 promotional offer.');
      }
      const promo = await PromotionCampaign.findOne({ code: 'PROMO_2RS', isActive: true });
      if (!promo) {
        throw new Error('Promotional campaign is not currently active.');
      }
      amountInINR = promo.promoPrice; // ₹2
      campaignCode = promo.code;
    } else {
      const priceRecord = await PlanPrice.findOne({
        planCode,
        billingCycle: billingCycle as BillingCycle,
        isActive: true,
      });

      if (!priceRecord) {
        throw new Error(`Invalid plan price configuration for ${planCode} (${billingCycle}).`);
      }
      amountInINR = priceRecord.price;
    }

    const amountInPaise = Math.round(amountInINR * 100);
    const receipt = `sub_${tenantId.slice(-6)}_${Date.now().toString().slice(-6)}`;

    let orderId = `order_sim_${Date.now()}`;

    // Try creating real Razorpay order if credentials set
    if (process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_ID.includes('dummy')) {
      try {
        const order = await razorpayInstance.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt,
          notes: {
            tenantId,
            userId,
            planCode,
            billingCycle,
            isPromo: isPromo ? 'true' : 'false',
          },
        });
        orderId = order.id;
      } catch (err: any) {
        console.warn('[Razorpay Order Creation Warning] Using generated order reference:', err.message);
      }
    }

    // Save transaction record in CREATED state
    const transaction = await PaymentTransaction.create({
      tenantId,
      userId,
      razorpayOrderId: orderId,
      amount: amountInINR,
      currency: 'INR',
      status: 'CREATED',
      planCode,
      billingCycle,
      isPromo,
      campaignCode,
    });

    return {
      orderId,
      transactionId: transaction._id,
      amount: amountInINR,
      amountInPaise,
      currency: 'INR',
      planCode,
      billingCycle,
      isPromo,
      keyId: razorpayKeyId,
    };
  }

  /**
   * Verify Razorpay Payment Signature & Grant Entitlement
   */
  static async verifyPayment(
    tenantId: string,
    userId: string,
    payload: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }
  ) {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = payload;

    // Verify HMAC signature if secret is configured
    if (process.env.RAZORPAY_KEY_SECRET && !process.env.RAZORPAY_KEY_SECRET.includes('dummy')) {
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (generatedSignature !== razorpaySignature) {
        throw new Error('Invalid Razorpay payment signature.');
      }
    }

    // Find payment transaction
    const transaction = await PaymentTransaction.findOne({ razorpayOrderId });
    if (!transaction) {
      throw new Error(`Transaction not found for Order ID: ${razorpayOrderId}`);
    }

    // Idempotent check
    if (transaction.status === 'SUCCESS') {
      return this.getUserEntitlements(tenantId);
    }

    // Update transaction to SUCCESS
    transaction.status = 'SUCCESS';
    transaction.razorpayPaymentId = razorpayPaymentId;
    transaction.razorpaySignature = razorpaySignature;
    await transaction.save();

    // Calculate plan duration
    let durationDays = 30;
    if (transaction.isPromo) {
      durationDays = 30; // 1 month promo
    } else if (transaction.billingCycle === '3_MONTH') {
      durationDays = 90;
    } else if (transaction.billingCycle === '6_MONTH') {
      durationDays = 180;
    } else if (transaction.billingCycle === '12_MONTH') {
      durationDays = 365;
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Update UserSubscription
    const subscription = await UserSubscription.findOneAndUpdate(
      { tenantId },
      {
        tenantId,
        userId,
        planCode: transaction.planCode,
        billingCycle: transaction.isPromo ? '1_MONTH_PROMO' : transaction.billingCycle,
        status: 'ACTIVE',
        startDate,
        endDate,
        autoRenew: false,
        isPromo: transaction.isPromo,
        campaignCode: transaction.campaignCode,
      },
      { upsert: true, new: true }
    );

    // Handle Promo Redemption record
    if (transaction.isPromo && transaction.campaignCode) {
      const promo = await PromotionCampaign.findOne({ code: transaction.campaignCode });
      if (promo) {
        await PromotionRedemption.create({
          campaignId: promo._id,
          campaignCode: promo.code,
          tenantId,
          userId,
          redeemedAt: startDate,
          expiresAt: endDate,
          transactionId: transaction._id,
        });

        promo.currentRedemptions = (promo.currentRedemptions || 0) + 1;
        await promo.save();
      }
    }

    // Update Tenant document for backward compatibility
    await Tenant.findByIdAndUpdate(tenantId, {
      plan: transaction.planCode.toLowerCase(),
      planExpiresAt: endDate,
    });

    // Record audit log
    await SubscriptionAuditLog.create({
      actorId: userId || tenantId,
      actorRole: 'USER',
      tenantId,
      action: 'PAYMENT_VERIFIED_AND_ENTITLEMENT_GRANTED',
      details: {
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        planCode: transaction.planCode,
        amount: transaction.amount,
        isPromo: transaction.isPromo,
        endDate,
      },
    });

    return this.getUserEntitlements(tenantId);
  }
}
