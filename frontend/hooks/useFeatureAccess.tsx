import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { storage, API_URL } from "@/utils/storage";
import { SubscriptionApi, SubscriptionStatusResponse } from "@/services/subscriptionApi";

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  premium: boolean;
  minPlan: "free" | "basic" | "super" | "premium";
}

export interface ModuleVisibilityFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface AppConfig {
  subscriptionsEnabled: boolean;
  supervisorManagementRestrictedToPaid?: boolean;
  features: FeatureFlag[];
  moduleVisibility?: ModuleVisibilityFlag[];
}

interface FeatureAccessContextType {
  config: AppConfig | null;
  subscriptionStatus: SubscriptionStatusResponse | null;
  isSubscriptionEnabled: boolean;
  isLoading: boolean;
  refetch: () => Promise<void>;
  hasFeature: (featureKey: string) => boolean;
  isModuleVisible: (moduleKey: string) => boolean;
  isSupervisorManagementAllowed: (userPlan?: string) => boolean;
  getFeatureStatus: (featureKey: string) => {
    enabled: boolean;
    accessible: boolean;
    premium: boolean;
    minPlan: "free" | "basic" | "super" | "premium";
    showUpgradeUI: boolean;
  };
}

const FeatureAccessContext = createContext<FeatureAccessContextType | null>(null);

export const FeatureAccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoggedIn, user } = useAuth();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      // 1. Fetch App Config
      const auth = await storage.getAuth();
      if (auth && auth.token) {
        const res = await fetch(`${API_URL}/app/config`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setConfig(data);
        }
      }

      // 2. Fetch Subscription v2 Status
      const subStatus = await SubscriptionApi.getStatus();
      setSubscriptionStatus(subStatus);
    } catch (err) {
      console.warn("[FeatureAccess] Failed to fetch app configuration:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchConfig();
    } else {
      setConfig(null);
      setSubscriptionStatus(null);
      setIsLoading(false);
    }
  }, [isLoggedIn]);

  const isSubscriptionEnabled = subscriptionStatus?.subscriptionEnabled ?? false;

  const hasFeature = (featureKey: string): boolean => {
    if (!config) return true;
    const feature = config.features?.find((f) => f.key === featureKey);
    if (!feature) return true;
    return feature.enabled;
  };

  const isModuleVisible = (moduleKey: string): boolean => {
    if (!config || !config.moduleVisibility) return true;
    const mod = config.moduleVisibility.find((m) => m.key === moduleKey);
    if (!mod) return true;
    return mod.enabled;
  };

  const isSupervisorManagementAllowed = (_userPlan: string = "free"): boolean => {
    return true; // Always allowed on all plans when global mode is free
  };

  const getFeatureStatus = (featureKey: string) => {
    const defaultStatus = {
      enabled: true,
      accessible: true,
      premium: false,
      minPlan: "free" as const,
      showUpgradeUI: false,
    };

    // If global subscription is OFF, all features are 100% accessible with no upgrade UI
    if (!isSubscriptionEnabled) {
      return defaultStatus;
    }

    if (!config) return defaultStatus;

    const feature = config.features?.find((f) => f.key === featureKey);
    if (!feature) return defaultStatus;

    const enabled = feature.enabled;
    if (!enabled) {
      return {
        enabled: false,
        accessible: false,
        premium: feature.premium,
        minPlan: feature.minPlan,
        showUpgradeUI: false,
      };
    }

    let accessible = true;
    let showUpgradeUI = false;

    if (isSubscriptionEnabled && feature.premium) {
      const activeSub = subscriptionStatus?.userSubscription;
      if (!activeSub || activeSub.status !== "active") {
        accessible = false;
        showUpgradeUI = true;
      }
    }

    return {
      enabled,
      accessible,
      premium: feature.premium,
      minPlan: feature.minPlan,
      showUpgradeUI,
    };
  };

  return (
    <FeatureAccessContext.Provider
      value={{
        config,
        subscriptionStatus,
        isSubscriptionEnabled,
        isLoading,
        refetch: fetchConfig,
        hasFeature,
        isModuleVisible,
        isSupervisorManagementAllowed,
        getFeatureStatus,
      }}
    >
      {children}
    </FeatureAccessContext.Provider>
  );
};

export const useFeatureAccess = () => {
  const context = useContext(FeatureAccessContext);
  if (!context) {
    throw new Error("useFeatureAccess must be used within a FeatureAccessProvider");
  }
  return context;
};
