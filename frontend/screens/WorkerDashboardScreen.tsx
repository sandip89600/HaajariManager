import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Share,
  DeviceEventEmitter,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import {
  authenticatedFetch,
  API_URL,
  storage,
  calculateWorkerSummary,
  siteActivityStorage,
  WorkerTodayContext,
} from "@/utils/storage";
import { captureLocation } from "@/utils/gps";
import { Spacing, BorderRadius } from "@/constants/theme";
import TeamConnectionWidget from "@/components/TeamConnectionWidget";

export default function WorkerDashboardScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const { user, uniqueId, refreshUserProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [todayContext, setTodayContext] = useState<WorkerTodayContext | null>(
    null,
  );
  const [isStartingWork, setIsStartingWork] = useState(false);

  const [workerInfo, setWorkerInfo] = useState<{
    id?: string;
    uniqueId?: string;
    name?: string;
    category?: string;
    dailyRate?: number;
    contractorName?: string;
    contractorCompany?: string;
  }>({});

  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<{
    presentDays: number;
    absentDays: number;
    halfDays: number;
    overtimeHours: number;
    totalEarned: number;
    advancePaid: number;
    totalPaid: number;
    netPayable: number;
  }>({
    presentDays: 0,
    absentDays: 0,
    halfDays: 0,
    overtimeHours: 0,
    totalEarned: 0,
    advancePaid: 0,
    totalPaid: 0,
    netPayable: 0,
  });

  const isFetchingRef = React.useRef(false);

  const loadWorkerData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      // 1. Immediately load cached dashboard data if available
      const cached = await storage.getLabourDashboardCache(
        selectedYear,
        selectedMonth,
      );
      if (cached) {
        if (cached.worker) setWorkerInfo(cached.worker);
        if (cached.records) setAttendanceRecords(cached.records);
        if (cached.summary) setSummary(cached.summary);
        setIsLoading(false);
      } else {
        // Fallback to local user profile and local attendance records
        if (user) {
          setWorkerInfo({
            id: user.id,
            uniqueId: user.uniqueId || uniqueId,
            name: user.name,
            category: user.workerCategory || "Labour",
            dailyRate: user.dailyWage || 0,
            contractorName: user.contractorName,
            contractorCompany: user.contractorCompany,
          });
        }
        const localAttendance = await storage.getAttendance();
        const monthRecords = localAttendance.filter(
          (r) =>
            r.year === selectedYear &&
            (r.month === selectedMonth ||
              r.month === selectedMonth - 1 ||
              r.month === selectedMonth + 1),
        );
        if (monthRecords.length > 0) {
          setAttendanceRecords(monthRecords);
          const computed = calculateWorkerSummary(
            user?.id || "",
            localAttendance,
            user?.dailyWage || 0,
          );
          const localPayments = await storage.getPaymentsForMonth(
            selectedYear,
            selectedMonth,
          );
          const totalPaid = localPayments
            .filter(
              (p) =>
                p.workerId === user?.id ||
                (user?.uniqueId && p.workerId === user.uniqueId),
            )
            .reduce((sum, p) => sum + p.amount, 0);
          const totalAdvance = computed.totalAdvanceAmount || 0;
          setSummary({
            presentDays: computed.presentDays,
            absentDays: computed.absentDays,
            halfDays: computed.halfDays,
            overtimeHours: 0,
            totalEarned: computed.totalAmount,
            advancePaid: totalAdvance,
            totalPaid,
            netPayable: Math.max(
              0,
              computed.totalAmount - totalAdvance - totalPaid,
            ),
          });
        }
      }

      // 2. Fetch fresh data from backend
      try {
        const attRes = await authenticatedFetch(
          `${API_URL}/attendance/my-attendance?year=${selectedYear}&month=${selectedMonth}`,
        );
        if (attRes.ok) {
          const data = await attRes.json();
          if (data.worker) setWorkerInfo(data.worker);
          if (data.records) setAttendanceRecords(data.records);
          if (data.summary) setSummary(data.summary);
          await storage.setLabourDashboardCache(
            selectedYear,
            selectedMonth,
            data,
          );
        }
        // 3. Fetch fresh worker today site context (smart site detection / work update proof status)
        try {
          const loc = await captureLocation();
          const ctx = await siteActivityStorage.getWorkerTodayContext(
            loc
              ? { latitude: loc.latitude, longitude: loc.longitude }
              : undefined,
          );
          if (ctx) setTodayContext(ctx);
        } catch (ctxErr) {
          console.log("Failed to fetch worker today site context:", ctxErr);
        }
      } catch (netErr) {
        console.log(
          "Worker dashboard using cached/offline data:",
          (netErr as any)?.message || netErr,
        );
      }
    } catch (error) {
      console.warn("Failed to load worker dashboard data:", error);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedYear, selectedMonth]);

  const handleStartWork = async () => {
    const targetSiteId =
      todayContext?.detectedNearbySite?.id ||
      todayContext?.defaultSite?.id ||
      todayContext?.activeWorkingSite?.id;

    if (!targetSiteId) {
      return;
    }

    setIsStartingWork(true);
    try {
      const loc = await captureLocation();
      await siteActivityStorage.startDailyWorkSession(
        targetSiteId,
        loc
          ? {
              latitude: loc.latitude,
              longitude: loc.longitude,
              accuracy: loc.accuracy,
            }
          : undefined,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadWorkerData();
    } catch (err: any) {
      console.warn("Error starting daily work session:", err);
    } finally {
      setIsStartingWork(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadWorkerData();
    }, [loadWorkerData]),
  );

  useEffect(() => {
    const sub1 = DeviceEventEmitter.addListener("refreshData", () => {
      loadWorkerData();
    });
    const sub2 = DeviceEventEmitter.addListener("attendanceUpdated", () => {
      loadWorkerData();
    });
    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, [loadWorkerData]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadWorkerData();
  }, [loadWorkerData]);

  const activeUniqueId =
    workerInfo?.uniqueId || uniqueId || user?.uniqueId || "HM-W-PENDING";
  const activeName = workerInfo?.name || user?.name || "Worker";
  const rawCategory = workerInfo?.category || user?.workerCategory || "labour";
  const activeCategory = t.translateCategory(rawCategory);

  const copyUniqueId = async () => {
    if (activeUniqueId && activeUniqueId !== "HM-W-PENDING") {
      await Clipboard.setStringAsync(activeUniqueId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const shareUniqueId = async () => {
    if (activeUniqueId && activeUniqueId !== "HM-W-PENDING") {
      try {
        await Share.share({
          message: `Haajari Manager Worker ID: ${activeUniqueId}\nName: ${activeName}\nTrade: ${activeCategory}`,
        });
      } catch (err) {
        console.warn("Share error:", err);
      }
    }
  };

  const copyCode = async (code: string) => {
    if (code) {
      await Clipboard.setStringAsync(code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // Determine Today's Status
  const todayNum = new Date().getDate();
  const currentMonthNum = new Date().getMonth() + 1;
  const currentYearNum = new Date().getFullYear();
  const isCurrentMonth =
    selectedYear === currentYearNum && selectedMonth === currentMonthNum;
  const todayRecord = isCurrentMonth
    ? attendanceRecords.find((r) => r.day === todayNum)
    : null;

  const cardBg = isDark ? "#1E293B" : "#FFFFFF";
  const borderCol = isDark ? "#334155" : "#E2E8F0";

  const getStatusBadge = (val?: string) => {
    switch (val) {
      case "P":
        return {
          label: t("attendance.present", "Present"),
          color: "#10B981",
          bg: "#DCFCE7",
          icon: "check-circle",
        };
      case "A":
        return {
          label: t("attendance.absent", "Absent"),
          color: "#EF4444",
          bg: "#FEE2E2",
          icon: "x-circle",
        };
      case "H":
        return {
          label: t("attendance.halfDay", "Half Day"),
          color: "#F59E0B",
          bg: "#FEF3C7",
          icon: "clock",
        };
      case "OT":
        return {
          label: t("attendance.overtime", "Overtime"),
          color: "#3B82F6",
          bg: "#DBEAFE",
          icon: "plus-circle",
        };
      default:
        return {
          label: t("attendance.unmarked", "Not Marked"),
          color: "#94A3B8",
          bg: isDark ? "#334155" : "#F1F5F9",
          icon: "help-circle",
        };
    }
  };

  const todayStatus = getStatusBadge(todayRecord?.value);

  const monthNames = [
    t("months.january", "January"),
    t("months.february", "February"),
    t("months.march", "March"),
    t("months.april", "April"),
    t("months.may", "May"),
    t("months.june", "June"),
    t("months.july", "July"),
    t("months.august", "August"),
    t("months.september", "September"),
    t("months.october", "October"),
    t("months.november", "November"),
    t("months.december", "December"),
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 16) + 8,
            backgroundColor: theme.backgroundSecondary,
            borderBottomColor: borderCol,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                DeviceEventEmitter.emit("OPEN_SETTINGS_DRAWER");
              }}
              style={[
                styles.headerIconBtn,
                {
                  backgroundColor: isDark ? "#334155" : "#F1F5F9",
                  marginRight: 10,
                },
              ]}
            >
              <Feather name="menu" size={20} color={theme.text} />
            </Pressable>
            <View style={styles.headerUserInfo}>
              <View style={styles.categoryPill}>
                <Text style={styles.categoryPillText}>{activeCategory}</Text>
              </View>
              <Text style={[styles.userNameText, { color: theme.text }]}>
                {activeName}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => navigation.navigate("Notifications")}
            style={[
              styles.headerIconBtn,
              { backgroundColor: isDark ? "#334155" : "#F1F5F9" },
            ]}
          >
            <Feather name="bell" size={20} color={theme.text} />
          </Pressable>
        </View>

        {/* Unique ID Badge Card */}
        <View
          style={[
            styles.uniqueIdCard,
            {
              backgroundColor: isDark ? "#064E3B" : "#ECFDF5",
              borderColor: "#10B981",
            },
          ]}
        >
          <View style={styles.uniqueIdLeft}>
            <MaterialCommunityIcons
              name="card-account-details"
              size={22}
              color="#10B981"
            />
            <View style={{ marginLeft: 8 }}>
              <Text style={[styles.uniqueIdLabel, { color: "#047857" }]}>
                {t("worker.uniqueIdLabel", "Worker Unique ID")}
              </Text>
              <Text style={[styles.uniqueIdValue, { color: "#065F46" }]}>
                {activeUniqueId}
              </Text>
            </View>
          </View>
          <View style={styles.uniqueIdActions}>
            <Pressable onPress={copyUniqueId} style={styles.idActionBtn}>
              <Feather name="copy" size={16} color="#059669" />
            </Pressable>
            <Pressable
              onPress={shareUniqueId}
              style={[styles.idActionBtn, { marginLeft: 8 }]}
            >
              <Feather name="share-2" size={16} color="#059669" />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 80 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Team Connection Widget */}
        <TeamConnectionWidget onRefreshParent={loadWorkerData} />

        {/* 1. SMART SITE DETECTION CARD */}
        {(todayContext?.activeWorkingSite ||
          todayContext?.detectedNearbySite ||
          todayContext?.defaultSite) && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: cardBg,
                borderColor: todayContext?.hasActiveSession
                  ? "#10B981"
                  : borderCol,
                borderLeftWidth: 4,
                borderLeftColor: todayContext?.hasActiveSession
                  ? "#10B981"
                  : theme.primary,
              },
            ]}
          >
            <View style={styles.cardTitleRow}>
              <Feather
                name="map-pin"
                size={18}
                color={
                  todayContext?.hasActiveSession ? "#10B981" : theme.primary
                }
              />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[styles.sectionHeading, { color: theme.text }]}>
                  {todayContext?.hasActiveSession
                    ? t("site.activeSiteToday", "🟢 Today's Active Site")
                    : todayContext?.detectedNearbySite
                      ? t("site.detectedNearby", "📍 Detected Nearby Site")
                      : t("site.assignedSite", "📍 Assigned Site")}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.siteAddressText,
                    { color: isDark ? "#CBD5E1" : "#475569" },
                  ]}
                >
                  {
                    (
                      todayContext.activeWorkingSite ||
                      todayContext.detectedNearbySite ||
                      todayContext.defaultSite
                    )?.name
                  }
                </Text>
              </View>

              {!todayContext?.hasActiveSession && (
                <Pressable
                  onPress={handleStartWork}
                  disabled={isStartingWork}
                  style={[
                    styles.startWorkBtn,
                    { backgroundColor: theme.primary },
                  ]}
                >
                  {isStartingWork ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="zap" size={14} color="#FFFFFF" />
                      <Text style={styles.startWorkBtnText}>
                        {t("site.startWork", "Start Work")}
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* 2. CONTRACTOR INSTRUCTION BANNER */}
        {todayContext?.latestInstruction && (
          <View
            style={[
              styles.instructionBanner,
              {
                backgroundColor: isDark ? "#312E81" : "#EEF2FF",
                borderColor: "#6366F1",
              },
            ]}
          >
            <View style={styles.instructionBannerHeader}>
              <MaterialCommunityIcons
                name="bullhorn"
                size={18}
                color="#6366F1"
              />
              <Text style={styles.instructionBannerTitle}>
                {t("site.contractorInstruction", "Contractor Instruction")}
              </Text>
              {todayContext.latestInstruction.timeStr && (
                <Text style={styles.instructionTimeTag}>
                  {todayContext.latestInstruction.timeStr}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.instructionBannerDesc,
                { color: isDark ? "#E0E7FF" : "#312E81" },
              ]}
            >
              "{todayContext.latestInstruction.description}"
            </Text>
          </View>
        )}

        {/* 3. PROMINENT CTA: SUBMIT WORK UPDATE */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            navigation.navigate("WorkerCameraTab");
          }}
          style={[
            styles.prominentWorkUpdateBtn,
            { backgroundColor: theme.primary },
          ]}
        >
          <View style={styles.workUpdateBtnIconWrapper}>
            <Feather name="camera" size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.prominentWorkUpdateTitle}>
              {t("camera.submitWorkUpdateBtn", "📸 Submit Work Photo Update")}
            </Text>
            <Text style={styles.prominentWorkUpdateSubtitle}>
              {todayContext?.workUpdates?.morning?.submitted &&
              !todayContext?.workUpdates?.evening?.submitted
                ? t(
                    "camera.eveningPendingPrompt",
                    "Capture and submit evening work completion photo",
                  )
                : t(
                    "camera.morningPendingPrompt",
                    "Capture and submit morning / evening work proof",
                  )}
            </Text>
          </View>
          <Feather name="chevron-right" size={22} color="#FFFFFF" />
        </Pressable>

        {/* 4. TODAY'S WORK PROOF STATUS BADGES */}
        <View style={styles.proofStatusRow}>
          <View
            style={[
              styles.proofStatusBadge,
              {
                backgroundColor: todayContext?.workUpdates?.morning?.submitted
                  ? isDark
                    ? "#064E3B"
                    : "#DCFCE7"
                  : isDark
                    ? "#1E293B"
                    : "#F1F5F9",
                borderColor: todayContext?.workUpdates?.morning?.submitted
                  ? "#10B981"
                  : borderCol,
              },
            ]}
          >
            <Feather
              name={
                todayContext?.workUpdates?.morning?.submitted
                  ? "check-circle"
                  : "clock"
              }
              size={16}
              color={
                todayContext?.workUpdates?.morning?.submitted
                  ? "#10B981"
                  : "#94A3B8"
              }
            />
            <View style={{ marginLeft: 8 }}>
              <Text
                style={[
                  styles.proofBadgeTitle,
                  {
                    color: todayContext?.workUpdates?.morning?.submitted
                      ? "#10B981"
                      : isDark
                        ? "#CBD5E1"
                        : "#475569",
                  },
                ]}
              >
                {t("camera.morning", "🌅 Morning Work")}
              </Text>
              <Text
                style={[
                  styles.proofBadgeSub,
                  {
                    color: todayContext?.workUpdates?.morning?.submitted
                      ? "#059669"
                      : isDark
                        ? "#94A3B8"
                        : "#64748B",
                  },
                ]}
              >
                {todayContext?.workUpdates?.morning?.submitted
                  ? `✅ ${todayContext.workUpdates.morning.time || "Submitted"}`
                  : `⏳ ${t("common.pending", "Pending")}`}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.proofStatusBadge,
              {
                backgroundColor: todayContext?.workUpdates?.evening?.submitted
                  ? isDark
                    ? "#064E3B"
                    : "#DCFCE7"
                  : isDark
                    ? "#1E293B"
                    : "#F1F5F9",
                borderColor: todayContext?.workUpdates?.evening?.submitted
                  ? "#10B981"
                  : borderCol,
              },
            ]}
          >
            <Feather
              name={
                todayContext?.workUpdates?.evening?.submitted
                  ? "check-circle"
                  : "clock"
              }
              size={16}
              color={
                todayContext?.workUpdates?.evening?.submitted
                  ? "#10B981"
                  : "#94A3B8"
              }
            />
            <View style={{ marginLeft: 8 }}>
              <Text
                style={[
                  styles.proofBadgeTitle,
                  {
                    color: todayContext?.workUpdates?.evening?.submitted
                      ? "#10B981"
                      : isDark
                        ? "#CBD5E1"
                        : "#475569",
                  },
                ]}
              >
                {t("camera.evening", "🌆 Evening Work")}
              </Text>
              <Text
                style={[
                  styles.proofBadgeSub,
                  {
                    color: todayContext?.workUpdates?.evening?.submitted
                      ? "#059669"
                      : isDark
                        ? "#94A3B8"
                        : "#64748B",
                  },
                ]}
              >
                {todayContext?.workUpdates?.evening?.submitted
                  ? `✅ ${todayContext.workUpdates.evening.time || "Submitted"}`
                  : `⏳ ${t("common.pending", "Pending")}`}
              </Text>
            </View>
          </View>
        </View>

        {/* Today's Attendance Highlight Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: cardBg, borderColor: borderCol },
          ]}
        >
          <View style={styles.cardTitleRow}>
            <Feather name="calendar" size={18} color={theme.primary} />
            <Text
              style={[
                styles.sectionHeading,
                { color: theme.text, marginLeft: 8 },
              ]}
            >
              {t("worker.todayStatus", "Today's Attendance Status")}
            </Text>
            <Text style={[styles.dateSubtext, { color: theme.textSecondary }]}>
              {new Date().toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </Text>
          </View>

          <View
            style={[styles.todayBadgeBig, { backgroundColor: todayStatus.bg }]}
          >
            <Feather
              name={todayStatus.icon as any}
              size={28}
              color={todayStatus.color}
            />
            <View style={{ marginLeft: 12 }}>
              <Text
                style={[styles.todayStatusText, { color: todayStatus.color }]}
              >
                {todayStatus.label}
              </Text>
              {todayRecord?.overtimeHours ? (
                <Text
                  style={[styles.todayOtText, { color: todayStatus.color }]}
                >
                  +{todayRecord.overtimeHours}{" "}
                  {t("attendance.hours", "hrs overtime")}
                </Text>
              ) : null}
            </View>
          </View>

          <Text
            style={[styles.viewOnlyDisclaimer, { color: theme.textSecondary }]}
          >
            {t(
              "worker.viewOnlyNotice",
              "🔒 Attendance is recorded and verified by your site supervisor or contractor.",
            )}
          </Text>
        </View>

        {/* Monthly Summary & Wage Calculation */}
        <View
          style={[
            styles.card,
            { backgroundColor: cardBg, borderColor: borderCol },
          ]}
        >
          <View style={styles.monthHeaderRow}>
            <View>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                {monthNames[selectedMonth - 1]} {selectedYear}
              </Text>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>
                {t(
                  "worker.monthlySummary",
                  "Monthly Attendance & Wage Details",
                )}
              </Text>
            </View>
            <View style={styles.monthSwitchRow}>
              <Pressable
                onPress={() => {
                  if (selectedMonth === 1) {
                    setSelectedMonth(12);
                    setSelectedYear((y) => y - 1);
                  } else {
                    setSelectedMonth((m) => m - 1);
                  }
                }}
                style={[
                  styles.monthArrowBtn,
                  { backgroundColor: isDark ? "#334155" : "#F1F5F9" },
                ]}
              >
                <Feather name="chevron-left" size={18} color={theme.text} />
              </Pressable>
              <Pressable
                onPress={() => {
                  if (selectedMonth === 12) {
                    setSelectedMonth(1);
                    setSelectedYear((y) => y + 1);
                  } else {
                    setSelectedMonth((m) => m + 1);
                  }
                }}
                style={[
                  styles.monthArrowBtn,
                  {
                    backgroundColor: isDark ? "#334155" : "#F1F5F9",
                    marginLeft: 6,
                  },
                ]}
              >
                <Feather name="chevron-right" size={18} color={theme.text} />
              </Pressable>
            </View>
          </View>

          {/* 4 Stat Boxes */}
          <View style={styles.statGrid}>
            <View
              style={[
                styles.statBox,
                { backgroundColor: isDark ? "#064E3B" : "#ECFDF5" },
              ]}
            >
              <Text style={[styles.statNum, { color: "#10B981" }]}>
                {summary.presentDays}
              </Text>
              <Text style={[styles.statLbl, { color: "#047857" }]}>
                {t("attendance.present", "Present")}
              </Text>
            </View>
            <View
              style={[
                styles.statBox,
                { backgroundColor: isDark ? "#450A0A" : "#FEF2F2" },
              ]}
            >
              <Text style={[styles.statNum, { color: "#EF4444" }]}>
                {summary.absentDays}
              </Text>
              <Text style={[styles.statLbl, { color: "#B91C1C" }]}>
                {t("attendance.absent", "Absent")}
              </Text>
            </View>
            <View
              style={[
                styles.statBox,
                { backgroundColor: isDark ? "#451A03" : "#FFFBEB" },
              ]}
            >
              <Text style={[styles.statNum, { color: "#F59E0B" }]}>
                {summary.halfDays}
              </Text>
              <Text style={[styles.statLbl, { color: "#B45309" }]}>
                {t("attendance.halfDay", "Half Day")}
              </Text>
            </View>
            <View
              style={[
                styles.statBox,
                { backgroundColor: isDark ? "#172554" : "#EFF6FF" },
              ]}
            >
              <Text style={[styles.statNum, { color: "#3B82F6" }]}>
                {summary.overtimeHours}h
              </Text>
              <Text style={[styles.statLbl, { color: "#1D4ED8" }]}>
                {t("attendance.overtime", "Overtime")}
              </Text>
            </View>
          </View>

          {/* Wage / Financial Details Container */}
          <View
            style={[
              styles.wageCard,
              {
                backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                borderColor: borderCol,
              },
            ]}
          >
            <View style={styles.wageRow}>
              <Text
                style={[styles.wageRowLabel, { color: theme.textSecondary }]}
              >
                {t("workers.dailyWage", "Daily Wage Rate")}
              </Text>
              <Text style={[styles.wageRowValue, { color: theme.text }]}>
                ₹
                {workerInfo?.dailyRate !== undefined
                  ? workerInfo.dailyRate
                  : user?.dailyWage || 0}{" "}
                / {t("common.day", "day")}
              </Text>
            </View>
            <View style={styles.wageDivider} />
            <View style={styles.wageRow}>
              <Text
                style={[styles.wageRowLabel, { color: theme.textSecondary }]}
              >
                {t("worker.totalEarnings", "Gross Earned")}
              </Text>
              <Text
                style={[
                  styles.wageRowValue,
                  { color: "#10B981", fontWeight: "700" },
                ]}
              >
                ₹{summary.totalEarned.toLocaleString("en-IN")}
              </Text>
            </View>
            {summary.advancePaid > 0 && (
              <View style={styles.wageRow}>
                <Text
                  style={[styles.wageRowLabel, { color: theme.textSecondary }]}
                >
                  {t("worker.advanceDeductions", "Advance Deductions")}
                </Text>
                <Text style={[styles.wageRowValue, { color: "#EF4444" }]}>
                  -₹{summary.advancePaid.toLocaleString("en-IN")}
                </Text>
              </View>
            )}
            {summary.totalPaid > 0 && (
              <View style={styles.wageRow}>
                <Text
                  style={[styles.wageRowLabel, { color: theme.textSecondary }]}
                >
                  {t("payment.totalPaid", "Paid Received")}
                </Text>
                <Text style={[styles.wageRowValue, { color: "#3B82F6" }]}>
                  -₹{summary.totalPaid.toLocaleString("en-IN")}
                </Text>
              </View>
            )}
            <View style={styles.wageDivider} />
            <View style={styles.wageRow}>
              <Text style={[styles.netPayLabel, { color: theme.text }]}>
                {t("worker.netPayable", "Net Payable Balance")}
              </Text>
              <Text style={[styles.netPayValue, { color: theme.primary }]}>
                ₹{summary.netPayable.toLocaleString("en-IN")}
              </Text>
            </View>
          </View>
        </View>

        {/* Daily Records List */}
        <View
          style={[
            styles.card,
            { backgroundColor: cardBg, borderColor: borderCol },
          ]}
        >
          <Text
            style={[
              styles.sectionHeading,
              { color: theme.text, marginBottom: 12 },
            ]}
          >
            {t("worker.dailyBreakdown", "Daily Attendance History")}
          </Text>
          {isLoading ? (
            <ActivityIndicator
              size="small"
              color={theme.primary}
              style={{ marginVertical: 20 }}
            />
          ) : attendanceRecords.length === 0 ? (
            <View style={styles.emptyBox}>
              <Feather name="calendar" size={32} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {t(
                  "worker.noRecordsThisMonth",
                  "No attendance records found for this month.",
                )}
              </Text>
            </View>
          ) : (
            attendanceRecords.map((item, idx) => {
              const statusInfo = getStatusBadge(item.value);
              return (
                <View
                  key={idx}
                  style={[
                    styles.dailyRecordRow,
                    {
                      borderBottomColor: borderCol,
                      borderBottomWidth:
                        idx === attendanceRecords.length - 1 ? 0 : 1,
                    },
                  ]}
                >
                  <View style={styles.dayCol}>
                    <Text style={[styles.dayNumber, { color: theme.text }]}>
                      {item.day} {monthNames[selectedMonth - 1]}
                    </Text>
                    {item.projectName && (
                      <Text
                        style={[
                          styles.siteMiniText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {item.projectName}
                      </Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.dailyStatusBadge,
                      { backgroundColor: statusInfo.bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dailyStatusText,
                        { color: statusInfo.color },
                      ]}
                    >
                      {item.value === "OT"
                        ? `OT (${item.overtimeHours || 0}h)`
                        : item.value}
                    </Text>
                  </View>
                  <Text style={[styles.dailyPayText, { color: theme.text }]}>
                    ₹{item.finalPay || 0}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  headerUserInfo: {
    flex: 1,
  },
  categoryPill: {
    alignSelf: "flex-start",
    backgroundColor: "#10B98120",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginBottom: 4,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
    textTransform: "uppercase",
  },
  userNameText: {
    fontSize: 20,
    fontWeight: "700",
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  uniqueIdCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: 4,
  },
  uniqueIdLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  uniqueIdLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  uniqueIdValue: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },
  uniqueIdActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  idActionBtn: {
    padding: 6,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  scrollContent: {
    padding: Spacing.md,
  },
  pendingCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    marginBottom: Spacing.md,
  },
  pendingHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  pendingTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#4F46E5",
  },
  pendingSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  pendingDesc: {
    fontSize: 13,
    marginTop: 10,
  },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  codeText: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 6,
    color: "#3730A3",
  },
  copyCodeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#EEF2FF",
    borderRadius: BorderRadius.sm,
  },
  copyCodeBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4F46E5",
    marginLeft: 4,
  },
  expiryNote: {
    fontSize: 11,
    color: "#6366F1",
    marginTop: 6,
    textAlign: "right",
  },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  contractorIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  cardLabel: {
    fontSize: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    marginTop: 1,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: "700",
  },
  helperNote: {
    fontSize: 12,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148, 163, 184, 0.2)",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  dateSubtext: {
    fontSize: 12,
  },
  todayBadgeBig: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: BorderRadius.md,
  },
  todayStatusText: {
    fontSize: 18,
    fontWeight: "800",
  },
  todayOtText: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  viewOnlyDisclaimer: {
    fontSize: 11,
    marginTop: 10,
    textAlign: "center",
  },
  monthHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  monthSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  monthArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  statGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  statNum: {
    fontSize: 18,
    fontWeight: "800",
  },
  statLbl: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  wageCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: 12,
  },
  wageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  wageRowLabel: {
    fontSize: 13,
  },
  wageRowValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  wageDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(148, 163, 184, 0.3)",
    marginVertical: 6,
  },
  netPayLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  netPayValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  emptyBox: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
    marginTop: 8,
  },
  dailyRecordRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  dayCol: {
    flex: 1,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: "600",
  },
  siteMiniText: {
    fontSize: 11,
    marginTop: 2,
  },
  dailyStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    marginRight: 16,
  },
  dailyStatusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  dailyPayText: {
    fontSize: 14,
    fontWeight: "700",
  },
  siteAddressText: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  startWorkBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 4,
  },
  startWorkBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  instructionBanner: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  instructionBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  instructionBannerTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4F46E5",
    flex: 1,
  },
  instructionTimeTag: {
    fontSize: 11,
    color: "#6366F1",
    fontWeight: "600",
  },
  instructionBannerDesc: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  prominentWorkUpdateBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    marginBottom: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  workUpdateBtnIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  prominentWorkUpdateTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  prominentWorkUpdateSubtitle: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 12,
    marginTop: 2,
  },
  proofStatusRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: Spacing.md,
  },
  proofStatusBadge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  proofBadgeTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  proofBadgeSub: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
});
