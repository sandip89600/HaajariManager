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
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, FadeInUp, FadeInRight, Layout } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { storage, API_URL } from "@/utils/storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Prices per Billing Cycle
const PRICES = {
  basic: { monthly: 70, "3months": 149, yearly: 499 },
  super: { monthly: 149, "3months": 249, yearly: 999 },
  premium: { monthly: 199, "3months": 499, yearly: 1599 },
};

const PLAN_FEATURES = {
  basic: [
    "Up to 20 Workers",
    "Up to 2 Sites",
    "Attendance Management",
    "Worker Management",
    "Salary Tracking",
    "Basic Reports",
    "Cloud Backup & Restore",
    "Email Support"
  ],
  super: [
    "Up to 100 Workers",
    "Up to 10 Sites",
    "Material Management",
    "Payment Tracking",
    "Expense Management",
    "PDF Export",
    "Excel Export",
    "Supervisor Management",
    "Priority Support"
  ],
  premium: [
    "Unlimited Workers",
    "Unlimited Sites",
    "Unlimited Supervisors",
    "Multiple Admins",
    "Organization Management",
    "Advanced Analytics",
    "Live Dashboard",
    "Activity Logs",
    "Premium Future Features",
    "Highest Priority Support"
  ]
};

export default function SubscriptionScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // States
  const [billingCycle, setBillingCycle] = useState<"monthly" | "3months" | "yearly">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<"basic" | "super" | "premium">("super");
  const [currentPlan, setCurrentPlan] = useState<string>("basic");
  const [loading, setLoading] = useState(false);
  const [cancellingRenew, setCancellingRenew] = useState(false);
  const [autoRenewActive, setAutoRenewActive] = useState(true);

  // Usage states
  const [workersCount, setWorkersCount] = useState(18);
  const [workersLimit, setWorkersLimit] = useState(20);
  const [sitesCount, setSitesCount] = useState(2);
  const [sitesLimit, setSitesLimit] = useState(2);

  // Payment Drawer & Success Modal state
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successDetails, setSuccessDetails] = useState<{ planName: string; amount: number; validUntil: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "Credit Card" | "Debit Card" | "Net Banking" | "Wallet">("UPI");

  // Mobile Native WebView Razorpay Modal States
  const [webViewModalVisible, setWebViewModalVisible] = useState(false);
  const [webViewHtml, setWebViewHtml] = useState<string>("");
  const [pendingTxnDetails, setPendingTxnDetails] = useState<{ transactionId: string; token: string; invoiceNumber: string } | null>(null);

  const triggerHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

  // Load limits and plan info
  useEffect(() => {
    const loadStatus = async () => {
      try {
        setLoading(true);
        const auth = await storage.getAuth();
        const activePlan = auth?.plan || user?.plan || "basic";
        setCurrentPlan(activePlan);

        const workers = await storage.getWorkers();
        setWorkersCount(workers.length);

        const sitesResult = await storage.getSites();
        const sites = sitesResult.sites || [];
        setSitesCount(sites.length);

        // Map limits
        if (activePlan === "free" || activePlan === "basic") {
          setWorkersLimit(20);
          setSitesLimit(2);
        } else if (activePlan === "professional" || activePlan === "super") {
          setWorkersLimit(100);
          setSitesLimit(10);
        } else {
          setWorkersLimit(Infinity);
          setSitesLimit(Infinity);
        }
      } catch (err) {
        console.warn("Failed to load plan limits", err);
      } finally {
        setLoading(false);
      }
    };
    loadStatus();
  }, []);

  // Handle plan purchase/checkout session init
  const handleInitiateUpgrade = (plan: "basic" | "super" | "premium") => {
    triggerHaptic();
    setSelectedPlan(plan);
    setPaymentModalVisible(true);
  };

  // Helper to dynamically load Razorpay Standard Web Checkout SDK script on web environment
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window !== "undefined" && (window as any).Razorpay) {
        resolve(true);
        return;
      }
      if (typeof document === "undefined") {
        resolve(false);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Process Real Razorpay Standard Checkout
  const handlePayWithRazorpay = async () => {
    if (isPaymentProcessing) return; // Prevent double-clicking / duplicate orders

    try {
      setIsPaymentProcessing(true);

      const auth = await storage.getAuth();
      const token = auth?.token;

      // 1. Create order & transaction on backend
      let checkoutRes: Response;
      try {
        checkoutRes = await fetch(`${API_URL}/subscription/checkout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            planName: selectedPlan,
            billingCycle,
            paymentMethod,
          }),
        });
      } catch {
        setIsPaymentProcessing(false);
        Alert.alert(
          "Network Error",
          "Unable to complete the payment right now. Please check your connection and try again."
        );
        return;
      }

      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok || !checkoutData.success) {
        setIsPaymentProcessing(false);
        Alert.alert(
          "Payment Order Failed",
          checkoutData.error || "Unable to initialize Razorpay payment order.",
          [
            { text: "Try Again", onPress: () => handlePayWithRazorpay() },
            { text: "Cancel", style: "cancel" },
          ]
        );
        return;
      }

      const { transactionId, order_id, amount, key_id } = checkoutData;

      // Calculate expiration date string
      let days = 30;
      if (billingCycle === "3months") days = 90;
      else if (billingCycle === "yearly") days = 365;
      const validUntilDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      const handleSuccess = async () => {
        if (auth) {
          auth.plan = selectedPlan;
          await storage.setAuth(auth);
          setCurrentPlan(selectedPlan);
          if ((selectedPlan as string) === "super" || (selectedPlan as string) === "professional") {
            setWorkersLimit(100);
            setSitesLimit(10);
          } else if ((selectedPlan as string) === "premium" || (selectedPlan as string) === "business") {
            setWorkersLimit(Infinity);
            setSitesLimit(Infinity);
          } else {
            setWorkersLimit(20);
            setSitesLimit(2);
          }
        }
        setIsPaymentProcessing(false);
        setPaymentModalVisible(false);
        setSuccessDetails({
          planName: selectedPlan.toUpperCase(),
          amount: Math.round(PRICES[selectedPlan][billingCycle] * 1.18),
          validUntil: validUntilDate,
        });
        setSuccessModalVisible(true);
      };

      // Launch Razorpay Standard Checkout Modal on Web vs Mobile Native (WebView)
      if (Platform.OS === "web") {
        const scriptLoaded = await loadRazorpayScript();
        if (scriptLoaded && (window as any).Razorpay) {
          const options = {
            key: key_id || process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TSg4wZpi0xM7On",
            amount: amount,
            currency: "INR",
            name: "Haajari Manager",
            description: `Subscription Upgrade - ${selectedPlan.toUpperCase()} (${billingCycle})`,
            order_id: order_id,
            prefill: {
              name: user?.name || "Haajari User",
              email: user?.email || "",
              contact: user?.phone || "",
            },
            theme: {
              color: "#F97316",
            },
            handler: async function (response: any) {
              try {
                // Verify payment signature on backend
                const confirmRes = await fetch(`${API_URL}/subscription/confirm`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    transactionId,
                    status: "Completed",
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  }),
                });

                const confirmData = await confirmRes.json();
                if (!confirmRes.ok || !confirmData.success) {
                  throw new Error(confirmData.error || "Payment signature verification failed.");
                }

                await handleSuccess();
              } catch (err: any) {
                setIsPaymentProcessing(false);
                Alert.alert(
                  "Verification Failed",
                  err.message || "Payment verification failed. Please try again.",
                  [
                    { text: "Try Again", onPress: () => handlePayWithRazorpay() },
                    { text: "Cancel", style: "cancel" },
                  ]
                );
              }
            },
            modal: {
              ondismiss: function () {
                setIsPaymentProcessing(false);
                Alert.alert("Payment Cancelled", "Payment cancelled.");
              },
            },
          };

          const rzp = new (window as any).Razorpay(options);
          rzp.on("payment.failed", function (response: any) {
            setIsPaymentProcessing(false);
            Alert.alert(
              "Payment Failed",
              "Payment failed. Please try again.",
              [
                { text: "Try Again", onPress: () => handlePayWithRazorpay() },
                { text: "Cancel", style: "cancel" },
              ]
            );
          });
          rzp.open();
          return;
        }
      } else {
        // Mobile Native (Android & iOS) Razorpay Checkout via WebView Modal
        const keyIdToUse = key_id || process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TSg4wZpi0xM7On";
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
              <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
              <style>
                body { background-color: #0F172A; margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }
                .loading { color: #F97316; font-weight: bold; font-size: 16px; text-align: center; }
              </style>
            </head>
            <body>
              <div class="loading">Initializing Razorpay Checkout...</div>
              <script>
                var options = {
                  "key": "${keyIdToUse}",
                  "amount": "${amount}",
                  "currency": "INR",
                  "name": "Haajari Manager",
                  "description": "Subscription Upgrade - ${selectedPlan.toUpperCase()}",
                  "order_id": "${order_id}",
                  "prefill": {
                    "name": "${(user?.name || "Haajari User").replace(/"/g, '\\"')}",
                    "email": "${(user?.email || "").replace(/"/g, '\\"')}",
                    "contact": "${(user?.phone || "").replace(/"/g, '\\"')}"
                  },
                  "theme": { "color": "#F97316" },
                  "handler": function (response) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      status: 'success',
                      razorpay_payment_id: response.razorpay_payment_id,
                      razorpay_order_id: response.razorpay_order_id,
                      razorpay_signature: response.razorpay_signature
                    }));
                  },
                  "modal": {
                    "ondismiss": function() {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'cancelled' }));
                    }
                  }
                };
                var rzp = new Razorpay(options);
                rzp.on('payment.failed', function (response){
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    status: 'failed',
                    error: response.error ? response.error.description : 'Payment failed'
                  }));
                });
                window.onload = function() {
                  rzp.open();
                };
              </script>
            </body>
          </html>
        `;

        setPendingTxnDetails({ transactionId, token: token || "", invoiceNumber: checkoutData.transaction?.invoiceNumber || order_id });
        setWebViewHtml(html);
        setPaymentModalVisible(false);
        setWebViewModalVisible(true);
      }
    } catch (err: any) {
      setIsPaymentProcessing(false);
      Alert.alert(
        "Payment Failed",
        "Payment failed. Please try again.",
        [
          { text: "Try Again", onPress: () => handlePayWithRazorpay() },
          { text: "Cancel", style: "cancel" },
        ]
      );
    }
  };

  // Handle Razorpay PostMessage from WebView Modal on Mobile Native
  const handleWebViewMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      setWebViewModalVisible(false);

      if (data.status === "success" && pendingTxnDetails) {
        setIsPaymentProcessing(true);
        const confirmRes = await fetch(`${API_URL}/subscription/confirm`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${pendingTxnDetails.token}`,
          },
          body: JSON.stringify({
            transactionId: pendingTxnDetails.transactionId,
            status: "Completed",
            razorpay_order_id: data.razorpay_order_id,
            razorpay_payment_id: data.razorpay_payment_id,
            razorpay_signature: data.razorpay_signature,
          }),
        });

        const confirmData = await confirmRes.json();
        if (!confirmRes.ok || !confirmData.success) {
          throw new Error(confirmData.error || "Payment signature verification failed.");
        }

        const auth = await storage.getAuth();
        if (auth) {
          auth.plan = selectedPlan;
          await storage.setAuth(auth);
          setCurrentPlan(selectedPlan);
          if ((selectedPlan as string) === "super" || (selectedPlan as string) === "professional") {
            setWorkersLimit(100);
            setSitesLimit(10);
          } else if ((selectedPlan as string) === "premium" || (selectedPlan as string) === "business") {
            setWorkersLimit(Infinity);
            setSitesLimit(Infinity);
          } else {
            setWorkersLimit(20);
            setSitesLimit(2);
          }
        }

        let days = 30;
        if (billingCycle === "3months") days = 90;
        else if (billingCycle === "yearly") days = 365;
        const validUntilDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });

        setIsPaymentProcessing(false);
        setSuccessDetails({
          planName: selectedPlan.toUpperCase(),
          amount: Math.round(PRICES[selectedPlan][billingCycle] * 1.18),
          validUntil: validUntilDate,
        });
        setSuccessModalVisible(true);
      } else if (data.status === "cancelled") {
        setIsPaymentProcessing(false);
        Alert.alert("Payment Cancelled", "Payment cancelled.");
      } else {
        setIsPaymentProcessing(false);
        Alert.alert(
          "Payment Failed",
          "Payment failed. Please try again.",
          [
            { text: "Try Again", onPress: () => handlePayWithRazorpay() },
            { text: "Cancel", style: "cancel" },
          ]
        );
      }
    } catch (err: any) {
      setIsPaymentProcessing(false);
      Alert.alert(
        "Verification Failed",
        err.message || "Payment verification failed. Please try again.",
        [
          { text: "Try Again", onPress: () => handlePayWithRazorpay() },
          { text: "Cancel", style: "cancel" },
        ]
      );
    }
  };

  // Manage Auto Renewal
  const handleAutoRenewToggle = async () => {
    try {
      triggerHaptic();
      setCancellingRenew(true);
      const auth = await storage.getAuth();
      const token = auth?.token;

      const res = await fetch(`${API_URL}/subscription/manage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: autoRenewActive ? "cancel_renew" : "enable_renew",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAutoRenewActive(!autoRenewActive);
        Alert.alert("Subscription Updated", data.message);
      } else {
        throw new Error(data.error || "Failed to update auto renewal settings");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setCancellingRenew(false);
    }
  };

  // Handle Immediate Downgrade
  const handleDowngrade = async () => {
    Alert.alert(
      "Confirm Downgrade",
      "Are you sure you want to downgrade to the Basic plan? You will immediately lose access to premium limits.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Downgrade",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              const auth = await storage.getAuth();
              const token = auth?.token;

              const res = await fetch(`${API_URL}/subscription/manage`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ action: "downgrade" }),
              });

              const data = await res.json();
              if (res.ok && data.success) {
                if (auth) {
                  auth.plan = "basic";
                  await storage.setAuth(auth);
                }
                setCurrentPlan("basic");
                setWorkersLimit(20);
                setSitesLimit(2);
                Alert.alert("Downgraded", "Your plan is now set to Basic.");
              } else {
                throw new Error(data.error || "Failed to downgrade plan");
              }
            } catch (err: any) {
              Alert.alert("Error", err.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Helper to determine warning progress bar color
  const getProgressColor = (used: number, limit: number) => {
    if (limit === Infinity) return "#22C55E";
    const ratio = used / limit;
    if (ratio >= 1.0) return "#EF4444"; // Red
    if (ratio >= 0.8) return "#F59E0B"; // Orange/Amber
    return "#22C55E"; // Green
  };

  if (loading && !paymentModalVisible) {
    return (
      <View style={[styles.centerScreen, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC" }]}>
        <ActivityIndicator size="large" color="#F97316" />
        <ThemedText style={{ marginTop: 12 }}>Syncing subscription limits...</ThemedText>
      </View>
    );
  }

  const cycleMultiplier = billingCycle === "monthly" ? "Month" : billingCycle === "3months" ? "3 Mos" : "Year";

  return (
    <View style={[styles.root, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC" }]}>
      {/* Header Bar */}
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: isDark ? "#1E293B" : "#E2E8F0" }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={isDark ? "#FFFFFF" : "#1E293B"} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Subscription</ThemedText>
        <Pressable onPress={() => navigation.navigate("BillingHistory")} style={styles.historyBtn}>
          <Feather name="file-text" size={20} color={isDark ? "#FFFFFF" : "#1E293B"} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }} showsVerticalScrollIndicator={false}>
        {/* Visual Hero Area */}
        <LinearGradient
          colors={isDark ? ["#1E1E38", "#0F172A"] : ["#FFF7ED", "#F8FAFC"]}
          style={styles.hero}
        >
          <Ionicons name="sparkles" size={42} color="#F97316" style={{ marginBottom: 12 }} />
          <ThemedText style={styles.heroTitle}>Upgrade to Haajari Pro</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            Choose the perfect plan for your construction business. Unlock analytics, material tracking, and export features.
          </ThemedText>
        </LinearGradient>

        {/* Current Plan & Limits Meter */}
        <View style={[styles.usageCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]}>
          <View style={styles.usageHeader}>
            <ThemedText style={styles.usageLabel}>Current Plan</ThemedText>
            <Badge plan={currentPlan} />
          </View>

          {/* Workers Limits */}
          <View style={styles.limitRow}>
            <View style={styles.limitInfo}>
              <ThemedText style={styles.limitLabel}>Workers Enrolled</ThemedText>
              <ThemedText style={styles.limitVal}>
                {workersCount} / {workersLimit === Infinity ? "Unlimited" : workersLimit}
              </ThemedText>
            </View>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: workersLimit === Infinity ? "100%" : `${Math.min(100, (workersCount / workersLimit) * 100)}%`,
                    backgroundColor: getProgressColor(workersCount, workersLimit),
                  },
                ]}
              />
            </View>
          </View>

          {/* Sites Limits */}
          <View style={styles.limitRow}>
            <View style={styles.limitInfo}>
              <ThemedText style={styles.limitLabel}>Active Sites</ThemedText>
              <ThemedText style={styles.limitVal}>
                {sitesCount} / {sitesLimit === Infinity ? "Unlimited" : sitesLimit}
              </ThemedText>
            </View>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: sitesLimit === Infinity ? "100%" : `${Math.min(100, (sitesCount / sitesLimit) * 100)}%`,
                    backgroundColor: getProgressColor(sitesCount, sitesLimit),
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Billing Period Selector */}
        <View style={styles.toggleContainer}>
          <Pressable
            onPress={() => { triggerHaptic(); setBillingCycle("monthly"); }}
            style={[styles.toggleBtn, billingCycle === "monthly" && styles.toggleBtnActive]}
          >
            <ThemedText style={[styles.toggleText, billingCycle === "monthly" && styles.toggleTextActive]}>
              Monthly
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => { triggerHaptic(); setBillingCycle("3months"); }}
            style={[styles.toggleBtn, billingCycle === "3months" && styles.toggleBtnActive]}
          >
            <ThemedText style={[styles.toggleText, billingCycle === "3months" && styles.toggleTextActive]}>
              3 Months
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => { triggerHaptic(); setBillingCycle("yearly"); }}
            style={[styles.toggleBtn, billingCycle === "yearly" && styles.toggleBtnActive]}
          >
            <ThemedText style={[styles.toggleText, billingCycle === "yearly" && styles.toggleTextActive]}>
              Yearly
            </ThemedText>
          </Pressable>
        </View>

        {/* PLANS GRID */}
        <View style={styles.plansContainer}>
          {/* Plan 1: Basic */}
          <Animated.View entering={FadeInRight.delay(50)} style={[styles.planCard, isDark ? styles.cardDark : styles.cardLight, currentPlan === "basic" && styles.planCardActive]}>
            <ThemedText style={styles.planName}>Basic</ThemedText>
            <ThemedText style={styles.planDesc}>Suitable for Individual Contractors</ThemedText>
            <ThemedText style={styles.planPrice}>
              ₹{PRICES.basic[billingCycle]} <ThemedText style={styles.planCycle}>/ {cycleMultiplier}</ThemedText>
            </ThemedText>
            
            <Pressable
              onPress={() => handleInitiateUpgrade("basic")}
              disabled={currentPlan === "basic"}
              style={[styles.planBtn, currentPlan === "basic" && styles.planBtnDisabled]}
            >
              <ThemedText style={styles.planBtnText}>
                {currentPlan === "basic" ? "Active Plan" : "Choose Basic"}
              </ThemedText>
            </Pressable>

            <View style={styles.divider} />
            {PLAN_FEATURES.basic.map((f, i) => (
              <View key={i} style={styles.featureItem}>
                <Feather name="check" size={14} color="#22C55E" style={{ marginRight: 8 }} />
                <ThemedText style={styles.featureText}>{f}</ThemedText>
              </View>
            ))}
          </Animated.View>

          {/* Plan 2: Super (Highlighted) */}
          <Animated.View entering={FadeInRight.delay(100)} style={[styles.planCard, styles.superCard, currentPlan === "super" && styles.planCardActive]}>
            <View style={styles.popularBadge}>
              <ThemedText style={styles.popularBadgeText}>MOST POPULAR</ThemedText>
            </View>
            <ThemedText style={[styles.planName, { color: "#FFFFFF" }]}>Super</ThemedText>
            <ThemedText style={[styles.planDesc, { color: "rgba(255,255,255,0.7)" }]}>Suitable for Growing Contractors</ThemedText>
            <ThemedText style={[styles.planPrice, { color: "#FFFFFF" }]}>
              ₹{PRICES.super[billingCycle]} <ThemedText style={[styles.planCycle, { color: "rgba(255,255,255,0.7)" }]}>/ {cycleMultiplier}</ThemedText>
            </ThemedText>

            <Pressable
              onPress={() => handleInitiateUpgrade("super")}
              disabled={currentPlan === "super"}
              style={[styles.planBtn, styles.superBtn, currentPlan === "super" && styles.planBtnDisabled]}
            >
              <ThemedText style={[styles.planBtnText, { color: "#EA580C" }]}>
                {currentPlan === "super" ? "Active Plan" : "Upgrade to Super"}
              </ThemedText>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: "rgba(255,255,255,0.15)" }]} />
            {PLAN_FEATURES.super.map((f, i) => (
              <View key={i} style={styles.featureItem}>
                <Feather name="check" size={14} color="#FFFFFF" style={{ marginRight: 8 }} />
                <ThemedText style={[styles.featureText, { color: "#FFFFFF" }]}>{f}</ThemedText>
              </View>
            ))}
          </Animated.View>

          {/* Plan 3: Premium */}
          <Animated.View entering={FadeInRight.delay(150)} style={[styles.planCard, isDark ? styles.cardDark : styles.cardLight, currentPlan === "premium" && styles.planCardActive]}>
            <ThemedText style={styles.planName}>Premium</ThemedText>
            <ThemedText style={styles.planDesc}>Builders & Construction Companies</ThemedText>
            <ThemedText style={styles.planPrice}>
              ₹{PRICES.premium[billingCycle]} <ThemedText style={styles.planCycle}>/ {cycleMultiplier}</ThemedText>
            </ThemedText>

            <Pressable
              onPress={() => handleInitiateUpgrade("premium")}
              disabled={currentPlan === "premium"}
              style={[styles.planBtn, currentPlan === "premium" && styles.planBtnDisabled]}
            >
              <ThemedText style={styles.planBtnText}>
                {currentPlan === "premium" ? "Active Plan" : "Go Premium"}
              </ThemedText>
            </Pressable>

            <View style={styles.divider} />
            {PLAN_FEATURES.premium.map((f, i) => (
              <View key={i} style={styles.featureItem}>
                <Feather name="check" size={14} color="#22C55E" style={{ marginRight: 8 }} />
                <ThemedText style={styles.featureText}>{f}</ThemedText>
              </View>
            ))}
          </Animated.View>
        </View>



        {/* Subscription Management Actions */}
        {currentPlan !== "basic" && (
          <View style={styles.managementWrap}>
            <ThemedText style={styles.sectionTitle}>Manage Subscription</ThemedText>
            <View style={[styles.tableCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", padding: 16 }]}>
              <View style={styles.manageRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.manageTitle}>Auto Renewal</ThemedText>
                  <ThemedText style={styles.manageDesc}>
                    {autoRenewActive ? "Automatically renews next cycle." : "Will expire at end of cycle."}
                  </ThemedText>
                </View>
                <Pressable
                  disabled={cancellingRenew}
                  onPress={handleAutoRenewToggle}
                  style={[styles.manageBtn, { backgroundColor: autoRenewActive ? "#EF4444" + "20" : "#22C55E" + "20" }]}
                >
                  <ThemedText style={{ color: autoRenewActive ? "#EF4444" : "#22C55E", fontWeight: "700" }}>
                    {cancellingRenew ? "Updating..." : autoRenewActive ? "Disable" : "Enable"}
                  </ThemedText>
                </Pressable>
              </View>

              <Pressable onPress={handleDowngrade} style={styles.downgradeButton}>
                <ThemedText style={styles.downgradeBtnText}>Downgrade to Basic</ThemedText>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {/* PAYMENT SHEET MODAL */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalCloseArea} onPress={() => setPaymentModalVisible(false)} />
          <View style={[styles.modalContent, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Confirm Payment</ThemedText>
              <Pressable onPress={() => setPaymentModalVisible(false)}>
                <Feather name="x" size={22} color={isDark ? "#94A3B8" : "#64748B"} />
              </Pressable>
            </View>

            <ThemedText style={styles.modalSub}>
              Confirm subscription of <ThemedText style={{ fontWeight: "800", color: "#F97316" }}>{selectedPlan.toUpperCase()}</ThemedText> for ₹{PRICES[selectedPlan][billingCycle]} (+ 18% GST).
            </ThemedText>

            {/* Payment Method Selectors */}
            <ThemedText style={styles.methodTitle}>Select Payment Method</ThemedText>
            <View style={{ gap: 8, marginBottom: 20 }}>
              <PaymentMethodOption label="UPI (PhonePe, GPay, PayTM)" value="UPI" selected={paymentMethod} onSelect={setPaymentMethod} icon="wallet-outline" />
              <PaymentMethodOption label="Credit Card" value="Credit Card" selected={paymentMethod} onSelect={setPaymentMethod} icon="card-outline" />
              <PaymentMethodOption label="Debit Card" value="Debit Card" selected={paymentMethod} onSelect={setPaymentMethod} icon="card-outline" />
              <PaymentMethodOption label="Net Banking" value="Net Banking" selected={paymentMethod} onSelect={setPaymentMethod} icon="business-outline" />
              <PaymentMethodOption label="Wallet" value="Wallet" selected={paymentMethod} onSelect={setPaymentMethod} icon="wallet-outline" />
            </View>

            {/* Proceed to Pay CTA */}
            <View style={{ gap: 10 }}>
              <Pressable
                disabled={isPaymentProcessing}
                onPress={handlePayWithRazorpay}
                style={[
                  styles.payBtn,
                  isPaymentProcessing && { opacity: 0.6 }
                ]}
              >
                {isPaymentProcessing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <ThemedText style={styles.payBtnText}>Proceed to Pay</ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* SUCCESS OVERLAY MODAL */}
      <Modal
        visible={successModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", alignItems: "center", paddingVertical: 28 }]}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(34, 197, 94, 0.15)", justifyContent: "center", alignItems: "center", marginBottom: 16 }}>
              <Feather name="check-circle" size={36} color="#22C55E" />
            </View>

            <ThemedText style={{ fontSize: 20, fontWeight: "800", color: isDark ? "#F8FAFC" : "#0F172A", marginBottom: 4 }}>
              ✓ Payment Successful
            </ThemedText>
            
            <ThemedText style={{ fontSize: 13, color: isDark ? "#94A3B8" : "#64748B", marginBottom: 20, textAlign: "center" }}>
              Your Haajari subscription is now active.
            </ThemedText>

            {successDetails && (
              <View style={{ width: "100%", backgroundColor: isDark ? "#0F172A" : "#F8FAFC", borderRadius: 12, padding: 16, marginBottom: 24, gap: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <ThemedText style={{ fontSize: 13, color: isDark ? "#94A3B8" : "#64748B" }}>Plan</ThemedText>
                  <ThemedText style={{ fontSize: 14, fontWeight: "700", color: "#F97316" }}>{successDetails.planName}</ThemedText>
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <ThemedText style={{ fontSize: 13, color: isDark ? "#94A3B8" : "#64748B" }}>Amount Paid</ThemedText>
                  <ThemedText style={{ fontSize: 14, fontWeight: "700", color: isDark ? "#F8FAFC" : "#0F172A" }}>₹{successDetails.amount}</ThemedText>
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <ThemedText style={{ fontSize: 13, color: isDark ? "#94A3B8" : "#64748B" }}>Valid Until</ThemedText>
                  <ThemedText style={{ fontSize: 14, fontWeight: "700", color: "#22C55E" }}>{successDetails.validUntil}</ThemedText>
                </View>
              </View>
            )}

            <Pressable
              onPress={() => setSuccessModalVisible(false)}
              style={[styles.payBtn, { width: "100%", backgroundColor: "#F97316" }]}
            >
              <ThemedText style={styles.payBtnText}>Continue to Haajari</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* MOBILE NATIVE RAZORPAY CHECKOUT WEBVIEW MODAL */}
      <Modal
        visible={webViewModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => {
          setWebViewModalVisible(false);
          setIsPaymentProcessing(false);
          Alert.alert("Payment Cancelled", "Payment cancelled.");
        }}
      >
        <View style={{ flex: 1, backgroundColor: "#0F172A", paddingTop: insets.top }}>
          <View style={{ height: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, backgroundColor: "#1E293B", borderBottomWidth: 1, borderBottomColor: "#334155" }}>
            <ThemedText style={{ fontSize: 16, fontWeight: "700", color: "#F8FAFC" }}>Razorpay Secure Checkout</ThemedText>
            <Pressable
              onPress={() => {
                setWebViewModalVisible(false);
                setIsPaymentProcessing(false);
                Alert.alert("Payment Cancelled", "Payment cancelled.");
              }}
              style={{ padding: 6 }}
            >
              <Feather name="x" size={24} color="#94A3B8" />
            </Pressable>
          </View>
          {webViewHtml ? (
            <WebView
              source={{ html: webViewHtml }}
              onMessage={handleWebViewMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={{ flex: 1, backgroundColor: "#0F172A", justifyContent: "center", alignItems: "center" }}>
                  <ActivityIndicator size="large" color="#F97316" />
                  <ThemedText style={{ color: "#94A3B8", fontSize: 14, marginTop: 12 }}>Loading Razorpay Payment Gateway...</ThemedText>
                </View>
              )}
              style={{ flex: 1, backgroundColor: "#0F172A" }}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

// Sub components
function Badge({ plan }: { plan: string }) {
  const isPro = plan === "professional" || plan === "super";
  const isPremium = plan === "business" || plan === "premium";
  let label = "Basic";
  let bg = "rgba(100, 116, 139, 0.15)";
  let color = "#64748B";

  if (isPro) {
    label = "Super";
    bg = "rgba(234, 88, 12, 0.15)";
    color = "#EA580C";
  } else if (isPremium) {
    label = "Premium";
    bg = "rgba(168, 85, 247, 0.15)";
    color = "#A855F7";
  }

  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: bg }}>
      <ThemedText style={{ color, fontSize: 11, fontWeight: "700" }}>{label}</ThemedText>
    </View>
  );
}

function TableHeading() {
  return (
    <View style={styles.tableHead}>
      <ThemedText style={[styles.tableCol, styles.firstCol]}>Features</ThemedText>
      <ThemedText style={styles.tableCol}>Basic</ThemedText>
      <ThemedText style={styles.tableCol}>Super</ThemedText>
      <ThemedText style={styles.tableCol}>Premium</ThemedText>
    </View>
  );
}

function TableRow({ label, basic, super: superVal, premium, basicColor }: { label: string; basic: string; super: string; premium: string; basicColor?: string }) {
  const { isDark } = useTheme();
  return (
    <View style={[styles.tableRow, { borderBottomColor: isDark ? "#2A354F" : "#F1F5F9" }]}>
      <ThemedText style={[styles.tableCellLabel, styles.firstCol]}>{label}</ThemedText>
      <ThemedText style={[styles.tableCell, basicColor ? { color: basicColor } : {}]}>{basic}</ThemedText>
      <ThemedText style={[styles.tableCell, { color: "#EA580C", fontWeight: "700" }]}>{superVal}</ThemedText>
      <ThemedText style={[styles.tableCell, { color: "#A855F7", fontWeight: "700" }]}>{premium}</ThemedText>
    </View>
  );
}

function RoadmapItem({ title, desc, icon }: { title: string; desc: string; icon: string }) {
  const { isDark } = useTheme();
  return (
    <View style={[styles.roadmapCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]}>
      <View style={styles.roadmapHead}>
        <Feather name={icon as any} size={15} color="#EA580C" style={{ marginRight: 6 }} />
        <ThemedText style={styles.roadmapTitle}>{title}</ThemedText>
      </View>
      <ThemedText style={styles.roadmapDesc}>{desc}</ThemedText>
      <View style={styles.roadmapBadge}>
        <ThemedText style={styles.roadmapBadgeText}>Coming Soon</ThemedText>
      </View>
    </View>
  );
}

function PaymentMethodOption({ label, value, selected, onSelect, icon }: { label: string; value: string; selected: string; onSelect: any; icon: string }) {
  const { isDark } = useTheme();
  const isSelected = selected === value;
  return (
    <Pressable
      onPress={() => onSelect(value)}
      style={[
        styles.methodCard,
        {
          backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#F8FAFC",
          borderColor: isSelected ? "#F97316" : isDark ? "#334155" : "#E2E8F0",
        },
      ]}
    >
      <Ionicons name={icon as any} size={18} color={isSelected ? "#F97316" : "#64748B"} />
      <ThemedText style={[styles.methodLabel, isSelected && { color: "#F97316", fontWeight: "700" }]}>{label}</ThemedText>
      <View style={[styles.radioOutline, isSelected && styles.radioActiveOutline]}>
        {isSelected && <View style={styles.radioDot} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centerScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    height: Platform.OS === "ios" ? 100 : 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  historyBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  hero: { padding: 24, alignItems: "center", borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  heroTitle: { fontSize: 24, fontWeight: "900", textAlign: "center", marginBottom: 8, color: "#F97316" },
  heroSubtitle: { fontSize: 13, textAlign: "center", color: "#64748B", lineHeight: 18 },
  usageCard: { margin: 16, borderRadius: 16, padding: 16, gap: 14, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10 },
  usageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  usageLabel: { fontSize: 14, fontWeight: "700" },
  limitRow: { gap: 6 },
  limitInfo: { flexDirection: "row", justifyContent: "space-between" },
  limitLabel: { fontSize: 12, color: "#64748B" },
  limitVal: { fontSize: 12, fontWeight: "700" },
  barBg: { height: 6, borderRadius: 3, backgroundColor: "rgba(100,116,139,0.1)", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
  toggleContainer: { flexDirection: "row", marginHorizontal: 16, backgroundColor: "rgba(100,116,139,0.1)", borderRadius: 10, padding: 4, marginBottom: 16 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  toggleBtnActive: { backgroundColor: "#EA580C" },
  toggleText: { fontSize: 12, fontWeight: "600" },
  toggleTextActive: { color: "#FFFFFF", fontWeight: "700" },
  plansContainer: { paddingHorizontal: 16, gap: 20 },
  planCard: { borderRadius: 20, padding: 20, borderWidth: 2, borderColor: "transparent" },
  planCardActive: { borderColor: "#F97316" },
  superCard: { backgroundColor: "#EA580C", overflow: "hidden", borderWidth: 2, borderColor: "#F97316" },
  popularBadge: { position: "absolute", top: 12, right: 12, backgroundColor: "#FFFFFF", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  popularBadgeText: { color: "#EA580C", fontSize: 9, fontWeight: "900" },
  cardLight: { backgroundColor: "#FFFFFF", elevation: 2 },
  cardDark: { backgroundColor: "#1E293B" },
  planName: { fontSize: 20, fontWeight: "900" },
  planDesc: { fontSize: 12, color: "#64748B", marginTop: 4, marginBottom: 16 },
  planPrice: { fontSize: 28, fontWeight: "900", marginBottom: 16 },
  planCycle: { fontSize: 13, fontWeight: "500", color: "#64748B" },
  planBtn: { backgroundColor: "#EA580C", borderRadius: 12, paddingVertical: 12, alignItems: "center", marginBottom: 16 },
  planBtnDisabled: { backgroundColor: "rgba(100,116,139,0.2)" },
  planBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
  superBtn: { backgroundColor: "#FFFFFF" },
  divider: { height: 1, backgroundColor: "rgba(100,116,139,0.1)", marginBottom: 16 },
  featureItem: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  featureText: { fontSize: 12 },
  compareWrap: { marginTop: 24, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 12, paddingHorizontal: 4 },
  tableCard: { borderRadius: 16, overflow: "hidden", elevation: 1 },
  tableHead: { flexDirection: "row", paddingVertical: 12, backgroundColor: "rgba(100,116,139,0.06)", borderBottomWidth: 1, borderBottomColor: "rgba(100,116,139,0.1)" },
  tableCol: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: "#64748B" },
  firstCol: { flex: 1.5, textAlign: "left", paddingLeft: 12 },
  tableRow: { flexDirection: "row", paddingVertical: 12, borderBottomWidth: 1 },
  tableCellLabel: { fontSize: 12, fontWeight: "600" },
  tableCell: { flex: 1, textAlign: "center", fontSize: 12, color: "#64748B" },
  roadmapWrap: { marginTop: 24, paddingHorizontal: 16 },
  gridContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  roadmapCard: { width: (SCREEN_WIDTH - 42) / 2, borderRadius: 12, padding: 12, gap: 6, position: "relative", borderWidth: 1, borderColor: "rgba(100,116,139,0.1)" },
  roadmapHead: { flexDirection: "row", alignItems: "center" },
  roadmapTitle: { fontSize: 12, fontWeight: "700" },
  roadmapDesc: { fontSize: 10, color: "#64748B", lineHeight: 14 },
  roadmapBadge: { position: "absolute", bottom: 6, right: 6, backgroundColor: "rgba(234,88,12,0.1)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  roadmapBadgeText: { color: "#EA580C", fontSize: 8, fontWeight: "700" },
  managementWrap: { marginTop: 24, paddingHorizontal: 16 },
  manageRow: { flexDirection: "row", alignItems: "center" },
  manageTitle: { fontSize: 14, fontWeight: "700" },
  manageDesc: { fontSize: 12, color: "#64748B", marginTop: 2 },
  manageBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  downgradeButton: { marginTop: 16, alignSelf: "center" },
  downgradeText: { color: "#64748B", fontSize: 12, textDecorationLine: "underline" },
  downgradeBtnText: { color: "#64748B", fontSize: 12, textDecorationLine: "underline", fontWeight: "600" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCloseArea: { flex: 1 },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === "ios" ? 40 : 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: "900" },
  modalSub: { fontSize: 13, color: "#64748B", marginBottom: 16, lineHeight: 18 },
  methodTitle: { fontSize: 14, fontWeight: "700", marginBottom: 10 },
  methodCard: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1 },
  methodLabel: { flex: 1, marginLeft: 10, fontSize: 13 },
  radioOutline: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#64748B", alignItems: "center", justifyContent: "center" },
  radioActiveOutline: { borderColor: "#F97316" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#F97316" },
  payBtn: { backgroundColor: "#EA580C", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  payBtnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
});
