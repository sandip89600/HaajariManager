import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  Alert,
  Dimensions,
  FlatList,
  Linking,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import {
  SubscriptionApi,
  SubscriptionPlan,
  BillingOption,
  SubscriptionStatusResponse,
  SubscriptionTransactionItem,
  CheckoutResponse,
} from "@/services/subscriptionApi";
import { Colors, Spacing } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function SubscriptionScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"plans" | "history">("plans");
  const [loading, setLoading] = useState(true);
  const [subStatus, setSubStatus] = useState<SubscriptionStatusResponse | null>(null);
  const [transactions, setTransactions] = useState<SubscriptionTransactionItem[]>([]);

  // Selected Plan & Billing Option State
  const [selectedPlanId, setSelectedPlanId] = useState<string>("pro");
  const [selectedOptionId, setSelectedOptionId] = useState<string>("yearly"); // Default to yearly (best value)

  // Razorpay WebView State
  const [isProcessing, setIsProcessing] = useState(false);
  const [webViewModalVisible, setWebViewModalVisible] = useState(false);
  const [webViewHtml, setWebViewHtml] = useState<string>("");
  const [paymentUrl, setPaymentUrl] = useState<string>("");
  const [activeCheckout, setActiveCheckout] = useState<CheckoutResponse | null>(null);

  // Cancel Subscription State
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const statusData = await SubscriptionApi.getStatus();
      setSubStatus(statusData);

      if (statusData.availablePlans && statusData.availablePlans.length > 0) {
        const proPlan =
          statusData.availablePlans.find((p) => p.planId === "pro") ||
          statusData.availablePlans[0];
        setSelectedPlanId(proPlan.planId);

        // Pre-select yearly if available, else first option
        const hasYearly = proPlan.billingOptions.some((o) => o.optionId === "yearly");
        setSelectedOptionId(hasYearly ? "yearly" : proPlan.billingOptions[0]?.optionId || "monthly");
      }

      const txns = await SubscriptionApi.getUserTransactions();
      setTransactions(txns);
    } catch (err) {
      console.warn("[SubscriptionScreen] Data load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
    Haptics.impactAsync(style);
  };

  // Find currently selected plan or fallback to default canonical Pro plan values
  const currentPlan: SubscriptionPlan = subStatus?.availablePlans?.find(
    (p) => p.planId === selectedPlanId
  ) || {
    planId: "pro",
    name: "Haajari Pro",
    description: "Complete all-in-one construction management & worker attendance suite.",
    active: true,
    displayOrder: 1,
    features: {
      maxWorkers: -1,
      maxProjects: -1,
      maxSupervisors: -1,
      gpsAttendance: true,
      reports: true,
      advancedReports: true,
    },
    billingOptions: [
      {
        optionId: "monthly",
        durationMonths: 1,
        billingLabel: "Monthly",
        price: 149,
        currency: "INR",
        active: true,
        promotionEnabled: false,
      },
      {
        optionId: "yearly",
        durationMonths: 12,
        billingLabel: "Yearly",
        price: 1119,
        currency: "INR",
        active: true,
        promotionEnabled: true,
        promotionalPrice: 1119,
        promotionalDurationMonths: 12,
      },
    ],
  };

  const currentOption =
    currentPlan.billingOptions.find((o) => o.optionId === selectedOptionId) ||
    currentPlan.billingOptions[0];

  const handleSelectOption = (optionId: string) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setSelectedOptionId(optionId);
  };

  /**
   * Build Razorpay Checkout standard HTML for WebView
   */
  const buildRazorpayHtml = (checkout: CheckoutResponse) => {
    const rawName = user?.name || "Contractor";
    const rawEmail = user?.email || "";
    const rawPhone = user?.phone || "";

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>Razorpay Checkout</title>
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #F8FAFC;
            color: #1E293B;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 24px;
          }
          .card {
            background: #FFFFFF;
            border-radius: 20px;
            padding: 32px 24px;
            text-align: center;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.06), 0 8px 10px -6px rgba(0,0,0,0.06);
            width: 100%;
            max-width: 360px;
          }
          .spinner {
            width: 44px;
            height: 44px;
            border: 4px solid #F1F5F9;
            border-top-color: #F97316;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 20px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          h3 { font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #0F172A; }
          p { font-size: 14px; color: #64748B; line-height: 1.5; }
          .price-pill {
            display: inline-block;
            margin-top: 14px;
            background: #FFF7ED;
            color: #EA580C;
            font-weight: 700;
            font-size: 18px;
            padding: 8px 18px;
            border-radius: 9999px;
            border: 1px solid #FFEDD5;
          }
          .btn-open {
            margin-top: 24px;
            background: #F97316;
            color: #FFFFFF;
            font-weight: 600;
            border: none;
            padding: 14px 20px;
            border-radius: 12px;
            font-size: 15px;
            cursor: pointer;
            width: 100%;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="spinner"></div>
          <h3>Connecting to Razorpay</h3>
          <p>Opening secure payment for <strong>${checkout.planName}</strong> (${checkout.billingLabel})...</p>
          <div class="price-pill">₹${checkout.amountRupees || checkout.amount}</div>
          <button id="manual-btn" class="btn-open" style="display:none;" onclick="launchRazorpay()">Tap to Open Payment</button>
        </div>

        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <script>
          function postToApp(data) {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify(data));
            }
          }

          function launchRazorpay() {
            try {
              if (!window.Razorpay) {
                document.getElementById('manual-btn').style.display = 'block';
                return;
              }

              var options = {
                key: "${checkout.keyId}",
                amount: ${checkout.amountInPaise || (checkout.amount * 100)},
                currency: "${checkout.currency || "INR"}",
                name: "Haajari Manager",
                description: "${checkout.planName} (${checkout.billingLabel})",
                order_id: "${checkout.orderId}",
                image: "https://haajari.app/logo.png",
                prefill: {
                  name: "${rawName}",
                  email: "${rawEmail}",
                  contact: "${rawPhone}"
                },
                theme: {
                  color: "#F97316"
                },
                handler: function (response) {
                  postToApp({
                    event: "PAYMENT_SUCCESS",
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature
                  });
                },
                modal: {
                  ondismiss: function () {
                    postToApp({ event: "PAYMENT_DISMISSED" });
                  }
                }
              };

              var rzp = new Razorpay(options);
              rzp.on('payment.failed', function (resp) {
                postToApp({
                  event: "PAYMENT_FAILED",
                  error: resp.error ? resp.error.description : 'Payment transaction failed'
                });
              });
              rzp.open();
            } catch (err) {
              document.getElementById('manual-btn').style.display = 'block';
            }
          }

          function checkAndLaunch(retries) {
            if (window.Razorpay) {
              launchRazorpay();
            } else if (retries > 0) {
              setTimeout(function() { checkAndLaunch(retries - 1); }, 200);
            } else {
              document.getElementById('manual-btn').style.display = 'block';
            }
          }

          window.onload = function() {
            checkAndLaunch(30);
          };
        </script>
      </body>
      </html>
    `;
  };

  /**
   * Handle Subscription Cancellation Confirmation
   */
  const handleConfirmCancellation = async () => {
    setIsCancelling(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      await SubscriptionApi.cancelSubscription("User requested cancellation from mobile app");
      setCancelModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const formattedExpiry = activeSub?.expiresAt
        ? new Date(activeSub.expiresAt).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "the end of your billing cycle";

      Alert.alert(
        "Subscription Cancelled",
        `Your automatic renewal has been cancelled.\n\nYour PRO benefits remain 100% active until ${formattedExpiry}.\n\nA confirmation email has been sent to your registered email address.`,
        [{ text: "OK", onPress: () => loadData() }]
      );
      loadData();
    } catch (err: any) {
      console.warn("[SubscriptionScreen] Cancellation error:", err);
      Alert.alert(
        "Notice",
        err.message || "Failed to cancel subscription. Please check your connection and try again."
      );
    } finally {
      setIsCancelling(false);
    }
  };

  /**
   * Handle initiation of Razorpay Checkout
   */
  const handleCheckout = async () => {
    if (!currentPlan || !currentOption) return;
    setIsProcessing(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const checkoutData = await SubscriptionApi.createCheckout(
        currentPlan.planId,
        currentOption.optionId
      );

      // If Razorpay API keys are not configured yet, inform the user cleanly
      if (!checkoutData.keyId) {
        Alert.alert(
          "Razorpay API Keys Needed",
          "The Razorpay order creation and signature verification routes are completely set up!\n\nPlease add your RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the backend/.env file to start processing real payments.",
          [{ text: "Understood", style: "default" }]
        );
        return;
      }

      setActiveCheckout(checkoutData);

      if (checkoutData.paymentUrl) {
        setPaymentUrl(checkoutData.paymentUrl);
      } else {
        setPaymentUrl("");
      }
      const html = buildRazorpayHtml(checkoutData);
      setWebViewHtml(html);
      setWebViewModalVisible(true);
    } catch (err: any) {
      if (err.message && err.message.includes("RAZORPAY_CONFIG_REQUIRED")) {
        Alert.alert(
          "Razorpay API Keys Needed",
          "Please configure your RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the backend/.env file to accept payments.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Checkout Notice",
          err.message || "Unable to initiate payment."
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Parse redirect URL from Razorpay Payment Link and verify payment
   */
  const handleRedirectUrl = async (url: string) => {
    try {
      const queryString = url.split("?")[1] || "";
      const params: Record<string, string> = {};
      queryString.split("&").forEach((pair) => {
        const [k, v] = pair.split("=");
        if (k && v) {
          params[decodeURIComponent(k)] = decodeURIComponent(v);
        }
      });

      const paymentId = params["razorpay_payment_id"];
      const signature = params["razorpay_signature"];
      const linkId = params["razorpay_payment_link_id"];
      const linkStatus = params["razorpay_payment_link_status"];
      const orderId = params["razorpay_order_id"] || activeCheckout?.orderId;

      if (paymentId) {
        setWebViewModalVisible(false);
        setIsProcessing(true);

        await SubscriptionApi.verifyPayment({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature || "link_redirect_verified",
          razorpay_payment_link_id: linkId,
          razorpay_payment_link_status: linkStatus,
          planId: currentPlan.planId,
          billingOptionId: currentOption.optionId,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Payment Successful! 🎉",
          "Your Haajari Pro subscription has been activated successfully! All pro features are now completely unlocked.",
          [
            {
              text: "Continue",
              onPress: () => loadData(),
            },
          ]
        );
        loadData();
      }
    } catch (err: any) {
      console.warn("[SubscriptionScreen] Redirect verification error:", err);
      Alert.alert("Verification Notice", err.message || "Failed to confirm payment.");
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handle Razorpay events emitted from WebView
   */
  const handleWebViewMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.event === "PAYMENT_SUCCESS") {
        setWebViewModalVisible(false);
        setIsProcessing(true);

        // Call backend signature verification endpoint
        await SubscriptionApi.verifyPayment({
          razorpay_order_id: data.razorpay_order_id,
          razorpay_payment_id: data.razorpay_payment_id,
          razorpay_signature: data.razorpay_signature,
          planId: currentPlan.planId,
          billingOptionId: currentOption.optionId,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Payment Successful! 🎉",
          "Your Haajari Pro subscription has been activated successfully! All pro features are now completely unlocked.",
          [
            {
              text: "Continue",
              onPress: () => loadData(),
            },
          ]
        );
        loadData();
      } else if (data.event === "PAYMENT_DISMISSED") {
        setWebViewModalVisible(false);
      } else if (data.event === "PAYMENT_FAILED") {
        setWebViewModalVisible(false);
        Alert.alert("Payment Incomplete", data.error || "The payment transaction was not completed.");
      } else if (data.event === "ERROR") {
        setWebViewModalVisible(false);
        Alert.alert("Checkout Error", data.message || "An error occurred with Razorpay checkout.");
      }
    } catch (err: any) {
      console.warn("[SubscriptionScreen] Verification error:", err);
      Alert.alert("Verification Error", err.message || "Failed to verify payment with server.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  const activeSub = subStatus?.userSubscription;
  const isProActive = Boolean(
    activeSub &&
    activeSub.status === "active" &&
    (!activeSub.expiresAt || new Date(activeSub.expiresAt) > new Date())
  );
  const isYearly = Boolean(
    activeSub?.billingOptionId &&
    (activeSub.billingOptionId.includes("year") || activeSub.billingOptionId.includes("12"))
  );
  const daysRemaining = activeSub?.expiresAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(activeSub.expiresAt).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null;

  return (
    <ThemedView style={styles.container}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <ThemedText type="h2" style={styles.headerTitle}>
            {isProActive ? "PRO Identity" : "Haajari Pro"}
          </ThemedText>
          <View style={[styles.proBadge, isProActive && { backgroundColor: "#10B981" }]}>
            <ThemedText style={styles.proBadgeText}>
              {isProActive ? "ACTIVE" : "PRO"}
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabSelectorRow}>
        <Pressable
          onPress={() => {
            triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab("plans");
          }}
          style={[
            styles.tabBtn,
            activeTab === "plans" && {
              backgroundColor: theme.primary,
              borderColor: theme.primary,
            },
          ]}
        >
          <ThemedText
            type="body"
            style={[
              styles.tabBtnText,
              { color: activeTab === "plans" ? "#FFFFFF" : theme.text },
            ]}
          >
            {isProActive ? "👑 PRO Membership" : "Plans & Pricing"}
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => {
            triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab("history");
          }}
          style={[
            styles.tabBtn,
            activeTab === "history" && {
              backgroundColor: theme.primary,
              borderColor: theme.primary,
            },
          ]}
        >
          <ThemedText
            type="body"
            style={[
              styles.tabBtnText,
              { color: activeTab === "history" ? "#FFFFFF" : theme.text },
            ]}
          >
            Billing History ({transactions.length})
          </ThemedText>
        </Pressable>
      </View>

      {activeTab === "plans" ? (
        isProActive && activeSub ? (
          /* ══════════════════════════════════════════════════════════════════
             OPTION 4: MAIN PRO IDENTITY SCREEN (WHEN UPGRADED)
             ══════════════════════════════════════════════════════════════════ */
          <ScrollView
            contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 110 }}
            showsVerticalScrollIndicator={false}
          >
            {/* VIP PRO Digital Membership Card */}
            <LinearGradient
              colors={["#0F172A", "#1E293B", "#0F172A"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.proIdentityCard}
            >
              <View style={styles.proCardHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <View style={styles.crownCircle}>
                    <ThemedText style={{ fontSize: 24 }}>👑</ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.proIdentityTitle}>
                      HAAJARI PRO MEMBER
                    </ThemedText>
                    <ThemedText numberOfLines={1} style={styles.proMemberName}>
                      {user?.companyName || user?.name || "Verified Contractor"}
                    </ThemedText>
                  </View>
                </View>

                <View
                  style={[
                    styles.verifiedActiveBadge,
                    activeSub.cancelAtPeriodEnd && {
                      backgroundColor: "rgba(245, 158, 11, 0.2)",
                      borderColor: "#F59E0B",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.pulsingDot,
                      activeSub.cancelAtPeriodEnd && { backgroundColor: "#F59E0B" },
                    ]}
                  />
                  <ThemedText
                    style={[
                      styles.verifiedActiveText,
                      activeSub.cancelAtPeriodEnd && { color: "#FBBF24" },
                    ]}
                  >
                    {activeSub.cancelAtPeriodEnd ? "CANCELLING" : "ACTIVE"}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.proCardDivider} />

              {/* Plan Details & Validity Grid */}
              <View style={styles.proMetaGrid}>
                <View style={styles.proMetaCol}>
                  <ThemedText style={styles.proMetaLabel}>ACTIVE PLAN</ThemedText>
                  <ThemedText style={styles.proMetaValue}>
                    {isYearly ? "Annual Plan (₹1,119 / yr)" : "Monthly Plan (₹149 / mo)"}
                  </ThemedText>
                </View>

                <View style={[styles.proMetaCol, { alignItems: "flex-end" }]}>
                  <ThemedText style={styles.proMetaLabel}>VALID UNTIL</ThemedText>
                  <ThemedText style={styles.proMetaValue}>
                    {activeSub.expiresAt
                      ? new Date(activeSub.expiresAt).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Lifetime"}
                  </ThemedText>
                </View>
              </View>

              {daysRemaining !== null && (
                <View style={styles.daysRemainingRow}>
                  <Feather name="clock" size={13} color="#F59E0B" style={{ marginRight: 6 }} />
                  <ThemedText style={styles.daysRemainingText}>
                    {daysRemaining > 0
                      ? `${daysRemaining} days remaining in current billing period`
                      : "Renews today"}
                  </ThemedText>
                </View>
              )}

              {/* Subscription ID & Guarantee */}
              <View style={styles.proCardFooter}>
                <ThemedText style={styles.subscriptionIdText}>
                  ID: SUB-{String(activeSub.subscriptionId || "PRO").slice(-8).toUpperCase()}
                </ThemedText>
                <ThemedText style={styles.verifiedGuaranteeText}>
                  Secured by Razorpay • Instant Sync
                </ThemedText>
              </View>
            </LinearGradient>

            {/* Unlocked Pro Features Header */}
            <ThemedText type="small" style={styles.sectionHeader}>
              ALL PRO FEATURES UNLOCKED
            </ThemedText>

            {/* Feature Entitlements List */}
            <View style={[styles.unlockedFeaturesContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <View style={[styles.unlockedItem, { borderBottomColor: theme.border }]}>
                <View style={styles.unlockedIconWrap}>
                  <Feather name="check" size={15} color="#16A34A" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText style={[styles.unlockedTitle, { color: theme.text }]}>
                    Unlimited Workers & Daily Attendance
                  </ThemedText>
                  <ThemedText style={styles.unlockedSub}>
                    No 20 worker cap • Add unlimited workers freely
                  </ThemedText>
                </View>
                <View style={styles.activePill}>
                  <ThemedText style={styles.activePillText}>UNLOCKED</ThemedText>
                </View>
              </View>

              <View style={[styles.unlockedItem, { borderBottomColor: theme.border }]}>
                <View style={styles.unlockedIconWrap}>
                  <Feather name="check" size={15} color="#16A34A" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText style={[styles.unlockedTitle, { color: theme.text }]}>
                    Unlimited Sites & Projects
                  </ThemedText>
                  <ThemedText style={styles.unlockedSub}>
                    Manage all current and future job sites
                  </ThemedText>
                </View>
                <View style={styles.activePill}>
                  <ThemedText style={styles.activePillText}>UNLOCKED</ThemedText>
                </View>
              </View>

              <View style={[styles.unlockedItem, { borderBottomColor: theme.border }]}>
                <View style={styles.unlockedIconWrap}>
                  <Feather name="check" size={15} color="#16A34A" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText style={[styles.unlockedTitle, { color: theme.text }]}>
                    Unlimited Supervisors & Staff
                  </ThemedText>
                  <ThemedText style={styles.unlockedSub}>
                    Assign team supervisors with access control
                  </ThemedText>
                </View>
                <View style={styles.activePill}>
                  <ThemedText style={styles.activePillText}>UNLOCKED</ThemedText>
                </View>
              </View>

              <View style={[styles.unlockedItem, { borderBottomColor: theme.border }]}>
                <View style={styles.unlockedIconWrap}>
                  <Feather name="check" size={15} color="#16A34A" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText style={[styles.unlockedTitle, { color: theme.text }]}>
                    GPS Geo-fencing & Real-Time Punch-In
                  </ThemedText>
                  <ThemedText style={styles.unlockedSub}>
                    Accurate on-site location verification
                  </ThemedText>
                </View>
                <View style={styles.activePill}>
                  <ThemedText style={styles.activePillText}>UNLOCKED</ThemedText>
                </View>
              </View>

              <View style={[styles.unlockedItem, { borderBottomColor: theme.border }]}>
                <View style={styles.unlockedIconWrap}>
                  <Feather name="check" size={15} color="#16A34A" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText style={[styles.unlockedTitle, { color: theme.text }]}>
                    1-Click Wage & Attendance PDF / Excel
                  </ThemedText>
                  <ThemedText style={styles.unlockedSub}>
                    Instant payroll calculations & detailed export
                  </ThemedText>
                </View>
                <View style={styles.activePill}>
                  <ThemedText style={styles.activePillText}>UNLOCKED</ThemedText>
                </View>
              </View>

              <View style={[styles.unlockedItem, { borderBottomColor: theme.border }]}>
                <View style={styles.unlockedIconWrap}>
                  <Feather name="check" size={15} color="#16A34A" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText style={[styles.unlockedTitle, { color: theme.text }]}>
                    Cloud Sync & Automated Daily Backups
                  </ThemedText>
                  <ThemedText style={styles.unlockedSub}>
                    Zero data loss guaranteed with automatic cloud saves
                  </ThemedText>
                </View>
                <View style={styles.activePill}>
                  <ThemedText style={styles.activePillText}>UNLOCKED</ThemedText>
                </View>
              </View>

              <View style={[styles.unlockedItem, { borderBottomWidth: 0 }]}>
                <View style={styles.unlockedIconWrap}>
                  <Feather name="check" size={15} color="#16A34A" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText style={[styles.unlockedTitle, { color: theme.text }]}>
                    Priority VIP Support
                  </ThemedText>
                  <ThemedText style={styles.unlockedSub}>
                    Direct priority help via WhatsApp
                  </ThemedText>
                </View>
                <View style={styles.activePill}>
                  <ThemedText style={styles.activePillText}>UNLOCKED</ThemedText>
                </View>
              </View>
            </View>

            {/* Quick Action: View Invoices & History */}
            <Pressable
              onPress={() => {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab("history");
              }}
              style={[
                styles.viewInvoicesBtn,
                { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Feather name="file-text" size={18} color={theme.primary} />
                <ThemedText style={[styles.viewInvoicesBtnText, { color: theme.text }]}>
                  View Invoices & Transaction History ({transactions.length})
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={18} color={theme.textSecondary} />
            </Pressable>

            {/* VIP Support Contact Button */}
            <Pressable
              onPress={() => {
                Linking.openURL(
                  "https://wa.me/917058222107?text=Hello%20Haajari%20Support,%20I%20am%20a%20PRO%20Member"
                ).catch(() => {});
              }}
              style={styles.supportContactBtn}
            >
              <Feather name="message-circle" size={18} color="#15803D" />
              <ThemedText style={styles.supportContactBtnText}>
                Connect with VIP WhatsApp Support
              </ThemedText>
            </Pressable>

            {/* Secondary Action: Cancel Subscription */}
            {activeSub.cancelAtPeriodEnd ? (
              <View style={[styles.cancelledNoticeCard, { backgroundColor: theme.backgroundDefault, borderColor: "#F59E0B" }]}>
                <Feather name="info" size={16} color="#D97706" style={{ marginRight: 8, marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.cancelledNoticeTitle}>
                    Automatic Renewal Cancelled
                  </ThemedText>
                  <ThemedText style={styles.cancelledNoticeDesc}>
                    Your PRO benefits remain 100% active until{" "}
                    {new Date(activeSub.expiresAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    . No future charges will be billed to your account.
                  </ThemedText>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                  setCancelModalVisible(true);
                }}
                style={styles.cancelSubBtn}
              >
                <Feather name="slash" size={13} color="#94A3B8" style={{ marginRight: 6 }} />
                <ThemedText style={styles.cancelSubBtnText}>
                  Cancel Subscription
                </ThemedText>
              </Pressable>
            )}
          </ScrollView>
        ) : (
          /* ══════════════════════════════════════════════════════════════════
             STANDARD CHECKOUT & PLANS VIEW (WHEN NOT UPGRADED)
             ══════════════════════════════════════════════════════════════════ */
          <ScrollView
            contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 110 }}
            showsVerticalScrollIndicator={false}
          >
          {/* Active Subscription Banner */}
          {isProActive && subStatus?.userSubscription && (
            <View style={styles.activeSubBanner}>
              <View style={styles.activeSubIcon}>
                <Feather name="check" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <ThemedText style={styles.activeSubTitle}>
                  Haajari Pro is Active
                </ThemedText>
                <ThemedText style={styles.activeSubExpiry}>
                  Valid until{" "}
                  {new Date(subStatus.userSubscription.expiresAt).toLocaleDateString(
                    undefined,
                    { year: "numeric", month: "short", day: "numeric" }
                  )}
                </ThemedText>
              </View>
            </View>
          )}

          {/* Promotional Free Mode Banner if subscription is globally disabled */}
          {!subStatus?.subscriptionEnabled && (
            <View style={styles.freeModeNotice}>
              <Feather name="gift" size={20} color="#EA580C" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <ThemedText style={styles.freeModeNoticeTitle}>
                  Promotional Free Mode Active
                </ThemedText>
                <ThemedText style={styles.freeModeNoticeSub}>
                  All site limits and worker features are currently free. You can preview our Pro plans below.
                </ThemedText>
              </View>
            </View>
          )}

          {/* Pricing Plan Selector Title */}
          <ThemedText type="small" style={styles.sectionHeader}>
            CHOOSE YOUR BILLING PLAN
          </ThemedText>

          {/* Billing Options Stack */}
          <View style={styles.billingGrid}>
            {/* 1. Monthly Plan (₹149 / mo) */}
            <Pressable
              onPress={() => handleSelectOption("monthly")}
              style={[
                styles.billingCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor:
                    selectedOptionId === "monthly" ? theme.primary : theme.border,
                  borderWidth: selectedOptionId === "monthly" ? 2 : 1,
                },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleWrap}>
                  <ThemedText type="h3" style={styles.planCardTitle}>
                    Monthly Plan
                  </ThemedText>
                  <ThemedText style={styles.planCardSubtext}>
                    Flexible billing, cancel anytime
                  </ThemedText>
                </View>

                {/* Radio selection indicator */}
                <View
                  style={[
                    styles.radioCircle,
                    {
                      borderColor:
                        selectedOptionId === "monthly" ? theme.primary : theme.border,
                    },
                  ]}
                >
                  {selectedOptionId === "monthly" && (
                    <View
                      style={[styles.radioDot, { backgroundColor: theme.primary }]}
                    />
                  )}
                </View>
              </View>

              <View style={styles.priceContainer}>
                <ThemedText style={[styles.mainPrice, { color: theme.text }]}>
                  ₹149
                </ThemedText>
                <ThemedText style={styles.perMonthLabel}>/ month</ThemedText>
              </View>
            </Pressable>

            {/* 2. Yearly Plan (₹1,119 / yr - Best Value) */}
            <Pressable
              onPress={() => handleSelectOption("yearly")}
              style={[
                styles.billingCard,
                styles.yearlyCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor:
                    selectedOptionId === "yearly" ? theme.primary : theme.border,
                  borderWidth: selectedOptionId === "yearly" ? 2 : 1,
                },
              ]}
            >
              {/* Best Value Badge */}
              <View style={styles.bestValueBadge}>
                <Feather name="zap" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                <ThemedText style={styles.bestValueText}>
                  BEST VALUE • SAVE 37%
                </ThemedText>
              </View>

              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleWrap}>
                  <ThemedText type="h3" style={styles.planCardTitle}>
                    Annual Plan
                  </ThemedText>
                  <ThemedText style={styles.planCardSubtext}>
                    12 months of full Pro access
                  </ThemedText>
                </View>

                {/* Radio selection indicator */}
                <View
                  style={[
                    styles.radioCircle,
                    {
                      borderColor:
                        selectedOptionId === "yearly" ? theme.primary : theme.border,
                    },
                  ]}
                >
                  {selectedOptionId === "yearly" && (
                    <View
                      style={[styles.radioDot, { backgroundColor: theme.primary }]}
                    />
                  )}
                </View>
              </View>

              <View style={styles.priceContainer}>
                <ThemedText style={[styles.mainPrice, { color: theme.primary }]}>
                  ₹1,119
                </ThemedText>
                <ThemedText style={styles.perYearLabel}>/ year</ThemedText>
                <ThemedText style={styles.strikethroughPrice}>₹1,788</ThemedText>
              </View>

              <View style={styles.savingsPill}>
                <Feather name="check-circle" size={13} color="#15803D" />
                <ThemedText style={styles.savingsPillText}>
                  Just ₹93.25/mo • Save ₹669/year
                </ThemedText>
              </View>
            </Pressable>
          </View>

          {/* Included Features Section */}
          <View
            style={[
              styles.featuresContainer,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
              },
            ]}
          >
            <ThemedText type="small" style={styles.sectionHeader}>
              ALL PRO FEATURES INCLUDED
            </ThemedText>

            <View style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <Feather name="users" size={16} color={theme.primary} />
              </View>
              <ThemedText style={styles.featureLabel}>
                Unlimited Workers & Attendance Records
              </ThemedText>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <Feather name="map-pin" size={16} color={theme.primary} />
              </View>
              <ThemedText style={styles.featureLabel}>
                Unlimited Construction Sites & Projects
              </ThemedText>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <Feather name="user-check" size={16} color={theme.primary} />
              </View>
              <ThemedText style={styles.featureLabel}>
                Unlimited Supervisor & Staff Accounts
              </ThemedText>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <Feather name="navigation" size={16} color={theme.primary} />
              </View>
              <ThemedText style={styles.featureLabel}>
                GPS Geo-fencing & Real-Time Punch-In
              </ThemedText>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <Feather name="file-text" size={16} color={theme.primary} />
              </View>
              <ThemedText style={styles.featureLabel}>
                1-Click Wage, Overtime & Attendance PDF / Excel
              </ThemedText>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <Feather name="cloud" size={16} color={theme.primary} />
              </View>
              <ThemedText style={styles.featureLabel}>
                Cloud Sync & Automated Daily Backups
              </ThemedText>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <Feather name="shield" size={16} color={theme.primary} />
              </View>
              <ThemedText style={styles.featureLabel}>
                Priority Technical Support via WhatsApp
              </ThemedText>
            </View>
          </View>

          {/* Secure Payment Guarantee */}
          <View style={styles.secureGuaranteeRow}>
            <Feather name="lock" size={14} color={theme.textSecondary} />
            <ThemedText style={styles.secureGuaranteeText}>
              Secured by Razorpay • UPI, Cards, NetBanking supported
            </ThemedText>
          </View>

          {/* Primary Action Button */}
          <Pressable
            onPress={handleCheckout}
            disabled={isProcessing}
            style={({ pressed }) => [
              styles.subscribeBtn,
              {
                backgroundColor: theme.primary,
                opacity: isProcessing ? 0.7 : pressed ? 0.9 : 1,
              },
            ]}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="lock" size={18} color="#FFFFFF" />
                <ThemedText style={styles.subscribeBtnText}>
                  Pay Now • ₹{selectedOptionId === "yearly" ? "1,119" : "149"}
                </ThemedText>
              </View>
            )}
          </Pressable>

          {/* Subtext under button */}
          <ThemedText
            style={{
              textAlign: "center",
              fontSize: 12,
              color: theme.textSecondary,
              marginTop: 10,
              fontWeight: "500",
            }}
          >
            Instant activation via Razorpay UPI, Cards & NetBanking
          </ThemedText>
        </ScrollView>
        )
      ) : (
        /* History Tab */
        <FlatList
          data={transactions}
          keyExtractor={(item) => item._id || item.transactionId}
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 110 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="file-text" size={48} color={theme.textSecondary} />
              <ThemedText
                type="body"
                style={{ color: theme.textSecondary, marginTop: Spacing.md }}
              >
                No subscription transactions found yet.
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.txnCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.txnHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="body" style={styles.txnTitle}>
                    {item.planNameSnapshot || "Haajari Pro"}
                  </ThemedText>
                  <ThemedText type="small" style={styles.txnId}>
                    Txn: {item.transactionId}
                  </ThemedText>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        item.status === "paid"
                          ? "#DCFCE7"
                          : item.status === "failed"
                          ? "#FEE2E2"
                          : "#F1F5F9",
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color:
                        item.status === "paid"
                          ? "#15803D"
                          : item.status === "failed"
                          ? "#B91C1C"
                          : "#475569",
                      fontWeight: "700",
                      fontSize: 11,
                      textTransform: "uppercase",
                    }}
                  >
                    {item.status}
                  </ThemedText>
                </View>
              </View>

              <View
                style={[styles.divider, { backgroundColor: theme.border }]}
              />

              <View style={styles.txnFooter}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {new Date(item.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </ThemedText>
                <ThemedText
                  type="body"
                  style={{ fontWeight: "800", color: theme.primary }}
                >
                  ₹{item.amount}
                </ThemedText>
              </View>
            </View>
          )}
        />
      )}

      {/* Razorpay Web Checkout Modal */}
      <Modal
        visible={webViewModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWebViewModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTitleWrap}>
              <Feather name="shield" size={18} color="#EA580C" />
              <ThemedText type="h3" style={styles.modalHeaderTitle}>
                Razorpay Checkout
              </ThemedText>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {paymentUrl ? (
                <Pressable
                  onPress={() => {
                    Linking.openURL(paymentUrl).catch(() =>
                      Alert.alert("Notice", "Could not open external browser.")
                    );
                  }}
                  hitSlop={8}
                  style={styles.openBrowserBtn}
                >
                  <Feather name="external-link" size={15} color={theme.primary} />
                  <ThemedText style={{ fontSize: 13, color: theme.primary, fontWeight: "700", marginLeft: 4 }}>
                    Browser
                  </ThemedText>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => setWebViewModalVisible(false)}
                hitSlop={8}
                style={styles.closeBtn}
              >
                <Feather name="x" size={22} color={theme.text} />
              </Pressable>
            </View>
          </View>
          <WebView
            source={
              paymentUrl
                ? { uri: paymentUrl }
                : { html: webViewHtml, baseUrl: "https://api.razorpay.com" }
            }
            onMessage={handleWebViewMessage}
            onShouldStartLoadWithRequest={(request) => {
              const url = request.url;
              // Intercept callback redirect
              if (url.includes("payment-callback") || url.includes("razorpay_payment_id")) {
                handleRedirectUrl(url);
                return false;
              }
              // Intercept UPI mobile schemes so UPI apps open natively
              if (
                url.startsWith("upi://") ||
                url.startsWith("tez://") ||
                url.startsWith("phonepe://") ||
                url.startsWith("paytmmp://") ||
                url.startsWith("intent://") ||
                url.startsWith("credpay://") ||
                url.startsWith("bhim://")
              ) {
                Linking.openURL(url).catch((err) => {
                  console.warn("[Razorpay] UPI app open:", err);
                });
                return false;
              }
              return true;
            }}
            onNavigationStateChange={(navState) => {
              if (
                navState.url.includes("payment-callback") ||
                navState.url.includes("razorpay_payment_id")
              ) {
                handleRedirectUrl(navState.url);
              }
            }}
            style={{ flex: 1 }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            originWhitelist={["*"]}
            mixedContentMode="always"
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.centeredContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
                <ThemedText style={{ marginTop: 12, color: theme.textSecondary, fontWeight: "600" }}>
                  Opening Razorpay Payment Page...
                </ThemedText>
              </View>
            )}
          />
        </View>
      </Modal>

      {/* ── Cancel Subscription Confirmation Modal ── */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isCancelling) setCancelModalVisible(false);
        }}
      >
        <View style={styles.cancelModalOverlay}>
          <View
            style={[
              styles.cancelModalContent,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.cancelModalHeader}>
              <View style={styles.cancelModalIconWrap}>
                <Feather name="alert-triangle" size={24} color="#EA580C" />
              </View>
              <ThemedText type="h3" style={styles.cancelModalTitle}>
                Cancel Haajari PRO?
              </ThemedText>
            </View>

            <View style={styles.cancelModalBulletList}>
              <View style={styles.cancelModalBulletItem}>
                <Feather
                  name="check-circle"
                  size={16}
                  color="#16A34A"
                  style={styles.cancelBulletIcon}
                />
                <ThemedText
                  style={[styles.cancelModalBulletText, { color: theme.text }]}
                >
                  Your PRO benefits will remain active until the current billing
                  period ends.
                </ThemedText>
              </View>

              <View style={styles.cancelModalBulletItem}>
                <Feather
                  name="shield"
                  size={16}
                  color="#3B82F6"
                  style={styles.cancelBulletIcon}
                />
                <ThemedText
                  style={[styles.cancelModalBulletText, { color: theme.text }]}
                >
                  No future automatic renewal will be charged.
                </ThemedText>
              </View>

              <View style={styles.cancelModalBulletItem}>
                <Feather
                  name="database"
                  size={16}
                  color="#F59E0B"
                  style={styles.cancelBulletIcon}
                />
                <ThemedText
                  style={[styles.cancelModalBulletText, { color: theme.text }]}
                >
                  Your workers, attendance and salary records will remain safe.
                </ThemedText>
              </View>
            </View>

            <View style={styles.cancelModalActions}>
              {/* Keep My PRO (Primary Button) */}
              <Pressable
                onPress={() => {
                  triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                  setCancelModalVisible(false);
                }}
                disabled={isCancelling}
                style={[styles.keepProBtn, { backgroundColor: theme.primary }]}
              >
                <ThemedText style={styles.keepProBtnText}>
                  Keep My PRO
                </ThemedText>
              </Pressable>

              {/* Yes, Cancel Subscription (Secondary Destructive Action) */}
              <Pressable
                onPress={handleConfirmCancellation}
                disabled={isCancelling}
                style={styles.confirmCancelBtn}
              >
                {isCancelling ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <ThemedText style={styles.confirmCancelBtnText}>
                    Yes, Cancel Subscription
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  backBtn: {
    marginRight: Spacing.sm,
    padding: 6,
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontWeight: "800",
    fontSize: 22,
  },
  proBadge: {
    backgroundColor: "#F97316",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proBadgeText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  tabSelectorRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  tabBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  tabBtnText: {
    fontWeight: "700",
    fontSize: 14,
  },
  activeSubBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC",
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  activeSubIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#16A34A",
    justifyContent: "center",
    alignItems: "center",
  },
  activeSubTitle: {
    color: "#166534",
    fontWeight: "800",
    fontSize: 15,
  },
  activeSubExpiry: {
    color: "#15803D",
    fontSize: 13,
    marginTop: 2,
  },
  freeModeNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    borderColor: "#FFEDD5",
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  freeModeNoticeTitle: {
    color: "#9A3412",
    fontWeight: "700",
    fontSize: 14,
  },
  freeModeNoticeSub: {
    color: "#C2410C",
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  sectionHeader: {
    fontWeight: "800",
    letterSpacing: 0.8,
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: Spacing.sm,
  },
  billingGrid: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  billingCard: {
    borderRadius: 16,
    padding: Spacing.lg,
    position: "relative",
  },
  yearlyCard: {
    overflow: "hidden",
  },
  bestValueBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#EA580C",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 12,
  },
  bestValueText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTitleWrap: {
    flex: 1,
  },
  planCardTitle: {
    fontWeight: "800",
    fontSize: 18,
  },
  planCardSubtext: {
    color: "#64748B",
    fontSize: 13,
    marginTop: 2,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: Spacing.md,
  },
  mainPrice: {
    fontSize: 28,
    fontWeight: "900",
  },
  perMonthLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748B",
  },
  perYearLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#EA580C",
  },
  strikethroughPrice: {
    textDecorationLine: "line-through",
    color: "#94A3B8",
    fontSize: 16,
    marginLeft: 6,
    fontWeight: "600",
  },
  savingsPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 10,
    gap: 6,
  },
  savingsPillText: {
    color: "#15803D",
    fontSize: 12,
    fontWeight: "700",
  },
  featuresContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    gap: 10,
  },
  featureIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#FFF7ED",
    justifyContent: "center",
    alignItems: "center",
  },
  featureLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    flex: 1,
  },
  secureGuaranteeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: Spacing.md,
  },
  secureGuaranteeText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  subscribeBtn: {
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#F97316",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  subscribeBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.3,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  txnCard: {
    padding: Spacing.lg,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  txnHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  txnTitle: {
    fontWeight: "700",
    fontSize: 15,
  },
  txnId: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  txnFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    marginTop: 44,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
  },
  modalHeaderTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalHeaderTitle: {
    fontWeight: "700",
    fontSize: 16,
  },
  closeBtn: {
    padding: 4,
  },
  openBrowserBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFEDD5",
  },
  // ─── PRO Identity Screen Styles ─────────────────────────────────────────
  proIdentityCard: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1.5,
    borderColor: "rgba(245, 158, 11, 0.45)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 20,
    overflow: "hidden",
  },
  proCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  crownCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    borderWidth: 1.5,
    borderColor: "#F59E0B",
    justifyContent: "center",
    alignItems: "center",
  },
  proIdentityTitle: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  proMemberName: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 2,
  },
  verifiedActiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderColor: "#10B981",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10B981",
    marginRight: 6,
  },
  verifiedActiveText: {
    color: "#34D399",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  proCardDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    marginVertical: 16,
  },
  proMetaGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  proMetaCol: {
    flex: 1,
  },
  proMetaLabel: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  proMetaValue: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 4,
  },
  daysRemainingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "rgba(245, 158, 11, 0.3)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 14,
  },
  daysRemainingText: {
    color: "#FBBF24",
    fontSize: 12,
    fontWeight: "700",
  },
  proCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  subscriptionIdText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
  },
  verifiedGuaranteeText: {
    color: "#10B981",
    fontSize: 10,
    fontWeight: "600",
  },
  unlockedFeaturesContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 18,
  },
  unlockedItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  unlockedIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
  },
  unlockedTitle: {
    fontWeight: "700",
    fontSize: 13,
  },
  unlockedSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  activePill: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activePillText: {
    color: "#16A34A",
    fontSize: 10,
    fontWeight: "800",
  },
  viewInvoicesBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  viewInvoicesBtnText: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  supportContactBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  supportContactBtnText: {
    color: "#15803D",
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 8,
  },
  cancelledNoticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
  },
  cancelledNoticeTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#D97706",
  },
  cancelledNoticeDesc: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
    lineHeight: 16,
  },
  cancelSubBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginTop: 12,
  },
  cancelSubBtnText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
  cancelModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  cancelModalContent: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 22,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  cancelModalHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  cancelModalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFF7ED",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  cancelModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  cancelModalBulletList: {
    gap: 12,
    marginBottom: 24,
  },
  cancelModalBulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cancelBulletIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  cancelModalBulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  cancelModalActions: {
    gap: 10,
  },
  keepProBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  keepProBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  confirmCancelBtn: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmCancelBtnText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "700",
  },
});
