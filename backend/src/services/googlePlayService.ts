import { google } from "googleapis";
import {
  Tenant,
  User,
  UserSubscriptionV2,
  SubscriptionTransactionV2,
  SubscriptionPlanV2,
} from "../models";
import { getIO } from "../utils/socket";

const PACKAGE_NAME = "com.haajari.app";
export const VALID_PRODUCT_IDS = ["haajari_pro_monthly", "haajari_pro_annual"];

// Subscription Notification Types from Google Play RTDN
export enum GooglePlayNotificationType {
  SUBSCRIPTION_RECOVERED = 1,
  SUBSCRIPTION_RENEWED = 2,
  SUBSCRIPTION_CANCELED = 3,
  SUBSCRIPTION_PURCHASED = 4,
  SUBSCRIPTION_ON_HOLD = 5,
  SUBSCRIPTION_IN_GRACE_PERIOD = 6,
  SUBSCRIPTION_RESTARTED = 7,
  SUBSCRIPTION_PRICE_CHANGE_CONFIRMED = 8,
  SUBSCRIPTION_DEFERRED = 9,
  SUBSCRIPTION_PAUSED = 10,
  SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED = 11,
  SUBSCRIPTION_REVOKED = 12,
  SUBSCRIPTION_EXPIRED = 13,
}

export class GooglePlayService {
  private static androidPublisher: any = null;

  /**
   * Initialize authenticated Google Play Android Publisher client
   */
  private static getPublisherClient() {
    if (this.androidPublisher) {
      return this.androidPublisher;
    }

    try {
      let authClient: any = null;

      // 1. Check for complete Service Account JSON string in env
      if (process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) {
        let credsJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON.trim();
        // Support base64 encoded JSON
        if (!credsJson.startsWith("{")) {
          try {
            credsJson = Buffer.from(credsJson, "base64").toString("utf-8");
          } catch {
            // Keep original if not base64
          }
        }
        const credentials = JSON.parse(credsJson);
        authClient = new google.auth.GoogleAuth({
          credentials,
          scopes: ["https://www.googleapis.com/auth/androidpublisher"],
        });
      }
      // 2. Check for private key and client email in env
      else if (process.env.GOOGLE_PLAY_CLIENT_EMAIL && process.env.GOOGLE_PLAY_PRIVATE_KEY) {
        authClient = new google.auth.GoogleAuth({
          credentials: {
            client_email: process.env.GOOGLE_PLAY_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PLAY_PRIVATE_KEY.replace(/\\n/g, "\n"),
          },
          scopes: ["https://www.googleapis.com/auth/androidpublisher"],
        });
      }
      // 3. Check for standard Google Application Credentials file path
      else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        authClient = new google.auth.GoogleAuth({
          keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
          scopes: ["https://www.googleapis.com/auth/androidpublisher"],
        });
      }

      if (authClient) {
        this.androidPublisher = google.androidpublisher({
          version: "v3",
          auth: authClient,
        });
        return this.androidPublisher;
      }
    } catch (err: any) {
      console.warn("[GooglePlayService] Auth client initialization warning:", err.message || err);
    }

