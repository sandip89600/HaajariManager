import { Request, Response } from "express";
import { SubscriptionServiceV2 } from "../services/subscriptionServiceV2";
import {
  SubscriptionPlanV2,
  SubscriptionTransactionV2,
  UserSubscriptionV2,
  User,
} from "../models";
import { getIO } from "../utils/socket";

export const getAdminConfig = async (req: Request, res: Response) => {
  try {
    const config = await SubscriptionServiceV2.getGlobalConfig();
    return res.json(config);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch admin config." });
  }
};

export const updateAdminConfig = async (req: Request, res: Response) => {
  try {
    const { globalEnabled } = req.body;
    const adminId = (req as any).user?.id || (req as any).user?._id;

    if (typeof globalEnabled !== "boolean") {
      return res.status(400).json({ error: "globalEnabled boolean parameter required." });
    }

    const updated = await SubscriptionServiceV2.updateGlobalConfig(globalEnabled, adminId);
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update admin config." });
  }
};

export const getAdminPlans = async (req: Request, res: Response) => {
  try {
    await SubscriptionServiceV2.seedDefaultPlans();
    const plans = await SubscriptionPlanV2.find().sort({ displayOrder: 1 }).lean();
    return res.json(plans);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch plans." });
  }
};

export const createAdminPlan = async (req: Request, res: Response) => {
  try {
    const { planId, name, description, active, displayOrder, features, billingOptions } = req.body;

    if (!planId || !name) {
      return res.status(400).json({ error: "planId and name are required." });
    }

    const existing = await SubscriptionPlanV2.findOne({ planId });
    if (existing) {
      return res.status(409).json({ error: "Plan with this ID already exists." });
    }

    const newPlan = await SubscriptionPlanV2.create({
      planId,
      name,
      description: description || "",
      active: active ?? true,
      displayOrder: displayOrder || 0,
      features: features || {
        maxWorkers: 15,
        maxProjects: 1,
        maxSupervisors: 1,
        gpsAttendance: true,
        reports: true,
        advancedReports: false,
      },
      billingOptions: billingOptions || [],
    });

    // Socket notification
    try {
      const io = getIO();
      if (io) io.emit("subscription:configUpdated", { timestamp: new Date() });
    } catch {}

    return res.status(201).json(newPlan);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to create plan." });
  }
};

export const updateAdminPlan = async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const updateData = req.body;

    const plan = await SubscriptionPlanV2.findOneAndUpdate({ planId }, updateData, { new: true });
    if (!plan) {
      return res.status(444).json({ error: "Plan not found." });
    }

    // Socket notification
    try {
      const io = getIO();
      if (io) io.emit("subscription:configUpdated", { timestamp: new Date() });
    } catch {}

    return res.json(plan);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to update plan." });
  }
};

export const deleteAdminPlan = async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    await SubscriptionPlanV2.deleteOne({ planId });

    // Socket notification
    try {
      const io = getIO();
      if (io) io.emit("subscription:configUpdated", { timestamp: new Date() });
    } catch {}

    return res.json({ message: "Plan deleted successfully." });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to delete plan." });
  }
};

export const togglePlanStatus = async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const { active } = req.body;

    const plan = await SubscriptionPlanV2.findOne({ planId });
    if (!plan) {
      return res.status(404).json({ error: "Plan not found." });
    }

    plan.active = typeof active === "boolean" ? active : !plan.active;
    await plan.save();

    // Socket notification
    try {
      const io = getIO();
      if (io) io.emit("subscription:configUpdated", { timestamp: new Date() });
    } catch {}

    return res.json(plan);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to toggle plan status." });
  }
};

export const toggleBillingOptionStatus = async (req: Request, res: Response) => {
  try {
    const { planId, optionId } = req.params;
    const { active, promotionEnabled, price, promotionalPrice } = req.body;

    const plan = await SubscriptionPlanV2.findOne({ planId });
    if (!plan) {
      return res.status(404).json({ error: "Plan not found." });
    }

    const optIndex = plan.billingOptions.findIndex((o) => o.optionId === optionId);
    if (optIndex === -1) {
      return res.status(404).json({ error: "Billing option not found." });
    }

    if (typeof active === "boolean") plan.billingOptions[optIndex].active = active;
    if (typeof promotionEnabled === "boolean") plan.billingOptions[optIndex].promotionEnabled = promotionEnabled;
    if (typeof price === "number") plan.billingOptions[optIndex].price = price;
    if (typeof promotionalPrice === "number") plan.billingOptions[optIndex].promotionalPrice = promotionalPrice;

    await plan.save();

    // Socket notification
    try {
      const io = getIO();
      if (io) io.emit("subscription:configUpdated", { timestamp: new Date() });
    } catch {}

    return res.json(plan);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to toggle billing option." });
  }
};

export const getAdminTransactions = async (req: Request, res: Response) => {
  try {
    const transactions = await SubscriptionTransactionV2.find()
      .sort({ createdAt: -1 })
      .populate("userId", "name phone email")
      .populate("tenantId", "name")
      .lean();
    return res.json(transactions);
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch transactions." });
  }
};

export const getAdminAnalytics = async (req: Request, res: Response) => {
  try {
    const config = await SubscriptionServiceV2.getGlobalConfig();
    const totalTransactions = await SubscriptionTransactionV2.countDocuments();
    const paidTransactions = await SubscriptionTransactionV2.find({ status: "paid" });
    const totalRevenue = paidTransactions.reduce((acc, t) => acc + (t.amount || 0), 0);
    const activeSubscribers = await UserSubscriptionV2.countDocuments({
      status: "active",
      expiresAt: { $gt: new Date() },
    });
    const totalUsers = await User.countDocuments();

    return res.json({
      globalEnabled: config.globalEnabled,
      mode: config.mode,
      totalUsers,
      activeSubscribers,
      freeUsers: Math.max(0, totalUsers - activeSubscribers),
      totalTransactions,
      successfulPayments: paidTransactions.length,
      totalRevenue,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch analytics." });
  }
};
