import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  Dimensions,
  Platform,
  Alert,
  Modal,
  DeviceEventEmitter,
  Text,
  Image,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeInDown,
  FadeInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import SettingsDrawer from "@/components/SettingsDrawer";
import { useNotifications, registerForPushNotificationsAsync } from "@/hooks/useNotifications";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { AttendanceEditorModal } from "@/components/AttendanceEditorModal";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useSocket } from "@/hooks/useSocket";
import { useTour } from "@/contexts/TourContext";
import {
  storage,
  Project,
  Worker,
  AttendanceRecord,
  AttendanceValue,
  API_URL,
} from "@/utils/storage";

// UI System Components
import { designSystem } from "@/constants/designSystem";
import { KPICard } from "@/components/ui/KPICard";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useInAppReview } from "@/hooks/useInAppReview";
import { markSessionStart, trackInteraction } from "@/utils/reviewTracker";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PrimeBillingTransaction {
  date: string;
  planName: string;
  amount: number;
  paymentId: string;
}

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  colors: [string, string];
  screen: string;
}

const getQuickActions = (t: any): QuickAction[] => [
  { id: "grid", label: t.dashboard?.attendanceGrid || "Attendance Grid", icon: "grid", colors: ["#22C55E", "#16A34A"], screen: "AttendanceDetail" },
  { id: "log", label: t.dashboard?.attendanceLog || "Attendance Log", icon: "file-text", colors: ["#3B82F6", "#2563EB"], screen: "Summary" },
  { id: "progress", label: t.dashboard?.workProgress || "Work / Progress", icon: "trending-up", colors: ["#A855F7", "#9333EA"], screen: "SiteManagementTab" },
  { id: "material", label: t.dashboard?.material || "Material", icon: "box", colors: ["#F97316", "#EA580C"], screen: "SiteManagementTab" },
  { id: "expense", label: t.dashboard?.expense || "Expense", icon: "credit-card", colors: ["#EC4899", "#DB2777"], screen: "SiteManagementTab" },
  { id: "photos", label: t.dashboard?.photos || "Photos", icon: "camera", colors: ["#06B6D4", "#0891B2"], screen: "SiteManagementTab" },
  { id: "gps", label: t.dashboard?.gpsLocation || "GPS Location", icon: "map-pin", colors: ["#10B981", "#059669"], screen: "AttendanceDetail" },
  { id: "issues", label: t.dashboard?.issuesDelays || "Issues / Delays", icon: "alert-circle", colors: ["#EF4444", "#DC2626"], screen: "Support" },
];

