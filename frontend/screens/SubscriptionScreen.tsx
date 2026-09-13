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
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
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
  const [subStatus, setSubStatus] = useState<SubscriptionStatusResponse | null>(
    null,
  );
  const [transactions, setTransactions] = useState<
    SubscriptionTransactionItem[]
  >([]);

  // Selected Plan & Billing Option State
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [selectedOptionId, setSelectedOptionId] = useState<string>("");

  // Payment Webview State
  const [isProcessing, setIsProcessing] = useState(false);
  const [webViewModalVisible, setWebViewModalVisible] = useState(false);
  const [webViewHtml, setWebViewHtml] = useState<string>("");
  const [activeTxnId, setActiveTxnId] = useState<string>("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const statusData = await SubscriptionApi.getStatus();
      setSubStatus(statusData);

      if (statusData.availablePlans && statusData.availablePlans.length > 0) {
        const firstPlan = statusData.availablePlans[0];
        setSelectedPlanId(firstPlan.planId);
        if (firstPlan.billingOptions && firstPlan.billingOptions.length > 0) {
          setSelectedOptionId(firstPlan.billingOptions[0].optionId);
        }
      }

      const txns = await SubscriptionApi.getUserTransactions();
      setTransactions(txns);
    } catch (err) {
      console.warn("[SubscriptionScreen] Data load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const triggerHaptic = () =>
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

  const currentPlan = subStatus?.availablePlans?.find(
    (p) => p.planId === selectedPlanId,
  );
  const currentOption = currentPlan?.billingOptions?.find(
    (o) => o.optionId === selectedOptionId,
  );

  const handleSelectPlan = (planId: string) => {
    triggerHaptic();
    setSelectedPlanId(planId);
    const plan = subStatus?.availablePlans?.find((p) => p.planId === planId);
    if (plan?.billingOptions && plan.billingOptions.length > 0) {
      setSelectedOptionId(plan.billingOptions[0].optionId);
    }
  };

  const handleSelectOption = (optionId: string) => {
    triggerHaptic();
    setSelectedOptionId(optionId);
  };

  const handleCheckout = async () => {
    if (!currentPlan || !currentOption) return;
    setIsProcessing(true);
    triggerHaptic();

    try {
      const checkoutData = await SubscriptionApi.createCheckout(
        currentPlan.planId,
        currentOption.optionId,
      );
      setActiveTxnId(checkoutData.transactionId);

      // Simple simulated Razorpay HTML checkout trigger
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f8fafc; }
            .card { background: white; padding: 24px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; max-width: 90%; }
            .btn { background: #2563eb; color: white; border: none; padding: 14px 28px; border-radius: 10px; font-size: 16px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 16px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Complete Payment</h2>
            <p>Plan: <strong>${checkoutData.planName} (${checkoutData.billingLabel})</strong></p>
            <p style="font-size: 24px; font-weight: bold; color: #2563eb;">₹${checkoutData.effectivePrice}</p>
            <button class="btn" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({ status: 'success' }))">Confirm Payment</button>
          </div>
        </body>
        </html>
      `;

      setWebViewHtml(htmlContent);
      setWebViewModalVisible(true);
    } catch (err: any) {
      Alert.alert(
        "Checkout Notice",
        err.message || "Unable to initiate payment.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWebViewMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.status === "success" && activeTxnId) {
        setWebViewModalVisible(false);
        setIsProcessing(true);

        await SubscriptionApi.activateSubscription(
          activeTxnId,
          `PAY_${Date.now()}`,
        );
        Alert.alert(
          "Success!",
          "Your subscription has been activated successfully!",
        );
        loadData();
      }
    } catch (err) {
      console.warn("[SubscriptionScreen] Payment verification error:", err);
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

  // Global Subscription OFF -> Show Free Mode Card
  if (!subStatus?.subscriptionEnabled) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={theme.text} />
          </Pressable>

          <ThemedText type="h2" style={{ fontWeight: "700" }}>
            Subscription
          </ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.freeModeContainer}>
          <View
            style={[
              styles.freeModeCard,
              {
                backgroundColor: theme.primary + "12",
                borderColor: theme.primary + "30",
              },
            ]}
          >
            <View
              style={[
                styles.freeBadgeCircle,
                { backgroundColor: theme.primary },
              ]}
            >
              <Feather name="gift" size={36} color="#FFFFFF" />
            </View>

            <ThemedText
              type="h2"
              style={{
                fontWeight: "700",
                marginTop: Spacing.lg,
                textAlign: "center",
              }}
            >
              Currently in Free Mode
            </ThemedText>

            <ThemedText
              type="body"
              style={{
                color: theme.textSecondary,
                textAlign: "center",
                marginTop: Spacing.sm,
                lineHeight: 22,
                maxWidth: 300,
              }}
            >
              Haajari Manager is currently free for all construction managers.
              All site limits, worker capacity, supervisor accounts, and PDF
              exports are 100% unlocked!
            </ThemedText>
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header & Tabs */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={theme.text} />
        </Pressable>

        <ThemedText type="h2" style={{ fontWeight: "700" }}>
          Subscriptions
        </ThemedText>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabSelectorRow}>
        <Pressable
          onPress={() => setActiveTab("plans")}
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
            style={{
              color: activeTab === "plans" ? "#FFFFFF" : theme.text,
              fontWeight: "700",
            }}
          >
            Subscription Plans
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("history")}
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
            style={{
              color: activeTab === "history" ? "#FFFFFF" : theme.text,
              fontWeight: "700",
            }}
          >
            History ({transactions.length})
          </ThemedText>
        </Pressable>
      </View>

      {activeTab === "plans" ? (
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}
        >
          {/* Active Subscription Banner if user has active plan */}
          {subStatus.userSubscription &&
            subStatus.userSubscription.status === "active" && (
              <View
                style={[
                  styles.activeSubBanner,
                  { backgroundColor: "#E6F4EA", borderColor: "#34A853" },
                ]}
              >
                <Feather name="check-circle" size={20} color="#137333" />
                <View style={{ marginLeft: 10 }}>
                  <ThemedText
                    type="body"
                    style={{ color: "#137333", fontWeight: "700" }}
                  >
                    Active Subscription:{" "}
                    {subStatus.userSubscription.planId.toUpperCase()}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: "#137333", marginTop: 2 }}
                  >
                    Valid until{" "}
                    {new Date(
                      subStatus.userSubscription.expiresAt,
                    ).toLocaleDateString()}
                  </ThemedText>
                </View>
              </View>
            )}

          {/* Plan Tabs */}
          <ThemedText type="small" style={styles.sectionHeader}>
            SELECT A PLAN
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.planChipsRow}
          >
            {subStatus.availablePlans.map((plan) => {
              const isSelected = plan.planId === selectedPlanId;
              return (
                <Pressable
                  key={plan.planId}
                  onPress={() => handleSelectPlan(plan.planId)}
                  style={[
                    styles.planChip,
                    {
                      backgroundColor: isSelected
                        ? theme.primary
                        : theme.backgroundDefault,
                      borderColor: isSelected ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <ThemedText
                    type="body"
                    style={{
                      color: isSelected ? "#FFFFFF" : theme.text,
                      fontWeight: "700",
                    }}
                  >
                    {plan.name}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Plan Description & Features Card */}
          {currentPlan && (
            <View
              style={[
                styles.planCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
              ]}
            >
              <ThemedText type="h3" style={{ fontWeight: "700" }}>
                {currentPlan.name} Plan
              </ThemedText>
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, marginTop: 4 }}
              >
                {currentPlan.description}
              </ThemedText>

              {/* Billing Options Selector */}
              <ThemedText
                type="small"
                style={[styles.sectionHeader, { marginTop: Spacing.md }]}
              >
                SELECT BILLING DURATION
              </ThemedText>

              <View style={styles.billingGrid}>
                {currentPlan.billingOptions.map((opt) => {
                  const isSelected = opt.optionId === selectedOptionId;
                  const showPromo =
                    opt.promotionEnabled &&
                    typeof opt.promotionalPrice === "number";
                  const effectivePrice = showPromo
                    ? opt.promotionalPrice
                    : opt.price;

                  return (
                    <Pressable
                      key={opt.optionId}
                      onPress={() => handleSelectOption(opt.optionId)}
                      style={[
                        styles.billingOptionBox,
                        {
                          backgroundColor: isSelected
                            ? theme.primary + "12"
                            : theme.backgroundRoot,
                          borderColor: isSelected
                            ? theme.primary
                            : theme.border,
                        },
                      ]}
                    >
                      {showPromo && (
                        <View style={styles.promoBadge}>
                          <ThemedText
                            type="small"
                            style={{
                              color: "#FFFFFF",
                              fontWeight: "700",
                              fontSize: 10,
                            }}
                          >
                            PROMO OFFER
                          </ThemedText>
                        </View>
                      )}

                      <ThemedText type="body" style={{ fontWeight: "700" }}>
                        {opt.billingLabel}
                      </ThemedText>

                      <View style={styles.priceRow}>
                        <ThemedText
                          type="h2"
                          style={{ color: theme.primary, fontWeight: "800" }}
                        >
                          ₹{effectivePrice}
                        </ThemedText>
                        {showPromo &&
                          effectivePrice !== undefined &&
                          opt.price > effectivePrice && (
                            <ThemedText
                              type="small"
                              style={styles.strikethroughPrice}
                            >
                              ₹{opt.price}
                            </ThemedText>
                          )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* Features List */}
              <View style={styles.featuresList}>
                <ThemedText type="small" style={styles.sectionHeader}>
                  INCLUDED FEATURES
                </ThemedText>
                <View style={styles.featureItem}>
                  <Feather name="check" size={16} color={theme.primary} />
                  <ThemedText type="body" style={styles.featureText}>
                    Worker Capacity:{" "}
                    {currentPlan.features.maxWorkers === -1
                      ? "Unlimited"
                      : currentPlan.features.maxWorkers}
                  </ThemedText>
                </View>
                <View style={styles.featureItem}>
                  <Feather name="check" size={16} color={theme.primary} />
                  <ThemedText type="body" style={styles.featureText}>
                    Construction Sites:{" "}
                    {currentPlan.features.maxProjects === -1
                      ? "Unlimited"
                      : currentPlan.features.maxProjects}
                  </ThemedText>
                </View>
                <View style={styles.featureItem}>
                  <Feather name="check" size={16} color={theme.primary} />
                  <ThemedText type="body" style={styles.featureText}>
                    Supervisors:{" "}
                    {currentPlan.features.maxSupervisors === -1
                      ? "Unlimited"
                      : currentPlan.features.maxSupervisors}
                  </ThemedText>
                </View>
              </View>

              {/* Subscribe Button */}
              {currentOption && (
                <Pressable
                  onPress={handleCheckout}
                  disabled={isProcessing}
                  style={[
                    styles.checkoutBtn,
                    {
                      backgroundColor: theme.primary,
                      opacity: isProcessing ? 0.7 : 1,
                    },
                  ]}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedText
                      type="body"
                      style={{
                        color: "#FFFFFF",
                        fontWeight: "700",
                        fontSize: 16,
                      }}
                    >
                      Subscribe Now • ₹
                      {currentOption.promotionEnabled &&
                      typeof currentOption.promotionalPrice === "number"
                        ? currentOption.promotionalPrice
                        : currentOption.price}
                    </ThemedText>
                  )}
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>
      ) : (
        /* History Tab */
        <FlatList
          data={transactions}
          keyExtractor={(item) => item._id || item.transactionId}
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.centeredContainer}>
              <Feather name="file-text" size={42} color={theme.textSecondary} />
              <ThemedText
                type="body"
                style={{ color: theme.textSecondary, marginTop: Spacing.md }}
              >
                No subscription transactions found.
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
                <View>
                  <ThemedText type="body" style={{ fontWeight: "700" }}>
                    {item.planNameSnapshot || item.planId}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, marginTop: 2 }}
                  >
                    Txn ID: {item.transactionId}
                  </ThemedText>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        item.status === "paid" ? "#E6F4EA" : "#F1F3F4",
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: item.status === "paid" ? "#137333" : "#70757A",
                      fontWeight: "700",
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
                  {new Date(item.createdAt).toLocaleDateString()}
                </ThemedText>
                <ThemedText
                  type="body"
                  style={{ fontWeight: "700", color: theme.primary }}
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
            <ThemedText type="h3" style={{ fontWeight: "700" }}>
              Razorpay Checkout
            </ThemedText>
            <Pressable onPress={() => setWebViewModalVisible(false)}>
              <Feather name="x" size={20} color={theme.text} />
            </Pressable>
          </View>
          <WebView
            source={{ html: webViewHtml }}
            onMessage={handleWebViewMessage}
            style={{ flex: 1 }}
          />
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
    paddingBottom: Spacing.md,
  },
  backBtn: { marginRight: Spacing.md, padding: 4 },
  freeModeContainer: {
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 400,
  },
  freeModeCard: {
    width: "100%",
    padding: Spacing.xl,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
  },
  freeBadgeCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  tabSelectorRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  tabBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    justifyContent: "center",
    alignItems: "center",
  },
  activeSubBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
    color: "#888888",
  },
  planChipsRow: { gap: Spacing.sm, marginBottom: Spacing.lg },
  planChip: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  planCard: { padding: Spacing.xl, borderRadius: 16, borderWidth: 1 },
  billingGrid: { gap: Spacing.sm, marginVertical: Spacing.sm },
  billingOptionBox: {
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    position: "relative",
  },
  promoBadge: {
    position: "absolute",
    top: -8,
    right: 12,
    backgroundColor: "#E65100",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginTop: 4,
  },
  strikethroughPrice: { textDecorationLine: "line-through", color: "#888888" },
  featuresList: { marginTop: Spacing.lg },
  featureItem: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  featureText: { marginLeft: 8, fontWeight: "500" },
  checkoutBtn: {
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.xl,
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
    alignItems: "center",
  },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  divider: { height: 1, marginVertical: Spacing.md },
  txnFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalContainer: { flex: 1, backgroundColor: "#FFFFFF", marginTop: 40 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
});
