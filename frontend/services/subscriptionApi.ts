import { API_URL, authenticatedFetch } from "@/utils/storage";

export interface BillingOption {
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

export interface PlanFeatures {
  maxWorkers: number;
  maxProjects: number;
  maxSupervisors: number;
  gpsAttendance: boolean;
  reports: boolean;
  advancedReports: boolean;
}

export interface SubscriptionPlan {
  planId: string;
  name: string;
  description: string;
  active: boolean;
  displayOrder: number;
  features: PlanFeatures;
  billingOptions: BillingOption[];
}

export interface UserSubscriptionDetails {
  subscriptionId: string;
  status: "active" | "expired" | "cancelled" | "pending";
  planId: string;
  billingOptionId: string;
  startedAt: string;
  expiresAt: string;
  provider: string;
}

export interface SubscriptionStatusResponse {
  subscriptionEnabled: boolean;
  mode: "free" | "subscription";
  userSubscription: UserSubscriptionDetails | null;
  availablePlans: SubscriptionPlan[];
}

export interface SubscriptionTransactionItem {
  _id: string;
  transactionId: string;
  planId: string;
  planNameSnapshot: string;
  billingOptionId: string;
  billingSnapshot: any;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "failed" | "refunded" | "cancelled";
  paymentProvider: string;
  createdAt: string;
}

export class SubscriptionApi {
  /**
   * Fetch global subscription mode status (unauthenticated or authenticated)
   */
  static async getConfig(): Promise<{ subscriptionEnabled: boolean; mode: "free" | "subscription" }> {
    try {
      const res = await fetch(`${API_URL}/v2/subscription/config`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn("[SubscriptionApi] Config fetch failed, defaulting to free mode:", err);
    }
    return { subscriptionEnabled: false, mode: "free" };
  }

  /**
   * Fetch available active subscription plans
   */
  static async getPlans(): Promise<SubscriptionPlan[]> {
    try {
      const res = await fetch(`${API_URL}/v2/subscription/plans`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn("[SubscriptionApi] Plans fetch failed:", err);
    }
    return [];
  }

  /**
   * Fetch unified user subscription status
   */
  static async getStatus(): Promise<SubscriptionStatusResponse> {
    try {
      const res = await authenticatedFetch(`${API_URL}/v2/subscription/status`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn("[SubscriptionApi] Status fetch failed, defaulting to free mode:", err);
    }
    return {
      subscriptionEnabled: false,
      mode: "free",
      userSubscription: null,
      availablePlans: [],
    };
  }

  /**
   * Create Checkout Order for plan & billing option
   */
  static async createCheckout(planId: string, billingOptionId: string) {
    const res = await authenticatedFetch(`${API_URL}/v2/subscription/checkout`, {
      method: "POST",
      body: JSON.stringify({ planId, billingOptionId }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || "Failed to create checkout order.");
    }
    return await res.json();
  }

  /**
   * Activate Subscription after payment
   */
  static async activateSubscription(transactionId: string, paymentReference?: string) {
    const res = await authenticatedFetch(`${API_URL}/v2/subscription/activate`, {
      method: "POST",
      body: JSON.stringify({ transactionId, paymentReference }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || "Failed to activate subscription.");
    }
    return await res.json();
  }

  /**
   * Fetch user subscription transaction history
   */
  static async getUserTransactions(): Promise<SubscriptionTransactionItem[]> {
    try {
      const res = await authenticatedFetch(`${API_URL}/v2/subscription/transactions`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn("[SubscriptionApi] Transactions fetch failed:", err);
    }
    return [];
  }
}