export default function DashboardScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { config: featureConfig } = useFeatureAccess();
  const subscriptionsEnabled = featureConfig?.subscriptionsEnabled ?? true;
  const { socket, connectSocket } = useSocket();
  const { unreadCount } = useNotifications();
  const insets = useSafeAreaInsets();
  const tour = useTour();

  useEffect(() => {
    registerForPushNotificationsAsync().catch(() => {});
  }, []);

  const welcomeRef = useRef<View>(null);
  const summaryRef = useRef<View>(null);
  const logRef = useRef<View>(null);
  const actionsRef = useRef<View>(null);
  const gpsRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const onLayoutWelcome = () => tour.registerTarget(0, welcomeRef);
  const onLayoutSummary = () => tour.registerTarget(1, summaryRef);
  const onLayoutLog = () => tour.registerTarget(2, logRef);
  const onLayoutActions = () => tour.registerTarget(3, actionsRef);
  const onLayoutGps = () => tour.registerTarget(4, gpsRef);

  // States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSite, setActiveSite] = useState<Project | null>(null);
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [workersList, setWorkersList] = useState<Worker[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [currentPlan, setCurrentPlan] = useState<"free" | "starter" | "professional" | "business" | "basic" | "super" | "premium">("free");
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showSuccessToast = useCallback((msg: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToastMessage(msg);
    setShowToast(true);

    toastTimerRef.current = setTimeout(() => {
      setShowToast(false);
      toastTimerRef.current = null;
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  let tabBarHeight = 65;
  try {
    tabBarHeight = useBottomTabBarHeight();
  } catch {
    tabBarHeight = insets.bottom + 65;
  }
  const toastBottom = (tabBarHeight > 0 ? tabBarHeight : insets.bottom + 65) + 16;
  const [streakCount, setStreakCount] = useState(1);
  const [smartInsight, setSmartInsight] = useState("Calculating live analytics...");
  const [quickMarkModalVisible, setQuickMarkModalVisible] = useState(false);
  const [quickMarkWorker, setQuickMarkWorker] = useState<Worker | null>(null);
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>("ALL");

  const [stats, setStats] = useState({
    totalWorkers: 0,
    present: 0,
    absent: 0,
    halfDay: 0,
    overtime: 0,
    rate: 0,
  });

  const [siteStats, setSiteStats] = useState({
    totalSites: 0,
    activeSites: 0,
    completedSites: 0,
    delayedSites: 0,
    workersPresent: 0,
    workersAbsent: 0,
    totalWorkers: 0,
    sitesInProgress: 0,
  });

  // Date helpers
  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const greetingHour = today.getHours();
  const greeting =
    greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";

  const triggerHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  // Load dashboard data
  const loadDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const sitesResult = await storage.getSites();
      const rawSites = sitesResult.sites || [];
      const projects = rawSites.map((s: any) => ({
        id: s.id,
        name: s.name,
        location: s.address || s.location,
        status: (s.status === "Completed" || s.status === "On Hold") ? "inactive" : "active",
        startDate: s.startDate,
        endDate: s.endDate,
        clientName: s.clientName,
      })) as any[];

      const statsData = await storage.getSiteDashboardStats();
      setSiteStats(statsData);

      const workers = await storage.getWorkers();
      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth();
      const todayDay = today.getDate();

      const attendance = await storage.getAttendanceForMonth(todayYear, todayMonth);

      const auth = await storage.getAuth();
      if (auth?.plan) setCurrentPlan(auth.plan);
      else if (user?.plan) setCurrentPlan(user.plan);

      setProjectsList(projects);
      setWorkersList(workers);
      setAttendanceRecords(attendance);

      const active = projects.find((p) => p.status === "active") || projects[0] || null;
      setActiveSite(active);

      // Default to ALL workers (contractor-wide scope) unless an explicit site filter is selected
      const siteWorkers = (selectedSiteFilter && selectedSiteFilter !== "ALL" && active)
        ? workers.filter((w) => w.projectId === active.id)
        : workers;
      const totalWorkers = siteWorkers.length;

      const todayAttendance = attendance.filter(
        (r) => r.year === todayYear && r.month === todayMonth && r.day === todayDay
      );

      let presentCount = 0, halfDayCount = 0, overtimeCount = 0;
      todayAttendance.forEach((rec) => {
        const belongsToScope = siteWorkers.some((sw) => sw.id === rec.workerId);
        if (belongsToScope) {
          if (rec.value === "P") presentCount++;
          else if (rec.value === "H") halfDayCount++;
          else if (rec.value === "OT") overtimeCount++;
        }
      });

      const absentCount = totalWorkers - presentCount - halfDayCount - overtimeCount;
      const rate = totalWorkers > 0
        ? Math.round(((presentCount + halfDayCount + overtimeCount) / totalWorkers) * 100)
        : 0;

      setStats({
        totalWorkers,
        present: presentCount,
        absent: Math.max(0, absentCount),
        halfDay: halfDayCount,
        overtime: overtimeCount,
        rate: totalWorkers > 0 ? rate : 0,
      });

      // Streak calculation
      let streak = 0;
      let checkDate = new Date();
      for (let i = 0; i < 30; i++) {
        const year = checkDate.getFullYear();
        const month = checkDate.getMonth();
        const day = checkDate.getDate();
        const hasAttendance = attendance.some(
          (r) => r.year === year && r.month === month && r.day === day &&
            (r.value === "P" || r.value === "A" || r.value === "H" || r.value === "OT" || typeof r.value === "number")
        );
        if (hasAttendance) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
        else {
          if (streak === 0 && checkDate.getDate() === today.getDate()) {
            checkDate.setDate(checkDate.getDate() - 1); continue;
          }
          break;
        }
      }
      setStreakCount(Math.max(1, streak));

      // Smart insight
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayAttendance = attendance.filter(
        (r) => r.year === yesterday.getFullYear() && r.month === yesterday.getMonth() && r.day === yesterday.getDate()
      );
      let yesterdayPresent = 0;
      yesterdayAttendance.forEach((rec) => {
        const belongs = siteWorkers.some((sw) => sw.id === rec.workerId);
        if (belongs && (rec.value === "P" || rec.value === "H" || rec.value === "OT")) yesterdayPresent++;
      });
      const yesterdayRate = totalWorkers > 0 ? Math.round((yesterdayPresent / totalWorkers) * 100) : 0;

      if (totalWorkers > 0) {
        if (rate > yesterdayRate) setSmartInsight(`Attendance improved by ${rate - yesterdayRate}% vs yesterday 🎉`);
        else if (rate < yesterdayRate) setSmartInsight(`Attendance dropped by ${yesterdayRate - rate}% vs yesterday ⚠️`);
        else setSmartInsight("Attendance is stable, matching yesterday's levels.");
      } else {
        setSmartInsight("Welcome! Register workers and sites to see live insights.");
      }

    } catch (error) {
      console.warn("Failed to load dashboard statistics:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Effects
  useEffect(() => { connectSocket(); }, []);

  useEffect(() => {
    const handleUpdate = () => { loadDashboardData(true); };
    socket.on("admin_dashboard_update", handleUpdate);
    const sub = DeviceEventEmitter.addListener("refreshData", () => loadDashboardData(true));
    return () => {
      socket.off("admin_dashboard_update", handleUpdate);
      sub.remove();
    };
  }, [socket]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
      markSessionStart();
    }, [activeSite?.id])
  );

  useInAppReview({ isReady: !loading && !refreshing });

  const deleteAttendanceLocally = async (workerId: string, year: number, month: number, day: number) => {
    const allRecords = await storage.getAttendance();
    const filtered = allRecords.filter(
      (r) => !(r.workerId === workerId && r.year === year && r.month === month && r.day === day)
    );
    await storage.setAttendance(filtered);
  };

  const handleFastMarkPresent = async (worker: Worker) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();
    const dailyRate = worker.dailyRate ?? 0;

    const newRecord: AttendanceRecord = {
      workerId: worker.id,
      projectId: activeSite?.id || undefined,
      year: todayYear,
      month: todayMonth,
      day: todayDay,
      value: "P",
      dailyRate,
      finalPay: dailyRate,
      timestamp: Date.now(),
    };

    // Optimistic UI update
    const previousRecords = [...attendanceRecords];
    setAttendanceRecords((prev) => {
      const idx = prev.findIndex(
        (r) => r.workerId === worker.id && r.year === todayYear && r.month === todayMonth && r.day === todayDay
      );
      const updated = [...prev];
      if (idx !== -1) {
        updated[idx] = newRecord;
      } else {
        updated.push(newRecord);
      }
      return updated;
    });

    try {
      await storage.setAttendanceRecord(newRecord);
      showSuccessToast("Attendance marked successfully.");
    } catch (e) {
      console.warn("Failed to mark present:", e);
      setAttendanceRecords(previousRecords);
      Alert.alert("Error", "Failed to save attendance. Please try again.");
    }
  };

  const handleMarkOptions = (workerId: string) => {
    triggerHaptic();
    const worker = workersList.find((w) => w.id === workerId);
    if (!worker) return;
    setQuickMarkWorker(worker);
    setQuickMarkModalVisible(true);
  };

  const handleSaveDetailedRecord = async (record: AttendanceRecord) => {
    try {
      await storage.setAttendanceRecord(record);
      setAttendanceRecords((prev) => {
        const idx = prev.findIndex(
          (r) => r.workerId === record.workerId && r.year === record.year && r.month === record.month && r.day === record.day
        );
        const updated = [...prev];
        if (idx !== -1) {
          updated[idx] = record;
        } else {
          updated.push(record);
        }
        return updated;
      });
      setQuickMarkModalVisible(false);
      await loadDashboardData(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccessToast("Attendance marked successfully.");
    } catch (e) {
      console.warn("Failed to save detailed record:", e);
      Alert.alert("Error", "Failed to save attendance. Please try again.");
    }
  };

  const handleClearDetailedRecord = async () => {
    if (!quickMarkWorker) return;
    try {
      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth();
      const todayDay = today.getDate();
      await deleteAttendanceLocally(quickMarkWorker.id, todayYear, todayMonth, todayDay);
      setAttendanceRecords((prev) =>
        prev.filter(
          (r) => !(r.workerId === quickMarkWorker.id && r.year === todayYear && r.month === todayMonth && r.day === todayDay)
        )
      );
      setQuickMarkModalVisible(false);
      await loadDashboardData(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.warn("Failed to clear attendance:", e);
    }
  };

  const displayWorkers = (selectedSiteFilter && selectedSiteFilter !== "ALL" && activeSite)
    ? workersList.filter((w) => w.projectId === activeSite.id)
    : workersList;

  const handleMarkAllPresent = async () => {
    triggerHaptic();
    try {
      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth();
      const todayDay = today.getDate();

      if (displayWorkers.length === 0) {
        Alert.alert("No Workers", "There are no workers registered to mark.");
        return;
      }

      const updated = [...attendanceRecords];

      for (const worker of displayWorkers) {
        const idx = updated.findIndex(
          (r) => r.workerId === worker.id && r.year === todayYear && r.month === todayMonth && r.day === todayDay
        );

        const dailyRate = worker.dailyRate ?? 0;
        const newRecord: AttendanceRecord = {
          workerId: worker.id,
          projectId: activeSite?.id || undefined,
          year: todayYear,
          month: todayMonth,
          day: todayDay,
          value: "P",
          dailyRate,
          finalPay: dailyRate,
          timestamp: Date.now(),
        };
        await storage.setAttendanceRecord(newRecord);

        if (idx !== -1) {
          updated[idx] = newRecord;
        } else {
          updated.push(newRecord);
        }
      }

      setAttendanceRecords(updated);
      await loadDashboardData(true);
      showSuccessToast("Attendance marked successfully.");
    } catch (e) {
      console.warn("Bulk mark failed:", e);
      Alert.alert("Error", "Failed to mark all workers. Please try again.");
    }
  };

  const onRefresh = async () => { setRefreshing(true); await loadDashboardData(false); };

  const ratePercent = stats.rate;
  const recentWorkers = workersList.slice(0, 6);

  const cardBg = isDark ? "#1E293B" : "#FFFFFF";
  const bgRoot = isDark ? "#0F172A" : "#F8FAFC";
  const borderColor = isDark ? "#334155" : "#E2E8F0";

  return (
    <View style={[styles.root, { backgroundColor: bgRoot }]}>
      {/* ── Header Section ─────────────────────────────────────────── */}
      <LinearGradient
        colors={isDark ? ["#0F172A", "#1E293B"] : ["#F97316", "#EA580C"]}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerInner} ref={welcomeRef} onLayout={onLayoutWelcome}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <ThemedText style={{ fontSize: 20, fontWeight: "900", color: "#FFFFFF" }}>
                Haajari Manager
              </ThemedText>
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  navigation.navigate("Notifications");
                }}
                style={{ padding: 4, position: "relative", marginRight: 8 }}
              >
                <Feather name="bell" size={22} color="#FFFFFF" />
                {unreadCount > 0 && (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      right: -2,
                      backgroundColor: "#EF4444",
                      borderRadius: 9,
                      minWidth: 16,
                      height: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 3,
                    }}
                  >
                    <ThemedText style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "800" }}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </ThemedText>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Small Plan Badge Nudge — only visible when subscriptions are enabled */}
            {subscriptionsEnabled && (
              <Pressable
                onPress={() => { triggerHaptic(); navigation.navigate("Subscription"); }}
                style={styles.nudgeBadge}
              >
                <ThemedText style={styles.nudgeBadgeText}>
                  {currentPlan === "free" || currentPlan === "basic" ? "Basic Plan" : currentPlan === "professional" || currentPlan === "super" ? "Super Plan" : "Premium Plan"}
                </ThemedText>
                <View style={styles.nudgeDivider} />
                <ThemedText style={styles.nudgeBadgeText}>
                  {workersList.length} / {currentPlan === "free" || currentPlan === "basic" ? 20 : currentPlan === "professional" || currentPlan === "super" ? 100 : "Unlimited"} Used
                </ThemedText>
                <Feather name="arrow-right" size={10} color="#FFFFFF" style={{ marginLeft: 4 }} />
              </Pressable>
            )}

            <ThemedText style={[styles.dateText, { color: isDark ? "#64748B" : "rgba(255,255,255,0.7)", marginTop: 6 }]}>
              {formattedDate}
            </ThemedText>
          </View>
          {/* Upgrade button — only visible when subscriptions are enabled */}
          {subscriptionsEnabled && (
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => { triggerHaptic(); navigation.navigate("Subscription"); }}
                style={styles.premiumBadgeBtn}
              >
                <Ionicons name="sparkles" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                <ThemedText style={styles.premiumBadgeBtnText}>Upgrade</ThemedText>
              </Pressable>
            </View>
          )}
        </View>

        {/* Streak badge */}
        <View style={[styles.streakBadge, { backgroundColor: isDark ? "#334155" : "rgba(255,255,255,0.2)" }]}>
          <Feather name="zap" size={14} color="#F97316" />
          <ThemedText style={[styles.streakText, { color: "#FFFFFF" }]}>
            {streakCount} day streak
          </ThemedText>
        </View>
      </LinearGradient>

      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 120, tabBarHeight + 90) }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. Top Site Information Card ───────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={[styles.topSiteCard, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.topSiteHeaderRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.topSiteName, { color: isDark ? "#FFFFFF" : "#0F172A" }]}>
                {activeSite ? activeSite.name : (user?.companyName || t.sites?.title || "Main Construction Site")}
              </ThemedText>
              <ThemedText style={[styles.topSiteDate, { color: isDark ? "#94A3B8" : theme.textSecondary }]}>
                {formattedDate}
              </ThemedText>
            </View>
            <View style={styles.topSiteStatusBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.activeStatusText}>{activeSite ? "Active" : "Live"}</Text>
            </View>
          </View>
          <View style={[styles.supervisorRow, { borderTopColor: borderColor }]}>
            <Feather name="user-check" size={14} color="#F97316" style={{ marginRight: 6 }} />
            <Text style={[styles.supervisorLabel, { color: isDark ? "#CBD5E1" : theme.textSecondary }]}>
              Supervisor: <Text style={{ fontWeight: "700", color: isDark ? "#FFFFFF" : "#0F172A" }}>{
                typeof (activeSite as any)?.supervisor === "object" && (activeSite as any)?.supervisor?.name
                  ? (activeSite as any).supervisor.name
                  : typeof (activeSite as any)?.supervisor === "string" && (activeSite as any).supervisor.trim().length > 0
                  ? (activeSite as any).supervisor
                  : (activeSite as any)?.supervisorName
                  ? (activeSite as any).supervisorName
                  : "Not Assigned"
              }</Text>
            </Text>
          </View>
        </Animated.View>

        {/* ── 2. Attendance Summary Cards (Compact Grid) ─────────────── */}
        <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.summaryGridContainer}>
          <SectionHeader title={t.dashboard?.todayAttendance || "Attendance Summary"} />
          <View style={styles.summaryCompactGrid}>
            <View style={[styles.summaryCompactCard, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[styles.summaryCardLabel, { color: isDark ? "#94A3B8" : theme.textSecondary }]}>{t.common?.total || "Total"}</Text>
              <Text style={[styles.summaryCardValue, { color: "#3B82F6" }]}>{stats.totalWorkers}</Text>
            </View>
            <View style={[styles.summaryCompactCard, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[styles.summaryCardLabel, { color: isDark ? "#94A3B8" : theme.textSecondary }]}>{t.summary?.present || "Present"}</Text>
              <Text style={[styles.summaryCardValue, { color: "#22C55E" }]}>{stats.present}</Text>
            </View>
            <View style={[styles.summaryCompactCard, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[styles.summaryCardLabel, { color: isDark ? "#94A3B8" : theme.textSecondary }]}>{t.summary?.absent || "Absent"}</Text>
              <Text style={[styles.summaryCardValue, { color: "#EF4444" }]}>{stats.absent}</Text>
            </View>
            <View style={[styles.summaryCompactCard, { backgroundColor: cardBg, borderColor }]}>
              <Text style={[styles.summaryCardLabel, { color: isDark ? "#94A3B8" : theme.textSecondary }]}>{t.summary?.halfDay || "Half Day"}</Text>
              <Text style={[styles.summaryCardValue, { color: "#F59E0B" }]}>{stats.halfDay}</Text>
            </View>
          </View>
        </Animated.View>

        {/* ── 3. Attendance Grid Launcher Card ──────────────────────── */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={{ paddingHorizontal: 16, marginTop: 12 }}>
          <Pressable
            onPress={() => {
              triggerHaptic();
              navigation.navigate("AttendanceDetail");
            }}
            style={[styles.attendanceGridLauncherCard, { backgroundColor: isDark ? "#1E293B" : "#FFF7ED", borderColor: "#F97316" }]}
          >
            <View style={styles.launcherIconCircle}>
              <Feather name="calendar" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <ThemedText style={[styles.launcherTitle, { color: isDark ? "#FFFFFF" : "#0F172A" }]}>
                📅 Attendance Grid
              </ThemedText>
              <ThemedText style={[styles.launcherSubtitle, { color: isDark ? "#94A3B8" : "#92400E" }]}>
                View worker attendance by date
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color="#F97316" />
          </Pressable>
        </Animated.View>

        {/* ── 4. Quick Actions Grid ─────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(240).springify()}
          style={styles.section}
          ref={actionsRef}
          onLayout={onLayoutActions}
        >
          <SectionHeader title={t.dashboard?.quickActions || "Quick Actions"} />
          <View style={styles.quickActionsGrid}>
            {getQuickActions(t).map((action) => (
              <AnimatedPressable
                key={action.id}
                style={[styles.quickActionCard, { backgroundColor: cardBg, borderColor }]}
                onPress={() => {
                  triggerHaptic();
                  trackInteraction("screen_navigated");
                  navigation.navigate(action.screen);
                }}
              >
                <LinearGradient colors={action.colors} style={styles.quickActionIconWrap}>
                  <Feather name={action.icon as any} size={20} color="#FFFFFF" />
                </LinearGradient>
                <ThemedText style={[styles.quickActionLabel, { color: isDark ? "#FFFFFF" : "#0F172A" }]}>{action.label}</ThemedText>
              </AnimatedPressable>
            ))}
          </View>
        </Animated.View>

        {/* ── Active Site Card ──────────────────────────────────────── */}
        {activeSite ? (
          <Animated.View
            entering={FadeInDown.delay(280).springify()}
            style={[styles.siteCard, { backgroundColor: cardBg, borderColor }]}
          >
            <View style={styles.siteCardHeader}>
              <LinearGradient colors={["#F97316", "#EA580C"]} style={styles.siteIconWrap}>
                <Feather name="map-pin" size={16} color="#FFF" />
              </LinearGradient>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <ThemedText style={[styles.siteCardTitle, { color: isDark ? "#FFFFFF" : "#0F172A" }]} numberOfLines={1}>{activeSite.name}</ThemedText>
                <ThemedText style={[styles.siteCardLocation, { color: isDark ? "#94A3B8" : theme.textSecondary }]} numberOfLines={1}>
                  {activeSite.location || "Default Location"}
                </ThemedText>
              </View>
              <Badge label="Active" variant="success" />
            </View>

            <View style={styles.siteCardStats}>
              <Feather name="users" size={14} color={isDark ? "#94A3B8" : theme.textSecondary} style={{ marginRight: 6 }} />
              <ThemedText style={{ color: isDark ? "#CBD5E1" : theme.textSecondary, fontSize: 13 }}>
                {siteStats.workersPresent}/{siteStats.totalWorkers} workers on site
              </ThemedText>
            </View>

            <View style={styles.siteCardActions}>
              <PrimaryButton
                label="Mark Attendance"
                onPress={() => { triggerHaptic(); navigation.navigate("AttendanceDetail"); }}
                size="sm"
                style={{ flex: 1 }}
              />
              <Pressable
                onPress={() => { triggerHaptic(); navigation.navigate("ProjectManagement"); }}
                style={[styles.siteActionOutlineBtn, { borderColor }]}
              >
                <Feather name="external-link" size={14} color={isDark ? "#FFFFFF" : theme.text} style={{ marginRight: 6 }} />
                <ThemedText style={{ color: isDark ? "#FFFFFF" : theme.text, fontSize: 13, fontWeight: "600" }}>Manage</ThemedText>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}

        {/* ── Today's Attendance Log ────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(320).springify()}
          style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}
          ref={logRef}
          onLayout={onLayoutLog}
        >
          <View style={styles.sectionCardHeader}>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.sectionTitle, { color: isDark ? "#FFFFFF" : "#0F172A" }]}>Today's Attendance Log</ThemedText>
              <ThemedText style={[styles.sectionSubtitle, { color: isDark ? "#94A3B8" : theme.textSecondary }]}>
                Tap row to mark, hold for options.
              </ThemedText>
            </View>
            <Pressable
              onPress={handleMarkAllPresent}
              style={[styles.viewAllBtn, { backgroundColor: theme.primary + "15" }]}
            >
              <Feather name="check" size={14} color={theme.primary} />
              <ThemedText style={[styles.viewAllText, { color: theme.primary, marginLeft: 4 }]}>All Present</ThemedText>
            </Pressable>
          </View>

          {displayWorkers.length === 0 ? (
            <View style={styles.emptyWorkersLog}>
              <Feather name="users" size={24} color={isDark ? "#94A3B8" : theme.textSecondary} style={{ marginBottom: 8 }} />
              <ThemedText style={{ color: isDark ? "#94A3B8" : theme.textSecondary, fontSize: 13 }}>
                No workers registered for this site.
              </ThemedText>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {displayWorkers.map((worker, idx) => {
                const todayYear = today.getFullYear();
                const todayMonth = today.getMonth();
                const todayDay = today.getDate();
                const todayRec = attendanceRecords.find(
                  (r) =>
                    r.workerId === worker.id &&
                    r.year === todayYear &&
                    r.month === todayMonth &&
                    r.day === todayDay
                );
                const val = todayRec?.value;

                const handleSingleTap = () => {
                  // Single tap ALWAYS marks worker as Present immediately (no modal, no bottom sheet)
                  handleFastMarkPresent(worker);
                };

                const handleLongPress = () => {
                  // Hold for 2 seconds opens Attendance Options Pop-Up Modal
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleMarkOptions(worker.id);
                };

                return (
                  <Pressable
                    key={worker.id}
                    onPress={handleSingleTap}
                    onLongPress={handleLongPress}
                    delayLongPress={2000}
                    style={({ pressed }) => [
                      styles.workerLogRow,
                      {
                        backgroundColor: pressed
                          ? (isDark ? "#334155" : "#F1F5F9")
                          : (isDark ? "#0F172A" : "#F8FAFC"),
                        borderColor,
                      },
                    ]}
                  >
                    <Avatar name={worker.name} size="sm" />
                    <View style={styles.workerLogInfo}>
                      <ThemedText style={[styles.workerLogName, { color: isDark ? "#FFFFFF" : "#0F172A" }]}>{worker.name}</ThemedText>
                      <ThemedText style={[styles.workerLogCategory, { color: isDark ? "#94A3B8" : theme.textSecondary }]}>
                        {worker.category ? worker.category.toUpperCase() : "GENERAL WORKER"}
                      </ThemedText>
                    </View>
                    <View style={styles.workerLogStatus}>
                      {val === "P" && <Badge label="P" variant="success" />}
                      {val === "H" && <Badge label="1/2" variant="warning" />}
                      {val === "OT" && <Badge label="OT" variant="info" />}
                      {val === "A" && <Badge label="A" variant="error" />}
                      {!val && <Badge label="Unmarked" variant="neutral" />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Animated.View>

        {/* ── Recent Workers Row ────────────────────────────────────── */}
        {recentWorkers.length > 0 && (
          <Animated.View entering={FadeInDown.delay(360).springify()} style={styles.section}>
            <SectionHeader
              title="Recent Workers"
              actionLabel="View All"
              onAction={() => navigation.navigate("Workers")}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {recentWorkers.map((worker, idx) => {
                const todayRec = attendanceRecords.find(
                  (r) =>
                    r.workerId === worker.id &&
                    r.year === today.getFullYear() &&
                    r.month === today.getMonth() &&
                    r.day === today.getDate()
                );
                const status = todayRec?.value;
                let badgeVariant: "success" | "warning" | "error" | "info" | "neutral" = "neutral";
                let label = "Unmarked";
                
                if (status === "P") { badgeVariant = "success"; label = "P"; }
                else if (status === "A") { badgeVariant = "error"; label = "A"; }
                else if (status === "H") { badgeVariant = "warning"; label = "1/2"; }
                else if (status === "OT") { badgeVariant = "info"; label = "OT"; }

                return (
                  <Animated.View
                    key={worker.id}
                    entering={FadeInRight.delay(idx * 50).springify()}
                    style={[styles.workerChip, { backgroundColor: cardBg, borderColor }]}
                  >
                    <Avatar name={worker.name} size="md" />
                    <ThemedText style={styles.workerName} numberOfLines={1}>{worker.name}</ThemedText>
                    <Badge label={label} variant={badgeVariant} />
                  </Animated.View>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}


        {/* ── Empty State ───────────────────────────────────────────── */}
        {!loading && stats.totalWorkers === 0 && workersList.length === 0 && (
          <Animated.View entering={FadeInDown.delay(400).springify()}>
            <EmptyState
              icon="users"
              title="Start Managing Workforce"
              subtitle="Add your first site and workers to begin tracking attendance."
              actionLabel="Add First Worker"
              onAction={() => navigation.navigate("AddWorker")}
            />
          </Animated.View>
        )}
      </ScrollView>

      {/* ── Attendance Success Notification / Toast (Overlay Layering Fix) ── */}
      <Modal
        visible={showToast}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
            toastTimerRef.current = null;
          }
          setShowToast(false);
        }}
        statusBarTranslucent
      >
        <View style={styles.toastModalOverlay} pointerEvents="box-none">
          <Animated.View
            entering={FadeInDown.duration(200)}
            style={[
              styles.toast,
              {
                bottom: toastBottom,
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                borderColor: isDark ? "rgba(34, 197, 94, 0.5)" : "#BBF7D0",
              },
            ]}
          >
            <View style={styles.toastIconCircle}>
              <Feather name="check" size={16} color="#FFFFFF" />
            </View>
            <ThemedText style={[styles.toastText, { color: isDark ? "#FFFFFF" : "#0F172A" }]}>
              {toastMessage || "Attendance marked successfully."}
            </ThemedText>
            <Pressable
              onPress={() => {
                if (toastTimerRef.current) {
                  clearTimeout(toastTimerRef.current);
                  toastTimerRef.current = null;
                }
                setShowToast(false);
              }}
              hitSlop={8}
              style={styles.toastCloseBtn}
            >
              <Feather name="x" size={16} color={isDark ? "#94A3B8" : "#64748B"} />
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      {/* Settings Drawer */}
      <SettingsDrawer
        visible={showSettingsDrawer}
        onClose={() => setShowSettingsDrawer(false)}
      />

      {/* ── Unified Attendance Editor Modal ─────────────────────────── */}
      <AttendanceEditorModal
        visible={quickMarkModalVisible}
        worker={quickMarkWorker}
        date={today}
        projectId={activeSite?.id}
        initialRecord={
          quickMarkWorker
            ? attendanceRecords.find(
                (r) =>
                  r.workerId === quickMarkWorker.id &&
                  r.year === today.getFullYear() &&
                  r.month === today.getMonth() &&
                  r.day === today.getDate()
              ) || null
            : null
        }
        onClose={() => setQuickMarkModalVisible(false)}
        onSave={handleSaveDetailedRecord}
        onClear={handleClearDetailedRecord}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  headerInner: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  greeting: { fontSize: 13, fontWeight: "500", marginBottom: 2 },
  userName: { fontSize: 22, fontWeight: "800", letterSpacing: 0.3, marginBottom: 2 },
  dateText: { fontSize: 12 },
  headerActions: { flexDirection: "row", gap: 8 },
  nudgeBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 6,
  },
  nudgeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  nudgeDivider: {
    width: 1,
    height: 10,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    marginHorizontal: 8,
  },
  premiumBadgeBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EA580C",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  premiumBadgeBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  streakText: { fontSize: 12, fontWeight: "700" },

  // Insights
  insightBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  insightText: { fontSize: 13, fontWeight: "500", flex: 1 },

  // KPI
  kpiScroll: { marginTop: 16, marginBottom: 8 },
  kpiScrollContent: { paddingHorizontal: 16, gap: 12 },

  // Section Card
  sectionCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  sectionSubtitle: { fontSize: 12, marginTop: 2 },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  viewAllText: { fontSize: 11, fontWeight: "700" },

  // Attendance Breakdown
  attendanceRow: { flexDirection: "row", alignItems: "center", gap: 24 },
  rateRingWrap: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  rateRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  rateRingTrack: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 6,
  },
  rateRingFill: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 6,
    borderLeftColor: "transparent",
    borderBottomColor: "transparent",
  },
  rateRingCenter: { alignItems: "center" },
  rateValue: { fontSize: 16, fontWeight: "800" },
  rateLabel: { fontSize: 10, fontWeight: "600", marginTop: 1 },

  statsBreakdown: { flex: 1, gap: 6 },
  statRow: { flexDirection: "row", alignItems: "center" },
  statDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statRowLabel: { fontSize: 12, flex: 1 },
  statRowValue: { fontSize: 13, fontWeight: "700" },

  // Quick Actions Grid
  section: { marginHorizontal: 16, marginTop: 20 },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 10,
  },
  quickActionCard: {
    flex: 1,
    minWidth: "45%",
    aspectRatio: 1.5,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickActionLabel: { fontSize: 12, fontWeight: "700", textAlign: "center" },

  // Active Site Card
  siteCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  siteCardHeader: { flexDirection: "row", alignItems: "center" },
  siteIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  siteCardTitle: { fontSize: 15, fontWeight: "800" },
  siteCardLocation: { fontSize: 12, marginTop: 2 },
  siteCardStats: { flexDirection: "row", alignItems: "center", marginTop: 14 },
  siteCardActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  siteActionOutlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },

  // Today's Attendance Log List
  emptyWorkersLog: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  workerLogRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  workerLogInfo: { flex: 1, marginLeft: 12 },
  workerLogName: { fontSize: 14, fontWeight: "700" },
  workerLogCategory: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  workerLogStatus: { alignItems: "flex-end" },

  // Recent Workers
  workerChip: {
    width: 100,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
  },
  workerName: { fontSize: 12, fontWeight: "700", textAlign: "center" },

  // Bottom Slogan PNG Asset
  bottomSloganWrapper: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    marginTop: 28,
    marginBottom: 16,
  },
  bottomSloganImg: {
    width: "100%",
    maxWidth: 320,
    height: 106,
  },

  // Toast Layering Overlay
  toastModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 25,
    zIndex: 999999,
  },
  toastIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
  },
  toastText: { fontSize: 14, fontWeight: "700", flex: 1 },
  toastCloseBtn: { padding: 4 },

  // Modal Sheet style
  qmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  qmSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  qmHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  qmWorkerHeader: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  qmWorkerName: { fontSize: 16, fontWeight: "800" },
  qmWorkerSub: { fontSize: 12, marginTop: 2 },
  qmTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 12, textTransform: "uppercase" },
  qmGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  qmStatusBtn: {
    flex: 1,
    minWidth: "45%",
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  qmStatusLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  qmFooterRow: { flexDirection: "row", gap: 10 },
  qmClearBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  qmClearText: { fontSize: 13, fontWeight: "700" },
  qmCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  qmCancelText: { fontSize: 13, fontWeight: "700" },

  // Top Site Card
  topSiteCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  topSiteHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  topSiteName: {
    fontSize: 18,
    fontWeight: "900",
  },
  topSiteDate: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: "500",
  },
  topSiteStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22C55E",
    marginRight: 6,
  },
  activeStatusText: {
    color: "#166534",
    fontSize: 12,
    fontWeight: "700",
  },
  supervisorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  supervisorLabel: {
    fontSize: 13,
  },

  // Summary Compact Grid (2x2)
  summaryGridContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  summaryCompactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  summaryCompactCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCardLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryCardValue: {
    fontSize: 22,
    fontWeight: "900",
  },

  // Attendance Grid Launcher Card
  attendanceGridLauncherCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  launcherIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
  },
  launcherTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  launcherSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
});
