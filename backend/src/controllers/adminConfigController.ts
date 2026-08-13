import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { AppConfig, AuditLog, User } from "../models";
import { invalidateAppConfigCache } from "../middleware/featureAccess";

// Helper to seed default config if not present
export const seedDefaultConfigIfNeeded = async (adminId?: any) => {
  let config = await AppConfig.findOne();
  if (!config) {
    config = new AppConfig({
      subscriptionsEnabled: false,
      features: [
        { key: "paymentHandover", name: "Payment Handover", description: "Enables contractor payment handover configuration and settings", enabled: true, premium: true, minPlan: "premium" },
        { key: "paymentProof", name: "Payment Proof", description: "Allows uploading and auditing payment proofs", enabled: false, premium: true, minPlan: "premium" },
        { key: "advancedReports", name: "Advanced Reports", description: "Allows exporting advanced PDF and CSV sheets", enabled: true, premium: true, minPlan: "premium" },
        { key: "aiAssistant", name: "AI / HAI Assistant", description: "Enables voice-driven commands and AI recommendations", enabled: false, premium: true, minPlan: "premium" }
      ],
      updatedBy: adminId || "000000000000000000000000" // Fallback system ID if seed is triggered anonymously
    });
    await config.save();
  }
  return config;
};

export const getSubscriptionConfig = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const config = await seedDefaultConfigIfNeeded(req.user?.id);
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateSubscriptionConfig = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { subscriptionsEnabled, features } = req.body;
    const adminId = req.user?.id;

    let config = await AppConfig.findOne();
    if (!config) {
      config = await seedDefaultConfigIfNeeded(adminId);
    }

    const oldSubscriptionsEnabled = config.subscriptionsEnabled;
    const oldFeatures = JSON.parse(JSON.stringify(config.features));

    // Update values
    if (typeof subscriptionsEnabled === "boolean") {
      config.subscriptionsEnabled = subscriptionsEnabled;
    }
    if (Array.isArray(features)) {
      config.features = features;
    }
    config.updatedBy = adminId as any;
    await config.save();

    // Invalidate backend cache
    invalidateAppConfigCache();

    // Fetch the admin user record for audit logging
    const adminUser = await User.findById(adminId);
    const adminName = adminUser ? adminUser.name : "Admin";

    // 1. Audit log for global subscription toggle
    if (oldSubscriptionsEnabled !== config.subscriptionsEnabled) {
      await new AuditLog({
        userId: adminId as any,
        userName: adminName,
        role: req.user?.role,
        action: "UPDATE_CONFIG",
        targetType: "APP_CONFIG",
        targetId: config._id.toString(),
        changes: {
          before: { subscriptionsEnabled: oldSubscriptionsEnabled },
          after: { subscriptionsEnabled: config.subscriptionsEnabled }
        },
        ipAddress: req.ip || req.socket.remoteAddress,
        device: req.get("User-Agent") || "Unknown"
      }).save();
    }

    // 2. Audit logs for each feature changes
    for (const newFeat of config.features) {
      const oldFeat = oldFeatures.find((f: any) => f.key === newFeat.key);
      if (oldFeat) {
        if (oldFeat.enabled !== newFeat.enabled) {
          await new AuditLog({
            userId: adminId as any,
            userName: adminName,
            role: req.user?.role,
            action: "UPDATE_CONFIG",
            targetType: "APP_CONFIG",
            targetId: `${config._id}:${newFeat.key}`,
            changes: {
              before: { enabled: oldFeat.enabled },
              after: { enabled: newFeat.enabled }
            },
            ipAddress: req.ip || req.socket.remoteAddress,
            device: req.get("User-Agent") || "Unknown"
          }).save();
        }
        if (oldFeat.minPlan !== newFeat.minPlan) {
          await new AuditLog({
            userId: adminId as any,
            userName: adminName,
            role: req.user?.role,
            action: "UPDATE_CONFIG",
            targetType: "APP_CONFIG",
            targetId: `${config._id}:${newFeat.key}`,
            changes: {
              before: { minPlan: oldFeat.minPlan },
              after: { minPlan: newFeat.minPlan }
            },
            ipAddress: req.ip || req.socket.remoteAddress,
            device: req.get("User-Agent") || "Unknown"
          }).save();
        }
      }
    }

    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
