import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
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
  User,
} from '../models';

// 1. Subscription Overview Stats
export async function getAdminSubscriptionStats(req: AuthenticatedRequest, res: Response) {
  try {
    const totalTenants = await Tenant.countDocuments();
    const activePaidSubs = await UserSubscription.countDocuments({
      status: 'ACTIVE',
      planCode: { $in: ['SUPER', 'PREMIUM'] },
    });
    const activeFreeSubs = await UserSubscription.countDocuments({
      status: 'ACTIVE',
      planCode: 'FREE',
    });
    const expiredSubs = await UserSubscription.countDocuments({ status: 'EXPIRED' });

    // Aggregate total revenue from successful transactions
    const revenueResult = await PaymentTransaction.aggregate([
      { $match: { status: 'SUCCESS' } },
      { $group: { _id: null, totalRevenue: { $sum: '$amount' } } },
    ]);
    const totalRevenue = revenueResult[0]?.totalRevenue || 0;

    // Estimate MRR (Monthly Recurring Revenue)
    const mrrResult = await UserSubscription.aggregate([
      { $match: { status: 'ACTIVE', planCode: { $in: ['SUPER', 'PREMIUM'] } } },
      { $group: { _id: '$planCode', count: { $sum: 1 } } },
    ]);

    let estimatedMRR = 0;
    for (const item of mrrResult) {
      if (item._id === 'SUPER') estimatedMRR += item.count * 99;
      if (item._id === 'PREMIUM') estimatedMRR += item.count * 199;
    }

    // Promo redemption stats
    const totalPromoRedemptions = await PromotionRedemption.countDocuments();

    // Recent 10 transactions
    const recentTransactions = await PaymentTransaction.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return res.json({
      success: true,
      stats: {
        totalTenants,
        activePaidSubs,
        activeFreeSubs,
        expiredSubs,
        totalRevenue,
        estimatedMRR,
        totalPromoRedemptions,
      },
      recentTransactions,
    });
  } catch (err: any) {
    console.error('[AdminSubscriptionController] Error in getAdminSubscriptionStats:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// 2. Manage Plans & Pricing
export async function getAdminPlans(req: AuthenticatedRequest, res: Response) {
  try {
    const plans = await Plan.find().sort({ sortOrder: 1 }).lean();
    const prices = await PlanPrice.find().lean();
    const entitlements = await PlanEntitlement.find().lean();
    const features = await Feature.find().lean();

    const formattedPlans = plans.map((plan) => ({
      ...plan,
      prices: prices.filter((p) => p.planCode === plan.code),
      entitlements: entitlements.filter((e) => e.planCode === plan.code),
    }));

    return res.json({ success: true, plans: formattedPlans, features });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateAdminPlanPrice(req: AuthenticatedRequest, res: Response) {
  try {
    const { planCode, billingCycle, price, isActive } = req.body;
    const actorId = req.user?.id || 'ADMIN';

    const updatedPrice = await PlanPrice.findOneAndUpdate(
      { planCode, billingCycle },
      { price, isActive },
      { upsert: true, new: true }
    );

    await SubscriptionAuditLog.create({
      actorId,
      actorRole: 'ADMIN',
      action: 'UPDATE_PLAN_PRICE',
      details: { planCode, billingCycle, price, isActive },
    });

    return res.json({ success: true, price: updatedPrice });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// 3. Promotions & Launch Offers Manager
export async function getAdminPromotions(req: AuthenticatedRequest, res: Response) {
  try {
    const campaigns = await PromotionCampaign.find().sort({ createdAt: -1 }).lean();
    const redemptions = await PromotionRedemption.find().sort({ createdAt: -1 }).limit(50).lean();

    return res.json({ success: true, campaigns, redemptions });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function updateAdminPromotion(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const actorId = req.user?.id || 'ADMIN';

    const campaign = await PromotionCampaign.findByIdAndUpdate(id, updateData, { new: true });

    await SubscriptionAuditLog.create({
      actorId,
      actorRole: 'ADMIN',
      action: 'UPDATE_PROMOTION_CAMPAIGN',
      details: { campaignId: id, updateData },
    });

    return res.json({ success: true, campaign });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// 4. Customers & Manual Entitlement Grants
export async function getAdminCustomers(req: AuthenticatedRequest, res: Response) {
  try {
    const { search, planFilter } = req.query;

    let query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const tenants = await Tenant.find(query).limit(100).lean();
    const tenantIds = tenants.map((t) => t._id.toString());

    const subscriptions = await UserSubscription.find({ tenantId: { $in: tenantIds } }).lean();
    const subMap: Record<string, any> = {};
    for (const sub of subscriptions) {
      subMap[sub.tenantId] = sub;
    }

    const customers = tenants.map((tenant) => {
      const tenantIdStr = tenant._id.toString();
      const sub = subMap[tenantIdStr] || {
        planCode: (tenant.plan || 'FREE').toUpperCase(),
        status: 'ACTIVE',
        endDate: tenant.planExpiresAt || null,
      };

      return {
        _id: tenantIdStr,
        tenantId: tenantIdStr,
        company: tenant.name || 'Site Owner',
        ownerName: tenant.name || 'Owner',
        ownerEmail: (tenant as any).email || 'N/A',
        ownerPhone: (tenant as any).phone || 'N/A',
        plan: sub.planCode,
        status: sub.status,
        startDate: sub.startDate || tenant.createdAt,
        renewalDate: sub.endDate,
        autoRenew: sub.autoRenew || false,
        isPromo: sub.isPromo || false,
      };
    });

    return res.json({ success: true, customers });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function grantManualSubscription(req: AuthenticatedRequest, res: Response) {
  try {
    const { tenantId, planCode, durationDays = 30, adminNotes } = req.body;
    const actorId = req.user?.id || 'ADMIN';

    if (!tenantId || !planCode) {
      return res.status(400).json({ success: false, error: 'tenantId and planCode are required' });
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const subscription = await UserSubscription.findOneAndUpdate(
      { tenantId },
      {
        tenantId,
        planCode,
        billingCycle: '3_MONTH',
        status: 'ACTIVE',
        startDate,
        endDate,
        autoRenew: false,
        assignedByAdmin: true,
        adminNotes,
      },
      { upsert: true, new: true }
    );

    await Tenant.findByIdAndUpdate(tenantId, {
      plan: planCode.toLowerCase(),
      planExpiresAt: endDate,
    });

    await SubscriptionAuditLog.create({
      actorId,
      actorRole: 'ADMIN',
      tenantId,
      action: 'MANUAL_SUBSCRIPTION_GRANT',
      details: { planCode, durationDays, adminNotes, endDate },
    });

    return res.json({ success: true, subscription });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// 5. Payment Transaction Ledger
export async function getAdminPayments(req: AuthenticatedRequest, res: Response) {
  try {
    const { status, search } = req.query;
    let query: any = {};
    if (status && status !== 'all') query.status = status;
    if (search) {
      query.$or = [
        { razorpayOrderId: { $regex: search, $options: 'i' } },
        { razorpayPaymentId: { $regex: search, $options: 'i' } },
        { tenantId: { $regex: search, $options: 'i' } },
      ];
    }

    const payments = await PaymentTransaction.find(query).sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ success: true, payments });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// 6. Upcoming Renewals & Expiries
export async function getAdminRenewals(req: AuthenticatedRequest, res: Response) {
  try {
    const now = new Date();
    const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const upcoming = await UserSubscription.find({
      status: 'ACTIVE',
      planCode: { $in: ['SUPER', 'PREMIUM'] },
      endDate: { $gte: now, $lte: next30Days },
    })
      .sort({ endDate: 1 })
      .lean();

    const expired = await UserSubscription.find({
      status: 'EXPIRED',
    })
      .sort({ endDate: -1 })
      .limit(50)
      .lean();

    return res.json({ success: true, upcoming, expired });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// 7. Audit Logs
export async function getAdminSubscriptionAuditLogs(req: AuthenticatedRequest, res: Response) {
  try {
    const logs = await SubscriptionAuditLog.find().sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ success: true, logs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