    return null;
  }

  /**
   * Verify and activate a Google Play in-app subscription purchase
   */
  static async verifySubscriptionPurchase(params: {
    userId: string;
    tenantId: string;
    productId: string;
    purchaseToken: string;
    packageName?: string;
    orderId?: string;
  }) {
    const { userId, tenantId, productId, purchaseToken } = params;
    const packageName = params.packageName || PACKAGE_NAME;

    if (!purchaseToken || typeof purchaseToken !== "string") {
      throw { code: "INVALID_PURCHASE_TOKEN", message: "Purchase token is required." };
    }

    if (!VALID_PRODUCT_IDS.includes(productId)) {
      throw {
        code: "INVALID_PRODUCT_ID",
        message: `Product ID '${productId}' is invalid. Expected one of: ${VALID_PRODUCT_IDS.join(", ")}`,
      };
    }

    // 1. Check if this purchaseToken has already been used by another user/tenant (Anti-Fraud / Anti-Reuse Guard)
    const existingUsage = await UserSubscriptionV2.findOne({
      purchaseToken,
      tenantId: { $ne: tenantId },
    });
    if (existingUsage) {
      throw {
        code: "TOKEN_ALREADY_USED",
        message: "This Google Play purchase token has already been associated with another Haajari account.",
      };
    }

    // 2. Check for idempotent retry: if already active for the current user and tenant
    const existingSameUserSub = await UserSubscriptionV2.findOne({
      tenantId,
      purchaseToken,
      status: "active",
      expiresAt: { $gt: new Date() },
    });
    if (existingSameUserSub) {
      return {
        success: true,
        alreadyProcessed: true,
        message: "Subscription is already active.",
        subscription: existingSameUserSub,
        expiresAt: existingSameUserSub.expiresAt,
      };
    }

    // 3. Fetch authoritative subscription details from Google Play Developer API
    const publisher = this.getPublisherClient();
    let googleSubData: any = null;
    let expiresAt: Date;
    let autoRenew = true;
    let googlePlayState = "SUBSCRIPTION_STATE_ACTIVE";
    let orderId = params.orderId || `GPA.${Date.now()}`;

    if (publisher) {
      try {
        // Query Google Play Developer API v3 subscriptionsv2
        const res = await publisher.purchases.subscriptionsv2.get({
          packageName,
          token: purchaseToken,
        });
        googleSubData = res.data;

        // Parse line items and state
        googlePlayState = googleSubData.subscriptionState || "SUBSCRIPTION_STATE_ACTIVE";

        // Check if subscription is expired or revoked
        if (
          googlePlayState === "SUBSCRIPTION_STATE_EXPIRED" ||
          googlePlayState === "SUBSCRIPTION_STATE_REVOKED"
        ) {
          throw {
            code: "SUBSCRIPTION_EXPIRED_OR_REVOKED",
            message: "Google Play indicates that this subscription is expired or revoked.",
          };
        }

        // Get expiry time
        const lineItem = googleSubData.lineItems && googleSubData.lineItems[0];
        if (lineItem?.expiryTime) {
          expiresAt = new Date(lineItem.expiryTime);
        } else {
          // Default expiry based on product id
          const isYearly = productId === "haajari_pro_annual";
          expiresAt = new Date();
          if (isYearly) {
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          } else {
            expiresAt.setMonth(expiresAt.getMonth() + 1);
          }
        }

        autoRenew = lineItem?.autoRenewingPlan !== undefined ? Boolean(lineItem.autoRenewingPlan) : true;
        if (googleSubData.latestOrderId) {
          orderId = googleSubData.latestOrderId;
        }

        // 4. Acknowledge the subscription if not acknowledged yet
        if (googleSubData.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING") {
          try {
            await publisher.purchases.subscriptions.acknowledge({
              packageName,
              subscriptionId: productId,
              token: purchaseToken,
            });
            console.log(`[GooglePlayService] Successfully acknowledged purchase: ${purchaseToken.slice(0, 15)}...`);
          } catch (ackErr: any) {
            console.warn("[GooglePlayService] Acknowledge note:", ackErr.message || ackErr);
          }
        }
      } catch (gpErr: any) {
        if (gpErr.code === "SUBSCRIPTION_EXPIRED_OR_REVOKED") throw gpErr;
        console.error("[GooglePlayService] Google Play API verification error:", gpErr.message || gpErr);
        throw {
          code: "GOOGLE_VERIFICATION_FAILED",
          message: gpErr.message || "Failed to verify subscription with Google Play.",
        };
      }
    } else {
      // If service account is not yet configured, check if test mode is enabled
      const isTestMode = process.env.GOOGLE_PLAY_TEST_MODE === "true" || process.env.NODE_ENV !== "production";
      if (!isTestMode) {
        throw {
          code: "GOOGLE_PLAY_CONFIG_MISSING",
          message: "Google Play service account credentials (GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) are not configured on the server.",
        };
      }

      console.warn("[GooglePlayService] Running in sandbox/development mode without Google credentials.");
      const isYearly = productId === "haajari_pro_annual";
      expiresAt = new Date();
      if (isYearly) {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }
    }

    // 5. Determine plan details
    const isYearly = productId === "haajari_pro_annual";
    const billingOptionId = isYearly ? "yearly" : "monthly";
    const amount = isYearly ? 1119 : 149;
    const planName = "Haajari Pro";

    // 6. Update Tenant entitlement
    await Tenant.findByIdAndUpdate(tenantId, {
      plan: "pro",
      planExpiresAt: expiresAt,
      status: "Active",
    });

    // 7. Supersede previous active subscriptions for this tenant
    await UserSubscriptionV2.updateMany(
      { tenantId, status: "active" },
      { $set: { status: "superseded" } }
    );

    // 8. Create new active UserSubscriptionV2 record
    const userSub = await UserSubscriptionV2.create({
      userId,
      tenantId,
      planId: "pro",
      billingOptionId,
      status: "active",
      startedAt: new Date(),
      expiresAt,
      autoRenew,
      provider: "google_play",
      providerSubscriptionId: orderId,
      purchaseToken,
      orderId,
      googlePlayState,
      lineItems: [
        {
          productId,
          expiryTime: expiresAt,
          autoRenewing: autoRenew,
        },
      ],
    });

    // 9. Create or update SubscriptionTransactionV2 record
    await SubscriptionTransactionV2.create({
      transactionId: orderId || `gp_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
      userId,
      tenantId,
      planId: "pro",
      planNameSnapshot: planName,
      billingOptionId,
      billingSnapshot: {
        durationMonths: isYearly ? 12 : 1,
        billingLabel: isYearly ? "Yearly" : "Monthly",
        price: amount,
        effectivePrice: amount,
        productId,
        provider: "google_play",
      },
      amount,
      currency: "INR",
      status: "paid",
      paymentProvider: "google_play",
      paymentReference: orderId,
      purchaseToken,
      orderId,
      startedAt: new Date(),
      expiresAt,
      metadata: {
        productId,
        purchaseToken,
        googlePlayState,
        googleSubData,
        verifiedAt: new Date().toISOString(),
      },
    });

    // 10. Real-time socket broadcast for instant app unlock
    try {
      const io = getIO();
      if (io) {
        io.to(`user_${userId}`).emit("subscription:statusUpdated", {
          status: "active",
          planId: "pro",
          billingOptionId,
          expiresAt,
          provider: "google_play",
        });
        io.to(`tenant_${tenantId}`).emit("subscription:statusUpdated", {
          status: "active",
          planId: "pro",
          billingOptionId,
          expiresAt,
          provider: "google_play",
        });
        io.emit("admin_dashboard_update");
      }
    } catch {}

    return {
      success: true,
      message: "Google Play subscription verified and PRO activated successfully!",
      subscription: userSub,
      expiresAt,
    };
  }

  /**
   * Handle Google Cloud Pub/Sub Real-Time Developer Notifications (RTDN)
   */
  static async handlePubSubNotification(message: any) {
    if (!message || !message.data) {
      throw { code: "INVALID_PUBSUB_MESSAGE", message: "Missing Pub/Sub message data." };
    }

    // Decode base64 payload
    let decodedString: string;
    try {
      decodedString = Buffer.from(message.data, "base64").toString("utf-8");
    } catch (err) {
      throw { code: "INVALID_BASE64", message: "Failed to decode Pub/Sub message data." };
    }

    let payload: any;
    try {
      payload = JSON.parse(decodedString);
    } catch (err) {
      throw { code: "INVALID_JSON", message: "Failed to parse notification JSON." };
    }

    console.log("[GooglePlayService] RTDN notification received:", payload);

    // Verify package name
    if (payload.packageName && payload.packageName !== PACKAGE_NAME) {
      console.warn(`[GooglePlayService] Ignored notification for package: ${payload.packageName}`);
      return { ignored: true, reason: "Package mismatch" };
    }

    // Handle Subscription Notification
    const subNotification = payload.subscriptionNotification;
    if (!subNotification) {
      return { received: true, type: "non_subscription" };
    }

    const { notificationType, purchaseToken, subscriptionId } = subNotification;

    if (!purchaseToken) {
      return { received: true, note: "No purchaseToken in notification" };
    }

    // Find the subscription record in database
    const subDoc = await UserSubscriptionV2.findOne({
      $or: [{ purchaseToken }, { providerSubscriptionId: purchaseToken }],
    });

    if (!subDoc) {
      console.warn(`[GooglePlayService] RTDN: No matching subscription found for token ${purchaseToken.slice(0, 15)}...`);
      return { received: true, note: "Subscription record not yet found" };
    }

    // Fetch authoritative status from Google Play Developer API if publisher credentials configured
    const publisher = this.getPublisherClient();
    let expiryTime = subDoc.expiresAt;
    let autoRenewing = subDoc.autoRenew;

    if (publisher) {
      try {
        const res = await publisher.purchases.subscriptionsv2.get({
          packageName: PACKAGE_NAME,
          token: purchaseToken,
        });
        const googleSub = res.data;
        const lineItem = googleSub.lineItems && googleSub.lineItems[0];
        if (lineItem?.expiryTime) {
          expiryTime = new Date(lineItem.expiryTime);
        }
        if (lineItem?.autoRenewingPlan !== undefined) {
          autoRenewing = Boolean(lineItem.autoRenewingPlan);
        }
        subDoc.googlePlayState = googleSub.subscriptionState;
      } catch (err: any) {
        console.error("[GooglePlayService] RTDN verification error:", err.message || err);
      }
    }

    subDoc.expiresAt = expiryTime;
    subDoc.autoRenew = autoRenewing;

    // Process notification types
    switch (notificationType) {
      case GooglePlayNotificationType.SUBSCRIPTION_RENEWED:
      case GooglePlayNotificationType.SUBSCRIPTION_RECOVERED:
      case GooglePlayNotificationType.SUBSCRIPTION_RESTARTED:
        subDoc.status = "active";
        subDoc.cancelAtPeriodEnd = false;
        await Tenant.findByIdAndUpdate(subDoc.tenantId, {
          plan: "pro",
          planExpiresAt: expiryTime,
          status: "Active",
        });
        break;

      case GooglePlayNotificationType.SUBSCRIPTION_CANCELED:
        // Canceled auto-renewal: benefits remain active until period end
        subDoc.autoRenew = false;
        subDoc.cancelAtPeriodEnd = true;
        subDoc.cancelledAt = new Date();
        subDoc.cancellationReason = "Cancelled by user on Google Play Store";
        break;

      case GooglePlayNotificationType.SUBSCRIPTION_IN_GRACE_PERIOD:
        subDoc.status = "in_grace_period";
        break;

      case GooglePlayNotificationType.SUBSCRIPTION_ON_HOLD:
        subDoc.status = "on_hold";
        break;

      case GooglePlayNotificationType.SUBSCRIPTION_EXPIRED:
      case GooglePlayNotificationType.SUBSCRIPTION_REVOKED:
        subDoc.status = "expired";
        await Tenant.findByIdAndUpdate(subDoc.tenantId, {
          plan: "basic",
          planExpiresAt: expiryTime,
        });
        break;
    }

    await subDoc.save();

    // Broadcast real-time status update to user & tenant
    try {
      const io = getIO();
      if (io) {
        io.to(`user_${subDoc.userId}`).emit("subscription:statusUpdated", {
          status: subDoc.status,
          expiresAt: subDoc.expiresAt,
          autoRenew: subDoc.autoRenew,
          cancelAtPeriodEnd: subDoc.cancelAtPeriodEnd,
        });
        io.to(`tenant_${subDoc.tenantId}`).emit("subscription:statusUpdated", {
          status: subDoc.status,
          expiresAt: subDoc.expiresAt,
          autoRenew: subDoc.autoRenew,
          cancelAtPeriodEnd: subDoc.cancelAtPeriodEnd,
        });
      }
    } catch {}

    return { success: true, processedType: notificationType };
  }

  /**
   * Restore Purchases from Google Play
   */
  static async restorePurchases(params: {
    userId: string;
    tenantId: string;
    purchases: Array<{
      productId: string;
      purchaseToken: string;
      orderId?: string;
    }>;
  }) {
    const { userId, tenantId, purchases } = params;

    if (!purchases || !Array.isArray(purchases) || purchases.length === 0) {
      return {
        success: false,
        message: "No Google Play purchases were provided to restore.",
      };
    }

    const restored: any[] = [];
    const errors: any[] = [];

    for (const p of purchases) {
      try {
        const result = await this.verifySubscriptionPurchase({
          userId,
          tenantId,
          productId: p.productId,
          purchaseToken: p.purchaseToken,
          orderId: p.orderId,
        });
        restored.push(result);
      } catch (err: any) {
        errors.push({ productId: p.productId, error: err.message || err });
      }
    }

    return {
      success: restored.length > 0,
      restoredCount: restored.length,
      errorsCount: errors.length,
      restored,
      errors,
    };
  }
}
