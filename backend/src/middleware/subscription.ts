import { Response, NextFunction } from "express";
import { Tenant, Worker, Project, User, Site, AppConfig } from "../models";
import { AuthenticatedRequest } from "./auth";

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
  return 0; // free or unknown
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

      // Check Master Global Subscription Switch
      const appConfig = await AppConfig.findOne();
      const subEnabled = appConfig?.subscriptionsEnabled ?? false;
      if (!subEnabled) {
        // Global Enforcement = OFF: Bypass ALL subscription limits & gates
        return next();
      }

      const { plan } = await getTenantPlan(tenantId);
      const userRank = getPlanRank(plan);

      if (resourceType === "workers") {
        const count = await Worker.countDocuments({ tenantId, isArchived: false });
        if (userRank < 2) { // Free or Basic
          if (count >= 20) {
            return res.status(403).json({
              success: false,
              limitExceeded: true,
              limit: 20,
              plan,
              message: "Worker limit reached. Upgrade to Super or Premium plan to add more workers."
            });
          }
        } else if (userRank === 2) { // Super or Professional
          if (count >= 100) {
            return res.status(403).json({
              success: false,
              limitExceeded: true,
              limit: 100,
              plan,
              message: "Worker limit reached. Upgrade to Premium plan to add more workers."
            });
          }
        }
      } else if (resourceType === "projects") {
        const projectCount = await Project.countDocuments({ tenantId });
        const siteCount = await Site.countDocuments({ tenantId, isDeleted: false });
        const count = Math.max(projectCount, siteCount);
        if (userRank < 2) { // Free or Basic
          if (count >= 2) {
            return res.status(403).json({
              success: false,
              error: "Site limit reached. Upgrade to Super or Premium plan to add more sites.",
              limitExceeded: true,
              limit: 2,
              plan,
            });
          }
        } else if (userRank === 2) { // Super or Professional
          if (count >= 10) {
            return res.status(403).json({
              success: false,
              error: "Site limit reached (max 10). Upgrade to Premium plan to unlock unlimited sites.",
              limitExceeded: true,
              limit: 10,
              plan,
            });
          }
        }
      } else if (resourceType === "supervisors") {
        const restricted = appConfig?.supervisorManagementRestrictedToPaid ?? false;
        if (restricted) {
          if (userRank < 1) { // Free plan restricted when supervisor toggle is ON
            return res.status(403).json({
              error: "Supervisor accounts are currently restricted to paid subscription plans. Upgrade your plan to invite supervisors.",
              limitExceeded: true,
              plan,
            });
          }
        }
        return next();
      } else if (resourceType === "gps") {
        if (userRank < 2) { // Requires Super/Professional or higher
          return res.status(403).json({
            error: "GPS attendance is not available on your current plan. Upgrade to Super Plan to unlock this feature.",
            limitExceeded: true,
            plan,
          });
        }
      }

      next();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
};
