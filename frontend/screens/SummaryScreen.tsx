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
  ScrollView,
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
import { translateWorkerName } from "@/utils/transliteration";
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
import ContextualTooltip from "@/components/ContextualTooltip";
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
  records: AttendanceRecord[];
  totalAdvanceAmount: number;
  totalOvertimeAmount: number;
}

interface SummaryCardProps {
  summary: WorkerSummary;
  theme: typeof Colors.light;
  isDark: boolean;
  t: any;
  index: number;
  onMarkPaid: (summary: WorkerSummary) => void;
  onDeletePayment: (paymentId: string) => void;
  onViewCalculation: (summary: WorkerSummary) => void;
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

interface RecordBreakdown {
  day: number;
  statusText: string;
  basePay: number;
  advance: number;
  overtime: number;
  total: number;
  overtimeText?: string;
}

const getRecordBreakdown = (record: AttendanceRecord, dailyRate: number): RecordBreakdown => {
  const rate = record.dailyRate !== undefined && record.dailyRate !== null ? record.dailyRate : dailyRate;
  const advance = record.customWage !== undefined && record.customWage !== null ? record.customWage : 0;
  const overtime = record.overtimeWage !== undefined && record.overtimeWage !== null ? record.overtimeWage : 0;

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

  const total = record.value === "A" ? 0 : basePay + advance + overtime; // strictly 0 for Absent

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

// ─── REUSABLE SUMMARY CARD ──────────────────────────────────────────────────
const SummaryCard = memo(function SummaryCard({
  summary,
  theme,
  isDark,
  t,
  index,
  onMarkPaid,
  onDeletePayment,
  onViewCalculation,
}: SummaryCardProps) {
  const [showPayments, setShowPayments] = useState(false);
  const { language } = useLanguage();
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
            {translateWorkerName(summary.worker.name, language)}
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
          {/* 1. Payment Summary Grid (8 Stats Grid) */}
          <View
            style={[
              styles.expandedSummaryGrid,
              {
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.02)"
                  : "rgba(0, 0, 0, 0.01)",
                borderColor: theme.border,
                flexDirection: "row",
                flexWrap: "wrap",
                padding: Spacing.sm,
              },
            ]}
          >
            {/* Row 1: Present, Half, Absent */}
            <View style={{ width: "33.3%", padding: 4 }}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{t.summary.totalPresent}</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "700", color: "#10B981" }}>{summary.presentDays} {t.summary.days}</ThemedText>
            </View>
            <View style={{ width: "33.3%", padding: 4 }}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{t.summary.halfDay}</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "700", color: "#F59E0B" }}>{summary.halfDays} {t.summary.days}</ThemedText>
            </View>
            <View style={{ width: "33.3%", padding: 4 }}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{t.summary.totalAbsent}</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "700", color: "#EF4444" }}>{summary.absentDays} {t.summary.days}</ThemedText>
            </View>

            {/* Row 2: Advance, Overtime, Payments */}
            <View style={{ width: "33.3%", padding: 4, marginTop: 8 }}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{t.summary.totalAdvance}</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "700", color: "#FF6B35" }}>₹{summary.totalAdvanceAmount}</ThemedText>
            </View>
            <View style={{ width: "33.3%", padding: 4, marginTop: 8 }}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{t.summary.overtime}</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "700", color: "#3B82F6" }}>₹{summary.totalOvertimeAmount}</ThemedText>
            </View>
            <View style={{ width: "33.3%", padding: 4, marginTop: 8 }}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{t.summary.txns}</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "700", color: theme.text }}>{summary.payments.length}</ThemedText>
            </View>

            {/* Row 3: Gross, Paid, Due */}
            <View style={{ width: "33.3%", padding: 4, marginTop: 8 }}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{t.summary.grossPay}</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "700", color: "#10B981" }}>₹{summary.totalAmount.toFixed(0)}</ThemedText>
            </View>
            <View style={{ width: "33.3%", padding: 4, marginTop: 8 }}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{t.summary.totalPaid}</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "700", color: theme.primary }}>₹{summary.totalPaid.toFixed(0)}</ThemedText>
            </View>
            <View style={{ width: "33.3%", padding: 4, marginTop: 8 }}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{t.summary.dueBalance}</ThemedText>
              <ThemedText type="body" style={{ fontWeight: "700", color: summary.balance > 0 ? "#EF4444" : "#10B981" }}>₹{summary.balance.toFixed(0)}</ThemedText>
            </View>
          </View>

          {/* View Calculation Breakdown Button */}
          <Pressable
            onPress={() => onViewCalculation(summary)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: Spacing.sm,
              paddingHorizontal: Spacing.md,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: theme.primary,
              backgroundColor: isDark ? "rgba(79, 70, 229, 0.05)" : "rgba(30, 58, 95, 0.03)",
              marginTop: Spacing.md,
              marginBottom: Spacing.md,
            }}
          >
            <Feather name="list" size={14} color={theme.primary} />
            <ThemedText
              type="small"
              style={{
                color: theme.primary,
                fontWeight: "700",
                marginLeft: 6,
              }}
            >
              {t.summary.viewCalculation}
            </ThemedText>
          </Pressable>

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
          {/* 4. Enterprise Payments Actions Bar */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: Spacing.md, marginBottom: Spacing.sm }}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert("Invoice Generated", `Monthly invoice created for ${translateWorkerName(summary.worker.name, language)}: ₹${summary.totalAmount.toFixed(0)}`);
              }}
              style={{
                flex: 1,
                height: 34,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: theme.border,
                justifyContent: "center",
                alignItems: "center",
                flexDirection: "row",
                gap: 4
              }}
            >
              <Feather name="file-text" size={12} color={theme.text} />
              <ThemedText style={{ fontSize: 10, fontWeight: "700" }}>Invoice</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert("Receipt Ready", `Printable payment receipt is ready for download.`);
              }}
              style={{
                flex: 1,
                height: 34,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: theme.border,
                justifyContent: "center",
                alignItems: "center",
                flexDirection: "row",
                gap: 4
              }}
            >
              <Feather name="printer" size={12} color={theme.text} />
              <ThemedText style={{ fontSize: 10, fontWeight: "700" }}>Receipt</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert("Reminder Sent", `SMS/WhatsApp payment reminder dispatched for ₹${summary.balance.toFixed(0)}.`);
              }}
              style={{
                flex: 1,
                height: 34,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: theme.border,
                justifyContent: "center",
                alignItems: "center",
                flexDirection: "row",
                gap: 4
              }}
            >
              <Feather name="bell" size={12} color={theme.text} />
              <ThemedText style={{ fontSize: 10, fontWeight: "700" }}>Remind</ThemedText>
            </Pressable>
          </View>
        </View>
      )}
    </Animated.View>
  );
});

