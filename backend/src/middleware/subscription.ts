import { Response, NextFunction } from "express";
import { Tenant, Worker, Project, User } from "../models";
import { AuthenticatedRequest } from "./auth";

export const getTenantPlan = async (tenantId: string) => {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    return { plan: "free" as const };
  }
  return {
    plan: tenant.plan || "free",
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
        if (plan === "free") {
          if (count >= 15) {
            return res.status(403).json({
              success: false,
              message: "Worker limit reached. Upgrade your plan to add more workers."
            });
          }
        } else if (plan === "professional") {
          if (count >= 100) {
            return res.status(403).json({
              success: false,
              message: "Worker limit reached. Upgrade your plan to add more workers."
            });
          }
        }
      } else if (resourceType === "projects") {
        if (plan === "free") {
          const count = await Project.countDocuments({ tenantId });
          if (count >= 1) {
            return res.status(403).json({
              error: "Project limit reached. Upgrade to Professional Plan to unlock this feature.",
              limitExceeded: true,
              limit: 1,
              plan,
            });
          }
        }
      } else if (resourceType === "supervisors") {
        const count = await User.countDocuments({ tenantId, role: "supervisor" });
        if (plan === "free") {
          return res.status(403).json({
            error: "Supervisor accounts are not available on the Free Plan. Upgrade to Professional Plan to unlock this feature.",
            limitExceeded: true,
            limit: 0,
            plan,
          });
        } else if (plan === "professional") {
          if (count >= 2) {
            return res.status(403).json({
              error: "Supervisor limit reached (max 2). Upgrade to Business Plan to unlock unlimited supervisors.",
              limitExceeded: true,
              limit: 2,
              plan,
            });
          }
        }
      } else if (resourceType === "gps") {
        if (plan === "free") {
          return res.status(403).json({
            error: "GPS attendance is not available on the Free Plan. Upgrade to Professional Plan to unlock this feature.",
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
