import mongoose from 'mongoose';
import dotenv from 'dotenv';
import {
  Plan,
  PlanPrice,
  Feature,
  PlanEntitlement,
  PromotionCampaign,
  UserSubscription,
  Tenant,
  PlanCode,
} from '../models';

dotenv.config();

export async function seedAndMigrateSubscriptions() {
  console.log('[Subscription Migration] Starting seed and migration process...');

  // 1. Seed Plans
  const plansData = [
    {
      code: 'FREE',
      name: 'Free Plan',
      description: 'Essential attendance management for small sites.',
      badge: 'Free Forever',
      sortOrder: 1,
      isActive: true,
    },
    {
      code: 'SUPER',
      name: 'Super Manager Plan',
      description: 'Full feature set for growing contractors and site managers.',
      badge: 'Popular Choice',
      sortOrder: 2,
      isActive: true,
    },
    {
      code: 'PREMIUM',
      name: 'Enterprise Premium Plan',
      description: 'Unlimited scale for large construction enterprises.',
      badge: 'Best Value',
      sortOrder: 3,
      isActive: true,
    },
  ];

  for (const p of plansData) {
    await Plan.findOneAndUpdate({ code: p.code }, p, { upsert: true, new: true });
  }
  console.log('[Subscription Migration] Canonical Plans seeded.');

  // 2. Seed Plan Prices
  const pricesData = [
    // SUPER Plan Prices
    { planCode: 'SUPER', billingCycle: '3_MONTH', price: 75, discountPercent: 0, isActive: true },
    { planCode: 'SUPER', billingCycle: '6_MONTH', price: 299, discountPercent: 20, isActive: true },
    { planCode: 'SUPER', billingCycle: '12_MONTH', price: 799, discountPercent: 40, isActive: true },
    // PREMIUM Plan Prices
    { planCode: 'PREMIUM', billingCycle: '3_MONTH', price: 149, discountPercent: 0, isActive: true },
    { planCode: 'PREMIUM', billingCycle: '6_MONTH', price: 499, discountPercent: 20, isActive: true },
    { planCode: 'PREMIUM', billingCycle: '12_MONTH', price: 999, discountPercent: 45, isActive: true },
  ];

  for (const pr of pricesData) {
    await PlanPrice.findOneAndUpdate(
      { planCode: pr.planCode, billingCycle: pr.billingCycle },
      pr,
      { upsert: true, new: true }
    );
  }
  console.log('[Subscription Migration] Plan Prices seeded.');

  // 3. Seed Features
  const featuresData = [
    { code: 'workers_limit', name: 'Worker Capacity Limit', description: 'Maximum workers allowed in tenant', category: 'Capacity' },
    { code: 'sites_limit', name: 'Site Capacity Limit', description: 'Maximum active sites allowed', category: 'Capacity' },
    { code: 'supervisors_limit', name: 'Supervisor Accounts', description: 'Maximum supervisors allowed', category: 'Team' },
    { code: 'material_management', name: 'Material Inventory Tracking', description: 'Track materials and site usage', category: 'Features' },
    { code: 'payment_tracking', name: 'Payment & Advance Logs', description: 'Record payments, advances & handovers', category: 'Features' },
    { code: 'reports_pdf_excel', name: 'PDF & Excel Reports', description: 'Export attendance, salary & site reports', category: 'Exports' },
    { code: 'live_dashboard', name: 'Real-Time Dashboard', description: 'Live overview metrics and site updates', category: 'Analytics' },
    { code: 'priority_support', name: 'Priority Support', description: '24/7 dedicated support channel', category: 'Support' },
  ];

  for (const f of featuresData) {
    await Feature.findOneAndUpdate({ code: f.code }, f, { upsert: true, new: true });
  }
  console.log('[Subscription Migration] Features seeded.');

  // 4. Seed Entitlements
  const entitlementsData = [
    // FREE Plan
    { planCode: 'FREE', featureCode: 'workers_limit', enabled: true, limit: 10 },
    { planCode: 'FREE', featureCode: 'sites_limit', enabled: true, limit: 1 },
    { planCode: 'FREE', featureCode: 'supervisors_limit', enabled: false, limit: 0 },
    { planCode: 'FREE', featureCode: 'material_management', enabled: false, limit: 0 },
    { planCode: 'FREE', featureCode: 'payment_tracking', enabled: true, limit: -1 },
    { planCode: 'FREE', featureCode: 'reports_pdf_excel', enabled: false, limit: 0 },
    { planCode: 'FREE', featureCode: 'live_dashboard', enabled: true, limit: -1 },
    { planCode: 'FREE', featureCode: 'priority_support', enabled: false, limit: 0 },

    // SUPER Plan
    { planCode: 'SUPER', featureCode: 'workers_limit', enabled: true, limit: 100 },
    { planCode: 'SUPER', featureCode: 'sites_limit', enabled: true, limit: 10 },
    { planCode: 'SUPER', featureCode: 'supervisors_limit', enabled: true, limit: 5 },
    { planCode: 'SUPER', featureCode: 'material_management', enabled: true, limit: -1 },
    { planCode: 'SUPER', featureCode: 'payment_tracking', enabled: true, limit: -1 },
    { planCode: 'SUPER', featureCode: 'reports_pdf_excel', enabled: true, limit: -1 },
    { planCode: 'SUPER', featureCode: 'live_dashboard', enabled: true, limit: -1 },
    { planCode: 'SUPER', featureCode: 'priority_support', enabled: true, limit: -1 },

    // PREMIUM Plan
    { planCode: 'PREMIUM', featureCode: 'workers_limit', enabled: true, limit: -1 },
    { planCode: 'PREMIUM', featureCode: 'sites_limit', enabled: true, limit: -1 },
    { planCode: 'PREMIUM', featureCode: 'supervisors_limit', enabled: true, limit: -1 },
    { planCode: 'PREMIUM', featureCode: 'material_management', enabled: true, limit: -1 },
    { planCode: 'PREMIUM', featureCode: 'payment_tracking', enabled: true, limit: -1 },
    { planCode: 'PREMIUM', featureCode: 'reports_pdf_excel', enabled: true, limit: -1 },
    { planCode: 'PREMIUM', featureCode: 'live_dashboard', enabled: true, limit: -1 },
    { planCode: 'PREMIUM', featureCode: 'priority_support', enabled: true, limit: -1 },
  ];

  for (const e of entitlementsData) {
    await PlanEntitlement.findOneAndUpdate(
      { planCode: e.planCode, featureCode: e.featureCode },
      e,
      { upsert: true, new: true }
    );
  }
  console.log('[Subscription Migration] Plan Entitlements seeded.');

  // 5. Seed ₹2 Promotional Launch Campaign
  await PromotionCampaign.findOneAndUpdate(
    { code: 'PROMO_2RS' },
    {
      code: 'PROMO_2RS',
      name: '₹2 Special Launch Offer',
      description: 'Get 1 Full Month of Super Manager Plan for only ₹2!',
      promoPrice: 2,
      durationDays: 30,
      targetPlanCode: 'SUPER',
      eligibility: 'NEW_USERS_ONLY',
      startDate: new Date(),
      isActive: true,
      maxRedemptions: -1,
    },
    { upsert: true, new: true }
  );
  console.log('[Subscription Migration] ₹2 Launch Promotion Campaign seeded.');

  // 6. Migrate Existing Tenants to UserSubscription
  const tenants = await Tenant.find({});
  let migratedCount = 0;

  for (const tenant of tenants) {
    const tenantIdStr = tenant._id.toString();
    const existingSub = await UserSubscription.findOne({ tenantId: tenantIdStr });

    if (!existingSub) {
      let mappedPlanCode: PlanCode = 'FREE';
      const rawPlan = (tenant.plan || 'free').toString().toLowerCase();
      if (rawPlan === 'super') mappedPlanCode = 'SUPER';
      else if (rawPlan === 'premium') mappedPlanCode = 'PREMIUM';
      else if (rawPlan === 'basic') mappedPlanCode = 'FREE'; // Migrate legacy 'basic' to FREE or SUPER

      const farFuture = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000); // 100 years
      const endDate = tenant.planExpiresAt ? new Date(tenant.planExpiresAt) : (mappedPlanCode === 'FREE' ? farFuture : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

      await UserSubscription.create({
        tenantId: tenantIdStr,
        planCode: mappedPlanCode,
        billingCycle: mappedPlanCode === 'FREE' ? 'LIFETIME' : '3_MONTH',
        status: 'ACTIVE',
        startDate: tenant.createdAt || new Date(),
        endDate,
        autoRenew: false,
        isPromo: false,
      });
      migratedCount++;
    }
  }

  console.log(`[Subscription Migration] Migrated ${migratedCount} tenant subscriptions.`);
  console.log('[Subscription Migration] Complete success!');
}

if (require.main === module) {
  const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/haajari';
  mongoose
    .connect(MONGO_URI)
    .then(async () => {
      await seedAndMigrateSubscriptions();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Subscription Migration Error]', err);
      process.exit(1);
    });
}
