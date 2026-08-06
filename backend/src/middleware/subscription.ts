import { Response, NextFunction } from "express";
import { Tenant, Worker, Project, User, Site } from "../models";
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

export const checkPlanLimit = (
  resourceType: "workers" | "projects" | "supervisors" | "gps"
) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: "Unauthorized: No tenant ID found" });
      }

      const { plan } = await getTenantPlan(tenantId);

      if (resourceType === "workers") {
        const count = await Worker.countDocuments({ tenantId, isArchived: false });
        if (plan === "free" || plan === "basic") {
          if (count >= 20) {
            return res.status(403).json({
              success: false,
              limitExceeded: true,
              limit: 20,
              plan,
              message: "Worker limit reached. Upgrade to Super or Premium plan to add more workers."
            });
          }
        } else if (plan === "professional" || plan === "super") {
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
        if (plan === "free" || plan === "basic") {
          if (count >= 2) {
            return res.status(403).json({
              success: false,
              error: "Site limit reached. Upgrade to Super or Premium plan to add more sites.",
              limitExceeded: true,
              limit: 2,
              plan,
            });
          }
        } else if (plan === "professional" || plan === "super") {
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
        const count = await User.countDocuments({ tenantId, role: "supervisor" });
        if (plan === "free" || plan === "basic") {
          return res.status(403).json({
            error: "Supervisor accounts are not available on the Basic Plan. Upgrade to Super or Premium Plan to unlock this feature.",
            limitExceeded: true,
            limit: 0,
            plan,
          });
        } else if (plan === "professional" || plan === "super") {
          if (count >= 10) {
            return res.status(403).json({
              error: "Supervisor limit reached (max 10). Upgrade to Premium plan to unlock unlimited supervisors.",
              limitExceeded: true,
              limit: 10,
              plan,
            });
          }
        }
      } else if (resourceType === "gps") {
        if (plan === "free" || plan === "basic") {
          return res.status(403).json({
            error: "GPS attendance is not available on the Basic Plan. Upgrade to Super Plan to unlock this feature.",
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
