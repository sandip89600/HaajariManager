import React, { useState, useCallback, useRef, memo, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Platform,
  Dimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import {
  storage,
  Worker,
  AttendanceRecord,
  PaymentRecord,
  calculateWorkerSummary,
  generateId,
  API_URL,
} from "@/utils/storage";
import { appContextTracker } from "@/utils/appContextTracker";
import { DeviceEventEmitter } from "react-native";
import {
  generateAttendanceHTML,
  generateSummaryHTML,
  generateCSV,
  exportToPDF,
  printHTML,
  shareCSV,
  downloadAndSharePDF,
  downloadAndShareCSV,
  fetchAndPrintHTML,
} from "@/utils/export";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface WorkerSummary {
  worker: Worker;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  overtimeDays: number;
  customDays: number;
  customAmount: number;
  totalAmount: number;
  totalPaid: number;
  balance: number;
  payments: PaymentRecord[];
}

interface SummaryCardProps {
  summary: WorkerSummary;
  theme: typeof Colors.light;
  isDark: boolean;
  t: any;
  index: number;
  onMarkPaid: (summary: WorkerSummary) => void;
  onDeletePayment: (paymentId: string) => void;
}

// ─── REUSABLE MODERN DIALOG ──────────────────────────────────────────────────
function GlassModal({
  visible,
  onClose,
  title,
  children,
  theme,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  theme: typeof Colors.light;
  isDark: boolean;
}) {
  const content = (
    <Pressable
      style={[
        styles.modalContentCard,
        {
          backgroundColor:
            Platform.OS === "ios"
              ? "transparent"
              : isDark
                ? "rgba(15, 23, 42, 0.96)"
                : "rgba(255, 255, 255, 0.98)",
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.08)"
            : "rgba(0, 0, 0, 0.08)",
          borderWidth: Platform.OS === "ios" ? 0 : 1,
        },
      ]}
      onPress={(e) => e.stopPropagation()}
    >
      <ThemedText type="h3" style={styles.modalTitleText}>
        {title}
      </ThemedText>
      {children}
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Animated.View
          entering={FadeInDown.duration(250)}
          style={styles.modalContainer}
        >
          {Platform.OS === "ios" ? (
            <BlurView
              intensity={95}
              tint={isDark ? "dark" : "light"}
              style={[
                styles.modalBlur,
                {
                  borderColor: isDark
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.08)",
                  borderWidth: 1,
                },
              ]}
            >
              {content}
            </BlurView>
          ) : (
            content
          )}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ─── REUSABLE SUMMARY CARD ──────────────────────────────────────────────────
const SummaryCard = memo(function SummaryCard({
  summary,
  theme,
  isDark,
  t,
  index,
  onMarkPaid,
  onDeletePayment,
}: SummaryCardProps) {
  const [showPayments, setShowPayments] = useState(false);
  const isPaid = summary.balance <= 0;

  const emerald = "#10B981";
  const amber = "#F59E0B";
  const red = "#EF4444";

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      style={[
        styles.summaryCard,
        {
          backgroundColor: isDark
            ? "rgba(30, 41, 59, 0.45)"
            : "rgba(255, 255, 255, 0.9)",
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.06)"
            : "rgba(0, 0, 0, 0.05)",
          borderWidth: 1,
        },
      ]}
    >
      {/* Header Info */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, marginRight: Spacing.sm }}>
          <ThemedText type="h3" style={{ fontWeight: "700" }}>
            {summary.worker.name}
          </ThemedText>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 4,
            }}
          >
            <View
              style={{
                backgroundColor: "#1E293B",
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 6,
              }}
            >
              <ThemedText
                type="small"
                style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 11 }}
              >
                {t.workers.dailyRate}: {t.common.currency}
                {summary.worker.dailyRate}
              </ThemedText>
            </View>
            {summary.customAmount > 0 && (
              <View
                style={{
                  backgroundColor: "#FF6B3520",
                  borderColor: "#FF6B3540",
                  borderWidth: 1,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 6,
                }}
              >
                <ThemedText
                  type="small"
                  style={{ color: "#FF6B35", fontWeight: "700", fontSize: 11 }}
                >
                  {t.payment.advance}: {t.common.currency}
                  {summary.customAmount}
                </ThemedText>
              </View>
            )}
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <ThemedText
            type="h2"
            style={[
              styles.totalAmount,
              { color: "#10B981", fontWeight: "800" },
            ]}
          >
            {t.common.currency} {summary.totalAmount.toFixed(0)}
          </ThemedText>

          {isPaid ? (
            <View
              style={[
                styles.paidBadge,
                {
                  backgroundColor: emerald + "12",
                  borderColor: emerald + "25",
                  borderWidth: 1,
                },
              ]}
            >
              <Feather name="check-circle" size={11} color={emerald} />
              <ThemedText
                type="small"
                style={{
                  color: emerald,
                  fontWeight: "700",
                  marginLeft: 4,
                  fontSize: 10,
                }}
              >
                {t.payment.paid}
              </ThemedText>
            </View>
          ) : summary.totalPaid > 0 ? (
            <View
              style={[
                styles.paidBadge,
                {
                  backgroundColor: amber + "12",
                  borderColor: amber + "25",
                  borderWidth: 1,
                },
              ]}
            >
              <Feather name="clock" size={11} color={amber} />
              <ThemedText
                type="small"
                style={{
                  color: amber,
                  fontWeight: "700",
                  marginLeft: 4,
                  fontSize: 10,
                }}
              >
                {t.payment.due}: {t.common.currency}
                {summary.balance.toFixed(0)}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>

      {/* Attendance Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <View
            style={[
              styles.statPill,
              {
                backgroundColor: emerald + "10",
                borderColor: emerald + "20",
                borderWidth: 1,
              },
            ]}
          >
            <Feather name="check-circle" size={13} color={emerald} />
            <ThemedText
              type="small"
              style={[styles.statValue, { color: emerald }]}
            >
              {summary.presentDays}
            </ThemedText>
          </View>
          <ThemedText
            type="small"
            style={[styles.statLabel, { color: theme.textSecondary }]}
          >
            {t.summary.totalPresent}
          </ThemedText>
        </View>

        <View style={styles.statItem}>
          <View
            style={[
              styles.statPill,
              {
                backgroundColor: amber + "10",
                borderColor: amber + "20",
                borderWidth: 1,
              },
            ]}
          >
            <Feather name="clock" size={13} color={amber} />
            <ThemedText
              type="small"
              style={[styles.statValue, { color: amber }]}
            >
              {summary.halfDays}
            </ThemedText>
          </View>
          <ThemedText
            type="small"
            style={[styles.statLabel, { color: theme.textSecondary }]}
          >
            {t.summary.totalHalfDays}
          </ThemedText>
        </View>

        <View style={styles.statItem}>
          <View
            style={[
              styles.statPill,
              {
                backgroundColor: red + "10",
                borderColor: red + "20",
                borderWidth: 1,
              },
            ]}
          >
            <Feather name="x-circle" size={13} color={red} />
            <ThemedText type="small" style={[styles.statValue, { color: red }]}>
              {summary.absentDays}
            </ThemedText>
          </View>
          <ThemedText
            type="small"
            style={[styles.statLabel, { color: theme.textSecondary }]}
          >
            {t.summary.totalAbsent}
          </ThemedText>
        </View>

        {summary.customDays > 0 && (
          <View style={styles.statItem}>
            <View
              style={[
                styles.statPill,
                {
                  backgroundColor: "#3B82F612",
                  borderColor: "#3B82F625",
                  borderWidth: 1,
                },
              ]}
            >
              <Feather name="dollar-sign" size={12} color="#3B82F6" />
              <ThemedText
                type="small"
                style={[styles.statValue, { color: "#3B82F6" }]}
              >
                {summary.customDays}
              </ThemedText>
            </View>
            <ThemedText
              type="small"
              style={[styles.statLabel, { color: theme.textSecondary }]}
            >
              {t.payment.advance}
            </ThemedText>
          </View>
        )}

        {summary.overtimeDays > 0 && (
          <View style={styles.statItem}>
            <View
              style={[
                styles.statPill,
                {
                  backgroundColor: "#3B82F612",
                  borderColor: "#3B82F625",
                  borderWidth: 1,
                },
              ]}
            >
              <Feather name="clock" size={13} color="#3B82F6" />
              <ThemedText
                type="small"
                style={[styles.statValue, { color: "#3B82F6" }]}
              >
                {summary.overtimeDays}
              </ThemedText>
            </View>
            <ThemedText
              type="small"
              style={[styles.statLabel, { color: theme.textSecondary }]}
            >
              Overtime
            </ThemedText>
          </View>
        )}
      </View>

      {/* Payment Summary Trigger (Chevron is always shown) */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowPayments(!showPayments);
        }}
        style={[styles.paymentSummaryRow, { borderColor: theme.border }]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={[
              styles.smallPill,
              {
                backgroundColor: theme.primary + "12",
                borderColor: theme.primary + "20",
                borderWidth: 1,
              },
            ]}
          >
            <Feather name="dollar-sign" size={10} color={theme.primary} />
          </View>
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, fontWeight: "600" }}
          >
            {t.payment.paid}: {t.common.currency} {summary.totalPaid.toFixed(0)}
          </ThemedText>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, fontSize: 11 }}
          >
            {showPayments
              ? t.common.hideDetails || "Hide"
              : t.common.showDetails || "Details"}
          </ThemedText>
          <Feather
            name={showPayments ? "chevron-up" : "chevron-down"}
            size={14}
            color={theme.textSecondary}
          />
        </View>
      </Pressable>

      {/* Expanded Section */}
      {showPayments && (
        <View style={styles.expandedContainer}>
          {/* 1. Payment Summary Grid */}
          <View
            style={[
              styles.expandedSummaryGrid,
              {
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.02)"
                  : "rgba(0, 0, 0, 0.01)",
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.expandedSummaryCell}>
              <ThemedText
                type="small"
                style={[
                  styles.expandedSummaryLabel,
                  { color: theme.textSecondary },
                ]}
              >
                Total Salary
              </ThemedText>
              <ThemedText
                type="body"
                style={[styles.expandedSummaryVal, { color: theme.text }]}
              >
                {t.common.currency} {summary.totalAmount.toFixed(0)}
              </ThemedText>
            </View>
            <View style={styles.expandedSummaryCell}>
              <ThemedText
                type="small"
                style={[
                  styles.expandedSummaryLabel,
                  { color: theme.textSecondary },
                ]}
              >
                Total Paid
              </ThemedText>
              <ThemedText
                type="body"
                style={[styles.expandedSummaryVal, { color: emerald }]}
              >
                {t.common.currency} {summary.totalPaid.toFixed(0)}
              </ThemedText>
            </View>
            <View style={styles.expandedSummaryCell}>
              <ThemedText
                type="small"
                style={[
                  styles.expandedSummaryLabel,
                  { color: theme.textSecondary },
                ]}
              >
                Remaining Due
              </ThemedText>
              <ThemedText
                type="body"
                style={[
                  styles.expandedSummaryVal,
                  { color: summary.balance > 0 ? red : emerald },
                ]}
              >
                {t.common.currency} {summary.balance.toFixed(0)}
              </ThemedText>
            </View>
            <View style={styles.expandedSummaryCell}>
              <ThemedText
                type="small"
                style={[
                  styles.expandedSummaryLabel,
                  { color: theme.textSecondary },
                ]}
              >
                Payments
              </ThemedText>
              <ThemedText
                type="body"
                style={[styles.expandedSummaryVal, { color: theme.text }]}
              >
                {summary.payments.length}{" "}
                {summary.payments.length === 1 ? "Payment" : "Payments"}
              </ThemedText>
            </View>
          </View>

          {/* 2. Chronological Timeline List */}
          {summary.payments.length > 0 ? (
            <View style={styles.timelineList}>
              {[...summary.payments]
                .sort((a, b) => b.paidAt - a.paidAt)
                .map((payment, pIdx, arr) => {
                  const payDate = new Date(payment.paidAt);
                  const dateStr = payDate.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });
                  const timeStr = payDate.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  });
                  return (
                    <View key={payment.id} style={styles.timelineRow}>
                      {/* Left vertical timeline line & dot */}
                      <View style={styles.timelineLeftColumn}>
                        <View
                          style={[
                            styles.timelineNodeDot,
                            { backgroundColor: theme.primary },
                          ]}
                        />
                        {pIdx < arr.length - 1 && (
                          <View
                            style={[
                              styles.timelineVerticalLine,
                              { backgroundColor: theme.border },
                            ]}
                          />
                        )}
                      </View>

                      {/* Right timeline details card */}
                      <View
                        style={[
                          styles.timelineBodyCard,
                          {
                            backgroundColor: isDark
                              ? "rgba(255, 255, 255, 0.03)"
                              : "rgba(0, 0, 0, 0.02)",
                            borderColor: theme.border,
                          },
                        ]}
                      >
                        <View style={styles.timelineBodyHeader}>
                          <View>
                            <ThemedText
                              type="body"
                              style={{ fontWeight: "700", fontSize: 13 }}
                            >
                              {dateStr}
                            </ThemedText>
                            <ThemedText
                              type="small"
                              style={{
                                color: theme.textSecondary,
                                fontSize: 11,
                                marginTop: 1,
                              }}
                            >
                              {timeStr}
                            </ThemedText>
                          </View>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <View
                              style={[
                                styles.timelinePayBadge,
                                { backgroundColor: emerald + "15" },
                              ]}
                            >
                              <ThemedText
                                type="small"
                                style={{ color: emerald, fontWeight: "700" }}
                              >
                                {t.common.currency} {payment.amount.toFixed(0)}
                              </ThemedText>
                            </View>
                            <Pressable
                              onPress={() => {
                                Haptics.impactAsync(
                                  Haptics.ImpactFeedbackStyle.Medium,
                                );
                                onDeletePayment(payment.id);
                              }}
                              style={styles.timelineDeleteBtn}
                            >
                              <Feather
                                name="trash-2"
                                size={13}
                                color={theme.error}
                              />
                            </Pressable>
                          </View>
                        </View>
                        <View style={styles.timelineBodyDetails}>
                          <ThemedText
                            type="small"
                            style={{ color: theme.textSecondary, fontSize: 11 }}
                          >
                            Method:{" "}
                            <ThemedText
                              type="small"
                              style={{
                                fontWeight: "600",
                                color: theme.text,
                                fontSize: 11,
                              }}
                            >
                              {payment.method || "Cash"}
                            </ThemedText>
                          </ThemedText>
                          <ThemedText
                            type="small"
                            style={{ color: theme.textSecondary, fontSize: 11 }}
                          >
                            Paid by:{" "}
                            <ThemedText
                              type="small"
                              style={{
                                fontWeight: "600",
                                color: theme.text,
                                fontSize: 11,
                              }}
                            >
                              {payment.paidByName || "Admin"}
                            </ThemedText>
                          </ThemedText>
                        </View>
                        {payment.note ? (
                          <View
                            style={[
                              styles.timelineNoteBox,
                              { borderLeftColor: theme.primary },
                            ]}
                          >
                            <ThemedText
                              type="small"
                              style={{
                                color: theme.textSecondary,
                                fontSize: 11,
                                fontStyle: "italic",
                              }}
                            >
                              "{payment.note}"
                            </ThemedText>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
            </View>
          ) : (
            <View style={{ alignItems: "center", paddingVertical: Spacing.lg }}>
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, fontStyle: "italic" }}
              >
                No payment history available.
              </ThemedText>
            </View>
          )}

          {/* 3. Mark Paid Trigger (within Expanded view) */}
          {!isPaid && (
            <Pressable
              onPress={() => onMarkPaid(summary)}
              style={styles.payBtnContainerExpanded}
            >
              <LinearGradient
                colors={[theme.primary, "#FF8C35"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.markPaidBtnExpanded}
              >
                <Feather name="plus-circle" size={15} color="#FFFFFF" />
                <ThemedText
                  type="small"
                  style={{
                    color: "#FFFFFF",
                    fontWeight: "800",
                    marginLeft: Spacing.xs,
                  }}
                >
                  {t.payment.markPaid}
                </ThemedText>
              </LinearGradient>
            </Pressable>
          )}
        </View>
      )}
    </Animated.View>
  );
});

