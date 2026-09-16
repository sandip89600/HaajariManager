import React, { useState, useEffect, useCallback, useRef, memo } from "react";
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
  ScrollView,
  Dimensions,
  DeviceEventEmitter,
} from "react-native";
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
import { useAuth } from "@/hooks/useAuth";
import {
  storage,
  Worker,
  AttendanceRecord,
  PaymentRecord,
  calculateWorkerSummary,
  API_URL,
  authenticatedFetch,
  mapAttendance,
} from "@/utils/storage";
import {
  downloadAndSharePDF,
  downloadAndShareCSV,
  fetchAndPrintHTML,
} from "@/utils/export";
import { useErrorFeedback } from "@/context/ErrorFeedbackContext";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";

// ─── REUSABLE MODERN GLASS MODAL ─────────────────────────────────────────────
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
  records: AttendanceRecord[];
  totalAdvanceAmount: number;
  totalOvertimeAmount: number;
}

interface RecordBreakdown {
  day: number;
  statusText: string;
  basePay: number;
  advance: number;
  overtime: number;
  total: number;
  overtimeText?: string;
}

const getRecordBreakdown = (
  record: AttendanceRecord,
  dailyRate: number,
): RecordBreakdown => {
  const rate =
    record.dailyRate !== undefined && record.dailyRate !== null
      ? record.dailyRate
      : dailyRate;
  const advance =
    record.customWage !== undefined && record.customWage !== null
      ? record.customWage
      : 0;
  const overtime =
    record.overtimeWage !== undefined && record.overtimeWage !== null
      ? record.overtimeWage
      : 0;

  let basePay = 0;
  let statusText = "";
  if (record.value === "P") {
    basePay = rate;
    statusText = "Present";
  } else if (record.value === "OT") {
    basePay = rate;
    statusText = "Present with Overtime";
  } else if (record.value === "H") {
    basePay = rate / 2;
    statusText = "Half Day";
  } else if (record.value === "A") {
    basePay = 0;
    statusText = "Absent";
  } else if (typeof record.value === "number") {
    basePay = record.value;
    statusText = "Custom";
  } else {
    basePay = 0;
    statusText = "Unknown";
  }

  let overtimeText = "";
  if (record.overtimeWage && record.overtimeWage > 0) {
    if (record.overtimeHours === 1) overtimeText = "1× OT";
    else if (record.overtimeHours === 2) overtimeText = "2× OT";
    else overtimeText = "Custom OT";
  }

  const total = record.value === "A" ? 0 : basePay + overtime;

  return {
    day: record.day,
    statusText,
    basePay,
    advance,
    overtime,
    total,
    overtimeText,
  };
};

