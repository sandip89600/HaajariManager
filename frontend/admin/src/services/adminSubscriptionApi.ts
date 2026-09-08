import { api } from "../utils/api";

export interface AdminSubscriptionConfig {
  globalEnabled: boolean;
  mode: "free" | "subscription";
  updatedAt?: string;
}

export interface AdminBillingOption {
  optionId: string;
  durationMonths: number;
  billingLabel: string;
  price: number;
  currency: string;
  active: boolean;
  promotionEnabled: boolean;
  promotionalPrice?: number;
  promotionalDurationMonths?: number;
}

export interface AdminPlanFeatures {
  maxWorkers: number;
  maxProjects: number;
  maxSupervisors: number;
  gpsAttendance: boolean;
  reports: boolean;
  advancedReports: boolean;
}

export interface AdminSubscriptionPlan {
  _id?: string;
  planId: string;
  name: string;
  description: string;
  active: boolean;
  displayOrder: number;
  features: AdminPlanFeatures;
  billingOptions: AdminBillingOption[];
}

export interface AdminTransaction {
  _id: string;
  transactionId: string;
  userId?: { name?: string; phone?: string; email?: string };
  tenantId?: { name?: string };
  planId: string;
  planNameSnapshot: string;
  billingOptionId: string;
  amount: number;
  currency: string;
  status: string;
  paymentProvider: string;
  createdAt: string;
}

export interface AdminAnalytics {
  globalEnabled: boolean;
  mode: string;
  totalUsers: number;
  activeSubscribers: number;
  freeUsers: number;
  totalTransactions: number;
  successfulPayments: number;
  totalRevenue: number;
}

export class AdminSubscriptionApi {
  static async getConfig(): Promise<AdminSubscriptionConfig> {
    const res = await api.get("/v2/admin/subscription/config");
    return res.data;
  }

  static async updateConfig(globalEnabled: boolean): Promise<AdminSubscriptionConfig> {
    const res = await api.put("/v2/admin/subscription/config", { globalEnabled });
    return res.data;
  }

  static async getPlans(): Promise<AdminSubscriptionPlan[]> {
    const res = await api.get("/v2/admin/subscription/plans");
    return res.data;
  }

  static async createPlan(planData: Partial<AdminSubscriptionPlan>): Promise<AdminSubscriptionPlan> {
    const res = await api.post("/v2/admin/subscription/plans", planData);
    return res.data;
  }

  static async updatePlan(planId: string, planData: Partial<AdminSubscriptionPlan>): Promise<AdminSubscriptionPlan> {
    const res = await api.put(`/v2/admin/subscription/plans/${planId}`, planData);
    return res.data;
  }

  static async deletePlan(planId: string) {
    const res = await api.delete(`/v2/admin/subscription/plans/${planId}`);
    return res.data;
  }

  static async togglePlanStatus(planId: string, active: boolean): Promise<AdminSubscriptionPlan> {
    const res = await api.put(`/v2/admin/subscription/plans/${planId}/status`, { active });
    return res.data;
  }

  static async toggleBillingOptionStatus(
    planId: string,
    optionId: string,
    data: { active?: boolean; promotionEnabled?: boolean; price?: number; promotionalPrice?: number }
  ): Promise<AdminSubscriptionPlan> {
    const res = await api.put(
      `/v2/admin/subscription/plans/${planId}/billing-options/${optionId}/status`,
      data
    );
    return res.data;
  }

  static async getTransactions(): Promise<AdminTransaction[]> {
    const res = await api.get("/v2/admin/subscription/transactions");
    return res.data;
  }

  static async getAnalytics(): Promise<AdminAnalytics> {
    const res = await api.get("/v2/admin/subscription/analytics");
    return res.data;
  }
}