// ─── MAIN SCREEN COMPONENT ───────────────────────────────────────────────────
export default function SummaryScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = insets.bottom + 60;

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [summaries, setSummaries] = useState<WorkerSummary[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [grandTotal, setGrandTotal] = useState(0);
  const [grandTotalPaid, setGrandTotalPaid] = useState(0);
  const [grandTotalAdvance, setGrandTotalAdvance] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentWorker, setPaymentWorker] = useState<WorkerSummary | null>(
    null,
  );
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "Cash" | "UPI" | "Bank Transfer"
  >("Cash");
  const [paymentNote, setPaymentNote] = useState("");

  const monthNames = [
    t.months.january,
    t.months.february,
    t.months.march,
    t.months.april,
    t.months.may,
    t.months.june,
    t.months.july,
    t.months.august,
    t.months.september,
    t.months.october,
    t.months.november,
    t.months.december,
  ];

  useFocusEffect(
    useCallback(() => {
      loadSummaries();
      appContextTracker.setContext({
        currentScreen: "Summary",
        selectedMonth: selectedMonth,
        selectedYear: selectedYear,
      });
    }, [selectedMonth, selectedYear]),
  );

  useEffect(() => {
    appContextTracker.registerCallback(
      "exportPDF",
      (type: "attendance" | "summary") => {
        handleExportPDF(type || "summary");
      },
    );
    const sub = DeviceEventEmitter.addListener("refreshData", () => {
      loadSummaries();
    });
    return () => {
      appContextTracker.unregisterCallback("exportPDF");
      sub.remove();
    };
  }, [selectedMonth, selectedYear, summaries]);

  const loadSummaries = async () => {
    setIsLoading(true);
    try {
      const loadedWorkers = await storage.getWorkers();
      const loadedAttendance = await storage.getAttendanceForMonth(
        selectedYear,
        selectedMonth,
      );
      const loadedPayments = await storage.getPaymentsForMonth(
        selectedYear,
        selectedMonth,
      );

      setWorkers(loadedWorkers);
      setAttendance(loadedAttendance);

      const workerSummaries: WorkerSummary[] = loadedWorkers.map((worker) => {
        const summary = calculateWorkerSummary(
          worker.id,
          loadedAttendance,
          worker.dailyRate,
        );
        const workerPayments = loadedPayments.filter(
          (p) => p.workerId === worker.id,
        );
        const totalPaid = workerPayments.reduce((sum, p) => sum + p.amount, 0);
        return {
          worker,
          ...summary,
          totalPaid,
          balance: Math.max(
            0,
            summary.totalAmount - totalPaid - summary.customAmount,
          ),
          payments: workerPayments,
        };
      });

      setSummaries(workerSummaries);
      setGrandTotal(workerSummaries.reduce((sum, s) => sum + s.totalAmount, 0));
      setGrandTotalPaid(
        workerSummaries.reduce((sum, s) => sum + s.totalPaid, 0),
      );
      setGrandTotalAdvance(
        workerSummaries.reduce((sum, s) => sum + s.customAmount, 0),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkPaid = (summary: WorkerSummary) => {
    setPaymentWorker(summary);
    setPaymentAmount(summary.balance.toFixed(0));
    setPaymentMethod("Cash");
    setPaymentNote("");
    setShowPaymentModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleAddPayment = async () => {
    if (!paymentWorker) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t.common.error, t.attendance.invalidAmount);
      return;
    }

    const payment: PaymentRecord = {
      id: generateId(),
      workerId: paymentWorker.worker.id,
      year: selectedYear,
      month: selectedMonth,
      amount,
      paidAt: Date.now(),
      method: paymentMethod,
      note: paymentNote.trim() || undefined,
    };

    await storage.addPayment(payment);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowPaymentModal(false);
    setPaymentAmount("");
    setPaymentMethod("Cash");
    setPaymentNote("");
    setPaymentWorker(null);
    loadSummaries();
  };

  const handleDeletePayment = async (paymentId: string) => {
    Alert.alert(t.payment.deletePayment, t.payment.deletePaymentConfirm, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.common.delete,
        style: "destructive",
        onPress: async () => {
          await storage.deletePayment(paymentId);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          loadSummaries();
        },
      },
    ]);
  };

  const getExportData = () => ({
    workers,
    attendance,
    year: selectedYear,
    month: selectedMonth,
    monthName: monthNames[selectedMonth],
    currency: t.common.currency,
    translations: t,
  });

  const handleExportPDF = async (type: "attendance" | "summary") => {
    if (workers.length === 0) {
      Alert.alert(t.common.error, t.export.noDataToExport);
      return;
    }
    setIsExporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const filename = `${t.app.name}_${type}_${monthNames[selectedMonth]}_${selectedYear}.pdf`;
      const endpoint =
        type === "attendance" ? "attendance-pdf" : "payment-summary";
      const url = `${API_URL}/export/${endpoint}?year=${selectedYear}&month=${selectedMonth}`;

      const success = await downloadAndSharePDF(url, filename);
      if (success) Alert.alert(t.common.success, t.export.success);
    } catch (error: any) {
      Alert.alert(t.common.error, error.message || t.export.error);
    } finally {
      setIsExporting(false);
      setShowExportModal(false);
    }
  };

  const handleExportCSV = async () => {
    if (workers.length === 0) {
      Alert.alert(t.common.error, t.export.noDataToExport);
      return;
    }
    setIsExporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const filename = `${t.app.name}_${monthNames[selectedMonth]}_${selectedYear}.csv`;
      const url = `${API_URL}/export/csv?year=${selectedYear}&month=${selectedMonth}`;

      const success = await downloadAndShareCSV(url, filename);
      if (success) Alert.alert(t.common.success, t.export.success);
    } catch (error: any) {
      Alert.alert(t.common.error, error.message || t.export.error);
    } finally {
      setIsExporting(false);
      setShowExportModal(false);
    }
  };

  const handlePrint = async () => {
    if (workers.length === 0) {
      Alert.alert(t.common.error, t.export.noDataToExport);
      return;
    }
    setIsExporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const url = `${API_URL}/export/print?year=${selectedYear}&month=${selectedMonth}`;
      await fetchAndPrintHTML(url);
    } catch (error: any) {
      Alert.alert(t.common.error, error.message || t.export.error);
    } finally {
      setIsExporting(false);
      setShowExportModal(false);
    }
  };

  const renderSummary = ({
    item,
    index,
  }: {
    item: WorkerSummary;
    index: number;
  }) => (
    <SummaryCard
      summary={item}
      theme={theme}
      isDark={isDark}
      t={t}
      index={index}
      onMarkPaid={handleMarkPaid}
      onDeletePayment={handleDeletePayment}
    />
  );

  const renderHeader = () => {
    const grandBalance = grandTotal - grandTotalPaid - grandTotalAdvance;
    return (
      <View style={styles.headerContent}>
        {/* Floating Month & Export Controls */}
        <View style={styles.topRow}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowMonthPicker(true);
            }}
            style={[
              styles.monthSelector,
              {
                backgroundColor: isDark
                  ? "rgba(30, 41, 59, 0.45)"
                  : "rgba(255, 255, 255, 0.9)",
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.06)"
                  : "rgba(0, 0, 0, 0.05)",
                borderWidth: 1,
              },
            ]}
          >
            <Feather name="calendar" size={16} color={theme.primary} />
            <ThemedText type="h4" style={{ fontWeight: "700" }}>
              {monthNames[selectedMonth]} {selectedYear}
            </ThemedText>
            <Feather
              name="chevron-down"
              size={16}
              color={theme.textSecondary}
            />
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowExportModal(true);
            }}
            style={styles.exportBtnWrap}
          >
            <LinearGradient
              colors={[theme.primary, "#FF8C35"]}
              style={styles.exportButton}
            >
              <Feather name="share" size={18} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </View>

        {/* Grand Total glowing Wallet Card */}
        <Animated.View
          entering={FadeIn.duration(450)}
          style={styles.grandCardWrap}
        >
          <LinearGradient
            colors={isDark ? ["#4F46E5", "#312E81"] : ["#1E3A5F", "#0A122C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.grandTotalCard}
          >
            {/* Glass decor balls */}
            <View style={styles.cardBubble1} />
            <View style={styles.cardBubble2} />

            <ThemedText style={styles.grandTotalLabel}>
              {t.summary.totalAmount}
            </ThemedText>
            <ThemedText style={styles.grandTotalValue}>
              {t.common.currency}{" "}
              {grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </ThemedText>

            {grandTotalPaid > 0 && (
              <View style={styles.grandTotalMeta}>
                <View style={styles.grandTotalMetaItem}>
                  <ThemedText style={styles.grandTotalMetaLabel}>
                    {t.payment.paid}
                  </ThemedText>
                  <ThemedText style={styles.grandTotalMetaValue}>
                    {t.common.currency}{" "}
                    {grandTotalPaid.toLocaleString("en-IN", {
                      maximumFractionDigits: 0,
                    })}
                  </ThemedText>
                </View>
                <View style={styles.grandTotalDivider} />
                <View style={styles.grandTotalMetaItem}>
                  <ThemedText style={styles.grandTotalMetaLabel}>
                    {t.payment.due}
                  </ThemedText>
                  <ThemedText
                    style={[styles.grandTotalMetaValue, { color: "#F43F5E" }]}
                  >
                    {t.common.currency}{" "}
                    {Math.max(0, grandBalance).toLocaleString("en-IN", {
                      maximumFractionDigits: 0,
                    })}
                  </ThemedText>
                </View>
              </View>
            )}
          </LinearGradient>
        </Animated.View>
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={[styles.emptyContainer, { paddingTop: Spacing["4xl"] }]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Feather
          name="bar-chart-2"
          size={64}
          color={theme.textSecondary}
          style={styles.emptyIcon}
        />
        <ThemedText type="h3" style={styles.emptyTitle}>
          {t.summary.noData}
        </ThemedText>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={summaries}
        renderItem={renderSummary}
        keyExtractor={(item) => item.worker.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadSummaries}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* ── SELECT MONTH DIALOG ── */}
      <GlassModal
        visible={showMonthPicker}
        onClose={() => setShowMonthPicker(false)}
        title="Select Month"
        theme={theme}
        isDark={isDark}
      >
        <View style={styles.yearSelector}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedYear(selectedYear - 1);
            }}
            style={styles.yearArrow}
          >
            <Feather name="chevron-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h3" style={{ fontWeight: "700" }}>
            {selectedYear}
          </ThemedText>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedYear(selectedYear + 1);
            }}
            style={styles.yearArrow}
          >
            <Feather name="chevron-right" size={24} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.monthGrid}>
          {monthNames.map((month, index) => (
            <Pressable
              key={index}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedMonth(index);
                setShowMonthPicker(false);
              }}
              style={[
                styles.monthItem,
                {
                  backgroundColor:
                    selectedMonth === index ? theme.primary : "transparent",
                },
              ]}
            >
              <ThemedText
                type="small"
                style={{
                  color: selectedMonth === index ? "#FFFFFF" : theme.text,
                  fontWeight: selectedMonth === index ? "700" : "500",
                }}
              >
                {month.substring(0, 3)}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </GlassModal>

      {/* ── PAYMENT REGISTRATION DIALOG ── */}
      <GlassModal
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title={t.payment.addPayment}
        theme={theme}
        isDark={isDark}
      >
        {paymentWorker ? (
          <ThemedText
            type="body"
            style={{
              color: theme.textSecondary,
              textAlign: "center",
              marginBottom: Spacing.lg,
              fontSize: 14,
            }}
          >
            {paymentWorker.worker.name} — {t.payment.balance}:{" "}
            {t.common.currency} {paymentWorker.balance.toFixed(0)}
          </ThemedText>
        ) : null}

        <View
          style={[
            styles.paymentInputRow,
            {
              borderColor: theme.border,
              backgroundColor: theme.backgroundSecondary,
            },
          ]}
        >
          <ThemedText
            type="h3"
            style={{ color: theme.textSecondary, fontWeight: "700" }}
          >
            {t.common.currency}
          </ThemedText>
          <TextInput
            style={[styles.paymentInput, { color: theme.text }]}
            value={paymentAmount}
            onChangeText={setPaymentAmount}
            keyboardType="numeric"
            placeholder={t.payment.enterAmount}
            placeholderTextColor={theme.textSecondary}
            autoFocus
          />
        </View>

        {paymentWorker && paymentWorker.balance > 0 && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setPaymentAmount(paymentWorker.balance.toFixed(0));
            }}
            style={[
              styles.fullAmountBtn,
              { borderColor: theme.primary + "40" },
            ]}
          >
            <ThemedText
              type="small"
              style={{ color: theme.primary, fontWeight: "700" }}
            >
              {t.payment.fullAmount}: {t.common.currency}{" "}
              {paymentWorker.balance.toFixed(0)}
            </ThemedText>
          </Pressable>
        )}

        {/* Payment Method Selector */}
        <ThemedText
          type="small"
          style={{
            color: theme.textSecondary,
            fontWeight: "700",
            marginBottom: 6,
          }}
        >
          Payment Method
        </ThemedText>
        <View style={styles.methodSelectorRow}>
          {(["Cash", "UPI", "Bank Transfer"] as const).map((method) => {
            const isSelected = paymentMethod === method;
            return (
              <Pressable
                key={method}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPaymentMethod(method);
                }}
                style={[
                  styles.methodItemBtn,
                  {
                    backgroundColor: isSelected
                      ? theme.primary
                      : isDark
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.03)",
                    borderColor: isSelected ? theme.primary : theme.border,
                  },
                ]}
              >
                <ThemedText
                  type="small"
                  style={{
                    color: isSelected ? "#FFFFFF" : theme.text,
                    fontWeight: "700",
                    fontSize: 11,
                  }}
                >
                  {method}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* Optional Notes */}
        <ThemedText
          type="small"
          style={{
            color: theme.textSecondary,
            fontWeight: "700",
            marginBottom: 6,
          }}
        >
          Notes (Optional)
        </ThemedText>
        <View
          style={[
            styles.noteInputWrapper,
            {
              borderColor: theme.border,
              backgroundColor: theme.backgroundSecondary,
            },
          ]}
        >
          <TextInput
            style={[styles.noteInput, { color: theme.text }]}
            value={paymentNote}
            onChangeText={setPaymentNote}
            placeholder="e.g. Advance, final settlement"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        <View style={styles.paymentModalActions}>
          <Pressable
            onPress={() => setShowPaymentModal(false)}
            style={[styles.paymentCancelBtn, { borderColor: theme.border }]}
          >
            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, fontWeight: "600" }}
            >
              {t.common.cancel}
            </ThemedText>
          </Pressable>
          <Pressable onPress={handleAddPayment} style={{ flex: 1 }}>
            <LinearGradient
              colors={[theme.primary, "#FF8C35"]}
              style={styles.paymentSaveBtn}
            >
              <ThemedText
                type="body"
                style={{ color: "#FFFFFF", fontWeight: "700" }}
              >
                {t.common.save}
              </ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      </GlassModal>

      {/* ── EXPORT OPTIONS DIALOG ── */}
      <GlassModal
        visible={showExportModal}
        onClose={() => !isExporting && setShowExportModal(false)}
        title={t.export.title}
        theme={theme}
        isDark={isDark}
      >
        {isExporting ? (
          <View style={styles.exportingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText type="body" style={styles.exportingText}>
              {t.export.generating}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.exportOptions}>
            <Pressable
              onPress={() => handleExportPDF("attendance")}
              style={[
                styles.exportOption,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <View
                style={[
                  styles.exportIconContainer,
                  {
                    backgroundColor: theme.error + "12",
                    borderColor: theme.error + "25",
                    borderWidth: 1,
                  },
                ]}
              >
                <Feather name="file-text" size={20} color={theme.error} />
              </View>
              <View style={styles.exportOptionText}>
                <ThemedText type="h4" style={{ fontWeight: "600" }}>
                  {t.export.attendanceReport}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: 2 }}
                >
                  {t.export.pdf}
                </ThemedText>
              </View>
              <Feather
                name="chevron-right"
                size={16}
                color={theme.textSecondary}
              />
            </Pressable>

            <Pressable
              onPress={() => handleExportPDF("summary")}
              style={[
                styles.exportOption,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <View
                style={[
                  styles.exportIconContainer,
                  {
                    backgroundColor: theme.primary + "12",
                    borderColor: theme.primary + "25",
                    borderWidth: 1,
                  },
                ]}
              >
                <Feather name="bar-chart-2" size={20} color={theme.primary} />
              </View>
              <View style={styles.exportOptionText}>
                <ThemedText type="h4" style={{ fontWeight: "600" }}>
                  {t.export.summaryReport}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: 2 }}
                >
                  {t.export.pdf}
                </ThemedText>
              </View>
              <Feather
                name="chevron-right"
                size={16}
                color={theme.textSecondary}
              />
            </Pressable>

            <Pressable
              onPress={handleExportCSV}
              style={[
                styles.exportOption,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <View
                style={[
                  styles.exportIconContainer,
                  {
                    backgroundColor: "#10B98112",
                    borderColor: "#10B98125",
                    borderWidth: 1,
                  },
                ]}
              >
                <Feather name="file" size={20} color="#10B981" />
              </View>
              <View style={styles.exportOptionText}>
                <ThemedText type="h4" style={{ fontWeight: "600" }}>
                  {t.export.csv}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: 2 }}
                >
                  {t.export.spreadsheet}
                </ThemedText>
              </View>
              <Feather
                name="chevron-right"
                size={16}
                color={theme.textSecondary}
              />
            </Pressable>

            <Pressable
              onPress={handlePrint}
              style={[
                styles.exportOption,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <View
                style={[
                  styles.exportIconContainer,
                  {
                    backgroundColor: theme.info + "12",
                    borderColor: theme.info + "25",
                    borderWidth: 1,
                  },
                ]}
              >
                <Feather name="printer" size={20} color={theme.info} />
              </View>
              <View style={styles.exportOptionText}>
                <ThemedText type="h4" style={{ fontWeight: "600" }}>
                  {t.export.print}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: 2 }}
                >
                  {t.export.attendanceReport}
                </ThemedText>
              </View>
              <Feather
                name="chevron-right"
                size={16}
                color={theme.textSecondary}
              />
            </Pressable>
          </View>
        )}
      </GlassModal>
    </ThemedView>
  );
}