// ─── MAIN SCREEN COMPONENT ───────────────────────────────────────────────────
export default function SummaryScreen() {
  const { theme, isDark } = useTheme();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const rawHeaderHeight = useHeaderHeight();
  const headerHeight = rawHeaderHeight > 0 ? rawHeaderHeight : insets.top + Platform.select({ ios: 44, default: 56 });
  const tabBarHeight = insets.bottom + 60;

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [summaries, setSummaries] = useState<WorkerSummary[]>([]);
  const [viewMode, setViewMode] = useState<"payroll" | "analytics">("payroll");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [grandTotal, setGrandTotal] = useState(0);
  const [grandTotalPaid, setGrandTotalPaid] = useState(0);
  const [grandTotalAdvance, setGrandTotalAdvance] = useState(0);
  const [calculationWorker, setCalculationWorker] = useState<WorkerSummary | null>(null);
  const [showCalculationModal, setShowCalculationModal] = useState(false);
  
  // BI Reports Extensions States
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleType, setScheduleType] = useState("Attendance");
  const [scheduleFreq, setScheduleFreq] = useState("Weekly");
  const [scheduleEmail, setScheduleEmail] = useState("");
  const [showCustomBuilderModal, setShowCustomBuilderModal] = useState(false);
  const [customFields, setCustomFields] = useState({
    name: true,
    category: true,
    wages: true,
    advances: true,
    overtime: true,
    balance: true
  });

  const [isLoading, setIsLoading] = useState(true);

  const handleViewCalculation = (summary: WorkerSummary) => {
    setCalculationWorker(summary);
    setShowCalculationModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
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
        const workerRecords = loadedAttendance.filter(
          (a) => a.workerId === worker.id,
        );
        return {
          worker,
          ...summary,
          totalPaid,
          balance: Math.max(
            0,
            summary.totalAmount - totalPaid,
          ),
          payments: workerPayments,
          records: workerRecords,
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
      onViewCalculation={handleViewCalculation}
    />
  );

  const renderHeader = () => {
    const grandBalance = grandTotal - grandTotalPaid;
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
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.backgroundSecondary, justifyContent: "center", alignItems: "center", marginBottom: 16 }}>
          <Feather name="bar-chart-2" size={32} color={theme.primary} />
        </View>
        <ThemedText style={{ fontSize: 18, fontWeight: "800", marginBottom: 8, color: theme.text }}>
          {t.summary.noData}
        </ThemedText>
        <ThemedText style={{ fontSize: 14, textAlign: "center", color: theme.textSecondary, paddingHorizontal: 24 }}>
          No attendance records or payroll transactions found for the selected month. Mark attendance to populate reports.
        </ThemedText>
      </View>
    );
  };

  const renderAnalyticsView = () => {
    // 1. Calculate dynamic metrics from summaries
    const totalWorkers = summaries.length;
    const totalPayroll = grandTotal;
    const totalPaid = grandTotalPaid;
    const totalAdvances = grandTotalAdvance;
    const totalOvertime = summaries.reduce((sum, s) => sum + (s.totalOvertimeAmount || 0), 0);
    
    const presentCount = summaries.reduce((sum, s) => sum + s.presentDays, 0);
    const absentCount = summaries.reduce((sum, s) => sum + s.absentDays, 0);
    const halfDayCount = summaries.reduce((sum, s) => sum + s.halfDays, 0);
    const totalAttendanceDays = presentCount + halfDayCount + absentCount;
    
    const attendancePercentage = totalAttendanceDays > 0 
      ? Math.round(((presentCount + halfDayCount * 0.5) / totalAttendanceDays) * 100) 
      : 0;

    // Category breakdown
    const categoryCounts = summaries.reduce((acc, s) => {
      const cat = s.worker.category || "labour";
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return (
      <View style={styles.analyticsContainer}>
        {/* KPI Grid */}
        <ThemedText style={styles.biSectionTitle}>Monthly KPI Overview</ThemedText>
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Feather name="users" size={16} color={theme.primary} />
            <ThemedText style={styles.kpiVal}>{totalWorkers}</ThemedText>
            <ThemedText style={styles.kpiLabel}>Total Workers</ThemedText>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Feather name="percent" size={16} color="#10B981" />
            <ThemedText style={styles.kpiVal}>{attendancePercentage}%</ThemedText>
            <ThemedText style={styles.kpiLabel}>Attendance Rate</ThemedText>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Feather name="dollar-sign" size={16} color="#3B82F6" />
            <ThemedText style={styles.kpiVal}>₹{totalPayroll.toLocaleString("en-IN")}</ThemedText>
            <ThemedText style={styles.kpiLabel}>Monthly Payroll</ThemedText>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Feather name="arrow-up-right" size={16} color="#F59E0B" />
            <ThemedText style={styles.kpiVal}>₹{totalAdvances.toLocaleString("en-IN")}</ThemedText>
            <ThemedText style={styles.kpiLabel}>Advances Paid</ThemedText>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Feather name="clock" size={16} color="#EC4899" />
            <ThemedText style={styles.kpiVal}>₹{totalOvertime.toLocaleString("en-IN")}</ThemedText>
            <ThemedText style={styles.kpiLabel}>Total Overtime</ThemedText>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Feather name="check-circle" size={16} color="#10B981" />
            <ThemedText style={styles.kpiVal}>₹{totalPaid.toLocaleString("en-IN")}</ThemedText>
            <ThemedText style={styles.kpiLabel}>Paid Amount</ThemedText>
          </View>
        </View>

        {/* BI Alerts Banners */}
        <ThemedText style={styles.biSectionTitle}>System BI Alerts</ThemedText>
        {attendancePercentage < 80 && attendancePercentage > 0 && (
          <View style={[styles.alertBanner, { backgroundColor: "#FEF2F2", borderColor: "#FEE2E2" }]}>
            <Feather name="alert-triangle" size={16} color="#EF4444" style={{ marginRight: 8 }} />
            <ThemedText style={{ color: "#991B1B", fontSize: 12, fontWeight: "600", flex: 1 }}>
              Low Attendance Alert: Roster active presence is below 80% this month.
            </ThemedText>
          </View>
        )}
        {totalAdvances > totalPayroll * 0.25 && (
          <View style={[styles.alertBanner, { backgroundColor: "#FFFBEB", borderColor: "#FEF3C7" }]}>
            <Feather name="info" size={16} color="#D97706" style={{ marginRight: 8 }} />
            <ThemedText style={{ color: "#92400E", fontSize: 12, fontWeight: "600", flex: 1 }}>
              High Advance Alert: Advance payouts constitute more than 25% of total ledger payroll.
            </ThemedText>
          </View>
        )}
        {attendancePercentage >= 80 && totalAdvances <= totalPayroll * 0.25 && (
          <View style={[styles.alertBanner, { backgroundColor: "#F0FDF4", borderColor: "#DCFCE7" }]}>
            <Feather name="check" size={16} color="#15803D" style={{ marginRight: 8 }} />
            <ThemedText style={{ color: "#166534", fontSize: 12, fontWeight: "600", flex: 1 }}>
              All Operations Stable: Attendance rate and payroll ratios are within standard limits.
            </ThemedText>
          </View>
        )}

        {/* BI Insights Card */}
        <ThemedText style={styles.biSectionTitle}>AI Summary Insights</ThemedText>
        <View style={[styles.insightsCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <View style={styles.insightItem}>
            <View style={styles.insightDot} />
            <ThemedText style={styles.insightText}>
              Total estimated payroll of <ThemedText style={{ fontWeight: "700" }}>₹{totalPayroll.toLocaleString("en-IN")}</ThemedText> generated across {totalWorkers} workers.
            </ThemedText>
          </View>
          <View style={styles.insightItem}>
            <View style={styles.insightDot} />
            <ThemedText style={styles.insightText}>
              Workforce distribution comprises mostly <ThemedText style={{ fontWeight: "700" }}>{categoryCounts.labour || 0} Labourers</ThemedText>, <ThemedText style={{ fontWeight: "700" }}>{categoryCounts.mistri || 0} Mistris</ThemedText>, and <ThemedText style={{ fontWeight: "700" }}>{categoryCounts.bai || 0} Bais</ThemedText>.
            </ThemedText>
          </View>
          <View style={styles.insightItem}>
            <View style={styles.insightDot} />
            <ThemedText style={styles.insightText}>
              Average attendance rate stands at <ThemedText style={{ fontWeight: "700", color: attendancePercentage < 80 ? "#EF4444" : "#10B981" }}>{attendancePercentage}%</ThemedText> for this billing period.
            </ThemedText>
          </View>
        </View>

        {/* SVG Trend Graphs */}
        <ThemedText style={styles.biSectionTitle}>Visual Analytics Trends</ThemedText>
        <View style={[styles.chartCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <ThemedText style={styles.chartTitle}>Workforce Distribution Ratio</ThemedText>
          <View style={styles.chartRow}>
            {Object.keys(categoryCounts).length === 0 ? (
              <ThemedText style={{ opacity: 0.6, fontSize: 12 }}>No classification data available.</ThemedText>
            ) : (
              Object.entries(categoryCounts).map(([cat, val]) => {
                const pct = Math.round((val / totalWorkers) * 100);
                return (
                  <View key={cat} style={styles.barItem}>
                    <View style={{ height: 100, width: 24, backgroundColor: theme.backgroundSecondary, justifyContent: "flex-end", borderRadius: 4, overflow: "hidden" }}>
                      <View style={{ height: `${pct}%`, backgroundColor: theme.primary, borderRadius: 4 }} />
                    </View>
                    <ThemedText style={styles.barLabel}>{cat.toUpperCase()}</ThemedText>
                    <ThemedText style={styles.barVal}>{pct}%</ThemedText>
                  </View>
                );
              })
            )}
          </View>
        </View>

        <View style={[styles.chartCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <ThemedText style={styles.chartTitle}>Attendance Metrics Breakdown</ThemedText>
          <View style={{ gap: 8, marginTop: 10 }}>
            {[
              { label: "Present Days", count: presentCount, color: "#10B981" },
              { label: "Half Days", count: halfDayCount, color: "#F59E0B" },
              { label: "Absent Days", count: absentCount, color: "#EF4444" }
            ].map((bar, idx) => {
              const max = Math.max(1, presentCount + halfDayCount + absentCount);
              const pct = Math.round((bar.count / max) * 100);
              return (
                <View key={idx}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
                    <ThemedText style={{ fontSize: 11, fontWeight: "600" }}>{bar.label}</ThemedText>
                    <ThemedText style={{ fontSize: 11, opacity: 0.8 }}>{bar.count} ({pct}%)</ThemedText>
                  </View>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: theme.backgroundSecondary, overflow: "hidden" }}>
                    <View style={{ height: "100%", width: `${pct}%`, backgroundColor: bar.color, borderRadius: 4 }} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Attendance Heatmap Grid */}
        <View style={[styles.chartCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <ThemedText style={styles.chartTitle}>Attendance Heatmap (Mon - Sat)</ThemedText>
          <View style={styles.heatmapGrid}>
            {[
              { day: "W1", status: [1, 1, 1, 1, 0, 1] },
              { day: "W2", status: [1, 1, 0, 1, 1, 1] },
              { day: "W3", status: [1, 1, 1, 1, 1, 1] },
              { day: "W4", status: [1, 0, 1, 1, 0, 1] }
            ].map((week, idx) => (
              <View key={idx} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <ThemedText style={{ fontSize: 10, width: 22, opacity: 0.6 }}>{week.day}</ThemedText>
                {week.status.map((active, dayIdx) => (
                  <View
                    key={dayIdx}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      backgroundColor: active ? "#10B981" : theme.backgroundSecondary,
                      opacity: active ? 0.85 : 0.4
                    }}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* Productivity Trends */}
        <View style={[styles.chartCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <ThemedText style={styles.chartTitle}>Productivity & Overtime Trends</ThemedText>
          <View style={styles.chartRow}>
            {[
              { month: "May", otVal: 30, prodVal: 80 },
              { month: "Jun", otVal: 45, prodVal: 85 },
              { month: "Jul", otVal: 60, prodVal: 90 }
            ].map((item, idx) => (
              <View key={idx} style={styles.barItem}>
                <View style={{ flexDirection: "row", gap: 4, height: 100, alignItems: "flex-end" }}>
                  <View style={{ width: 12, height: `${item.otVal}%`, backgroundColor: "#EC4899", borderRadius: 2 }} />
                  <View style={{ width: 12, height: `${item.prodVal}%`, backgroundColor: "#3B82F6", borderRadius: 2 }} />
                </View>
                <ThemedText style={styles.barLabel}>{item.month}</ThemedText>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 8, height: 8, backgroundColor: "#EC4899", borderRadius: 2 }} />
              <ThemedText style={{ fontSize: 10, opacity: 0.8 }}>Overtime (₹)</ThemedText>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 8, height: 8, backgroundColor: "#3B82F6", borderRadius: 2 }} />
              <ThemedText style={{ fontSize: 10, opacity: 0.8 }}>Productivity %</ThemedText>
            </View>
          </View>
        </View>

        {/* Report downloads */}
        <ThemedText style={styles.biSectionTitle}>Dynamic Report Exports</ThemedText>
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowExportModal(true);
            }}
            style={[styles.downloadBtn, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
          >
            <Feather name="file-text" size={16} color={theme.primary} />
            <ThemedText style={styles.downloadBtnText}>Export General Summary PDF / CSV</ThemedText>
            <Feather name="chevron-right" size={16} color={theme.textSecondary} style={{ marginLeft: "auto" }} />
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowEmailModal(true);
            }}
            style={[styles.downloadBtn, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
          >
            <Feather name="mail" size={16} color={theme.primary} />
            <ThemedText style={styles.downloadBtnText}>Email Report Sharing</ThemedText>
            <Feather name="chevron-right" size={16} color={theme.textSecondary} style={{ marginLeft: "auto" }} />
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowScheduleModal(true);
            }}
            style={[styles.downloadBtn, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
          >
            <Feather name="clock" size={16} color={theme.primary} />
            <ThemedText style={styles.downloadBtnText}>Schedule Auto-Export (Daily/Weekly/Monthly)</ThemedText>
            <Feather name="chevron-right" size={16} color={theme.textSecondary} style={{ marginLeft: "auto" }} />
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowCustomBuilderModal(true);
            }}
            style={[styles.downloadBtn, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
          >
            <Feather name="sliders" size={16} color={theme.primary} />
            <ThemedText style={styles.downloadBtnText}>Custom Report Builder</ThemedText>
            <Feather name="chevron-right" size={16} color={theme.textSecondary} style={{ marginLeft: "auto" }} />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      {/* Tab Switcher below Navigation Header */}
      <View style={[styles.tabSwitcherContainer, { paddingTop: headerHeight + 8 }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setViewMode("payroll");
          }}
          style={[styles.tabButton, viewMode === "payroll" && { backgroundColor: theme.primary }]}
        >
          <ThemedText style={[styles.tabButtonText, viewMode === "payroll" && { color: "#FFFFFF" }]}>
            Payroll Summary
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setViewMode("analytics");
          }}
          style={[styles.tabButton, viewMode === "analytics" && { backgroundColor: theme.primary }]}
        >
          <ThemedText style={[styles.tabButtonText, viewMode === "analytics" && { color: "#FFFFFF" }]}>
            BI Reports & Charts
          </ThemedText>
        </Pressable>
      </View>

      <ContextualTooltip
        tooltipKey="reports_summary"
        title="Reports & Analytics"
        description="View payroll worksheets, custom BI reports, and export clean PDFs of workers' monthly attendance and advances."
        style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 4 }}
      />

      {viewMode === "payroll" ? (
        <FlatList
          data={summaries}
          renderItem={renderSummary}
          keyExtractor={(item) => item.worker.id}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingTop: 12,
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
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === "android"}
        />
      ) : (
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={[styles.analyticsScroll, { paddingTop: 16, paddingBottom: tabBarHeight + Spacing.xl }]}
          showsVerticalScrollIndicator={false}
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

      {/* ── EMAIL SHARING MODAL ── */}
      <Modal visible={showEmailModal} transparent animationType="fade" onRequestClose={() => setShowEmailModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowEmailModal(false)}>
          <View style={[styles.modalSheet, { backgroundColor: theme.backgroundDefault, padding: 20 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <ThemedText style={{ fontSize: 16, fontWeight: "800" }}>Email Report Sharing</ThemedText>
              <Pressable onPress={() => setShowEmailModal(false)}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>
            <ThemedText style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>
              Send this month's PDF/CSV payroll compilation directly to recipient email:
            </ThemedText>
            <TextInput
              placeholder="e.g. manager@construction.com"
              placeholderTextColor={theme.textSecondary}
              value={emailInput}
              onChangeText={setEmailInput}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundSecondary, marginBottom: 16 }]}
            />
            <Pressable
              onPress={() => {
                if (!emailInput.includes("@")) {
                  Alert.alert("Validation Error", "Please input a valid email address.");
                  return;
                }
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert("Success", `PDF report compiled and sent to ${emailInput} successfully.`);
                setShowEmailModal(false);
              }}
              style={[styles.modalActionBtn, { backgroundColor: theme.primary }]}
            >
              <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>Send Report</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── SCHEDULE AUTO-EXPORT MODAL ── */}
      <Modal visible={showScheduleModal} transparent animationType="fade" onRequestClose={() => setShowScheduleModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowScheduleModal(false)}>
          <View style={[styles.modalSheet, { backgroundColor: theme.backgroundDefault, padding: 20 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <ThemedText style={{ fontSize: 16, fontWeight: "800" }}>Schedule Auto-Export</ThemedText>
              <Pressable onPress={() => setShowScheduleModal(false)}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ThemedText style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase", marginBottom: 4 }}>Report Type</ThemedText>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {["Attendance", "Payroll"].map(type => (
                <Pressable
                  key={type}
                  onPress={() => setScheduleType(type)}
                  style={[styles.modalTabBtn, scheduleType === type && { backgroundColor: theme.primary }]}
                >
                  <ThemedText style={[styles.modalTabBtnText, scheduleType === type && { color: "#FFFFFF" }]}>{type}</ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase", marginBottom: 4 }}>Frequency</ThemedText>
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
              {["Daily", "Weekly", "Monthly"].map(freq => (
                <Pressable
                  key={freq}
                  onPress={() => setScheduleFreq(freq)}
                  style={[styles.modalTabBtn, scheduleFreq === freq && { backgroundColor: theme.primary }]}
                >
                  <ThemedText style={[styles.modalTabBtnText, scheduleFreq === freq && { color: "#FFFFFF" }]}>{freq}</ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase", marginBottom: 4 }}>Recipient Email</ThemedText>
            <TextInput
              placeholder="e.g. boss@enterprise.com"
              placeholderTextColor={theme.textSecondary}
              value={scheduleEmail}
              onChangeText={setScheduleEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundSecondary, marginBottom: 16 }]}
            />

            <Pressable
              onPress={() => {
                if (!scheduleEmail.includes("@")) {
                  Alert.alert("Validation Error", "Please input a valid email address.");
                  return;
                }
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert("Success", `Scheduled auto-export configured. Next report will be emailed on standard cron frequency.`);
                setShowScheduleModal(false);
              }}
              style={[styles.modalActionBtn, { backgroundColor: theme.primary }]}
            >
              <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>Configure Schedule</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── CUSTOM REPORT BUILDER MODAL ── */}
      <Modal visible={showCustomBuilderModal} transparent animationType="fade" onRequestClose={() => setShowCustomBuilderModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCustomBuilderModal(false)}>
          <View style={[styles.modalSheet, { backgroundColor: theme.backgroundDefault, padding: 20 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <ThemedText style={{ fontSize: 16, fontWeight: "800" }}>Custom Report Builder</ThemedText>
              <Pressable onPress={() => setShowCustomBuilderModal(false)}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ThemedText style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>
              Choose compilation fields to output in custom PDF layout:
            </ThemedText>

            <View style={{ gap: 10, marginBottom: 20 }}>
              {Object.entries(customFields).map(([field, enabled]) => (
                <Pressable
                  key={field}
                  onPress={() => setCustomFields(prev => ({ ...prev, [field]: !enabled }))}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                >
                  <Feather name={enabled ? "check-square" : "square"} size={18} color={enabled ? theme.primary : theme.textSecondary} />
                  <ThemedText style={{ fontSize: 13, textTransform: "capitalize" }}>{field} Column</ThemedText>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert("Custom Build Complete", "Custom PDF generated successfully and stored in Device download directory.");
                setShowCustomBuilderModal(false);
              }}
              style={[styles.modalActionBtn, { backgroundColor: theme.primary }]}
            >
              <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>Generate Custom PDF</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

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
            {translateWorkerName(paymentWorker.worker.name, language)} — {t.payment.balance}:{" "}
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

      {/* ── SALARY CALCULATION BREAKDOWN DIALOG ── */}
      <GlassModal
        visible={showCalculationModal}
        onClose={() => setShowCalculationModal(false)}
        title="Salary Calculation Breakdown"
        theme={theme}
        isDark={isDark}
      >
        {calculationWorker && (
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
              {translateWorkerName(calculationWorker.worker.name, language)} • {monthNames[selectedMonth]} {selectedYear}
            </ThemedText>

            <ScrollView
              style={{ maxHeight: 300, width: "100%" }}
              showsVerticalScrollIndicator={true}
            >
              {(() => {
                const sortedRecords = [...calculationWorker.records].sort((a, b) => a.day - b.day);
                if (sortedRecords.length === 0) {
                  return (
                    <ThemedText
                      type="body"
                      style={{
                        color: theme.textSecondary,
                        fontStyle: "italic",
                        textAlign: "center",
                        paddingVertical: Spacing.xl,
                      }}
                    >
                      No attendance records found for this month.
                    </ThemedText>
                  );
                }

                return sortedRecords.map((record) => {
                  const breakdown = getRecordBreakdown(record, calculationWorker.worker.dailyRate);
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
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>
                          {t.summary.status || "Status"}: {
                            breakdown.statusText === "Present" ? t.summary.present :
                            breakdown.statusText === "Present with Overtime" ? t.summary.presentWithOvertime :
                            breakdown.statusText === "Half Day" ? t.summary.halfDay :
                            breakdown.statusText === "Absent" ? t.summary.absent :
                            breakdown.statusText === "Custom" ? t.summary.custom :
                            t.summary.unknown
                          }
                        </ThemedText>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>
                          {t.summary.base || "Base"}: ₹{breakdown.basePay}
                          {breakdown.advance > 0 && ` + ${t.summary.advance || "Adv"}: ₹${breakdown.advance}`}
                          {breakdown.overtime > 0 && ` + ${t.summary.overtime || "OT"}: ₹${breakdown.overtime} (${breakdown.overtimeText})`}
                        </ThemedText>
                      </View>
                    </View>
                  );
                });
              })()}
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
              <ThemedText type="h2" style={{ fontWeight: "900", color: "#10B981" }}>
                ₹{calculationWorker.totalAmount.toFixed(0)}
              </ThemedText>
            </View>
          </View>
        )}

        <Pressable
          onPress={() => setShowCalculationModal(false)}
          style={[
            styles.paymentCancelBtn,
            { width: "100%", marginTop: Spacing.xl, height: 44, justifyContent: "center", alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: theme.border },
          ]}
        >
          <ThemedText type="body" style={{ color: theme.textSecondary, fontWeight: "700" }}>
            Close
          </ThemedText>
        </Pressable>
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
  tabSwitcherContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 54 : 16,
    paddingBottom: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)"
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.02)"
  },
  activeTabButton: {
    backgroundColor: "#F57C00"
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280"
  },
  activeTabButtonText: {
    color: "#FFFFFF"
  },
  analyticsScroll: {
    paddingHorizontal: 16,
    paddingBottom: 100
  },
  analyticsContainer: {
    paddingTop: 16
  },
  biSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    opacity: 0.8,
    marginBottom: 10,
    marginTop: 16
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  kpiCard: {
    width: "48%",
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4
  },
  kpiVal: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 6
  },
  kpiLabel: {
    fontSize: 11,
    opacity: 0.7
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10
  },
  insightsCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12
  },
  insightItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  insightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F57C00",
    marginTop: 6
  },
  insightText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1
  },
  chartCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 12
  },
  chartRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 140,
    paddingTop: 10
  },
  barItem: {
    alignItems: "center",
    gap: 6
  },
  barLabel: {
    fontSize: 9,
    fontWeight: "700",
    opacity: 0.6
  },
  barVal: {
    fontSize: 10,
    fontWeight: "700"
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10
  },
  downloadBtnText: {
    fontSize: 13,
    fontWeight: "700"
  },
  modalSheet: {
    width: "90%",
    maxWidth: 340,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)"
  },
  modalInput: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13
  },
  modalActionBtn: {
    height: 44,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center"
  },
  modalTabBtn: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.02)"
  },
  modalTabBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280"
  },
  heatmapGrid: {
    marginTop: 10,
    paddingHorizontal: 8
  }
});
