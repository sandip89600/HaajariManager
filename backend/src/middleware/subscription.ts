import { Response, NextFunction } from "express";
import { Worker, Project, Site, Tenant } from "../models";
import { AuthenticatedRequest } from "./auth";
import { SubscriptionServiceV2 } from "../services/subscriptionServiceV2";

export const getTenantPlan = async (tenantId: string) => {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    return { plan: "basic" as const };
  }
  return {
    plan: tenant.plan || "basic",
    planExpiresAt: tenant.planExpiresAt,
  };
};

export const getPlanRank = (plan?: string): number => {
  const p = (plan || "free").toLowerCase();
  if (p === "premium" || p === "business") return 3;
  if (p === "super" || p === "professional") return 2;
  if (p === "basic") return 1;
  return 0;
};

export const checkPlanLimit = (
  resourceType: "workers" | "projects" | "supervisors" | "gps"
) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: "Unauthorized: No tenant ID found" });
      }

      // Check Global Subscription V2 Master Switch
      const globalConfig = await SubscriptionServiceV2.getGlobalConfig();
      if (!globalConfig.globalEnabled) {
        // Global Mode = FREE: Bypass ALL subscription gates & plan limits
        return next();
      }

      if (resourceType === "workers") {
        const count = await Worker.countDocuments({ tenantId, isArchived: false });
        const check = await SubscriptionServiceV2.checkPlanEnforcement(tenantId, "workers", count);
        if (!check.allowed) {
          return res.status(403).json({
            success: false,
            limitExceeded: true,
            limit: check.limit,
            current: count,
            message: `Worker limit reached (${check.limit}). Please upgrade your subscription plan to add more workers.`,
          });
        }
      } else if (resourceType === "projects") {
        const projectCount = await Project.countDocuments({ tenantId });
        const siteCount = await Site.countDocuments({ tenantId, isDeleted: false });
        const count = Math.max(projectCount, siteCount);
        const check = await SubscriptionServiceV2.checkPlanEnforcement(tenantId, "projects", count);
        if (!check.allowed) {
          return res.status(403).json({
            success: false,
            limitExceeded: true,
            limit: check.limit,
            current: count,
            message: `Site/Project limit reached (${check.limit}). Please upgrade your subscription plan to create more sites.`,
          });
        }
      } else if (resourceType === "supervisors") {
        const check = await SubscriptionServiceV2.checkPlanEnforcement(tenantId, "supervisors", 0);
        if (!check.allowed) {
          return res.status(403).json({
            success: false,
            limitExceeded: true,
            message: "Supervisor management requires an active subscription plan.",
          });
        }
      }

      next();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
};