const CARD_RADIUS = 20;

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.lg },
  headerContent: { marginBottom: Spacing.lg },
  topRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg },
  monthSelector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 14,
    gap: Spacing.xs,
    height: 46,
  },
  exportBtnWrap: { borderRadius: 14, overflow: "hidden" },
  exportButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },

  // ─ Grand Total Card ────────────────
  grandCardWrap: {
    borderRadius: CARD_RADIUS + 4,
    overflow: "hidden",
  },
  grandTotalCard: {
    padding: Spacing.xl,
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  cardBubble1: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: -50,
    right: -30,
  },
  cardBubble2: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(0,0,0,0.08)",
    bottom: -30,
    left: 20,
  },
  grandTotalLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13.5,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  grandTotalValue: { color: "#FFFFFF", fontSize: 34, fontWeight: "800" },
  grandTotalMeta: {
    flexDirection: "row",
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.18)",
    width: "100%",
    justifyContent: "space-around",
    alignItems: "center",
  },
  grandTotalMetaItem: { alignItems: "center" },
  grandTotalMetaLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  grandTotalMetaValue: { color: "#FFFFFF", fontWeight: "800", fontSize: 17 },
  grandTotalDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
  },

  // ─ Summary Card ───────────────────
  summaryCard: {
    borderRadius: CARD_RADIUS,
    padding: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  totalAmount: { fontSize: 22 },
  paidBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 6,
  },

  // ─ Attendance Stats Grid ──────────
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  statItem: { alignItems: "center", flex: 1 },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: Spacing.xs,
    width: "90%",
  },
  statValue: { fontWeight: "700", fontSize: 13 },
  statLabel: { fontSize: 10, fontWeight: "500" },

  // ─ Payment Details ────────────────
  paymentSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.xs,
  },
  smallPill: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: 10,
    marginTop: 6,
  },
  deletePaymentBtn: {
    padding: 4,
  },

  // ─ Pay Button ─────────────────────
  payBtnContainer: {
    marginTop: Spacing.md,
    borderRadius: 12,
    overflow: "hidden",
  },
  markPaidBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: Spacing.xs,
  },
  separator: { height: Spacing.sm },

  // ─ Empty States ───────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: Spacing["5xl"],
  },
  emptyIcon: { marginBottom: Spacing.lg, opacity: 0.5 },
  emptyTitle: { textAlign: "center" },

  // ─── Modal Sheet Styles ────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "90%",
    maxWidth: 350,
    borderRadius: 24,
    overflow: "hidden",
  },
  modalBlur: {
    borderRadius: 24,
  },
  modalContentCard: {
    padding: Spacing.xl,
  },
  modalTitleText: {
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.lg,
  },

  // ─ Month picker ───────────────────
  yearSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  yearArrow: { padding: Spacing.sm },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  monthItem: {
    width: "30%",
    paddingVertical: Spacing.md,
    alignItems: "center",
    borderRadius: 10,
    marginBottom: Spacing.sm,
  },

  // ─ Payment Modal ──────────────────
  paymentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.lg,
    height: 60,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  paymentInput: { flex: 1, fontSize: 24, fontWeight: "800" },
  fullAmountBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  paymentModalActions: { flexDirection: "row", gap: Spacing.md },
  paymentCancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  paymentSaveBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },

  // ─ Export Modal ───────────────────
  exportOptions: { gap: Spacing.sm },
  exportOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: 14,
  },
  exportIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  exportOptionText: { flex: 1 },
  exportingContainer: { alignItems: "center", paddingVertical: Spacing["3xl"] },
  exportingText: { marginTop: Spacing.lg },

  // ─── Payment Timeline & Expanded Card Styles ───
  expandedContainer: {
    marginTop: Spacing.sm,
    paddingHorizontal: 4,
  },
  expandedSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  expandedSummaryCell: {
    flex: 1,
    minWidth: "40%",
    paddingVertical: 4,
  },
  expandedSummaryLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  expandedSummaryVal: {
    fontSize: 14,
    fontWeight: "800",
  },
  timelineList: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  timelineRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  timelineLeftColumn: {
    alignItems: "center",
    width: 20,
    marginRight: 8,
    position: "relative",
  },
  timelineNodeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 14,
  },
  timelineVerticalLine: {
    position: "absolute",
    top: 22,
    bottom: -12,
    width: 2,
    left: 9,
  },
  timelineBodyCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.md,
  },
  timelineBodyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  timelinePayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  timelineDeleteBtn: {
    padding: 4,
  },
  timelineBodyDetails: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    opacity: 0.85,
  },
  timelineNoteBox: {
    borderLeftWidth: 2.5,
    paddingLeft: 8,
    marginTop: 8,
    paddingVertical: 2,
  },
  payBtnContainerExpanded: {
    marginTop: Spacing.sm,
    borderRadius: 12,
    overflow: "hidden",
  },
  markPaidBtnExpanded: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    gap: Spacing.xs,
  },
  methodSelectorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: Spacing.md,
  },
  methodItemBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  noteInputWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    height: 44,
    marginBottom: Spacing.lg,
    justifyContent: "center",
  },
  noteInput: {
    fontSize: 14,
    flex: 1,
  },
});
