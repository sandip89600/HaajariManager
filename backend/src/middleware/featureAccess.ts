import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth";
import { AppConfig } from "../models";
import { getTenantPlan } from "./subscription";

let cachedConfig: any = null;
let lastCacheTime = 0;
const CACHE_TTL = 30000; // Cache configuration in-memory for 30s for performance

export const getAppConfigCached = async () => {
  const now = Date.now();
  if (cachedConfig && (now - lastCacheTime < CACHE_TTL)) {
    return cachedConfig;
  }
  
  const config = await AppConfig.findOne();
  if (config) {
    cachedConfig = config.toObject();
    lastCacheTime = now;
  }
  return cachedConfig;
};

export const invalidateAppConfigCache = () => {
  cachedConfig = null;
  lastCacheTime = 0;
};

export const checkFeatureAccess = (featureKey: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user?.tenantId;

      // 1. Fetch app config
      const appConfig = await getAppConfigCached();
      if (!appConfig) {
        // If config is not created yet, default allow
        return next();
      }

      // 2. Look up the feature flag
      const feature = appConfig.features.find((f: any) => f.key === featureKey);
      if (!feature) {
        // Feature key not declared in schema, default allow
        return next();
      }

      // 3. Check global toggle status
      if (!feature.enabled) {
        return res.status(403).json({
          success: false,
          code: "FEATURE_DISABLED",
          message: `This feature (${feature.name}) is currently disabled by Admin.`
        });
      }

      // 4. Check subscription status rules if active
      if (appConfig.subscriptionsEnabled) {
        if (feature.premium) {
          if (!tenantId) {
            return res.status(401).json({ error: "Unauthorized: Tenant ID missing" });
          }

          const { plan } = await getTenantPlan(tenantId.toString());
          
          const planHierarchy = ["free", "basic", "super", "premium"];
          const userPlanIdx = planHierarchy.indexOf(plan || "free");
          const minPlanIdx = planHierarchy.indexOf(feature.minPlan || "premium");

          if (userPlanIdx < minPlanIdx) {
            return res.status(403).json({
              success: false,
              code: "SUBSCRIPTION_REQUIRED",
              message: `This feature requires an active ${feature.minPlan} subscription.`
            });
          }
        }
      }

      next();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
};
