import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
  Image,
  RefreshControl,
  DeviceEventEmitter,
  Text,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useSocket } from "@/hooks/useSocket";
import { Spacing, BorderRadius } from "@/constants/theme";
import {
  storage,
  siteActivityStorage,
  Project,
  Worker,
  authenticatedFetch,
  API_URL,
} from "@/utils/storage";

type ActiveTab =
  | "updates"
  | "photos"
  | "overview"
  | "workers"
  | "materials"
  | "expenses"
  | "reports"
  | "analytics";

type UpdateFilter = "ALL" | "MORNING" | "EVENING" | "ISSUES";

function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function SiteDetailControlScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const { socket } = useSocket();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { siteId } = route.params || {};

  const [site, setSite] = useState<Project | null>(null);
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    route.params?.initialTab || "updates"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ----------------------------------------------------
  // SITE CONTROL, UPDATES & PHOTOS STATE
  // ----------------------------------------------------
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [updateFilter, setUpdateFilter] = useState<UpdateFilter>("ALL");
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState<string>("ALL");
  const [controlData, setControlData] = useState<any>(null);

  // Instruction Modal State
  const [showInstructionModal, setShowInstructionModal] = useState(false);
  const [instructionText, setInstructionText] = useState("");
  const [instructionPriority, setInstructionPriority] = useState<"NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [isPostingInstruction, setIsPostingInstruction] = useState(false);

  // Resolve Issue Modal State
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedIssueToResolve, setSelectedIssueToResolve] = useState<any>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isResolving, setIsResolving] = useState(false);

  // Photo Full-Screen Viewer Modal State
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<{
    photoUrl: string;
    workerName?: string;
    siteName?: string;
    activityType?: string;
    timeStr?: string;
    dateStr?: string;
    description?: string;
    location?: any;
  } | null>(null);

  // ----------------------------------------------------
  // LEGACY TAB STATES
  // ----------------------------------------------------
  const [spentAmount, setSpentAmount] = useState(0);
  const [expenseBreakdown, setExpenseBreakdown] = useState<any>({
    material: 0,
    machinery: 0,
    labour: 0,
    vendor: 0,
    other: 0,
  });
  const [delayDays, setDelayDays] = useState(0);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [mbEntries, setMbEntries] = useState<any[]>([]);

  const [materials, setMaterials] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Load all site data & control center
  const loadSiteData = async (showIndicator = true) => {
    if (!siteId) return;
    if (showIndicator) setIsLoading(true);
    try {
      // 1. Fetch site control center metrics, timeline & photos
      try {
        const ctrl = await siteActivityStorage.getSiteControlCenter(siteId, selectedDate);
        if (ctrl && ctrl.success) {
          setControlData(ctrl);
        }
      } catch (cErr) {
        console.warn("Failed to fetch site control center", cErr);
      }

      // 2. Fetch basic site details
      let currentSite = (await storage.getSiteById(siteId)) as any;
      const allProjects = await storage.getProjects();
      if (!currentSite) {
        currentSite = allProjects.find((p) => p.id === siteId) || null;
      }
      setSite(currentSite);

      // 3. Workers
      const workersList = await storage.getWorkers();
      setAllWorkers(workersList);

      // 4. Materials & photos
      try {
        const matRes = await authenticatedFetch(`${API_URL}/sites/${siteId}/materials`);
        if (matRes.ok) setMaterials(await matRes.json());

        const photRes = await siteActivityStorage.getSitePhotos(siteId, {
          date: selectedDate,
        });
        if (photRes && photRes.photos) {
          setPhotos(photRes.photos);
        }
      } catch (e) {}

      // 5. Analytics
      try {
        const res = await authenticatedFetch(`${API_URL}/projects/${siteId}/dashboard`);
        if (res.ok) {
          const data = await res.json();
          setSpentAmount(data.totalSpent || 0);
          setExpenseBreakdown(data.expenseBreakdown || {});
          setDelayDays(data.totalDelayDays || 0);
        }
        const expRes = await authenticatedFetch(`${API_URL}/projects/${siteId}/expenses`);
        if (expRes.ok) setExpenses(await expRes.json());

        const mbRes = await authenticatedFetch(`${API_URL}/projects/${siteId}/mb-entries`);
        if (mbRes.ok) setMbEntries(await mbRes.json());
      } catch (e) {}
    } catch (err) {
      console.warn("loadSiteData error", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadSiteData(true);
  }, [siteId, selectedDate]);

  // Real-time Socket listener: updates automatically when worker uploads
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("refreshData", () => {
      loadSiteData(false);
    });

    if (socket) {
      const handleActivity = (data: any) => {
        if (!data || data.siteId === siteId || data.activity?.siteId === siteId) {
          loadSiteData(false);
        }
      };
      socket.on("site:activity_added", handleActivity);
      socket.on("admin_dashboard_update", handleActivity);

      return () => {
        sub.remove();
        socket.off("site:activity_added", handleActivity);
        socket.off("admin_dashboard_update", handleActivity);
      };
    }

    return () => sub.remove();
  }, [socket, siteId, selectedDate]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadSiteData(false);
  };

  // Submit Site Instruction
  const handleSubmitInstruction = async () => {
    if (!instructionText.trim()) {
      Alert.alert("Required", "Please enter instruction details.");
      return;
    }
    setIsPostingInstruction(true);
    try {
      await siteActivityStorage.addSiteInstruction(siteId, {
        description: instructionText.trim(),
        priority: instructionPriority,
      });
      triggerHaptic();
      setShowInstructionModal(false);
      setInstructionText("");
      setInstructionPriority("NORMAL");
      loadSiteData(false);
      Alert.alert("Success", "Instruction broadcasted to site workers.");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to post instruction");
    } finally {
      setIsPostingInstruction(false);
    }
  };

  // Resolve Issue Action
  const handleConfirmResolveIssue = async () => {
    if (!selectedIssueToResolve) return;
    setIsResolving(true);
    try {
      await siteActivityStorage.resolveSiteIssue(
        selectedIssueToResolve._id || selectedIssueToResolve.id,
        resolutionNotes
      );
      triggerHaptic();
      setShowResolveModal(false);
      setSelectedIssueToResolve(null);
      setResolutionNotes("");
      loadSiteData(false);
      Alert.alert("Resolved", "Issue has been marked as resolved.");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to resolve issue");
    } finally {
      setIsResolving(false);
    }
  };

  // Worker list for current site
  const siteWorkers = useMemo(() => {
    return allWorkers.filter((w: Worker) => w.projectId === siteId);
  }, [allWorkers, siteId]);

  // Combined timeline filtering
  const filteredTimeline = useMemo(() => {
    if (!controlData?.dailyTimeline) return [];
    let items = controlData.dailyTimeline as any[];

    // 1. Worker filter
    if (selectedWorkerFilter !== "ALL") {
      items = items.filter(
        (i) =>
          i.workerId === selectedWorkerFilter ||
          i.userId === selectedWorkerFilter ||
          i.workerId?._id === selectedWorkerFilter
      );
    }

    // 2. Sub-tab filter
    if (updateFilter === "MORNING") {
      items = items.filter((i) => i.activityType === "MORNING_WORK");
    } else if (updateFilter === "EVENING") {
      items = items.filter((i) => i.activityType === "EVENING_WORK");
    } else if (updateFilter === "ISSUES") {
      items = items.filter((i) => i.activityType === "ISSUE");
    }

    return items;
  }, [controlData, updateFilter, selectedWorkerFilter]);

  // Filtered Photos List for 2-column gallery
  const filteredPhotos = useMemo(() => {
    const rawPhotos = controlData?.sitePhotos || photos || [];
    let list = rawPhotos.map((p: any) => ({
      id: p.id || p._id,
      photoUrl: p.photo?.url || (typeof p.photo === "string" ? p.photo : p.photoUri || p.url || p),
      workerName: p.workerName || p.workerId?.name || "Worker",
      workerRole: p.workerRole || p.workerId?.category || "Labour",
      activityType: p.activityType || p.photoType || "MORNING_WORK",
      timeStr: p.timeStr || "Today",
      dateStr: p.dateStr || selectedDate,
      description: p.description,
      location: p.location,
    })).filter((p: any) => !!p.photoUrl);

    if (updateFilter === "MORNING") {
      list = list.filter((p: any) => p.activityType === "MORNING_WORK");
    } else if (updateFilter === "EVENING") {
      list = list.filter((p: any) => p.activityType === "EVENING_WORK");
    } else if (updateFilter === "ISSUES") {
      list = list.filter((p: any) => p.activityType === "ISSUE");
    }

    if (selectedWorkerFilter !== "ALL") {
      list = list.filter(
        (p: any) => p.workerName === selectedWorkerFilter || p.workerId === selectedWorkerFilter
      );
    }

    return list;
  }, [controlData, photos, updateFilter, selectedWorkerFilter, selectedDate]);

  // Counts for photos
  const morningPhotosCount = useMemo(() => {
    const rawPhotos = controlData?.sitePhotos || photos || [];
    return rawPhotos.filter((p: any) => (p.activityType || p.photoType) === "MORNING_WORK").length;
  }, [controlData, photos]);

  const eveningPhotosCount = useMemo(() => {
    const rawPhotos = controlData?.sitePhotos || photos || [];
    return rawPhotos.filter((p: any) => (p.activityType || p.photoType) === "EVENING_WORK").length;
  }, [controlData, photos]);

  // Pending Workers helper
  const pendingMorningWorkers = useMemo(() => {
    if (!controlData?.workers) return [];
    return controlData.workers.filter((w: any) => w.morningStatus === "pending");
  }, [controlData]);

  const pendingEveningWorkers = useMemo(() => {
    if (!controlData?.workers) return [];
    return controlData.workers.filter((w: any) => w.eveningStatus === "pending");
  }, [controlData]);

  if (!site && !controlData) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  const siteDisplayName = controlData?.site?.name || site?.name || "Site Details";
  const siteDisplayAddress = controlData?.site?.address || site?.location || "Nashik";

  return (
    <ThemedView style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      {/* 1. TOP MAIN HEADER */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable
          onPress={() => {
            triggerHaptic();
            navigation.goBack();
          }}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>

        <View style={{ flex: 1, marginLeft: 8 }}>
          <ThemedText numberOfLines={1} style={styles.headerTitle}>
            {siteDisplayName}
          </ThemedText>
          <ThemedText numberOfLines={1} style={styles.headerSubtitle}>
            📍 {siteDisplayAddress}
          </ThemedText>
        </View>

        {/* Post Instruction Quick Button */}
        <Pressable
          onPress={() => {
            triggerHaptic();
            setShowInstructionModal(true);
          }}
          style={[styles.instructionHeaderBtn, { backgroundColor: theme.primary }]}
        >
          <Feather name="volume-2" size={16} color="#FFFFFF" />
          <Text style={styles.instructionHeaderBtnText}>+ Instruction</Text>
        </Pressable>
      </View>

      {/* 2. MAIN TABS SCROLL ROW */}
      <View style={[styles.tabsScrollContainer, { borderBottomColor: theme.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {(
            [
              { id: "updates", label: "🏗️ Updates & Feed" },
              { id: "photos", label: "📸 Site Photos" },
              { id: "overview", label: t("sites.timelineStages", "Timeline & Stages") },
              { id: "workers", label: t("sites.workersWages", "Workers & Wages") },
              { id: "materials", label: t("sites.materials", "Materials") },
              { id: "reports", label: t("sites.reportsDocs", "Reports & Docs") },
              { id: "analytics", label: t("sites.analytics", "Analytics") },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => {
                  triggerHaptic();
                  setActiveTab(tab.id);
                }}
                style={[
                  styles.tabItem,
                  {
                    borderBottomColor: isActive ? theme.primary : "transparent",
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.tabText,
                    {
                      color: isActive ? theme.primary : "#6B7280",
                      fontWeight: isActive ? "800" : "600",
                    },
                  ]}
                >
                  {tab.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. TAB CONTENT */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
          />
        }
      >
        {/* ========================================================================= */}
        {/* TAB 1: UPDATES & SITE CONTROL COMMAND CENTER                             */}
        {/* ========================================================================= */}
        {activeTab === "updates" && (
          <View>
            {/* A. Date Quick Selector Bar */}
            <View style={styles.dateSelectorRow}>
              <View style={styles.datePillsGroup}>
                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    setSelectedDate(getTodayStr());
                  }}
                  style={[
                    styles.datePill,
                    selectedDate === getTodayStr()
                      ? { backgroundColor: theme.primary, borderColor: theme.primary }
                      : { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.datePillText,
                      selectedDate === getTodayStr()
                        ? { color: "#FFFFFF", fontWeight: "700" }
                        : { color: theme.textSecondary },
                    ]}
                  >
                    Today
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    setSelectedDate(getYesterdayStr());
                  }}
                  style={[
                    styles.datePill,
                    selectedDate === getYesterdayStr()
                      ? { backgroundColor: theme.primary, borderColor: theme.primary }
                      : { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.datePillText,
                      selectedDate === getYesterdayStr()
                        ? { color: "#FFFFFF", fontWeight: "700" }
                        : { color: theme.textSecondary },
                    ]}
                  >
                    Yesterday
                  </Text>
                </Pressable>
              </View>

              <ThemedText style={styles.currentDateLabel}>
                📅 {selectedDate}
              </ThemedText>
            </View>

            {/* B. TOP KPI SUMMARY METRIC CARDS */}
            <View style={styles.kpiGrid}>
              {/* Workers Present */}
              <View
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.kpiCardTop}>
                  <Text style={styles.kpiEmoji}>👷</Text>
                  <Text style={[styles.kpiVal, { color: "#16A34A" }]}>
                    {controlData?.metrics?.presentCount || 0}
                    <Text style={{ fontSize: 13, color: theme.textSecondary }}>
                      /{controlData?.metrics?.totalWorkers || 0}
                    </Text>
                  </Text>
                </View>
                <Text style={styles.kpiTitle}>Workers Present</Text>
              </View>

              {/* Total Updates */}
              <View
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.kpiCardTop}>
                  <Text style={styles.kpiEmoji}>📸</Text>
                  <Text style={[styles.kpiVal, { color: theme.text }]}>
                    {controlData?.metrics?.workUpdatesCount || 0}
                  </Text>
                </View>
                <Text style={styles.kpiTitle}>Total Updates</Text>
              </View>

              {/* Morning Progress */}
              <View
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.kpiCardTop}>
                  <Text style={styles.kpiEmoji}>🌅</Text>
                  <Text style={[styles.kpiVal, { color: theme.text }]}>
                    {controlData?.morningProgress?.submittedCount || 0}/
                    {controlData?.morningProgress?.totalWorkers || 0}
                  </Text>
                </View>
                <Text style={styles.kpiTitle}>
                  Morning ({controlData?.morningProgress?.percentage || 0}%)
                </Text>
              </View>

              {/* Evening Progress */}
              <View
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.kpiCardTop}>
                  <Text style={styles.kpiEmoji}>🌆</Text>
                  <Text style={[styles.kpiVal, { color: theme.text }]}>
                    {controlData?.eveningProgress?.submittedCount || 0}/
                    {controlData?.eveningProgress?.totalWorkers || 0}
                  </Text>
                </View>
                <Text style={styles.kpiTitle}>
                  Evening ({controlData?.eveningProgress?.percentage || 0}%)
                </Text>
              </View>
            </View>

            {/* Open Issues Alert Strip (if > 0) */}
            {(controlData?.metrics?.openIssuesCount || 0) > 0 && (
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setUpdateFilter("ISSUES");
                }}
                style={[
                  styles.openIssuesAlertStrip,
                  { backgroundColor: isDark ? "rgba(239,68,68,0.2)" : "#FEF2F2" },
                ]}
              >
                <Feather name="alert-triangle" size={18} color="#DC2626" />
                <ThemedText style={styles.openIssuesAlertText}>
                  {controlData.metrics.openIssuesCount} Open Site Issue
                  {controlData.metrics.openIssuesCount > 1 ? "s" : ""} requiring attention.
                </ThemedText>
                <Feather name="chevron-right" size={18} color="#DC2626" />
              </Pressable>
            )}

            {/* C. SEGMENTED FILTER BAR ([ALL] [MORNING] [EVENING] [ISSUES]) */}
            <View style={styles.segmentedFilterContainer}>
              {(["ALL", "MORNING", "EVENING", "ISSUES"] as UpdateFilter[]).map((filter) => {
                const isSelected = updateFilter === filter;
                return (
                  <Pressable
                    key={filter}
                    onPress={() => {
                      triggerHaptic();
                      setUpdateFilter(filter);
                    }}
                    style={[
                      styles.segmentedFilterBtn,
                      isSelected
                        ? { backgroundColor: theme.primary }
                        : { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentedFilterText,
                        isSelected
                          ? { color: "#FFFFFF", fontWeight: "800" }
                          : { color: theme.textSecondary },
                      ]}
                    >
                      {filter === "ALL" && "📋 ALL"}
                      {filter === "MORNING" && "🌅 MORNING"}
                      {filter === "EVENING" && "🌆 EVENING"}
                      {filter === "ISSUES" && "⚠️ ISSUES"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* D. SUB-TAB VIEW: MORNING PROGRESS BAR & PENDING WORKERS */}
            {updateFilter === "MORNING" && (
              <View
                style={[
                  styles.progressSectionCard,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.progressHeaderRow}>
                  <ThemedText style={styles.progressSectionTitle}>
                    🌅 Morning Work Submission Progress
                  </ThemedText>
                  <Text style={[styles.progressSectionVal, { color: theme.primary }]}>
                    {controlData?.morningProgress?.submittedCount || 0} /{" "}
                    {controlData?.morningProgress?.totalWorkers || 0} (
                    {controlData?.morningProgress?.percentage || 0}%)
                  </Text>
                </View>

                {/* Visual Progress Bar */}
                <View
                  style={[
                    styles.progressBarTrack,
                    { backgroundColor: isDark ? "#334155" : "#E2E8F0" },
                  ]}
                >
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${controlData?.morningProgress?.percentage || 0}%`,
                        backgroundColor: "#16A34A",
                      },
                    ]}
                  />
                </View>

                {/* Pending Workers Alert Box */}
                {pendingMorningWorkers.length > 0 && (
                  <View
                    style={[
                      styles.pendingWorkersBox,
                      {
                        backgroundColor: isDark ? "rgba(217, 119, 6, 0.15)" : "#FEF3C7",
                        borderColor: "#F59E0B",
                      },
                    ]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Feather name="clock" size={15} color="#D97706" />
                      <Text style={styles.pendingWorkersTitle}>
                        Pending Morning Updates ({pendingMorningWorkers.length})
                      </Text>
                    </View>
                    <View style={styles.pendingWorkerTagsRow}>
                      {pendingMorningWorkers.map((w: any) => (
                        <View key={w.id} style={styles.pendingWorkerTag}>
                          <Text style={styles.pendingWorkerTagText}>
                            👷 {w.name} ({w.category})
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* E. SUB-TAB VIEW: EVENING PROGRESS BAR & PENDING WORKERS */}
            {updateFilter === "EVENING" && (
              <View
                style={[
                  styles.progressSectionCard,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.progressHeaderRow}>
                  <ThemedText style={styles.progressSectionTitle}>
                    🌆 Evening Work Submission Progress
                  </ThemedText>
                  <Text style={[styles.progressSectionVal, { color: theme.primary }]}>
                    {controlData?.eveningProgress?.submittedCount || 0} /{" "}
                    {controlData?.eveningProgress?.totalWorkers || 0} (
                    {controlData?.eveningProgress?.percentage || 0}%)
                  </Text>
                </View>

                {/* Visual Progress Bar */}
                <View
                  style={[
                    styles.progressBarTrack,
                    { backgroundColor: isDark ? "#334155" : "#E2E8F0" },
                  ]}
                >
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${controlData?.eveningProgress?.percentage || 0}%`,
                        backgroundColor: "#2563EB",
                      },
                    ]}
                  />
                </View>

                {/* Pending Workers Alert Box */}
                {pendingEveningWorkers.length > 0 && (
                  <View
                    style={[
                      styles.pendingWorkersBox,
                      {
                        backgroundColor: isDark ? "rgba(217, 119, 6, 0.15)" : "#FEF3C7",
                        borderColor: "#F59E0B",
                      },
                    ]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Feather name="clock" size={15} color="#D97706" />
                      <Text style={styles.pendingWorkersTitle}>
                        Pending Evening Updates ({pendingEveningWorkers.length})
                      </Text>
                    </View>
                    <View style={styles.pendingWorkerTagsRow}>
                      {pendingEveningWorkers.map((w: any) => (
                        <View key={w.id} style={styles.pendingWorkerTag}>
                          <Text style={styles.pendingWorkerTagText}>
                            👷 {w.name} ({w.category})
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* F. CHRONOLOGICAL TIMELINE FEED */}
            <View style={styles.feedContainer}>
              <ThemedText style={styles.feedSectionTitle}>
                {updateFilter === "ALL" && "Timeline Feed"}
                {updateFilter === "MORNING" && "Morning Updates Feed"}
                {updateFilter === "EVENING" && "Evening Updates Feed"}
                {updateFilter === "ISSUES" && "Reported Issues"}
              </ThemedText>

              {filteredTimeline.length === 0 ? (
                <View
                  style={[
                    styles.emptyTimelineBox,
                    {
                      backgroundColor: theme.backgroundDefault,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>📋</Text>
                  <ThemedText style={styles.emptyTimelineTitle}>
                    No Updates Found
                  </ThemedText>
                  <ThemedText style={styles.emptyTimelineDesc}>
                    {updateFilter === "ISSUES"
                      ? "Great! There are no reported issues for this site."
                      : "Workers haven't submitted any activity for the selected date yet."}
                  </ThemedText>
                </View>
              ) : (
                filteredTimeline.map((item: any) => {
                  const isIssue = item.activityType === "ISSUE";
                  const isInstruction = item.activityType === "INSTRUCTION";
                  const isMorning = item.activityType === "MORNING_WORK";
                  const isEvening = item.activityType === "EVENING_WORK";

                  const photoUri = item.photo?.url || (typeof item.photo === "string" ? item.photo : null);

                  return (
                    <View
                      key={item._id || item.id}
                      style={[
                        styles.timelineCard,
                        {
                          backgroundColor: theme.backgroundDefault,
                          borderColor: isIssue && item.status === "OPEN" ? "#FCA5A5" : theme.border,
                        },
                      ]}
                    >
                      {/* Top Header: User Profile, Activity Badge & Time */}
                      <View style={styles.timelineCardHeader}>
                        <View style={styles.timelineUserInfo}>
                          <View
                            style={[
                              styles.userAvatarCircle,
                              { backgroundColor: isDark ? "#334155" : "#E2E8F0" },
                            ]}
                          >
                            <Text style={{ fontSize: 14 }}>
                              {isIssue ? "⚠️" : isInstruction ? "📢" : "👷"}
                            </Text>
                          </View>
                          <View>
                            <ThemedText style={styles.timelineUserName}>
                              {item.userName || "Worker"}
                            </ThemedText>
                            <Text style={styles.timelineUserRole}>
                              {item.workerRole || "Labour"}
                            </Text>
                          </View>
                        </View>

                        <View style={{ alignItems: "flex-end" }}>
                          <View
                            style={[
                              styles.activityBadge,
                              isMorning
                                ? { backgroundColor: "rgba(22, 163, 74, 0.12)" }
                                : isEvening
                                ? { backgroundColor: "rgba(37, 99, 235, 0.12)" }
                                : isIssue
                                ? { backgroundColor: "rgba(220, 38, 38, 0.12)" }
                                : { backgroundColor: "rgba(217, 119, 6, 0.12)" },
                            ]}
                          >
                            <Text
                              style={[
                                styles.activityBadgeText,
                                isMorning
                                  ? { color: "#16A34A" }
                                  : isEvening
                                  ? { color: "#2563EB" }
                                  : isIssue
                                  ? { color: "#DC2626" }
                                  : { color: "#D97706" },
                              ]}
                            >
                              {isMorning && "🌅 Morning"}
                              {isEvening && "🌆 Evening"}
                              {isIssue && "⚠️ Issue"}
                              {isInstruction && "📢 Instruction"}
                            </Text>
                          </View>
                          <Text style={styles.timelineTimeText}>
                            {item.timeStr || "Just now"}
                          </Text>
                        </View>
                      </View>

                      {/* Photo Display (Tap to Full-Screen) */}
                      {photoUri ? (
                        <Pressable
                          onPress={() => {
                            triggerHaptic();
                            setSelectedPhotoModal({
                              photoUrl: photoUri,
                              workerName: item.userName,
                              siteName: siteDisplayName,
                              activityType: item.activityType,
                              timeStr: item.timeStr,
                              dateStr: item.dateStr,
                              description: item.description,
                              location: item.location,
                            });
                          }}
                          style={styles.photoContainer}
                        >
                          <Image
                            source={{ uri: photoUri }}
                            style={styles.timelinePhoto}
                            resizeMode="cover"
                          />
                          <View style={styles.photoExpandOverlay}>
                            <Feather name="maximize-2" size={14} color="#FFFFFF" />
                            <Text style={styles.photoExpandText}>Tap to enlarge</Text>
                          </View>
                        </Pressable>
                      ) : null}

                      {/* Description */}
                      {item.description ? (
                        <ThemedText style={styles.timelineDescription}>
                          {item.description}
                        </ThemedText>
                      ) : null}

                      {/* GPS Location & Status Tag */}
                      <View style={styles.timelineFooterRow}>
                        {item.location?.latitude ? (
                          <View style={styles.locationChip}>
                            <Feather name="map-pin" size={12} color="#64748B" />
                            <Text style={styles.locationChipText} numberOfLines={1}>
                              {item.location.address || `${item.location.latitude.toFixed(4)}, ${item.location.longitude.toFixed(4)}`}
                            </Text>
                          </View>
                        ) : <View />}

                        {/* Issue Status & Resolve Action */}
                        {isIssue && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <View
                              style={[
                                styles.issueStatusBadge,
                                {
                                  backgroundColor:
                                    item.status === "RESOLVED"
                                      ? "rgba(22, 163, 74, 0.15)"
                                      : "rgba(220, 38, 38, 0.15)",
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.issueStatusText,
                                  {
                                    color:
                                      item.status === "RESOLVED" ? "#16A34A" : "#DC2626",
                                  },
                                ]}
                              >
                                {item.status === "RESOLVED" ? "✓ RESOLVED" : "OPEN"}
                              </Text>
                            </View>

                            {item.status !== "RESOLVED" && (
                              <Pressable
                                onPress={() => {
                                  triggerHaptic();
                                  setSelectedIssueToResolve(item);
                                  setShowResolveModal(true);
                                }}
                                style={styles.markResolvedBtn}
                              >
                                <Text style={styles.markResolvedBtnText}>
                                  Mark Resolved
                                </Text>
                              </Pressable>
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: SITE PHOTOS (Clean 2-Column Mobile Photo Gallery)                   */}
        {/* ========================================================================= */}
        {activeTab === "photos" && (
          <View>
            {/* Header & Date / Counts */}
            <View style={styles.photosHeaderSection}>
              <View>
                <ThemedText style={styles.photosMainTitle}>📸 Site Photos</ThemedText>
                <ThemedText style={styles.photosSubTitle}>
                  {selectedDate === getTodayStr() ? "Today" : selectedDate} • {filteredPhotos.length} Photos
                  {morningPhotosCount > 0 ? ` (${morningPhotosCount} Morning` : ""}
                  {eveningPhotosCount > 0 ? `, ${eveningPhotosCount} Evening)` : morningPhotosCount > 0 ? ")" : ""}
                </ThemedText>
              </View>

              {/* Date selector */}
              <View style={styles.datePillsGroup}>
                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    setSelectedDate(getTodayStr());
                  }}
                  style={[
                    styles.datePill,
                    selectedDate === getTodayStr()
                      ? { backgroundColor: theme.primary, borderColor: theme.primary }
                      : { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.datePillText,
                      selectedDate === getTodayStr()
                        ? { color: "#FFFFFF", fontWeight: "700" }
                        : { color: theme.textSecondary },
                    ]}
                  >
                    Today
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    setSelectedDate(getYesterdayStr());
                  }}
                  style={[
                    styles.datePill,
                    selectedDate === getYesterdayStr()
                      ? { backgroundColor: theme.primary, borderColor: theme.primary }
                      : { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.datePillText,
                      selectedDate === getYesterdayStr()
                        ? { color: "#FFFFFF", fontWeight: "700" }
                        : { color: theme.textSecondary },
                    ]}
                  >
                    Yesterday
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Filter Pills */}
            <View style={[styles.segmentedFilterContainer, { marginTop: 8 }]}>
              {(["ALL", "MORNING", "EVENING", "ISSUES"] as UpdateFilter[]).map((filter) => {
                const isSelected = updateFilter === filter;
                return (
                  <Pressable
                    key={filter}
                    onPress={() => {
                      triggerHaptic();
                      setUpdateFilter(filter);
                    }}
                    style={[
                      styles.segmentedFilterBtn,
                      isSelected
                        ? { backgroundColor: theme.primary }
                        : { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentedFilterText,
                        isSelected
                          ? { color: "#FFFFFF", fontWeight: "800" }
                          : { color: theme.textSecondary },
                      ]}
                    >
                      {filter === "ALL" && "ALL"}
                      {filter === "MORNING" && "🌅 MORNING"}
                      {filter === "EVENING" && "🌆 EVENING"}
                      {filter === "ISSUES" && "⚠️ ISSUES"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 2-Column Mobile Photo Grid */}
            {filteredPhotos.length === 0 ? (
              <View
                style={[
                  styles.emptyTimelineBox,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                    marginTop: 12,
                  },
                ]}
              >
                <Text style={{ fontSize: 36, marginBottom: 8 }}>📸</Text>
                <ThemedText style={styles.emptyTimelineTitle}>
                  No Site Photos Yet
                </ThemedText>
                <ThemedText style={styles.emptyTimelineDesc}>
                  Worker work updates submitted from this site will appear here automatically.
                </ThemedText>
              </View>
            ) : (
              <View style={styles.twoColumnGrid}>
                {filteredPhotos.map((item: any) => {
                  const isMorning = item.activityType === "MORNING_WORK";
                  const isEvening = item.activityType === "EVENING_WORK";

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        triggerHaptic();
                        setSelectedPhotoModal({
                          photoUrl: item.photoUrl,
                          workerName: item.workerName,
                          siteName: siteDisplayName,
                          activityType: item.activityType,
                          timeStr: item.timeStr,
                          dateStr: item.dateStr,
                          description: item.description,
                          location: item.location,
                        });
                      }}
                      style={[
                        styles.photoGridCard,
                        {
                          backgroundColor: theme.backgroundDefault,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Image
                        source={{ uri: item.photoUrl }}
                        style={styles.gridCardImage}
                        resizeMode="cover"
                      />

                      {/* Tag Overlay */}
                      <View
                        style={[
                          styles.gridCardBadge,
                          isMorning
                            ? { backgroundColor: "#F59E0B" }
                            : isEvening
                            ? { backgroundColor: "#2563EB" }
                            : { backgroundColor: "#DC2626" },
                        ]}
                      >
                        <Text style={styles.gridCardBadgeText}>
                          {isMorning ? "🌅 Morning" : isEvening ? "🌆 Evening" : "⚠️ Issue"}
                        </Text>
                      </View>

                      {/* Card Bottom Details */}
                      <View style={styles.gridCardFooter}>
                        <ThemedText numberOfLines={1} style={styles.gridCardWorkerName}>
                          👷 {item.workerName}
                        </ThemedText>
                        <View style={styles.gridCardMetaRow}>
                          <Text style={styles.gridCardTime}>{item.timeStr}</Text>
                          {item.location?.latitude ? (
                            <Text style={styles.gridCardGps}>📍 GPS</Text>
                          ) : null}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: OVERVIEW & STAGES                                                  */}
        {/* ========================================================================= */}
        {activeTab === "overview" && site && (
          <View>
            <View
              style={[
                styles.infoCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
              ]}
            >
              <ThemedText style={styles.infoTitle}>Site & Client Details</ThemedText>
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Client Name</ThemedText>
                <ThemedText style={styles.infoValue}>{site.clientName || "N/A"}</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Budget</ThemedText>
                <ThemedText style={styles.infoValue}>
                  ₹{site.budget?.toLocaleString("en-IN") || "N/A"}
                </ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Timeline</ThemedText>
                <ThemedText style={styles.infoValue}>
                  {site.startDate || "N/A"} to {site.endDate || "N/A"}
                </ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: WORKERS & WAGES                                                    */}
        {/* ========================================================================= */}
        {activeTab === "workers" && (
          <View>
            <ThemedText style={styles.sectionHeading}>
              Assigned Workers ({controlData?.workers?.length || siteWorkers.length})
            </ThemedText>

            {(controlData?.workers || siteWorkers).map((w: any) => (
              <View
                key={w.id || w._id}
                style={[
                  styles.workerCard,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.workerAvatar}>
                  <Text style={{ fontSize: 18 }}>👷</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <ThemedText style={styles.workerName}>{w.name}</ThemedText>
                  <ThemedText style={styles.workerCategory}>
                    {w.category || "Labour"} • Daily Wage: ₹{w.dailyRate || w.dailyWage || 0}
                  </ThemedText>
                  <Text style={styles.workerActivityTime}>
                    Morning: {w.morningStatus === "submitted" ? `✓ ${w.morningTime || "Submitted"}` : "Pending"} • 
                    Evening: {w.eveningStatus === "submitted" ? `✓ ${w.eveningTime || "Submitted"}` : "Pending"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: MATERIALS                                                          */}
        {/* ========================================================================= */}
        {activeTab === "materials" && (
          <View>
            <ThemedText style={styles.sectionHeading}>Materials Tracker</ThemedText>
            {materials.length === 0 ? (
              <ThemedText style={styles.emptyText}>No materials recorded yet.</ThemedText>
            ) : (
              materials.map((m: any, idx: number) => (
                <View
                  key={idx}
                  style={[
                    styles.materialItemCard,
                    {
                      backgroundColor: theme.backgroundDefault,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <ThemedText style={styles.materialName}>{m.name}</ThemedText>
                  <ThemedText style={styles.materialQuantity}>
                    {m.quantity || 0} {m.unit || "units"}
                  </ThemedText>
                </View>
              ))
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: REPORTS & DOCS                                                     */}
        {/* ========================================================================= */}
        {activeTab === "reports" && (
          <View>
            <ThemedText style={styles.sectionHeading}>Reports & Documentation</ThemedText>
            <View
              style={[
                styles.reportCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
              ]}
            >
              <ThemedText style={styles.reportTitle}>Daily Progress Report (DPR)</ThemedText>
              <ThemedText style={styles.reportSubtitle}>
                Generated automatically from daily work updates and haajari records.
              </ThemedText>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: ANALYTICS                                                          */}
        {/* ========================================================================= */}
        {activeTab === "analytics" && (
          <View>
            <ThemedText style={styles.sectionHeading}>Site Analytics</ThemedText>
            <View
              style={[
                styles.analyticsCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
              ]}
            >
              <ThemedText style={styles.analyticsTitle}>Budget Spent</ThemedText>
              <ThemedText style={styles.analyticsStat}>
                ₹{spentAmount.toLocaleString("en-IN")}
              </ThemedText>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD SITE INSTRUCTION MODAL                                       */}
      {/* ========================================================================= */}
      <Modal
        visible={showInstructionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInstructionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 20 }}>📢</Text>
                <ThemedText style={styles.modalTitle}>Add Site Instruction</ThemedText>
              </View>
              <Pressable onPress={() => setShowInstructionModal(false)} hitSlop={10}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Post an instruction for all workers at {siteDisplayName}. This will appear in their daily site context.
            </Text>

            {/* Priority Selector */}
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Priority Level</Text>
            <View style={styles.prioritySelectorRow}>
              {(["NORMAL", "HIGH", "URGENT"] as const).map((p) => {
                const isSelected = instructionPriority === p;
                return (
                  <Pressable
                    key={p}
                    onPress={() => {
                      triggerHaptic();
                      setInstructionPriority(p);
                    }}
                    style={[
                      styles.priorityPill,
                      isSelected
                        ? {
                            backgroundColor:
                              p === "URGENT"
                                ? "#DC2626"
                                : p === "HIGH"
                                ? "#D97706"
                                : theme.primary,
                          }
                        : { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityPillText,
                        isSelected ? { color: "#FFFFFF", fontWeight: "700" } : { color: theme.textSecondary },
                      ]}
                    >
                      {p}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Instruction Text Input */}
            <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 12 }]}>
              Instruction Note
            </Text>
            <TextInput
              value={instructionText}
              onChangeText={setInstructionText}
              placeholder="e.g. Ensure column shuttering is checked before 12 PM..."
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={4}
              style={[
                styles.instructionTextInput,
                {
                  color: theme.text,
                  backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                  borderColor: theme.border,
                },
              ]}
            />

            <Pressable
              onPress={handleSubmitInstruction}
              disabled={isPostingInstruction}
              style={[styles.modalPrimaryBtn, { backgroundColor: theme.primary }]}
            >
              {isPostingInstruction ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalPrimaryBtnText}>Broadcast Instruction</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: RESOLVE SITE ISSUE MODAL                                         */}
      {/* ========================================================================= */}
      <Modal
        visible={showResolveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResolveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 20 }}>✓</Text>
                <ThemedText style={styles.modalTitle}>Resolve Issue</ThemedText>
              </View>
              <Pressable onPress={() => setShowResolveModal(false)} hitSlop={10}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Mark issue as resolved. Add optional notes on how it was fixed.
            </Text>

            <TextInput
              value={resolutionNotes}
              onChangeText={setResolutionNotes}
              placeholder="e.g. Material replaced by vendor at 3 PM..."
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
              style={[
                styles.instructionTextInput,
                {
                  color: theme.text,
                  backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                  borderColor: theme.border,
                },
              ]}
            />

            <View style={styles.modalActionsRow}>
              <Pressable
                onPress={() => setShowResolveModal(false)}
                style={[
                  styles.modalCancelBtn,
                  { backgroundColor: isDark ? "#334155" : "#E2E8F0" },
                ]}
              >
                <Text style={{ color: theme.text, fontWeight: "700" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmResolveIssue}
                disabled={isResolving}
                style={[styles.modalConfirmBtn, { backgroundColor: "#16A34A" }]}
              >
                {isResolving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
                    Confirm Resolution
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: FULL SCREEN PHOTO VIEWER WITH METADATA                           */}
      {/* ========================================================================= */}
      <Modal
        visible={selectedPhotoModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhotoModal(null)}
      >
        <View style={styles.photoViewerContainer}>
          {/* Header */}
          <View style={styles.photoViewerHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.photoViewerTitle}>
                {selectedPhotoModal?.activityType === "MORNING_WORK"
                  ? "🌅 Morning Work Photo"
                  : selectedPhotoModal?.activityType === "EVENING_WORK"
                  ? "🌆 Evening Work Photo"
                  : selectedPhotoModal?.activityType === "ISSUE"
                  ? "⚠️ Site Issue Photo"
                  : "📸 Site Photo"}
              </Text>
              <Text style={styles.photoViewerSub}>
                👷 {selectedPhotoModal?.workerName} • 🕘 {selectedPhotoModal?.timeStr || selectedPhotoModal?.dateStr || "Today"}
              </Text>
            </View>
            <Pressable
              onPress={() => setSelectedPhotoModal(null)}
              style={styles.photoViewerCloseBtn}
            >
              <Feather name="x" size={24} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Full Screen Image */}
          {selectedPhotoModal?.photoUrl ? (
            <Image
              source={{ uri: selectedPhotoModal.photoUrl }}
              style={styles.photoViewerImage}
              resizeMode="contain"
            />
          ) : null}

          {/* Footer Metadata Overlay */}
          <View style={styles.photoViewerFooter}>
            <Text style={styles.photoViewerSiteTitle}>
              🏗️ {selectedPhotoModal?.siteName || siteDisplayName}
            </Text>
            {selectedPhotoModal?.description ? (
              <Text style={styles.photoViewerDesc}>
                "{selectedPhotoModal.description}"
              </Text>
            ) : null}
            {selectedPhotoModal?.location?.latitude ? (
              <View style={styles.photoViewerLocation}>
                <Feather name="map-pin" size={13} color="#94A3B8" />
                <Text style={styles.photoViewerLocationText}>
                  📍 GPS: {selectedPhotoModal.location.latitude.toFixed(5)},{" "}
                  {selectedPhotoModal.location.longitude.toFixed(5)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  instructionHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: BorderRadius.md,
  },
  instructionHeaderBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  // Tabs
  tabsScrollContainer: {
    borderBottomWidth: 1,
  },
  tabsRow: {
    paddingHorizontal: 16,
    gap: 12,
  },
  tabItem: {
    paddingVertical: 12,
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 13,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 100,
  },

  // Date Selector
  dateSelectorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  datePillsGroup: {
    flexDirection: "row",
    gap: 8,
  },
  datePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  datePillText: {
    fontSize: 12,
  },
  currentDateLabel: {
    fontSize: 12,
    fontWeight: "600",
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    minWidth: "47%",
    padding: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  kpiCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  kpiEmoji: {
    fontSize: 18,
  },
  kpiVal: {
    fontSize: 17,
    fontWeight: "800",
  },
  kpiTitle: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },

  // Open Issues Alert Strip
  openIssuesAlertStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: BorderRadius.md,
    marginBottom: 12,
  },
  openIssuesAlertText: {
    flex: 1,
    marginHorizontal: 8,
    fontSize: 13,
    color: "#DC2626",
    fontWeight: "700",
  },

  // Segmented Sub-filters
  segmentedFilterContainer: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 14,
  },
  segmentedFilterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentedFilterText: {
    fontSize: 11,
  },

  // Photos Header & 2-Column Grid
  photosHeaderSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  photosMainTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  photosSubTitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  twoColumnGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  photoGridCard: {
    width: "48%",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  gridCardImage: {
    width: "100%",
    height: 120,
    backgroundColor: "#1E293B",
  },
  gridCardBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  gridCardBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  gridCardFooter: {
    padding: 8,
  },
  gridCardWorkerName: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  gridCardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gridCardTime: {
    fontSize: 10,
    color: "#64748B",
  },
  gridCardGps: {
    fontSize: 10,
    color: "#16A34A",
    fontWeight: "700",
  },

  // Progress Section Card
  progressSectionCard: {
    padding: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: 14,
  },
  progressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  progressSectionVal: {
    fontSize: 13,
    fontWeight: "800",
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 10,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  pendingWorkersBox: {
    padding: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: 4,
  },
  pendingWorkersTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#D97706",
  },
  pendingWorkerTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  pendingWorkerTag: {
    backgroundColor: "rgba(217, 119, 6, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  pendingWorkerTagText: {
    fontSize: 11,
    color: "#B45309",
    fontWeight: "600",
  },

  // Feed Section
  feedContainer: {
    marginTop: 4,
  },
  feedSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 10,
  },
  emptyTimelineBox: {
    alignItems: "center",
    padding: 24,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  emptyTimelineTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptyTimelineDesc: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },

  // Timeline Card
  timelineCard: {
    padding: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: 12,
  },
  timelineCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  timelineUserInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineUserName: {
    fontSize: 13,
    fontWeight: "700",
  },
  timelineUserRole: {
    fontSize: 11,
    color: "#64748B",
  },
  activityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  activityBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  timelineTimeText: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 2,
  },
  photoContainer: {
    position: "relative",
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    marginBottom: 10,
  },
  timelinePhoto: {
    width: "100%",
    height: 190,
    backgroundColor: "#1E293B",
  },
  photoExpandOverlay: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  photoExpandText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  timelineDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  timelineFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    marginRight: 8,
  },
  locationChipText: {
    fontSize: 11,
    color: "#64748B",
  },
  issueStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  issueStatusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  markResolvedBtn: {
    backgroundColor: "#16A34A",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
  },
  markResolvedBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },

  // Other Tabs Helpers
  infoCard: {
    padding: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: "#64748B",
  },
  infoValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 10,
  },
  workerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: 8,
  },
  workerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(100,116,139,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  workerName: {
    fontSize: 13,
    fontWeight: "700",
  },
  workerCategory: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  workerActivityTime: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 2,
  },
  materialItemCard: {
    padding: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  materialName: {
    fontSize: 13,
    fontWeight: "700",
  },
  materialQuantity: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },
  reportCard: {
    padding: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  reportSubtitle: {
    fontSize: 12,
    color: "#64748B",
  },
  analyticsCard: {
    padding: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  analyticsTitle: {
    fontSize: 12,
    color: "#64748B",
  },
  analyticsStat: {
    fontSize: 24,
    fontWeight: "800",
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
    marginVertical: 12,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  modalSubtitle: {
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 17,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  prioritySelectorRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  priorityPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  priorityPillText: {
    fontSize: 12,
  },
  instructionTextInput: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: 12,
    fontSize: 13,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  modalPrimaryBtn: {
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  modalActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },

  // Photo Viewer
  photoViewerContainer: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "space-between",
  },
  photoViewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  photoViewerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  photoViewerSub: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
  },
  photoViewerCloseBtn: {
    padding: 6,
  },
  photoViewerImage: {
    flex: 1,
    width: "100%",
  },
  photoViewerFooter: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  photoViewerSiteTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  photoViewerDesc: {
    color: "#E2E8F0",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  photoViewerLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  photoViewerLocationText: {
    color: "#94A3B8",
    fontSize: 12,
  },
});
