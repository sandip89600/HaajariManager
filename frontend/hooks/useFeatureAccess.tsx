import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { storage, API_URL } from "@/utils/storage";

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  premium: boolean;
  minPlan: "free" | "basic" | "super" | "premium";
}

export interface AppConfig {
  subscriptionsEnabled: boolean;
  features: FeatureFlag[];
}

interface FeatureAccessContextType {
  config: AppConfig | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  hasFeature: (featureKey: string) => boolean;
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
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      const auth = await storage.getAuth();
      if (!auth || !auth.token) {
        setIsLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/app/config`, {
        headers: {
          Authorization: `Bearer ${auth.token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
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
      setIsLoading(false);
    }
  }, [isLoggedIn]);

  const hasFeature = (featureKey: string): boolean => {
    if (!config) return true; // Default to true while loading
    const feature = config.features.find(f => f.key === featureKey);
    if (!feature) return true;
    return feature.enabled;
  };

  const getFeatureStatus = (featureKey: string) => {
    const defaultStatus = {
      enabled: true,
      accessible: true,
      premium: false,
      minPlan: "free" as const,
      showUpgradeUI: false
    };

    if (!config) return defaultStatus;

    const feature = config.features.find(f => f.key === featureKey);
    if (!feature) return defaultStatus;

    const enabled = feature.enabled;
    if (!enabled) {
      return {
        enabled: false,
        accessible: false,
        premium: feature.premium,
        minPlan: feature.minPlan,
        showUpgradeUI: false
      };
    }

    let accessible = true;
    let showUpgradeUI = false;

    if (config.subscriptionsEnabled && feature.premium) {
      const planHierarchy = ["free", "basic", "super", "premium"];
      
      // Standardize user's plan name
      const rawUserPlan = user?.plan || "free";
      let userPlan = rawUserPlan;
      if (rawUserPlan === "professional") {
        userPlan = "super"; // treat professional as super
      } else if (rawUserPlan === "starter") {
        userPlan = "basic"; // treat starter as basic
      } else if (rawUserPlan === "business") {
        userPlan = "premium"; // treat business as premium
      }

      const userPlanIdx = planHierarchy.indexOf(userPlan);
      const minPlanIdx = planHierarchy.indexOf(feature.minPlan || "premium");

      if (userPlanIdx < minPlanIdx) {
        accessible = false;
        showUpgradeUI = true;
      }
    }

    return {
      enabled,
      accessible,
      premium: feature.premium,
      minPlan: feature.minPlan,
      showUpgradeUI
    };
  };

  return (
    <FeatureAccessContext.Provider
      value={{
        config,
        isLoading,
        refetch: fetchConfig,
        hasFeature,
        getFeatureStatus
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
