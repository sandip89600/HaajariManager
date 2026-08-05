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
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
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

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
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

const QUICK_ACTIONS: QuickAction[] = [
  { id: "attendance", label: "Mark Attendance", icon: "check-square", colors: ["#22C55E", "#16A34A"], screen: "AttendanceDetail" },
  { id: "workers", label: "Add Worker", icon: "user-plus", colors: ["#3B82F6", "#2563EB"], screen: "Workers" },
  { id: "reports", label: "View Reports", icon: "bar-chart-2", colors: ["#A855F7", "#9333EA"], screen: "Summary" },
  { id: "sites", label: "Manage Sites", icon: "map-pin", colors: ["#F97316", "#EA580C"], screen: "ProjectManagement" },
];

export default function DashboardScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { socket, connectSocket } = useSocket();
  const insets = useSafeAreaInsets();
  const tour = useTour();

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
  const [currentPlan, setCurrentPlan] = useState<"free" | "starter" | "professional" | "business">("free");
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [streakCount, setStreakCount] = useState(1);
  const [smartInsight, setSmartInsight] = useState("Calculating live analytics...");
  const [quickMarkModalVisible, setQuickMarkModalVisible] = useState(false);
  const [quickMarkWorker, setQuickMarkWorker] = useState<Worker | null>(null);

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

      const siteWorkers = active ? workers.filter((w) => w.projectId === active.id) : workers;
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
    const handleUpdate = () => { loadDashboardData(true); DeviceEventEmitter.emit("refreshData"); };
    socket.on("admin_dashboard_update", handleUpdate);
    socket.on("admin_activity", handleUpdate);
    const sub = DeviceEventEmitter.addListener("refreshData", () => loadDashboardData(true));
    return () => {
      socket.off("admin_dashboard_update", handleUpdate);
      socket.off("admin_activity", handleUpdate);
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

  const handleMarkPresent = async (workerId: string) => {
    triggerHaptic();
    try {
      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth();
      const todayDay = today.getDate();
      const existing = attendanceRecords.find(
        (r) => r.workerId === workerId && r.year === todayYear && r.month === todayMonth && r.day === todayDay
      );
      const newValue: AttendanceValue = existing?.value === "P" ? "A" : "P";
      const worker = workersList.find((w) => w.id === workerId);
      const dailyRate = worker?.dailyRate ?? 0;
      const finalPay = newValue === "P" ? dailyRate : 0;
      await storage.setAttendanceRecord({
        workerId,
        year: todayYear,
        month: todayMonth,
        day: todayDay,
        value: newValue,
        dailyRate,
        finalPay,
        timestamp: Date.now(),
      });
      setToastMessage(newValue === "P" ? "Marked Present ✓" : "Marked Absent ✗");
      setShowToast(true);
      await loadDashboardData(true);
    } catch (err) { console.warn("Quick mark failed:", err); }
  };

  const handleMarkOptions = (workerId: string) => {
    triggerHaptic();
    const worker = workersList.find((w) => w.id === workerId);
    if (!worker) return;
    setQuickMarkWorker(worker);
    setQuickMarkModalVisible(true);
  };

  const updateAttendanceValue = async (workerId: string, val: AttendanceValue | null) => {
    try {
      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth();
      const todayDay = today.getDate();

      const existingIdx = attendanceRecords.findIndex(
        (r) => r.workerId === workerId && r.year === todayYear && r.month === todayMonth && r.day === todayDay
      );

      if (val === null) {
        if (existingIdx !== -1) {
          await deleteAttendanceLocally(workerId, todayYear, todayMonth, todayDay);
          const updated = [...attendanceRecords];
          updated.splice(existingIdx, 1);
          setAttendanceRecords(updated);
        }
      } else {
        const worker = workersList.find((w) => w.id === workerId);
        const dailyRate = worker?.dailyRate ?? 0;
        const finalPay = val === "P" ? dailyRate : val === "H" ? dailyRate / 2 : val === "OT" ? dailyRate * 1.5 : 0;
        
        const newRecord: AttendanceRecord = {
          workerId,
          projectId: activeSite?.id || undefined,
          year: todayYear,
          month: todayMonth,
          day: todayDay,
          value: val,
          dailyRate,
          finalPay,
          timestamp: Date.now(),
        };
        await storage.setAttendanceRecord(newRecord);
        const updated = [...attendanceRecords];
        if (existingIdx !== -1) {
          updated[existingIdx] = newRecord;
        } else {
          updated.push(newRecord);
        }
        setAttendanceRecords(updated);
      }

      await loadDashboardData(true);
      const workerName = workersList.find((w) => w.id === workerId)?.name || "Worker";
      let statusLabel = "Present";
      if (val === "H") statusLabel = "Half Day";
      else if (val === "OT") statusLabel = "Overtime";
      else if (val === "A") statusLabel = "Absent";
      else if (val === null) statusLabel = "Unmarked";

      setToastMessage(`Marked ${workerName} as ${statusLabel}`);
      setShowToast(true);

      if (val !== null) {
        trackInteraction("attendance_marked");
      }
    } catch (e) {
      console.warn("Failed to update attendance value:", e);
    }
  };

  const displayWorkers = activeSite
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
      setToastMessage("Marked all workers as Present");
      setShowToast(true);
    } catch (e) {
      console.warn("Bulk mark failed:", e);
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
            <ThemedText style={[styles.greeting, { color: isDark ? "#94A3B8" : "rgba(255,255,255,0.7)" }]}>
              {greeting},
            </ThemedText>
            <ThemedText style={[styles.userName, { color: "#FFFFFF" }]}>
              {user?.name || "Contractor"} 👋
            </ThemedText>
            <ThemedText style={[styles.dateText, { color: isDark ? "#64748B" : "rgba(255,255,255,0.7)", marginTop: 4 }]}>
              {formattedDate}
            </ThemedText>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => { triggerHaptic(); setShowSettingsDrawer(true); }}
              style={[styles.headerBtn, { backgroundColor: isDark ? "#334155" : "rgba(255,255,255,0.2)" }]}
            >
              <Feather name="settings" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
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
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
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
        {/* ── Smart Insight Banner ──────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={[styles.insightBanner, { backgroundColor: isDark ? "#1E293B" : "#FFF7ED", borderColor: "#F97316" + "40" }]}>
          <Feather name="zap" size={14} color="#F97316" style={{ marginRight: 8 }} />
          <ThemedText style={[styles.insightText, { color: isDark ? "#FED7AA" : "#92400E" }]} numberOfLines={2}>
            {smartInsight}
          </ThemedText>
        </Animated.View>

        {/* ── KPI Scroll ────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.kpiScrollContent}
            style={styles.kpiScroll}
          >
            <KPICard title="Total" value={stats.totalWorkers} icon="users" color="#3B82F6" isLoading={loading} />
            <KPICard title="Present" value={stats.present} icon="check-circle" color="#22C55E" isLoading={loading} />
            <KPICard title="Absent" value={stats.absent} icon="x-circle" color="#EF4444" isLoading={loading} />
            <KPICard title="Half Day" value={stats.halfDay} icon="clock" color="#F59E0B" isLoading={loading} />
          </ScrollView>
        </Animated.View>

        {/* ── Today's Attendance Breakdown Card ─────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(200).springify()}
          style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}
          ref={summaryRef}
          onLayout={onLayoutSummary}
        >
          <View style={styles.sectionCardHeader}>
            <View>
              <ThemedText style={styles.sectionTitle}>Attendance Overview</ThemedText>
              <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Rate: {ratePercent}% today
              </ThemedText>
            </View>
            <Pressable
              onPress={() => { triggerHaptic(); navigation.navigate("AttendanceDetail"); }}
              style={[styles.viewAllBtn, { backgroundColor: theme.primary + "15" }]}
            >
              <ThemedText style={[styles.viewAllText, { color: theme.primary }]}>Grid Sheet</ThemedText>
              <Feather name="arrow-right" size={14} color={theme.primary} />
            </Pressable>
          </View>

          <View style={styles.attendanceRow}>
            {/* Circle Progress bar */}
            <View style={styles.rateRingWrap}>
              <View style={styles.rateRing}>
                <View style={[styles.rateRingTrack, { borderColor: isDark ? "#334155" : "#E2E8F0" }]} />
                <View style={[styles.rateRingFill, {
                  borderColor: ratePercent >= 80 ? "#22C55E" : ratePercent >= 50 ? "#F59E0B" : "#EF4444",
                  transform: [{ rotate: `${(ratePercent / 100) * 360}deg` }],
                }]} />
                <View style={styles.rateRingCenter}>
                  <ThemedText style={[styles.rateValue, {
                    color: ratePercent >= 80 ? "#22C55E" : ratePercent >= 50 ? "#F59E0B" : "#EF4444",
                  }]}>{ratePercent}%</ThemedText>
                  <ThemedText style={[styles.rateLabel, { color: theme.textSecondary }]}>Rate</ThemedText>
                </View>
              </View>
            </View>

            <View style={styles.statsBreakdown}>
              {[
                { label: "Present", value: stats.present, color: "#22C55E" },
                { label: "Absent", value: stats.absent, color: "#EF4444" },
                { label: "Half Day", value: stats.halfDay, color: "#F59E0B" },
                { label: "Overtime", value: stats.overtime, color: "#A855F7" },
              ].map((item) => (
                <View key={item.label} style={styles.statRow}>
                  <View style={[styles.statDot, { backgroundColor: item.color }]} />
                  <ThemedText style={[styles.statRowLabel, { color: theme.textSecondary }]}>{item.label}</ThemedText>
                  <ThemedText style={[styles.statRowValue, { color: item.color }]}>{item.value}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* ── Quick Actions Grid ────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(240).springify()}
          style={styles.section}
          ref={actionsRef}
          onLayout={onLayoutActions}
        >
          <SectionHeader title="Quick Actions" />
          <View style={styles.quickActionsGrid}>
            {QUICK_ACTIONS.map((action) => (
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
                <ThemedText style={styles.quickActionLabel}>{action.label}</ThemedText>
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
                <ThemedText style={styles.siteCardTitle} numberOfLines={1}>{activeSite.name}</ThemedText>
                <ThemedText style={[styles.siteCardLocation, { color: theme.textSecondary }]} numberOfLines={1}>
                  {activeSite.location || "Default Location"}
                </ThemedText>
              </View>
              <Badge label="Active" variant="success" />
            </View>

            <View style={styles.siteCardStats}>
              <Feather name="users" size={14} color={theme.textSecondary} style={{ marginRight: 6 }} />
              <ThemedText style={{ color: theme.textSecondary, fontSize: 13 }}>
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
                <Feather name="external-link" size={14} color={theme.text} style={{ marginRight: 6 }} />
                <ThemedText style={{ color: theme.text, fontSize: 13, fontWeight: "600" }}>Manage</ThemedText>
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
              <ThemedText style={styles.sectionTitle}>Today's Attendance Log</ThemedText>
              <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
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
              <Feather name="users" size={24} color={theme.textSecondary} style={{ marginBottom: 8 }} />
              <ThemedText style={{ color: theme.textSecondary, fontSize: 13 }}>
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

                return (
                  <Pressable
                    key={worker.id}
                    onPress={() => handleMarkPresent(worker.id)}
                    onLongPress={() => handleMarkOptions(worker.id)}
                    delayLongPress={300}
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
                      <ThemedText style={styles.workerLogName}>{worker.name}</ThemedText>
                      <ThemedText style={[styles.workerLogCategory, { color: theme.textSecondary }]}>
                        {worker.category ? worker.category.toUpperCase() : "GENERAL WORKER"}
                      </ThemedText>
                    </View>
                    <View style={styles.workerLogStatus}>
                      {val === "P" && <Badge label="Present" variant="success" />}
                      {val === "H" && <Badge label="Half Day" variant="warning" />}
                      {val === "OT" && <Badge label="Overtime" variant="info" />}
                      {val === "A" && <Badge label="Absent" variant="error" />}
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
                
                if (status === "P") { badgeVariant = "success"; label = "Present"; }
                else if (status === "A") { badgeVariant = "error"; label = "Absent"; }
                else if (status === "H") { badgeVariant = "warning"; label = "Half Day"; }
                else if (status === "OT") { badgeVariant = "info"; label = "Overtime"; }

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

      {/* Toast notification */}
      {showToast && (
        <View style={[styles.toast, { backgroundColor: isDark ? "#1E293B" : "#FFF" }]}>
          <Feather name="check-circle" size={18} color="#22C55E" />
          <ThemedText style={[styles.toastText, { color: theme.text }]}>{toastMessage}</ThemedText>
          <Pressable onPress={() => setShowToast(false)}>
            <Feather name="x" size={16} color={theme.textSecondary} />
          </Pressable>
        </View>
      )}

      {/* Settings Drawer */}
      <SettingsDrawer
        visible={showSettingsDrawer}
        onClose={() => setShowSettingsDrawer(false)}
      />

      {/* ── Quick-Mark Attendance Modal ─────────────────────────────── */}
      <Modal
        visible={quickMarkModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setQuickMarkModalVisible(false)}
      >
        <Pressable
          style={styles.qmOverlay}
          onPress={() => setQuickMarkModalVisible(false)}
        >
          <Pressable style={[styles.qmSheet, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]} onPress={() => {}}>
            <View style={[styles.qmHandle, { backgroundColor: isDark ? "#475569" : "#CBD5E1" }]} />

            {quickMarkWorker && (() => {
              const todayRec = attendanceRecords.find(
                (r) =>
                  r.workerId === quickMarkWorker.id &&
                  r.year === today.getFullYear() &&
                  r.month === today.getMonth() &&
                  r.day === today.getDate()
              );
              const currentVal = todayRec?.value;
              return (
                <View style={styles.qmWorkerHeader}>
                  <Avatar name={quickMarkWorker.name} size="md" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <ThemedText style={styles.qmWorkerName}>{quickMarkWorker.name}</ThemedText>
                    <ThemedText style={[styles.qmWorkerSub, { color: theme.textSecondary }]}>
                      {quickMarkWorker.category ? quickMarkWorker.category.toUpperCase() : "WORKER"}
                      {currentVal ? `  •  Today: ${currentVal}` : "  •  Unmarked"}
                    </ThemedText>
                  </View>
                </View>
              );
            })()}

            <ThemedText style={[styles.qmTitle, { color: theme.textSecondary }]}>Change Today's Status</ThemedText>

            <View style={styles.qmGrid}>
              <Pressable
                style={({ pressed }) => [styles.qmStatusBtn, { backgroundColor: pressed ? "#16A34A" : "#22C55E" }]}
                onPress={() => { triggerHaptic(); updateAttendanceValue(quickMarkWorker!.id, "P"); setQuickMarkModalVisible(false); }}
              >
                <ThemedText style={styles.qmStatusLabel}>Present</ThemedText>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.qmStatusBtn, { backgroundColor: pressed ? "#DC2626" : "#EF4444" }]}
                onPress={() => { triggerHaptic(); updateAttendanceValue(quickMarkWorker!.id, "A"); setQuickMarkModalVisible(false); }}
              >
                <ThemedText style={styles.qmStatusLabel}>Absent</ThemedText>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.qmStatusBtn, { backgroundColor: pressed ? "#D97706" : "#F59E0B" }]}
                onPress={() => { triggerHaptic(); updateAttendanceValue(quickMarkWorker!.id, "H"); setQuickMarkModalVisible(false); }}
              >
                <ThemedText style={styles.qmStatusLabel}>Half Day</ThemedText>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.qmStatusBtn, { backgroundColor: pressed ? "#7C3AED" : "#A855F7" }]}
                onPress={() => { triggerHaptic(); updateAttendanceValue(quickMarkWorker!.id, "OT"); setQuickMarkModalVisible(false); }}
              >
                <ThemedText style={styles.qmStatusLabel}>Overtime</ThemedText>
              </Pressable>
            </View>

            <View style={styles.qmFooterRow}>
              <Pressable
                style={[styles.qmClearBtn, { borderColor: isDark ? "#475569" : "#CBD5E1", backgroundColor: isDark ? "#0F172A" : "#F8FAFC" }]}
                onPress={() => { triggerHaptic(); updateAttendanceValue(quickMarkWorker!.id, null); setQuickMarkModalVisible(false); }}
              >
                <ThemedText style={[styles.qmClearText, { color: theme.textSecondary }]}>⚪ Clear</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.qmCancelBtn, { borderColor: isDark ? "#475569" : "#E2E8F0", backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]}
                onPress={() => setQuickMarkModalVisible(false)}
              >
                <ThemedText style={[styles.qmCancelText, { color: theme.textSecondary }]}>Cancel</ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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

  // Toast
  toast: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  toastText: { fontSize: 13, fontWeight: "600", flex: 1 },

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
});