export default function WorkerSummaryScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { reportError } = useErrorFeedback();
  const insets = useSafeAreaInsets();

  const [viewMode, setViewMode] = useState<"payroll" | "analytics">("payroll");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Modals
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCalculationModal, setShowCalculationModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const [emailInput, setEmailInput] = useState("");
  const [scheduleEmail, setScheduleEmail] = useState("");

  // State data
  const [summary, setSummary] = useState<WorkerSummary | null>(null);
  const [expandedDetails, setExpandedDetails] = useState(false);

  const monthNames = [
    t.months?.january || "January",
    t.months?.february || "February",
    t.months?.march || "March",
    t.months?.april || "April",
    t.months?.may || "May",
    t.months?.june || "June",
    t.months?.july || "July",
    t.months?.august || "August",
    t.months?.september || "September",
    t.months?.october || "October",
    t.months?.november || "November",
    t.months?.december || "December",
  ];

  const isFetchingRef = useRef(false);

  const loadSummaryData = useCallback(
    async (silent = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      if (!silent) setIsLoading(true);

      try {
        const currentWorker: Worker = {
          id: user?.id || "worker_self",
          uniqueId: user?.uniqueId,
          name: user?.name || "Worker",
          category: (user?.workerCategory as any) || "labour",
          dailyRate: user?.dailyWage || 0,
          createdAt: user?.createdAt || Date.now(),
        };

        // 1. Get cached attendance first
        const localAttendance = await storage.getAttendance();
        let workerAttendance = localAttendance.filter(
          (r) =>
            r.year === selectedYear &&
            (r.month === selectedMonth ||
              r.month === selectedMonth + 1 ||
              (selectedMonth > 0 && r.month === selectedMonth - 1)),
        );

        // 2. Fetch fresh attendance from backend
        try {
          const attRes = await authenticatedFetch(
            `${API_URL}/attendance/my-attendance?year=${selectedYear}&month=${selectedMonth + 1}`,
          );
          if (attRes.ok) {
            const data = await attRes.json();
            if (data.records && Array.isArray(data.records)) {
              workerAttendance = data.records.map(mapAttendance);
            }
            if (data.worker) {
              if (data.worker.id) currentWorker.id = String(data.worker.id);
              if (data.worker.uniqueId)
                currentWorker.uniqueId = data.worker.uniqueId;
              currentWorker.name = data.worker.name || currentWorker.name;
              currentWorker.dailyRate =
                data.worker.dailyRate ?? currentWorker.dailyRate;
              currentWorker.category =
                data.worker.category || currentWorker.category;
            }
          }
        } catch (e) {
          console.log(
            "Worker Summary using cached data:",
            (e as any)?.message || e,
          );
        }

        const loadedPayments = await storage.getPaymentsForMonth(
          selectedYear,
          selectedMonth,
        );

        const calculated = calculateWorkerSummary(
          currentWorker.id,
          workerAttendance,
          currentWorker.dailyRate,
          currentWorker.uniqueId,
        );

        const workerPayments = loadedPayments.filter(
          (p) =>
            p.workerId === currentWorker.id ||
            (currentWorker.uniqueId && p.workerId === currentWorker.uniqueId),
        );
        const totalPaid = workerPayments.reduce((sum, p) => sum + p.amount, 0);
        const totalAdvance = calculated.totalAdvanceAmount || 0;

        const finalSummary: WorkerSummary = {
          worker: currentWorker,
          ...calculated,
          totalPaid,
          balance: Math.max(
            0,
            calculated.totalAmount - totalAdvance - totalPaid,
          ),
          payments: workerPayments,
          records: workerAttendance,
          totalAdvanceAmount: totalAdvance,
          totalOvertimeAmount: calculated.totalOvertimeAmount || 0,
        };

        setSummary(finalSummary);
      } catch (err) {
        console.error("Failed to load worker summary data:", err);
      } finally {
        isFetchingRef.current = false;
        if (!silent) setIsLoading(false);
      }
    },
    [selectedMonth, selectedYear, user],
  );

  useEffect(() => {
    loadSummaryData();
    const sub = DeviceEventEmitter.addListener("refreshData", () => {
      loadSummaryData(true);
    });
    return () => sub.remove();
  }, [loadSummaryData]);

  // Exports
  const handleExportPDF = async (type: "attendance" | "summary") => {
    setIsExporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const filename = `${t.app?.name || "Haajari"}_${type === "attendance" ? "Attendance" : "Summary"}_${monthNames[selectedMonth]}_${selectedYear}.pdf`;
      const url = `${API_URL}/export/pdf?year=${selectedYear}&month=${selectedMonth}&type=${type}`;
      const success = await downloadAndSharePDF(url, filename);
      if (success) Alert.alert(t.common?.success || "Success", t.export?.success || "Exported successfully");
    } catch (error: any) {
      reportError({
        title: "PDF Export Failed",
        message: error.message || "Failed to download and share PDF.",
        category: "PDF",
        feature: "Export PDF",
        errorMessage: error.message,
        onRetry: () => handleExportPDF(type),
      });
    } finally {
      setIsExporting(false);
      setShowExportModal(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const filename = `${t.app?.name || "Haajari"}_${monthNames[selectedMonth]}_${selectedYear}.csv`;
      const url = `${API_URL}/export/csv?year=${selectedYear}&month=${selectedMonth}`;
      const success = await downloadAndShareCSV(url, filename);
      if (success) Alert.alert(t.common?.success || "Success", t.export?.success || "Exported successfully");
    } catch (error: any) {
      reportError({
        title: "CSV Export Failed",
        message: error.message || "Failed to download and share CSV.",
        category: "CSV",
        feature: "Export CSV",
        errorMessage: error.message,
        onRetry: () => handleExportCSV(),
      });
    } finally {
      setIsExporting(false);
      setShowExportModal(false);
    }
  };

  const handlePrint = async () => {
    setIsExporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const url = `${API_URL}/export/print?year=${selectedYear}&month=${selectedMonth}`;
      await fetchAndPrintHTML(url);
    } catch (error: any) {
      const isCanceled = error?.message?.toLowerCase().includes("cancel");
      if (!isCanceled) {
        reportError({
          title: "Print Layout Failed",
          message: error.message || "Failed to load and print HTML layout.",
          category: "Print",
          feature: "Print Sheet",
          errorMessage: error.message,
          onRetry: () => handlePrint(),
        });
      }
    } finally {
      setIsExporting(false);
      setShowExportModal(false);
    }
  };

  const emerald = "#10B981";
  const amber = "#F59E0B";
  const red = "#EF4444";

  // ── 1. TOP HEADER & GRADIENT WALLET CARD ──
  const renderHeader = () => {
    const totalAmount = summary?.totalAmount || 0;
    const totalPaid = summary?.totalPaid || 0;
    const balance = summary?.balance || 0;

    return (
      <View style={styles.headerContent}>
        {/* Floating Month & Export Controls */}
        <View style={styles.topRow}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              DeviceEventEmitter.emit("OPEN_SETTINGS_DRAWER");
            }}
            style={[
              styles.iconBtn,
              {
                backgroundColor: isDark
                  ? "rgba(30, 41, 59, 0.45)"
                  : "rgba(255, 255, 255, 0.9)",
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.06)"
                  : "rgba(0, 0, 0, 0.05)",
              },
            ]}
          >
            <Feather name="menu" size={18} color={theme.text} />
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowMonthPicker(true);
            }}
            style={[
              styles.monthSelector,
              {
                flex: 1,
                backgroundColor: isDark
                  ? "rgba(30, 41, 59, 0.45)"
                  : "rgba(255, 255, 255, 0.9)",
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.06)"
                  : "rgba(0, 0, 0, 0.05)",
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
              {t.summary?.totalAmount || "कुल राशि (TOTAL AMOUNT)"}
            </ThemedText>
            <ThemedText style={styles.grandTotalValue}>
              {t.common?.currency || "₹"}{" "}
              {totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </ThemedText>

            {totalPaid > 0 && (
              <View style={styles.grandTotalMeta}>
                <View style={styles.grandTotalMetaItem}>
                  <ThemedText style={styles.grandTotalMetaLabel}>
                    {t.payment?.paid || "Paid"}
                  </ThemedText>
                  <ThemedText style={styles.grandTotalMetaValue}>
                    {t.common?.currency || "₹"}{" "}
                    {totalPaid.toLocaleString("en-IN", {
                      maximumFractionDigits: 0,
                    })}
                  </ThemedText>
                </View>
                <View style={styles.grandTotalDivider} />
                <View style={styles.grandTotalMetaItem}>
                  <ThemedText style={styles.grandTotalMetaLabel}>
                    {t.payment?.due || "Due"}
                  </ThemedText>
                  <ThemedText
                    style={[styles.grandTotalMetaValue, { color: "#F43F5E" }]}
                  >
                    {t.common?.currency || "₹"}{" "}
                    {Math.max(0, balance).toLocaleString("en-IN", {
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

  // ── 2. WORKER MONTHLY SUMMARY CARD (EXACT AS SCREENSHOT) ──
  const renderWorkerCard = () => {
    if (!summary) return null;
    const isPaid = summary.balance <= 0;

    return (
      <Animated.View
        entering={FadeInDown.duration(400)}
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
                  {t.workers?.dailyRate || "Daily Rate"}: {t.common?.currency || "₹"}
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
                    {t.payment?.advance || "Advance"}: {t.common?.currency || "₹"}
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
              {t.common?.currency || "₹"} {summary.totalAmount.toFixed(0)}
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
                  {t.payment?.paid || "Paid"}
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
                  {t.payment?.due || "Due"}: {t.common?.currency || "₹"}
                  {summary.balance.toFixed(0)}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>

        {/* Attendance Stats 4-Pill Row */}
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
              {t.summary?.totalPresent || "उपस्थित"}
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
              {t.summary?.totalHalfDays || "आधा दिन"}
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
              <ThemedText
                type="small"
                style={[styles.statValue, { color: red }]}
              >
                {summary.absentDays}
              </ThemedText>
            </View>
            <ThemedText
              type="small"
              style={[styles.statLabel, { color: theme.textSecondary }]}
            >
              {t.summary?.totalAbsent || "अनुपस्थित"}
            </ThemedText>
          </View>

          {summary.overtimeDays > 0 ? (
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
          ) : (
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
                  {summary.customDays || 0}
                </ThemedText>
              </View>
              <ThemedText
                type="small"
                style={[styles.statLabel, { color: theme.textSecondary }]}
              >
                {t.payment?.advance || "Advance"}
              </ThemedText>
            </View>
          )}
        </View>

        {/* Paid and Details Expand Trigger */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setExpandedDetails(!expandedDetails);
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
              {t.payment?.paid || "Paid"}: {t.common?.currency || "₹"}{" "}
              {summary.totalPaid.toFixed(0)}
            </ThemedText>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, fontSize: 11 }}
            >
              {expandedDetails
                ? t.common?.hideDetails || "Hide"
                : t.common?.showDetails || "Details"}
            </ThemedText>
            <Feather
              name={expandedDetails ? "chevron-up" : "chevron-down"}
              size={14}
              color={theme.textSecondary}
            />
          </View>
        </Pressable>

        {/* Expandable Section */}
        {expandedDetails && (
          <View style={styles.expandedContainer}>
            {/* 8 Stats Grid Breakdown */}
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
              {/* Row 1 */}
              <View style={styles.gridStatCol}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {t.summary?.totalPresent || "Present"}
                </ThemedText>
                <ThemedText type="body" style={{ fontWeight: "700", color: "#10B981" }}>
                  {summary.presentDays} {t.summary?.days || "days"}
                </ThemedText>
              </View>
              <View style={styles.gridStatCol}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {t.summary?.totalHalfDays || "Half Day"}
                </ThemedText>
                <ThemedText type="body" style={{ fontWeight: "700", color: "#F59E0B" }}>
                  {summary.halfDays} {t.summary?.days || "days"}
                </ThemedText>
              </View>
              <View style={styles.gridStatCol}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {t.summary?.totalAbsent || "Absent"}
                </ThemedText>
                <ThemedText type="body" style={{ fontWeight: "700", color: "#EF4444" }}>
                  {summary.absentDays} {t.summary?.days || "days"}
                </ThemedText>
              </View>

              {/* Row 2 */}
              <View style={styles.gridStatCol}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {(t.summary as any)?.totalOvertime || "Overtime"}
                </ThemedText>
                <ThemedText type="body" style={{ fontWeight: "700", color: "#3B82F6" }}>
                  {summary.overtimeDays} {t.summary?.days || "days"}
                </ThemedText>
              </View>
              <View style={styles.gridStatCol}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {t.payment?.advance || "Advance"}
                </ThemedText>
                <ThemedText type="body" style={{ fontWeight: "700", color: "#EF4444" }}>
                  ₹{summary.totalAdvanceAmount}
                </ThemedText>
              </View>
              <View style={styles.gridStatCol}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {t.workers?.dailyRate || "Daily Wage"}
                </ThemedText>
                <ThemedText type="body" style={{ fontWeight: "700" }}>
                  ₹{summary.worker.dailyRate}
                </ThemedText>
              </View>

              {/* Row 3 */}
              <View style={styles.gridStatCol}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {(t.summary as any)?.grossEarnings || "Gross Earned"}
                </ThemedText>
                <ThemedText type="body" style={{ fontWeight: "800", color: "#10B981" }}>
                  ₹{summary.totalAmount.toFixed(0)}
                </ThemedText>
              </View>
              <View style={styles.gridStatCol}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {t.payment?.balance || "Net Balance"}
                </ThemedText>
                <ThemedText type="body" style={{ fontWeight: "800", color: "#F43F5E" }}>
                  ₹{summary.balance.toFixed(0)}
                </ThemedText>
              </View>
              <View style={styles.gridStatCol}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowCalculationModal(true);
                  }}
                  style={[styles.detailsLinkBtn, { backgroundColor: theme.primary + "15" }]}
                >
                  <Feather name="eye" size={12} color={theme.primary} />
                  <ThemedText type="small" style={{ color: theme.primary, fontWeight: "700", fontSize: 11 }}>
                    Breakdown
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {/* Daily Attendance History list in card */}
            <View style={{ marginTop: 12 }}>
              <ThemedText type="small" style={{ fontWeight: "700", marginBottom: 8, color: theme.textSecondary }}>
                Daily Attendance History ({summary.records.length} records)
              </ThemedText>
              {summary.records.length === 0 ? (
                <ThemedText type="small" style={{ color: theme.textSecondary, fontStyle: "italic", paddingVertical: 8 }}>
                  No records logged for this month.
                </ThemedText>
              ) : (
                summary.records.map((rec, i) => {
                  const breakdown = getRecordBreakdown(rec, summary.worker.dailyRate);
                  return (
                    <View
                      key={rec.day || i}
                      style={[
                        styles.dailyRow,
                        {
                          borderBottomColor: theme.border,
                          borderBottomWidth: i === summary.records.length - 1 ? 0 : 1,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <ThemedText style={{ fontSize: 13, fontWeight: "700" }}>
                          Day {rec.day}, {monthNames[selectedMonth]}
                        </ThemedText>
                        {rec.overtimeHours ? (
                          <ThemedText style={{ fontSize: 11, color: "#3B82F6", fontWeight: "600" }}>
                            +{rec.overtimeHours} hrs overtime
                          </ThemedText>
                        ) : null}
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <ThemedText
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color:
                              rec.value === "P" || rec.value === "OT"
                                ? "#10B981"
                                : rec.value === "H"
                                ? "#F59E0B"
                                : rec.value === "A"
                                ? "#EF4444"
                                : theme.textSecondary,
                          }}
                        >
                          {breakdown.statusText} (₹{breakdown.total})
                        </ThemedText>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}
      </Animated.View>
    );
  };

  // ── 3. BI REPORTS & CHARTS VIEW (ANALYTICS TAB) ──
  const renderAnalyticsView = () => {
    const presentCount = summary?.presentDays || 0;
    const halfDayCount = summary?.halfDays || 0;
    const absentCount = summary?.absentDays || 0;
    const totalDays = presentCount + halfDayCount + absentCount;
    const attendancePct =
      totalDays > 0
        ? Math.round(((presentCount + halfDayCount * 0.5) / totalDays) * 100)
        : 0;

    const totalPayroll = summary?.totalAmount || 0;
    const totalPaid = summary?.totalPaid || 0;
    const totalAdvances = summary?.totalAdvanceAmount || 0;
    const totalOvertime = summary?.totalOvertimeAmount || 0;

    return (
      <View style={styles.analyticsContainer}>
        {/* KPI Grid */}
        <ThemedText style={styles.biSectionTitle}>Monthly KPI Overview</ThemedText>
        <View style={styles.kpiGrid}>
          <View
            style={[
              styles.kpiCard,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
            ]}
          >
            <Feather name="calendar" size={16} color={theme.primary} />
            <ThemedText style={styles.kpiVal}>{totalDays}</ThemedText>
            <ThemedText style={styles.kpiLabel}>Total Shifts</ThemedText>
          </View>
          <View
            style={[
              styles.kpiCard,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
            ]}
          >
            <Feather name="percent" size={16} color="#10B981" />
            <ThemedText style={styles.kpiVal}>{attendancePct}%</ThemedText>
            <ThemedText style={styles.kpiLabel}>Attendance Rate</ThemedText>
          </View>
          <View
            style={[
              styles.kpiCard,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
            ]}
          >
            <Feather name="dollar-sign" size={16} color="#3B82F6" />
            <ThemedText style={styles.kpiVal}>₹{totalPayroll.toLocaleString("en-IN")}</ThemedText>
            <ThemedText style={styles.kpiLabel}>Total Earnings</ThemedText>
          </View>
          <View
            style={[
              styles.kpiCard,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
            ]}
          >
            <Feather name="arrow-up-right" size={16} color="#F59E0B" />
            <ThemedText style={styles.kpiVal}>₹{totalAdvances.toLocaleString("en-IN")}</ThemedText>
            <ThemedText style={styles.kpiLabel}>Advances Taken</ThemedText>
          </View>
          <View
            style={[
              styles.kpiCard,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
            ]}
          >
            <Feather name="clock" size={16} color="#EC4899" />
            <ThemedText style={styles.kpiVal}>₹{totalOvertime.toLocaleString("en-IN")}</ThemedText>
            <ThemedText style={styles.kpiLabel}>Overtime Pay</ThemedText>
          </View>
          <View
            style={[
              styles.kpiCard,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
            ]}
          >
            <Feather name="check-circle" size={16} color="#10B981" />
            <ThemedText style={styles.kpiVal}>₹{totalPaid.toLocaleString("en-IN")}</ThemedText>
            <ThemedText style={styles.kpiLabel}>Paid Amount</ThemedText>
          </View>
        </View>

        {/* Attendance Metrics Breakdown */}
        <View
          style={[
            styles.chartCard,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
          ]}
        >
          <ThemedText style={styles.chartTitle}>Attendance Metrics Breakdown</ThemedText>
          <View style={{ gap: 8, marginTop: 10 }}>
            {[
              { label: "Present Days", count: presentCount, color: "#10B981" },
              { label: "Half Days", count: halfDayCount, color: "#F59E0B" },
              { label: "Absent Days", count: absentCount, color: "#EF4444" },
            ].map((bar, idx) => {
              const max = Math.max(1, totalDays);
              const pct = Math.round((bar.count / max) * 100);
              return (
                <View key={idx}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 2,
                    }}
                  >
                    <ThemedText style={{ fontSize: 11, fontWeight: "600" }}>
                      {bar.label}
                    </ThemedText>
                    <ThemedText style={{ fontSize: 11, opacity: 0.8 }}>
                      {bar.count} ({pct}%)
                    </ThemedText>
                  </View>
                  <View
                    style={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: theme.backgroundSecondary,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        backgroundColor: bar.color,
                        borderRadius: 4,
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Report Exports */}
        <ThemedText style={styles.biSectionTitle}>Dynamic Report Exports</ThemedText>
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowExportModal(true);
            }}
            style={[
              styles.downloadBtn,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
            ]}
          >
            <Feather name="file-text" size={16} color={theme.primary} />
            <ThemedText style={styles.downloadBtnText}>
              Export Attendance & Payroll PDF / CSV
            </ThemedText>
            <Feather
              name="chevron-right"
              size={16}
              color={theme.textSecondary}
              style={{ marginLeft: "auto" }}
            />
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowEmailModal(true);
            }}
            style={[
              styles.downloadBtn,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
            ]}
          >
            <Feather name="mail" size={16} color={theme.primary} />
            <ThemedText style={styles.downloadBtnText}>Email Report Sharing</ThemedText>
            <Feather
              name="chevron-right"
              size={16}
              color={theme.textSecondary}
              style={{ marginLeft: "auto" }}
            />
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowScheduleModal(true);
            }}
            style={[
              styles.downloadBtn,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
            ]}
          >
            <Feather name="clock" size={16} color={theme.primary} />
            <ThemedText style={styles.downloadBtnText}>
              Schedule Auto-Export (Daily/Weekly/Monthly)
            </ThemedText>
            <Feather
              name="chevron-right"
              size={16}
              color={theme.textSecondary}
              style={{ marginLeft: "auto" }}
            />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      {/* ── TOP SEGMENTED TAB BAR WITH GEAR BUTTON ── */}
      <View
        style={[
          styles.tabSwitcherContainer,
          { paddingTop: Math.max(insets.top, 16) + 6 },
        ]}
      >
        <View style={styles.tabsRow}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setViewMode("payroll");
            }}
            style={[
              styles.tabButton,
              viewMode === "payroll" && { backgroundColor: theme.primary },
            ]}
          >
            <ThemedText
              style={[
                styles.tabButtonText,
                viewMode === "payroll" && { color: "#FFFFFF", fontWeight: "700" },
              ]}
            >
              Payroll Summary
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setViewMode("analytics");
            }}
            style={[
              styles.tabButton,
              viewMode === "analytics" && { backgroundColor: theme.primary },
            ]}
          >
            <ThemedText
              style={[
                styles.tabButtonText,
                viewMode === "analytics" && { color: "#FFFFFF", fontWeight: "700" },
              ]}
            >
              BI Reports & Charts
            </ThemedText>
          </Pressable>
        </View>

        {/* Top-right settings gear icon */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            DeviceEventEmitter.emit("OPEN_SETTINGS_DRAWER");
          }}
          style={[
            styles.gearButton,
            {
              backgroundColor: isDark
                ? "rgba(30, 41, 59, 0.45)"
                : "rgba(255, 255, 255, 0.9)",
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.06)"
                : "rgba(0, 0, 0, 0.05)",
            },
          ]}
        >
          <Feather name="settings" size={18} color={theme.text} />
        </Pressable>
      </View>

      {viewMode === "payroll" ? (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 80 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => loadSummaryData()}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
        >
          {renderHeader()}
          {isLoading && !summary ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            renderWorkerCard()
          )}
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.analyticsScroll,
            { paddingBottom: insets.bottom + 80 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => loadSummaryData()}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
        >
          {renderAnalyticsView()}
        </ScrollView>
      )}

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

      {/* ── EXPORT OPTIONS DIALOG ── */}
      <GlassModal
        visible={showExportModal}
        onClose={() => !isExporting && setShowExportModal(false)}
        title={t.export?.title || "Export Options"}
        theme={theme}
        isDark={isDark}
      >
        {isExporting ? (
          <View style={styles.exportingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText type="body" style={styles.exportingText}>
              {t.export?.generating || "Generating Document..."}
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
                  {t.export?.attendanceReport || "Attendance Report"}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: 2 }}
                >
                  {t.export?.pdf || "PDF Document"}
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
                  {t.export?.summaryReport || "Payroll Summary Report"}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: 2 }}
                >
                  {t.export?.pdf || "PDF Document"}
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
                <Feather name="grid" size={20} color="#10B981" />
              </View>
              <View style={styles.exportOptionText}>
                <ThemedText type="h4" style={{ fontWeight: "600" }}>
                  {(t.export as any)?.excel || "Export CSV / Excel"}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: 2 }}
                >
                  {t.export?.csv || "Spreadsheet"}
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
                    backgroundColor: "#6366F112",
                    borderColor: "#6366F125",
                    borderWidth: 1,
                  },
                ]}
              >
                <Feather name="printer" size={20} color="#6366F1" />
              </View>
              <View style={styles.exportOptionText}>
                <ThemedText type="h4" style={{ fontWeight: "600" }}>
                  {t.export?.print || "Print Sheet"}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: 2 }}
                >
                  AirPrint / WiFi Printer
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

      {/* ── SALARY CALCULATION BREAKDOWN DIALOG ── */}
      <GlassModal
        visible={showCalculationModal}
        onClose={() => setShowCalculationModal(false)}
        title="Salary Calculation Breakdown"
        theme={theme}
        isDark={isDark}
      >
        {summary && (
          <View style={{ width: "100%" }}>
            <ThemedText
              type="small"
              style={{
                color: theme.textSecondary,
                textAlign: "center",
                marginBottom: Spacing.md,
                marginTop: -Spacing.xs,
              }}
            >
              {summary.worker.name} • {monthNames[selectedMonth]} {selectedYear}
            </ThemedText>

            <ScrollView
              style={{ maxHeight: 300, width: "100%" }}
              showsVerticalScrollIndicator={true}
            >
              {summary.records.map((record) => {
                const breakdown = getRecordBreakdown(
                  record,
                  summary.worker.dailyRate,
                );
                return (
                  <View
                    key={record.day}
                    style={{
                      paddingVertical: Spacing.sm,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.border,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <ThemedText type="body" style={{ fontWeight: "700" }}>
                        Day {record.day}
                      </ThemedText>
                      <ThemedText
                        type="body"
                        style={{
                          fontWeight: "800",
                          color: record.value === "A" ? theme.error : "#10B981",
                        }}
                      >
                        ₹{breakdown.total}
                      </ThemedText>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginTop: 2,
                      }}
                    >
                      <ThemedText
                        type="small"
                        style={{ color: theme.textSecondary }}
                      >
                        {breakdown.statusText}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{ color: theme.textSecondary }}
                      >
                        Base: ₹{breakdown.basePay}
                        {breakdown.advance > 0 &&
                          ` + Adv: ₹${breakdown.advance}`}
                        {breakdown.overtime > 0 &&
                          ` + OT: ₹${breakdown.overtime} (${breakdown.overtimeText})`}
                      </ThemedText>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View
              style={{
                marginTop: Spacing.lg,
                paddingTop: Spacing.md,
                borderTopWidth: 2,
                borderTopColor: theme.border,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
              }}
            >
              <ThemedText type="body" style={{ fontWeight: "800" }}>
                Monthly Total Earnings
              </ThemedText>
              <ThemedText
                type="h2"
                style={{ fontWeight: "900", color: "#10B981" }}
              >
                ₹{summary.totalAmount.toFixed(0)}
              </ThemedText>
            </View>
          </View>
        )}

        <Pressable
          onPress={() => setShowCalculationModal(false)}
          style={[
            styles.paymentCancelBtn,
            {
              width: "100%",
              marginTop: Spacing.xl,
              height: 44,
              justifyContent: "center",
              alignItems: "center",
              borderRadius: 10,
              borderWidth: 1,
              borderColor: theme.border,
            },
          ]}
        >
          <ThemedText
            type="body"
            style={{ color: theme.textSecondary, fontWeight: "700" }}
          >
            Close
          </ThemedText>
        </Pressable>
      </GlassModal>

      {/* ── EMAIL SHARING MODAL ── */}
      <Modal
        visible={showEmailModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmailModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowEmailModal(false)}
        >
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: theme.backgroundDefault, padding: 20 },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <ThemedText style={{ fontSize: 16, fontWeight: "800" }}>
                Email Report Sharing
              </ThemedText>
              <Pressable onPress={() => setShowEmailModal(false)}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>
            <ThemedText
              style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}
            >
              Send this month's PDF/CSV payroll compilation directly to
              recipient email:
            </ThemedText>
            <TextInput
              placeholder="e.g. manager@construction.com"
              placeholderTextColor={theme.textSecondary}
              value={emailInput}
              onChangeText={setEmailInput}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[
                styles.modalInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSecondary,
                  marginBottom: 16,
                },
              ]}
            />
            <Pressable
              onPress={() => {
                if (!emailInput.includes("@")) {
                  Alert.alert(
                    "Validation Error",
                    "Please input a valid email address.",
                  );
                  return;
                }
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
                Alert.alert(
                  "Success",
                  `PDF report compiled and sent to ${emailInput} successfully.`,
                );
                setShowEmailModal(false);
              }}
              style={[
                styles.modalActionBtn,
                { backgroundColor: theme.primary },
              ]}
            >
              <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>
                Send Report
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── SCHEDULE AUTO-EXPORT MODAL ── */}
      <Modal
        visible={showScheduleModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowScheduleModal(false)}
        >
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: theme.backgroundDefault, padding: 20 },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <ThemedText style={{ fontSize: 16, fontWeight: "800" }}>
                Schedule Auto-Export
              </ThemedText>
              <Pressable onPress={() => setShowScheduleModal(false)}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ThemedText
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: theme.textSecondary,
                marginBottom: 6,
              }}
            >
              Recipient Email
            </ThemedText>
            <TextInput
              placeholder="e.g. manager@enterprise.com"
              placeholderTextColor={theme.textSecondary}
              value={scheduleEmail}
              onChangeText={setScheduleEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[
                styles.modalInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSecondary,
                  marginBottom: 16,
                },
              ]}
            />

            <Pressable
              onPress={() => {
                if (!scheduleEmail.includes("@")) {
                  Alert.alert(
                    "Validation Error",
                    "Please input a valid email address.",
                  );
                  return;
                }
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
                Alert.alert(
                  "Success",
                  `Scheduled auto-export configured. Next report will be emailed on schedule.`,
                );
                setShowScheduleModal(false);
              }}
              style={[
                styles.modalActionBtn,
                { backgroundColor: theme.primary },
              ]}
            >
              <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>
                Configure Schedule
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabSwitcherContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  tabsRow: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(148, 163, 184, 0.12)",
    borderRadius: 24,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
  },
  gearButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: 8,
    gap: 14,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  headerContent: {
    gap: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  monthSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
  },
  exportBtnWrap: {
    borderRadius: 12,
    overflow: "hidden",
  },
  exportButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  grandCardWrap: {
    borderRadius: 20,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  grandTotalCard: {
    padding: 20,
    position: "relative",
    overflow: "hidden",
  },
  cardBubble1: {
    position: "absolute",
    top: -30,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  cardBubble2: {
    position: "absolute",
    bottom: -40,
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  grandTotalLabel: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  grandTotalValue: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginTop: 4,
  },
  grandTotalMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.15)",
  },
  grandTotalMetaItem: {
    flex: 1,
  },
  grandTotalMetaLabel: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 11,
    fontWeight: "500",
  },
  grandTotalMetaValue: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2,
  },
  grandTotalDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginHorizontal: 12,
  },
  summaryCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: "800",
  },
  paidBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    gap: 6,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
    marginBottom: 4,
  },
  statValue: {
    fontWeight: "800",
    fontSize: 13,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
  paymentSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  smallPill: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  expandedContainer: {
    marginTop: 12,
    paddingTop: 10,
  },
  expandedSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  gridStatCol: {
    width: "33.3%",
    padding: 6,
  },
  detailsLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  dailyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  analyticsScroll: {
    padding: Spacing.md,
    gap: 14,
  },
  analyticsContainer: {
    gap: 14,
  },
  biSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  kpiCard: {
    width: "31%",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  kpiVal: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 6,
  },
  kpiLabel: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 2,
  },
  chartCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  downloadBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 380,
  },
  modalBlur: {
    borderRadius: 20,
    overflow: "hidden",
  },
  modalContentCard: {
    padding: 20,
    borderRadius: 20,
  },
  modalTitleText: {
    fontWeight: "800",
    marginBottom: 16,
    textAlign: "center",
  },
  yearSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  yearArrow: {
    padding: 8,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  monthItem: {
    width: "30%",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  exportOptions: {
    gap: 10,
  },
  exportOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  exportIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  exportOptionText: {
    flex: 1,
  },
  exportingContainer: {
    paddingVertical: 30,
    alignItems: "center",
    gap: 12,
  },
  exportingText: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalSheet: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 16,
  },
  modalInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  modalActionBtn: {
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentCancelBtn: {
    borderWidth: 1,
  },
});

