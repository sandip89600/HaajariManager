import { API_URL, authenticatedFetch } from "@/utils/storage";

export interface VerifyGooglePlayPurchasePayload {
  productId: string;
  purchaseToken: string;
  packageName?: string;
  orderId?: string;
}

export interface GooglePlaySubscriptionStatusResponse {
  success: boolean;
  hasActiveSubscription: boolean;
  subscription: {
    subscriptionId: string;
    planId: string;
    billingOptionId: string;
    status: string;
    startedAt: string;
    expiresAt: string;
    autoRenew: boolean;
    cancelAtPeriodEnd: boolean;
    cancelledAt?: string;
    provider: string;
    orderId?: string;
    productId: string;
  } | null;
}

export interface RestorePurchasesPayload {
  purchases: Array<{
    productId: string;
    purchaseToken: string;
    orderId?: string;
  }>;
}

export class GooglePlayApi {
  /**
   * Verify Google Play purchase token on backend and activate Haajari PRO
   */
  static async verifyPurchase(payload: VerifyGooglePlayPurchasePayload) {
    const res = await authenticatedFetch(`${API_URL}/v2/google-play/verify-purchase`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(
        errorData.message || "Failed to verify Google Play purchase with backend."
      );
    }

    return await res.json();
  }

  /**
   * Fetch Google Play subscription status for authenticated tenant
   */
  static async getSubscriptionStatus(): Promise<GooglePlaySubscriptionStatusResponse> {
    try {
      const res = await authenticatedFetch(
        `${API_URL}/v2/google-play/subscription-status`
      );
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn("[GooglePlayApi] Status fetch error:", err);
    }

    return {
      success: false,
      hasActiveSubscription: false,
      subscription: null,
    };
  }

  /**
   * Restore previous purchases using purchase tokens query from Google Play
   */
  static async restorePurchases(payload: RestorePurchasesPayload) {
    const res = await authenticatedFetch(
      `${API_URL}/v2/google-play/restore-purchases`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(
        errorData.message || "Failed to restore purchases from server."
      );
    }

    return await res.json();
  }
}
