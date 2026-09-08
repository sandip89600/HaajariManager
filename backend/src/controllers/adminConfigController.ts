import { Response } from "express";
import mongoose from "mongoose";
import { AuthenticatedRequest } from "../middleware/auth";
import { AppConfig, AuditLog, User } from "../models";
import { invalidateAppConfigCache } from "../middleware/featureAccess";

export const DEFAULT_MODULE_VISIBILITY = [
  { key: "dashboard", name: "Dashboard", description: "Main application summary & metrics dashboard", enabled: true },
  { key: "attendance", name: "Attendance Grid", description: "Attendance grid and monthly log management", enabled: true },
  { key: "workers", name: "Workers", description: "Worker management, roster, and salary settings", enabled: true },
  { key: "siteControl", name: "Site Control", description: "Construction sites and daily progress tracking", enabled: true },
  { key: "reports", name: "Reports & PDF", description: "Export PDF summaries, salary logs, and CSV reports", enabled: true },
  { key: "payments", name: "Payments & Advances", description: "Worker advances, payments, and salary handover", enabled: true },
  { key: "materials", name: "Materials", description: "Site materials inventory and vendor logs", enabled: true },
  { key: "expenses", name: "Expenses", description: "Site expenses and petty cash tracking", enabled: true },
  { key: "photos", name: "Daily Work Photos", description: "Morning & evening progress photos", enabled: true },
  { key: "gps", name: "GPS Attendance", description: "Geofenced location verification for attendance", enabled: true },
  { key: "aiAssistant", name: "AI / HAI Assistant", description: "Voice commands and HAI intelligent assistant", enabled: true },
  { key: "notifications", name: "Notifications", description: "System alerts and notifications feed", enabled: true },
  { key: "settings", name: "Settings & Profile", description: "App settings, language, and user profile", enabled: true }
];

// Helper to seed default config if not present
export const seedDefaultConfigIfNeeded = async (adminId?: any) => {
  const validAdminId = (adminId && mongoose.Types.ObjectId.isValid(adminId))
    ? adminId
    : "000000000000000000000000";

  let config = await AppConfig.findOne();
  if (!config) {
    config = new AppConfig({
      subscriptionsEnabled: false,
      supervisorManagementRestrictedToPaid: false,
      features: [
        { key: "paymentHandover", name: "Payment Handover", description: "Enables contractor payment handover configuration and settings", enabled: true, premium: true, minPlan: "premium" },
        { key: "paymentProof", name: "Payment Proof", description: "Allows uploading and auditing payment proofs", enabled: true, premium: false, minPlan: "free" },
        { key: "advancedReports", name: "Advanced Reports", description: "Allows exporting advanced PDF and CSV sheets", enabled: true, premium: false, minPlan: "free" },
        { key: "aiAssistant", name: "AI / HAI Assistant", description: "Enables voice-driven commands and AI recommendations", enabled: true, premium: false, minPlan: "free" }
      ],
      moduleVisibility: DEFAULT_MODULE_VISIBILITY,
      updatedBy: validAdminId as any
    });
    await config.save();
  } else {
    let modified = false;
    const feat = config.features.find((f: any) => f.key === "advancedReports");
    if (feat) {
      if (!feat.enabled || feat.premium || feat.minPlan !== "free") {
        feat.enabled = true;
        feat.premium = false;
        feat.minPlan = "free";
        modified = true;
      }
    } else {
      config.features.push({
        key: "advancedReports",
        name: "Advanced Reports",
        description: "Allows exporting advanced PDF and CSV sheets",
        enabled: true,
        premium: false,
        minPlan: "free"
      });
      modified = true;
    }

    if (config.supervisorManagementRestrictedToPaid !== false) {
      config.supervisorManagementRestrictedToPaid = false;
      modified = true;
    }

    // Ensure default moduleVisibility exists
    if (!config.moduleVisibility || config.moduleVisibility.length === 0) {
      config.moduleVisibility = DEFAULT_MODULE_VISIBILITY;
      modified = true;
    } else {
      // Merge missing module keys
      for (const defMod of DEFAULT_MODULE_VISIBILITY) {
        if (!config.moduleVisibility.some((m: any) => m.key === defMod.key)) {
          config.moduleVisibility.push(defMod);
          modified = true;
        }
      }
    }

    if (modified) {
      config.markModified("features");
      config.markModified("moduleVisibility");
      await config.save();
      invalidateAppConfigCache();
    }
  }
  return config;
};

export const getSubscriptionConfig = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawAdminId = req.user?.id || (req.user as any)?._id;
    const config = await seedDefaultConfigIfNeeded(rawAdminId);
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateSubscriptionConfig = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { subscriptionsEnabled, supervisorManagementRestrictedToPaid, features, moduleVisibility } = req.body;
    const rawAdminId = req.user?.id || (req.user as any)?._id;
    const validAdminId = (rawAdminId && mongoose.Types.ObjectId.isValid(rawAdminId))
      ? rawAdminId
      : "000000000000000000000000";

    let config = await AppConfig.findOne();
    if (!config) {
      config = await seedDefaultConfigIfNeeded(validAdminId);
    }

    const oldSubscriptionsEnabled = config.subscriptionsEnabled;

    // Update values
    if (typeof subscriptionsEnabled === "boolean") {
      config.subscriptionsEnabled = subscriptionsEnabled;
    }
    if (typeof supervisorManagementRestrictedToPaid === "boolean") {
      config.supervisorManagementRestrictedToPaid = supervisorManagementRestrictedToPaid;
    }
    if (Array.isArray(features)) {
      config.features = features;
      config.markModified("features");
    }
    if (Array.isArray(moduleVisibility)) {
      config.moduleVisibility = moduleVisibility;
      config.markModified("moduleVisibility");
    }

    config.updatedBy = validAdminId as any;
    await config.save();

    // Invalidate backend cache
    invalidateAppConfigCache();

    // Fetch the admin user record for audit logging
    const adminUser = validAdminId !== "000000000000000000000000" ? await User.findById(validAdminId) : null;
    const adminName = adminUser ? adminUser.name : "Admin";

    // 1. Audit log for global subscription toggle
    if (oldSubscriptionsEnabled !== config.subscriptionsEnabled) {
      await new AuditLog({
        userId: validAdminId as any,
        userName: adminName,
        role: req.user?.role || "admin",
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

    res.json(config);
  } catch (err: any) {
    console.error("[updateSubscriptionConfig Error]:", err);
    res.status(500).json({ error: err.message });
  }
};
