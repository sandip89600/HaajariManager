import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Speech from "expo-speech";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius, Colors, Shadows } from "@/constants/theme";
import { storage, Project, Worker, generateId } from "@/utils/storage";
import { appContextTracker } from "@/utils/appContextTracker";

// ─── DATA MODELS ─────────────────────────────────────────────────────────────
interface DailyPlan {
  id: string;
  siteId: string;
  teamName: string;
  workerIds: string[];
  taskName: string;
  voiceUri?: string;
  photoUri?: string;
  status: "pending" | "completed" | "blocked";
}

interface MaterialRequest {
  id: string;
  siteId: string;
  materialName: string;
  quantity: string;
  requestedBy: string;
  status: "pending" | "approved" | "delivered" | "rejected";
  date: number;
}

interface Notice {
  id: string;
  title: string;
  body: string;
  category: "safety" | "holiday" | "announcement";
  createdAt: number;
}

interface BlockedTask {
  id: string;
  siteId: string;
  taskName: string;
  reason: string;
  createdAt: number;
}

interface LeaveRequest {
  id: string;
  workerName: string;
  reason: string;
  dateStr: string;
  status: "pending" | "approved" | "rejected";
}

interface PhotoVerification {
  id: string;
  siteId: string;
  workerName: string;
  taskName: string;
  photoUri: string;
  status: "pending" | "approved" | "rejected";
}

interface ChatMessage {
  id: string;
  sender: "user" | "hai";
  text: string;
  timestamp: number;
}

interface RecentActivity {
  id: string;
  type: "checkin" | "task" | "photo" | "material" | "voice";
  text: string;
  timeStr: string;
}

export default function SiteManagementScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const role = user?.role || "contractor";
  const hasAccess =
    role === "contractor" ||
    role === "builder" ||
    role === "admin" ||
    role === "supervisor";

  // Data states
  const [sites, setSites] = useState<Project[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Search query
  const [searchQuery, setSearchQuery] = useState("");

  // Activity list
  const [activities, setActivities] = useState<RecentActivity[]>([
    {
      id: "act-1",
      type: "checkin",
      text: "Amit Kumar checked in at Metro Heights",
      timeStr: "10 mins ago",
    },
    {
      id: "act-2",
      type: "task",
      text: "Drywall plaster completed at Sector 5 Villa",
      timeStr: "45 mins ago",
    },
    {
      id: "act-3",
      type: "photo",
      text: "Ramesh uploaded foundation verification photo",
      timeStr: "1 hour ago",
    },
    {
      id: "act-4",
      type: "material",
      text: "50 Cement bags approved for Flyover Site",
      timeStr: "2 hours ago",
    },
    {
      id: "act-5",
      type: "voice",
      text: "Contractor sent voice instruction to Mason Team B",
      timeStr: "3 hours ago",
    },
  ]);

  // Today's Daily Work Plans
  const [dailyPlans, setDailyPlans] = useState<DailyPlan[]>([
    {
      id: "p-1",
      siteId: "site-1",
      teamName: "Mason Team A",
      workerIds: ["w-1"],
      taskName: "Laying foundation reinforcement structure",
      status: "pending",
    },
    {
      id: "p-2",
      siteId: "site-2",
      teamName: "Plaster Team",
      workerIds: ["w-2"],
      taskName: "Finishing drywall and plastering walls",
      status: "completed",
    },
    {
      id: "p-3",
      siteId: "site-1",
      teamName: "Helper Crew",
      workerIds: [],
      taskName: "Moving excavation aggregates to Section B",
      status: "blocked",
    },
  ]);

  // Material requests list
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([
    {
      id: "m-1",
      siteId: "site-1",
      materialName: "53-Grade OPC Cement Bags",
      quantity: "150 Bags",
      requestedBy: "Supervisor Rakesh",
      status: "pending",
      date: Date.now() - 3600000 * 2,
    },
    {
      id: "m-2",
      siteId: "site-2",
      materialName: "TMT Steel Rebars 12mm",
      quantity: "2 Tons",
      requestedBy: "Supervisor Dev",
      status: "approved",
      date: Date.now() - 3600000 * 24,
    },
  ]);

  // Notices
  const [notices, setNotices] = useState<Notice[]>([
    {
      id: "n-1",
      title: "Mandatory Hard Hat Policy",
      body: "All workers and supervisors must wear class-A hard hats at all times.",
      category: "safety",
      createdAt: Date.now() - 3600000 * 12,
    },
    {
      id: "n-2",
      title: "Independence Day Holiday",
      body: "All sites closed on August 15th.",
      category: "holiday",
      createdAt: Date.now() - 3600000 * 48,
    },
  ]);

  // Blocked tasks
  const [blockedTasks, setBlockedTasks] = useState<BlockedTask[]>([
    {
      id: "b-1",
      siteId: "site-1",
      taskName: "Excavation of Section B",
      reason: "Heavy monsoon rains logged key pathways",
      createdAt: Date.now() - 3600000 * 4,
    },
  ]);

  // Leave Requests
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([
    {
      id: "l-1",
      workerName: "Sanjay Singh",
      reason: "Family emergency in hometown",
      dateStr: "04 July 2026",
      status: "pending",
    },
  ]);

  // Photo Verification uploads
  const [photoVerifications, setPhotoVerifications] = useState<
    PhotoVerification[]
  >([
    {
      id: "v-1",
      siteId: "site-2",
      workerName: "Vikram Mistri",
      taskName: "Tiling floor phase 2",
      photoUri:
        "https://images.unsplash.com/photo-1581094288338-2314dddb7eed?w=400",
      status: "pending",
    },
  ]);

  // Chat message list
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "c-1",
      sender: "hai",
      text: "Hello! I am HAI, your read-only site assistant. Ask me anything about today's progress, material updates, or roster allocations.",
      timestamp: Date.now(),
    },
  ]);
  const [chatInput, setChatInput] = useState("");

  // SOS state
  const [sosActive, setSosActive] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);

  // Quick Action Modal states
  const [activeModal, setActiveModal] = useState<
    | "site"
    | "task"
    | "worker"
    | "notice"
    | "voice"
    | "material"
    | "details"
    | null
  >(null);
  const [selectedSiteForDetails, setSelectedSiteForDetails] =
    useState<Project | null>(null);

  // Forms states
  // Site
  const [siteName, setSiteName] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [siteSupervisor, setSiteSupervisor] = useState("Supervisor Ramesh");
  // Task
  const [taskSiteId, setTaskSiteId] = useState("");
  const [taskTeam, setTaskTeam] = useState("");
  const [taskNameText, setTaskNameText] = useState("");
  const [taskWorkerIds, setTaskWorkerIds] = useState<string[]>([]);
  const [taskVoiceUri, setTaskVoiceUri] = useState<string | null>(null);
  const [taskPhotoUri, setTaskPhotoUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  // Worker
  const [workerName, setWorkerName] = useState("");
  const [workerRate, setWorkerRate] = useState("");
  const [workerCategory, setWorkerCategory] = useState<any>("labour");
  const [workerSiteId, setWorkerSiteId] = useState("");
  // Notice
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeBody, setNoticeBody] = useState("");
  const [noticeCategory, setNoticeCategory] = useState<any>("announcement");
  // Material request
  const [matSiteId, setMatSiteId] = useState("");
  const [matName, setMatName] = useState("");
  const [matQty, setMatQty] = useState("");

  // Load Real Data from storage
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      appContextTracker.setContext({
        currentScreen: "SiteManagementCommandCenter",
      });
      loadData();
    });
    loadData();
    return unsubscribe;
  }, [navigation]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const realProjects = await storage.getProjects();
      setSites(realProjects);
      if (realProjects.length > 0) {
        setTaskSiteId(realProjects[0].id);
        setWorkerSiteId(realProjects[0].id);
        setMatSiteId(realProjects[0].id);
      }
      const realWorkers = await storage.getWorkers();
      setWorkers(realWorkers);
    } catch (e) {
      console.warn("Failed to load real data", e);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── SEARCH FILTERED LISTS ──────────────────────────────────────────────────
  const filteredSites = useMemo(() => {
    if (!searchQuery.trim()) return sites;
    return sites.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.location &&
          s.location.toLowerCase().includes(searchQuery.toLowerCase())),
    );
  }, [sites, searchQuery]);

  const filteredWorkers = useMemo(() => {
    if (!searchQuery.trim()) return workers;
    return workers.filter(
      (w) =>
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.category.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [workers, searchQuery]);

  // ─── FORM SUBMISSIONS ───────────────────────────────────────────────────────

  const handleCreateSite = async () => {
    if (!siteName.trim()) {
      Alert.alert("Error", "Site name is required.");
      return;
    }
    try {
      const newProj: Project = {
        id: generateId(),
        name: siteName.trim(),
        location: siteLocation.trim() || "N/A",
        status: "active",
        createdAt: Date.now(),
      };
      await storage.addProject(newProj);
      setSites((prev) => [newProj, ...prev]);

      // Add activity
      setActivities((prev) => [
        {
          id: generateId(),
          type: "checkin",
          text: `New Site "${newProj.name}" created`,
          timeStr: "Just now",
        },
        ...prev,
      ]);

      setSiteName("");
      setSiteLocation("");
      setActiveModal(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Construction site added successfully.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save site.");
    }
  };

  const handleAssignTask = () => {
    if (!taskTeam.trim() || !taskNameText.trim()) {
      Alert.alert("Error", "Please fill Team name and Task description.");
      return;
    }
    const newPlan: DailyPlan = {
      id: generateId(),
      siteId: taskSiteId,
      teamName: taskTeam.trim(),
      workerIds: taskWorkerIds,
      taskName: taskNameText.trim(),
      voiceUri: taskVoiceUri || undefined,
      photoUri: taskPhotoUri || undefined,
      status: "pending",
    };
    setDailyPlans((prev) => [newPlan, ...prev]);

    setActivities((prev) => [
      {
        id: generateId(),
        type: "task",
        text: `Task "${newPlan.taskName}" assigned to ${newPlan.teamName}`,
        timeStr: "Just now",
      },
      ...prev,
    ]);

    setTaskTeam("");
    setTaskNameText("");
    setTaskWorkerIds([]);
    setTaskVoiceUri(null);
    setTaskPhotoUri(null);
    setActiveModal(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Success", "Daily task assigned.");
  };

  const handleAddWorker = async () => {
    if (!workerName.trim() || !workerRate.trim()) {
      Alert.alert("Error", "Worker name and rate are required.");
      return;
    }
    const rateVal = parseFloat(workerRate);
    if (isNaN(rateVal) || rateVal <= 0) {
      Alert.alert("Error", "Please enter a valid daily wage rate.");
      return;
    }
    try {
      const newWorker: Worker = {
        id: generateId(),
        name: workerName.trim(),
        category: workerCategory,
        dailyRate: rateVal,
        projectId: workerSiteId || undefined,
        createdAt: Date.now(),
      };
      await storage.addWorker(newWorker);
      setWorkers((prev) => [newWorker, ...prev]);

      setActivities((prev) => [
        {
          id: generateId(),
          type: "checkin",
          text: `Worker "${newWorker.name}" added to workforce`,
          timeStr: "Just now",
        },
        ...prev,
      ]);

      setWorkerName("");
      setWorkerRate("");
      setActiveModal(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Worker registered successfully.");
    } catch (err: any) {
      Alert.alert("Error", "Failed to add worker.");
    }
  };

  const handleCreateNotice = () => {
    if (!noticeTitle.trim() || !noticeBody.trim()) {
      Alert.alert("Error", "Notice title and description are required.");
      return;
    }
    const newNotice: Notice = {
      id: generateId(),
      title: noticeTitle.trim(),
      body: noticeBody.trim(),
      category: noticeCategory,
      createdAt: Date.now(),
    };
    setNotices((prev) => [newNotice, ...prev]);
    setNoticeTitle("");
    setNoticeBody("");
    setActiveModal(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Success", "Notice posted.");
  };

  const handleRecordVoiceInstruction = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      setTaskVoiceUri(`voice_${Date.now()}.mp3`);
      setActivities((prev) => [
        {
          id: generateId(),
          type: "voice",
          text: `Voice instruction recorded for dispatch`,
          timeStr: "Just now",
        },
        ...prev,
      ]);
      Alert.alert("Recorded", "Voice note saved.");
      setActiveModal(null);
    }, 2000);
  };

  const handleCreateMaterialRequest = () => {
    if (!matName.trim() || !matQty.trim()) {
      Alert.alert("Error", "Material details are required.");
      return;
    }
    const newReq: MaterialRequest = {
      id: generateId(),
      siteId: matSiteId,
      materialName: matName.trim(),
      quantity: matQty.trim(),
      requestedBy: "Contractor Terminal",
      status: "pending",
      date: Date.now(),
    };
    setMaterialRequests((prev) => [newReq, ...prev]);

    setActivities((prev) => [
      {
        id: generateId(),
        type: "material",
        text: `Material request submitted: ${newReq.materialName}`,
        timeStr: "Just now",
      },
      ...prev,
    ]);

    setMatName("");
    setMatQty("");
    setActiveModal(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Success", "Supply order request queued.");
  };

  // ─── APPROVAL BOARD ACTIONS ────────────────────────────────────────────────
  const handleApproveMaterial = (
    id: string,
    status: MaterialRequest["status"],
  ) => {
    setMaterialRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r)),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (status === "approved") {
      setActivities((prev) => [
        {
          id: generateId(),
          type: "material",
          text: `Material request ID ${id} approved`,
          timeStr: "Just now",
        },
        ...prev,
      ]);
    }
  };

  const handleApproveLeave = (id: string, status: LeaveRequest["status"]) => {
    setLeaveRequests((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status } : l)),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Success", `Leave request ${status}.`);
  };

  const handleResolveBlocked = (id: string) => {
    setBlockedTasks((prev) => prev.filter((b) => b.id !== id));
    setDailyPlans((prev) =>
      prev.map((p) =>
        p.status === "blocked" ? { ...p, status: "pending" } : p,
      ),
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Resolved", "Block flags cleared. Task shifted to pending.");
  };

  const handleApprovePhoto = (
    id: string,
    status: PhotoVerification["status"],
  ) => {
    setPhotoVerifications((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status } : p)),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Photo Verification", `Upload verification ${status}.`);
  };

  // ─── AI CHAT BOT SYSTEM ─────────────────────────────────────────────────────
  const handleSendChatMessage = () => {
    if (!chatInput.trim()) return;

    const userText = chatInput.trim();
    const newUserMsg: ChatMessage = {
      id: generateId(),
      sender: "user",
      text: userText,
      timestamp: Date.now(),
    };

    setChatMessages((prev) => [...prev, newUserMsg]);
    setChatInput("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setTimeout(() => {
      let responseText = "";
      const query = userText.toLowerCase();

      const containsAction =
        /assign|create|approve|reject|delete|add|remove|change|schedule/gi.test(
          userText,
        );

      if (containsAction) {
        responseText =
          "As the HAI Read-Only Assistant, I am restricted from executing actions like creating projects, modifying priority levels, or assigning team tasks. Please execute these actions directly using the command console widgets.";
      } else {
        if (query.includes("site") || query.includes("project")) {
          responseText = `I see ${sites.length} construction site(s) registered. Main active sites are ${sites.map((s) => s.name).join(", ")}.`;
        } else if (query.includes("worker") || query.includes("deploy")) {
          responseText = `There are ${workers.length} registered builders and masons in the active workforce directory. Check the Distribution chart for allocations.`;
        } else if (query.includes("material") || query.includes("order")) {
          const pend = materialRequests.filter(
            (r) => r.status === "pending",
          ).length;
          responseText = `Roster shows ${pend} pending material request(s) awaiting approval in the Command console.`;
        } else if (query.includes("weather") || query.includes("rain")) {
          responseText =
            "Weather conditions today are showing heavy monsoon risk. Outdoor concrete pours at Metro Heights should be monitored closely.";
        } else {
          responseText =
            "According to certified contractor logs, site operations are currently running within optimal margins. Ask me about specific site timelines or material totals.";
        }
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          sender: "hai",
          text: responseText,
          timestamp: Date.now(),
        },
      ]);
    }, 8000); // 8ms simulation delay
  };

  // Emergency SOS Broadcast
  const handleTriggerEmergencySOS = (type: string) => {
    setSosActive(true);
    setShowEmergencyModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert(
      "🚨 COMMAND CENTER SOS ACTIVATED",
      `Critical ${type} SOS broadcast has been dispatched to all site terminals and safety networks!`,
      [{ text: "Deactivate SOS", onPress: () => setSosActive(false) }],
    );
  };

  // Stats
  const activeSitesCount = sites.filter((s) => s.status === "active").length;
  const completedTasksCount = dailyPlans.filter(
    (p) => p.status === "completed",
  ).length;
  const blockedTasksCount = blockedTasks.length;

  if (!hasAccess) {
    return (
      <ThemedView style={styles.deniedContainer}>
        <Feather name="shield-off" size={64} color={theme.error} />
        <ThemedText type="h2" style={styles.deniedTitle}>
          Access Denied
        </ThemedText>
        <ThemedText style={{ color: theme.textSecondary, textAlign: "center" }}>
          Only Contractors, Builders, and Company Admin roles can launch the
          Command Center.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* ─── CUSTOM HEADER ────────────────────────────────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        {navigation.canGoBack() && (
          <Pressable onPress={() => navigation.goBack()} style={styles.backArrow}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
        )}
        <View style={styles.headerInfo}>
          <ThemedText type="h1" style={styles.headerTitle}>
            Haajari Command Center
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Construction Site Command & Control Terminal
          </ThemedText>
        </View>
        <Pressable
          onPress={() => setShowEmergencyModal(true)}
          style={[
            styles.sosButton,
            { backgroundColor: sosActive ? theme.error : theme.error + "20" },
          ]}
        >
          <Feather
            name="alert-triangle"
            size={16}
            color={sosActive ? "#FFFFFF" : theme.error}
          />
          <ThemedText
            style={[
              styles.sosButtonText,
              { color: sosActive ? "#FFFFFF" : theme.error },
            ]}
          >
            SOS
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 0. WEATHER WIDGET (SECTION 12) ─── */}
        <LinearGradient
          colors={["#1E2022", "#2D3033"]}
          style={styles.weatherCard}
        >
          <View style={styles.weatherHeaderRow}>
            <View>
              <ThemedText
                style={{ fontWeight: "800", color: "#FF8C00", fontSize: 13 }}
              >
                CONSTRUCTION WEATHER MONITOR
              </ThemedText>
              <ThemedText
                type="body"
                style={{ color: "#FFFFFF", fontWeight: "700", marginTop: 2 }}
              >
                Monsoon Rain Alerts • Noida Region
              </ThemedText>
            </View>
            <Feather name="cloud-rain" size={28} color="#FF9800" />
          </View>
          <View style={styles.weatherBody}>
            <ThemedText type="h2" style={{ color: "#FFFFFF" }}>
              28°C • Precipitation Risk 85%
            </ThemedText>
            <ThemedText
              type="small"
              style={{ color: "#EF5350", fontWeight: "700", marginTop: 4 }}
            >
              🚨 WARNING: High precipitation risk. Concrete foundation pouring
              is recommended to pause.
            </ThemedText>
          </View>
        </LinearGradient>

        {/* ─── SIX SUMMARY CARDS (REQUIRED BY USER) ─── */}
        <View style={styles.cardsGrid}>
          {/* Active Sites */}
          <LinearGradient
            colors={["#FF6B35", "#FF8C5E"]}
            style={styles.summaryCard}
          >
            <View style={styles.summaryCardHeader}>
              <ThemedText style={{ fontSize: 20 }}>🏗</ThemedText>
              <Feather name="map" size={16} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.summaryNum}>
              {activeSitesCount}
            </ThemedText>
            <ThemedText style={styles.summaryLabel}>Active Sites</ThemedText>
          </LinearGradient>

          {/* Total Workers */}
          <LinearGradient
            colors={["#1E3A5F", "#2A5282"]}
            style={styles.summaryCard}
          >
            <View style={styles.summaryCardHeader}>
              <ThemedText style={{ fontSize: 20 }}>👷</ThemedText>
              <Feather name="users" size={16} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.summaryNum}>{workers.length}</ThemedText>
            <ThemedText style={styles.summaryLabel}>Total Workers</ThemedText>
          </LinearGradient>

          {/* Today's Tasks */}
          <LinearGradient
            colors={["#7C3AED", "#9061F3"]}
            style={styles.summaryCard}
          >
            <View style={styles.summaryCardHeader}>
              <ThemedText style={{ fontSize: 20 }}>📋</ThemedText>
              <Feather name="clipboard" size={16} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.summaryNum}>
              {dailyPlans.length}
            </ThemedText>
            <ThemedText style={styles.summaryLabel}>Today's Tasks</ThemedText>
          </LinearGradient>

          {/* Completed Tasks */}
          <LinearGradient
            colors={["#4CAF50", "#66BB6A"]}
            style={styles.summaryCard}
          >
            <View style={styles.summaryCardHeader}>
              <ThemedText style={{ fontSize: 20 }}>✅</ThemedText>
              <Feather name="check-circle" size={16} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.summaryNum}>
              {completedTasksCount}
            </ThemedText>
            <ThemedText style={styles.summaryLabel}>Completed Tasks</ThemedText>
          </LinearGradient>

          {/* Blocked Tasks */}
          <LinearGradient
            colors={["#F44336", "#EF5350"]}
            style={styles.summaryCard}
          >
            <View style={styles.summaryCardHeader}>
              <ThemedText style={{ fontSize: 20 }}>⚠</ThemedText>
              <Feather name="alert-triangle" size={16} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.summaryNum}>
              {blockedTasksCount}
            </ThemedText>
            <ThemedText style={styles.summaryLabel}>Blocked Tasks</ThemedText>
          </LinearGradient>

          {/* Site Progress */}
          <LinearGradient
            colors={["#2196F3", "#42A5F5"]}
            style={styles.summaryCard}
          >
            <View style={styles.summaryCardHeader}>
              <ThemedText style={{ fontSize: 20 }}>📊</ThemedText>
              <Feather name="trending-up" size={16} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.summaryNum}>78%</ThemedText>
            <ThemedText style={styles.summaryLabel}>Site Progress</ThemedText>
          </LinearGradient>
        </View>

        {/* ─── 1. SEARCH BAR (SECTION 1) ─── */}
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
        >
          <Feather
            name="search"
            size={18}
            color={theme.textSecondary}
            style={{ marginRight: Spacing.sm }}
          />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search Sites, Workers, or Supervisors..."
            placeholderTextColor={theme.textSecondary}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Feather name="x" size={16} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        {/* ─── 2. QUICK ACTIONS (SECTION 2) ─── */}
        <ThemedText type="h3" style={styles.widgetHeader}>
          Quick Command Actions
        </ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: Spacing.sm }}
        >
          <Pressable
            onPress={() => setActiveModal("site")}
            style={[styles.actionBtn, { backgroundColor: theme.primary }]}
          >
            <Feather name="map" size={16} color="#FFFFFF" />
            <ThemedText style={styles.actionBtnText}>Create Site</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setActiveModal("task")}
            style={[styles.actionBtn, { backgroundColor: "#7C3AED" }]}
          >
            <Feather name="clipboard" size={16} color="#FFFFFF" />
            <ThemedText style={styles.actionBtnText}>Assign Task</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setActiveModal("worker")}
            style={[styles.actionBtn, { backgroundColor: "#00BCD4" }]}
          >
            <Feather name="user-plus" size={16} color="#FFFFFF" />
            <ThemedText style={styles.actionBtnText}>Add Worker</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setActiveModal("notice")}
            style={[styles.actionBtn, { backgroundColor: "#E91E63" }]}
          >
            <Feather name="volume-2" size={16} color="#FFFFFF" />
            <ThemedText style={styles.actionBtnText}>Create Notice</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setActiveModal("voice")}
            style={[styles.actionBtn, { backgroundColor: "#FF9800" }]}
          >
            <Feather name="mic" size={16} color="#FFFFFF" />
            <ThemedText style={styles.actionBtnText}>Record Voice</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setActiveModal("material")}
            style={[styles.actionBtn, { backgroundColor: "#2196F3" }]}
          >
            <Feather name="shopping-cart" size={16} color="#FFFFFF" />
            <ThemedText style={styles.actionBtnText}>Order Material</ThemedText>
          </Pressable>
        </ScrollView>

        {/* ─── 3. MY SITES (SECTION 3) ─── */}
        <ThemedText type="h3" style={styles.widgetHeader}>
          My Sites Directory
        </ThemedText>
        {filteredSites.length === 0 ? (
          <View style={styles.noDataBox}>
            <ThemedText style={{ color: theme.textSecondary }}>
              No sites matched search query.
            </ThemedText>
          </View>
        ) : (
          filteredSites.map((site) => {
            const siteWorkers = workers.filter((w) => w.projectId === site.id);
            const activePlans = dailyPlans.filter((p) => p.siteId === site.id);
            return (
              <View
                key={site.id}
                style={[
                  styles.siteItemCard,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.siteItemHead}>
                  <View>
                    <ThemedText type="h3">{site.name}</ThemedText>
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary, marginTop: 2 }}
                    >
                      📍 {site.location || "Location not set"}
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: theme.success + "20" },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: theme.success, fontWeight: "700" }}
                    >
                      ACTIVE
                    </ThemedText>
                  </View>
                </View>

                <View
                  style={[styles.divider, { backgroundColor: theme.border }]}
                />

                <View style={styles.siteItemStats}>
                  <View style={styles.siteStatRow}>
                    <Feather
                      name="user"
                      size={14}
                      color={theme.textSecondary}
                    />
                    <ThemedText type="small" style={{ marginLeft: 6 }}>
                      Supervisor:{" "}
                      <ThemedText type="small" style={{ fontWeight: "700" }}>
                        {siteSupervisor}
                      </ThemedText>
                    </ThemedText>
                  </View>
                  <View style={styles.siteStatRow}>
                    <Feather
                      name="users"
                      size={14}
                      color={theme.textSecondary}
                    />
                    <ThemedText type="small" style={{ marginLeft: 6 }}>
                      Present:{" "}
                      <ThemedText
                        type="small"
                        style={{ fontWeight: "700", color: theme.success }}
                      >
                        {siteWorkers.length}
                      </ThemedText>
                      {"  |  "}Absent:{" "}
                      <ThemedText
                        type="small"
                        style={{ fontWeight: "700", color: theme.error }}
                      >
                        0
                      </ThemedText>
                    </ThemedText>
                  </View>
                  <View style={styles.siteStatRow}>
                    <Feather
                      name="activity"
                      size={14}
                      color={theme.textSecondary}
                    />
                    <ThemedText type="small" style={{ marginLeft: 6 }}>
                      Active Tasks:{" "}
                      <ThemedText type="small" style={{ fontWeight: "700" }}>
                        {activePlans.length}
                      </ThemedText>
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.progressRow}>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    Progress
                  </ThemedText>
                  <ThemedText type="small" style={{ fontWeight: "700" }}>
                    75%
                  </ThemedText>
                </View>
                <View
                  style={[
                    styles.progressTrack,
                    { backgroundColor: theme.border },
                  ]}
                >
                  <View
                    style={[
                      styles.progressValue,
                      { backgroundColor: theme.info, width: "75%" },
                    ]}
                  />
                </View>

                <Pressable
                  onPress={() => {
                    setSelectedSiteForDetails(site);
                    setActiveModal("details");
                  }}
                  style={[
                    styles.detailsBtn,
                    { borderColor: theme.primary, borderWidth: 1 },
                  ]}
                >
                  <ThemedText
                    style={{
                      color: theme.primary,
                      fontWeight: "700",
                      fontSize: 13,
                    }}
                  >
                    View Details
                  </ThemedText>
                </Pressable>
              </View>
            );
          })
        )}

        {/* ─── 4. TODAY'S WORK (SECTION 4) ─── */}
        <ThemedText type="h3" style={styles.widgetHeader}>
          Today's Work Tasks
        </ThemedText>
        {dailyPlans.map((plan) => {
          const site = sites.find((s) => s.id === plan.siteId);
          return (
            <View
              key={plan.id}
              style={[
                styles.planRowCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.planRowHeader}>
                <View>
                  <ThemedText style={{ fontWeight: "700" }}>
                    {plan.teamName}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    {site?.name || "Global Site"}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => {
                    setDailyPlans((prev) =>
                      prev.map((p) =>
                        p.id === plan.id
                          ? {
                              ...p,
                              status:
                                p.status === "completed"
                                  ? "pending"
                                  : "completed",
                            }
                          : p,
                      ),
                    );
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success,
                    );
                  }}
                  style={[
                    styles.checkCircle,
                    {
                      borderColor:
                        plan.status === "completed"
                          ? theme.success
                          : theme.border,
                      backgroundColor:
                        plan.status === "completed"
                          ? theme.success
                          : "transparent",
                    },
                  ]}
                >
                  {plan.status === "completed" && (
                    <Feather name="check" size={12} color="#FFFFFF" />
                  )}
                </Pressable>
              </View>
              <ThemedText style={{ marginTop: 6, fontSize: 13 }}>
                {plan.taskName}
              </ThemedText>
            </View>
          );
        })}

        {/* ─── 5. WORKER DISTRIBUTION (SECTION 5) ─── */}
        <ThemedText type="h3" style={styles.widgetHeader}>
          Worker Distribution
        </ThemedText>
        <View
          style={[
            styles.distributionCard,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
        >
          {sites.map((site) => {
            const count = workers.filter((w) => w.projectId === site.id).length;
            const pct = workers.length > 0 ? (count / workers.length) * 100 : 0;
            return (
              <View key={site.id} style={styles.distRow}>
                <ThemedText type="small" style={styles.distLabel}>
                  {site.name}
                </ThemedText>
                <View style={styles.distTrack}>
                  <View
                    style={[
                      styles.distFill,
                      {
                        backgroundColor: theme.primary,
                        width: `${Math.max(pct, 10)}%`,
                      },
                    ]}
                  />
                </View>
                <ThemedText type="small" style={styles.distCount}>
                  {count} Workers
                </ThemedText>
              </View>
            );
          })}
          {sites.length === 0 && (
            <ThemedText
              style={{ color: theme.textSecondary, textAlign: "center" }}
            >
              No active allocations.
            </ThemedText>
          )}
        </View>

        {/* ─── 6. PENDING APPROVALS (SECTION 6) ─── */}
        <ThemedText type="h3" style={styles.widgetHeader}>
          Pending Approvals
        </ThemedText>
        <View
          style={[
            styles.approvalsCard,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
        >
          {/* Leave Requests */}
          {leaveRequests
            .filter((l) => l.status === "pending")
            .map((req) => (
              <View key={req.id} style={styles.approvalItem}>
                <View style={styles.approvalInfo}>
                  <ThemedText style={{ fontWeight: "700" }}>
                    Leave Request: {req.workerName}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    {req.reason} • {req.dateStr}
                  </ThemedText>
                </View>
                <View style={styles.approvalBtns}>
                  <Pressable
                    onPress={() => handleApproveLeave(req.id, "approved")}
                    style={[styles.btnMini, { backgroundColor: theme.success }]}
                  >
                    <Feather name="check" size={14} color="#FFFFFF" />
                  </Pressable>
                  <Pressable
                    onPress={() => handleApproveLeave(req.id, "rejected")}
                    style={[styles.btnMini, { backgroundColor: theme.error }]}
                  >
                    <Feather name="x" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            ))}

          {/* Blocked Tasks */}
          {blockedTasks.map((block) => (
            <View key={block.id} style={styles.approvalItem}>
              <View style={styles.approvalInfo}>
                <ThemedText style={{ fontWeight: "700", color: theme.error }}>
                  Blocked: {block.taskName}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Reason: {block.reason}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => handleResolveBlocked(block.id)}
                style={[styles.resolveBtn, { backgroundColor: theme.info }]}
              >
                <ThemedText
                  style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 11 }}
                >
                  Resolve
                </ThemedText>
              </Pressable>
            </View>
          ))}

          {/* Photo Verification */}
          {photoVerifications
            .filter((p) => p.status === "pending")
            .map((ver) => (
              <View key={ver.id} style={styles.approvalItem}>
                <View style={styles.approvalInfo}>
                  <ThemedText style={{ fontWeight: "700" }}>
                    Photo Verification: {ver.workerName}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    Task: {ver.taskName}
                  </ThemedText>
                </View>
                <View style={styles.approvalBtns}>
                  <Pressable
                    onPress={() => handleApprovePhoto(ver.id, "approved")}
                    style={[styles.btnMini, { backgroundColor: theme.success }]}
                  >
                    <Feather name="check" size={14} color="#FFFFFF" />
                  </Pressable>
                  <Pressable
                    onPress={() => handleApprovePhoto(ver.id, "rejected")}
                    style={[styles.btnMini, { backgroundColor: theme.error }]}
                  >
                    <Feather name="x" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>
            ))}

          {blockedTasks.length === 0 &&
            leaveRequests.filter((l) => l.status === "pending").length === 0 &&
            photoVerifications.filter((p) => p.status === "pending").length ===
              0 && (
              <ThemedText
                style={{ color: theme.textSecondary, textAlign: "center" }}
              >
                No pending approvals.
              </ThemedText>
            )}
        </View>

        {/* ─── 7. MATERIAL REQUESTS (SECTION 7) ─── */}
        <ThemedText type="h3" style={styles.widgetHeader}>
          Material Orders & Log
        </ThemedText>
        {materialRequests.map((req) => {
          const site = sites.find((s) => s.id === req.siteId);
          return (
            <View
              key={req.id}
              style={[
                styles.materialLogCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.matLogHeader}>
                <View>
                  <ThemedText style={{ fontWeight: "700" }}>
                    {req.materialName}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    Site: {site?.name || "Global"} | Qty: {req.quantity}
                  </ThemedText>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        req.status === "approved"
                          ? theme.success + "20"
                          : req.status === "rejected"
                            ? theme.error + "20"
                            : req.status === "delivered"
                              ? theme.info + "20"
                              : theme.warning + "20",
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color:
                        req.status === "approved"
                          ? theme.success
                          : req.status === "rejected"
                            ? theme.error
                            : req.status === "delivered"
                              ? theme.info
                              : theme.warning,
                      fontWeight: "700",
                    }}
                  >
                    {req.status.toUpperCase()}
                  </ThemedText>
                </View>
              </View>

              {req.status === "pending" && (
                <View style={styles.matLogBtns}>
                  <Pressable
                    onPress={() => handleApproveMaterial(req.id, "approved")}
                    style={[styles.matBtn, { backgroundColor: theme.success }]}
                  >
                    <ThemedText style={styles.matBtnText}>Approve</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => handleApproveMaterial(req.id, "rejected")}
                    style={[styles.matBtn, { backgroundColor: theme.error }]}
                  >
                    <ThemedText style={styles.matBtnText}>Reject</ThemedText>
                  </Pressable>
                </View>
              )}

              {req.status === "approved" && (
                <Pressable
                  onPress={() => handleApproveMaterial(req.id, "delivered")}
                  style={[
                    styles.matDeliverBtn,
                    { borderColor: theme.info, borderWidth: 1 },
                  ]}
                >
                  <ThemedText
                    style={{
                      color: theme.info,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    Mark Delivered
                  </ThemedText>
                </Pressable>
              )}
            </View>
          );
        })}

        {/* ─── 8. AI ASSISTANT (SECTION 8) ─── */}
        <ThemedText type="h3" style={styles.widgetHeader}>
          AI Site Command Assistant
        </ThemedText>
        <View
          style={[
            styles.aiCommandBox,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
        >
          <View
            style={[styles.aiHeaderRow, { borderBottomColor: theme.border }]}
          >
            <Feather name="cpu" size={16} color={theme.primary} />
            <ThemedText style={{ fontWeight: "700", marginLeft: 6 }}>
              HAI Command Copilot (Read-Only)
            </ThemedText>
          </View>
          <ScrollView
            style={styles.aiChatScroll}
            contentContainerStyle={{ gap: Spacing.sm, padding: Spacing.sm }}
          >
            {chatMessages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.chatBubble,
                  msg.sender === "user" ? styles.userBubble : styles.haiBubble,
                ]}
              >
                <ThemedText
                  style={{
                    color: msg.sender === "user" ? "#FFFFFF" : theme.text,
                    fontSize: 13,
                  }}
                >
                  {msg.text}
                </ThemedText>
              </View>
            ))}
          </ScrollView>
          <View style={[styles.aiInputRow, { borderTopColor: theme.border }]}>
            <TextInput
              style={[styles.aiInput, { color: theme.text }]}
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="Ask about materials, weather, or work progress..."
              placeholderTextColor={theme.textSecondary}
              onSubmitEditing={handleSendChatMessage}
            />
            <Pressable
              onPress={handleSendChatMessage}
              style={[styles.aiSendBtn, { backgroundColor: theme.primary }]}
            >
              <Feather name="send" size={14} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* ─── 9. RECENT ACTIVITIES (SECTION 9) ─── */}
        <ThemedText type="h3" style={styles.widgetHeader}>
          Recent Site Activity Log
        </ThemedText>
        <View
          style={[
            styles.timelineCard,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
        >
          {activities.map((act, index) => (
            <View key={act.id} style={styles.timelineItem}>
              <View style={styles.timelineIndicators}>
                <View
                  style={[
                    styles.timelineDot,
                    { backgroundColor: theme.primary },
                  ]}
                />
                {index < activities.length - 1 && (
                  <View
                    style={[
                      styles.timelineLine,
                      { backgroundColor: theme.border },
                    ]}
                  />
                )}
              </View>
              <View style={styles.timelineContent}>
                <ThemedText style={{ fontSize: 13, fontWeight: "600" }}>
                  {act.text}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {act.timeStr}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>

        {/* ─── 10. REPORTS & ANALYTICS (SECTION 10) ─── */}
        <ThemedText type="h3" style={styles.widgetHeader}>
          Reports & Command Analytics
        </ThemedText>
        <View
          style={[
            styles.analyticsCard,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
        >
          <ThemedText style={{ fontWeight: "700" }}>
            Weekly Command Completion
          </ThemedText>
          <View style={styles.chartBarGroup}>
            <ThemedText type="small" style={{ width: 60 }}>
              Week 1
            </ThemedText>
            <View style={styles.chartBarTrack}>
              <View
                style={[
                  styles.chartBarFill,
                  { backgroundColor: theme.success, width: "90%" },
                ]}
              />
            </View>
            <ThemedText type="small">90%</ThemedText>
          </View>
          <View style={styles.chartBarGroup}>
            <ThemedText type="small" style={{ width: 60 }}>
              Week 2
            </ThemedText>
            <View style={styles.chartBarTrack}>
              <View
                style={[
                  styles.chartBarFill,
                  { backgroundColor: theme.success, width: "80%" },
                ]}
              />
            </View>
            <ThemedText type="small">80%</ThemedText>
          </View>
          <View style={styles.chartBarGroup}>
            <ThemedText type="small" style={{ width: 60 }}>
              Week 3
            </ThemedText>
            <View style={styles.chartBarTrack}>
              <View
                style={[
                  styles.chartBarFill,
                  { backgroundColor: theme.success, width: "75%" },
                ]}
              />
            </View>
            <ThemedText type="small">75%</ThemedText>
          </View>
        </View>

        {/* ─── 11. EMERGENCY ALERTS (SECTION 11) ─── */}
        <ThemedText type="h3" style={styles.widgetHeader}>
          Emergency Command center logs
        </ThemedText>
        <View
          style={[
            styles.emergencyLogCard,
            {
              backgroundColor: sosActive
                ? theme.error + "20"
                : theme.backgroundDefault,
              borderColor: sosActive ? theme.error : theme.border,
            },
          ]}
        >
          <View style={styles.emergencyHeadRow}>
            <Feather
              name="alert-octagon"
              size={20}
              color={sosActive ? theme.error : theme.textSecondary}
            />
            <ThemedText
              style={{
                fontWeight: "800",
                marginLeft: 6,
                color: sosActive ? theme.error : theme.text,
              }}
            >
              {sosActive ? "CRITICAL SOS ACTIVE" : "ALL SYSTEMS GREEN"}
            </ThemedText>
          </View>
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, marginTop: 4 }}
          >
            {sosActive
              ? "SOS broadcast sent to site terminals. Fire/Injury teams alert is dispatch status."
              : "No active emergencies logged on building structures."}
          </ThemedText>
        </View>
      </ScrollView>

      {/* ─── MODAL DIALOGS FOR QUICK ACTIONS ─────────────────────────────────── */}

      {/* SITE CREATE MODAL */}
      <Modal visible={activeModal === "site"} transparent animationType="slide">
        <View style={styles.modalBack}>
          <ThemedView
            style={[
              styles.modalBoxContent,
              { backgroundColor: theme.backgroundRoot },
            ]}
          >
            <ThemedText type="h2" style={styles.modalTitle}>
              Create Site
            </ThemedText>
            <ThemedText type="small" style={styles.label}>
              Site Name
            </ThemedText>
            <TextInput
              style={[
                styles.modalInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
              ]}
              value={siteName}
              onChangeText={setSiteName}
              placeholder="e.g. Metro Heights Phase 1"
              placeholderTextColor={theme.textSecondary}
            />
            <ThemedText type="small" style={styles.label}>
              Location
            </ThemedText>
            <TextInput
              style={[
                styles.modalInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
              ]}
              value={siteLocation}
              onChangeText={setSiteLocation}
              placeholder="e.g. Sector 62, Noida"
              placeholderTextColor={theme.textSecondary}
            />
            <View style={styles.modalBtns}>
              <Pressable
                onPress={() => setActiveModal(null)}
                style={[
                  styles.modalBtn,
                  { borderColor: theme.border, borderWidth: 1 },
                ]}
              >
                <ThemedText>Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleCreateSite}
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
              >
                <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>
                  Save
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* ASSIGN TASK MODAL */}
      <Modal visible={activeModal === "task"} transparent animationType="slide">
        <View style={styles.modalBack}>
          <ThemedView
            style={[
              styles.modalBoxContent,
              { backgroundColor: theme.backgroundRoot },
            ]}
          >
            <ThemedText type="h2" style={styles.modalTitle}>
              Assign Task
            </ThemedText>
            <ThemedText type="small" style={styles.label}>
              Select Construction Site
            </ThemedText>
            <ScrollView horizontal style={{ marginBottom: 10 }}>
              {sites.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setTaskSiteId(s.id)}
                  style={[
                    styles.dropdownPill,
                    {
                      backgroundColor:
                        taskSiteId === s.id
                          ? theme.primary
                          : theme.backgroundSecondary,
                    },
                  ]}
                >
                  <ThemedText
                    style={{
                      color: taskSiteId === s.id ? "#FFFFFF" : theme.text,
                    }}
                  >
                    {s.name}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
            <ThemedText type="small" style={styles.label}>
              Team Name
            </ThemedText>
            <TextInput
              style={[
                styles.modalInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
              ]}
              value={taskTeam}
              onChangeText={setTaskTeam}
              placeholder="e.g. Mason Crew"
              placeholderTextColor={theme.textSecondary}
            />
            <ThemedText type="small" style={styles.label}>
              Task Description
            </ThemedText>
            <TextInput
              style={[
                styles.modalInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
              ]}
              value={taskNameText}
              onChangeText={setTaskNameText}
              placeholder="Task details..."
              placeholderTextColor={theme.textSecondary}
            />
            <View style={styles.modalBtns}>
              <Pressable
                onPress={() => setActiveModal(null)}
                style={[
                  styles.modalBtn,
                  { borderColor: theme.border, borderWidth: 1 },
                ]}
              >
                <ThemedText>Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleAssignTask}
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
              >
                <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>
                  Dispatch
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* ADD WORKER MODAL */}
      <Modal
        visible={activeModal === "worker"}
        transparent
        animationType="slide"
      >
        <View style={styles.modalBack}>
          <ThemedView
            style={[
              styles.modalBoxContent,
              { backgroundColor: theme.backgroundRoot },
            ]}
          >
            <ThemedText type="h2" style={styles.modalTitle}>
              Add Worker
            </ThemedText>
            <ThemedText type="small" style={styles.label}>
              Worker Name
            </ThemedText>
            <TextInput
              style={[
                styles.modalInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
              ]}
              value={workerName}
              onChangeText={setWorkerName}
              placeholder="Full Name"
              placeholderTextColor={theme.textSecondary}
            />
            <ThemedText type="small" style={styles.label}>
              Daily Rate (Rs)
            </ThemedText>
            <TextInput
              style={[
                styles.modalInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
              ]}
              value={workerRate}
              onChangeText={setWorkerRate}
              placeholder="Daily Wage e.g. 500"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
            />
            <ThemedText type="small" style={styles.label}>
              Site Assignment
            </ThemedText>
            <ScrollView horizontal style={{ marginBottom: 10 }}>
              {sites.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setWorkerSiteId(s.id)}
                  style={[
                    styles.dropdownPill,
                    {
                      backgroundColor:
                        workerSiteId === s.id
                          ? theme.primary
                          : theme.backgroundSecondary,
                    },
                  ]}
                >
                  <ThemedText
                    style={{
                      color: workerSiteId === s.id ? "#FFFFFF" : theme.text,
                    }}
                  >
                    {s.name}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.modalBtns}>
              <Pressable
                onPress={() => setActiveModal(null)}
                style={[
                  styles.modalBtn,
                  { borderColor: theme.border, borderWidth: 1 },
                ]}
              >
                <ThemedText>Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleAddWorker}
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
              >
                <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>
                  Register
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* CREATE NOTICE MODAL */}
      <Modal
        visible={activeModal === "notice"}
        transparent
        animationType="slide"
      >
        <View style={styles.modalBack}>
          <ThemedView
            style={[
              styles.modalBoxContent,
              { backgroundColor: theme.backgroundRoot },
            ]}
          >
            <ThemedText type="h2" style={styles.modalTitle}>
              Post Notice
            </ThemedText>
            <ThemedText type="small" style={styles.label}>
              Notice Title
            </ThemedText>
            <TextInput
              style={[
                styles.modalInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
              ]}
              value={noticeTitle}
              onChangeText={setNoticeTitle}
              placeholder="e.g. Safety Policy Update"
              placeholderTextColor={theme.textSecondary}
            />
            <ThemedText type="small" style={styles.label}>
              Notice Description
            </ThemedText>
            <TextInput
              style={[
                styles.modalInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
              ]}
              value={noticeBody}
              onChangeText={setNoticeBody}
              placeholder="Detailed text..."
              placeholderTextColor={theme.textSecondary}
              multiline
            />
            <View style={styles.modalBtns}>
              <Pressable
                onPress={() => setActiveModal(null)}
                style={[
                  styles.modalBtn,
                  { borderColor: theme.border, borderWidth: 1 },
                ]}
              >
                <ThemedText>Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleCreateNotice}
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
              >
                <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>
                  Post
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* RECORD VOICE MODAL */}
      <Modal
        visible={activeModal === "voice"}
        transparent
        animationType="slide"
      >
        <View style={styles.modalBack}>
          <ThemedView
            style={[
              styles.modalBoxContent,
              { backgroundColor: theme.backgroundRoot },
            ]}
          >
            <ThemedText type="h2" style={styles.modalTitle}>
              Record Voice Note
            </ThemedText>
            <Pressable
              onPress={handleRecordVoiceInstruction}
              style={[
                styles.sosAlertBtn,
                { backgroundColor: theme.primary, marginTop: Spacing.xl },
              ]}
            >
              <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>
                {isRecording ? "Listening..." : "Tap to Record (2s)"}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setActiveModal(null)}
              style={[
                styles.sosCancelBtn,
                { borderColor: theme.border, borderWidth: 1 },
              ]}
            >
              <ThemedText>Cancel</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>

      {/* MATERIAL ORDER MODAL */}
      <Modal
        visible={activeModal === "material"}
        transparent
        animationType="slide"
      >
        <View style={styles.modalBack}>
          <ThemedView
            style={[
              styles.modalBoxContent,
              { backgroundColor: theme.backgroundRoot },
            ]}
          >
            <ThemedText type="h2" style={styles.modalTitle}>
              Order Material
            </ThemedText>
            <ThemedText type="small" style={styles.label}>
              Material Item
            </ThemedText>
            <TextInput
              style={[
                styles.modalInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
              ]}
              value={matName}
              onChangeText={setMatName}
              placeholder="e.g. Portland Cement"
              placeholderTextColor={theme.textSecondary}
            />
            <ThemedText type="small" style={styles.label}>
              Quantity Required
            </ThemedText>
            <TextInput
              style={[
                styles.modalInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
              ]}
              value={matQty}
              onChangeText={setMatQty}
              placeholder="e.g. 100 Bags"
              placeholderTextColor={theme.textSecondary}
            />
            <ThemedText type="small" style={styles.label}>
              Construction Site
            </ThemedText>
            <ScrollView horizontal style={{ marginBottom: 10 }}>
              {sites.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setMatSiteId(s.id)}
                  style={[
                    styles.dropdownPill,
                    {
                      backgroundColor:
                        matSiteId === s.id
                          ? theme.primary
                          : theme.backgroundSecondary,
                    },
                  ]}
                >
                  <ThemedText
                    style={{
                      color: matSiteId === s.id ? "#FFFFFF" : theme.text,
                    }}
                  >
                    {s.name}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.modalBtns}>
              <Pressable
                onPress={() => setActiveModal(null)}
                style={[
                  styles.modalBtn,
                  { borderColor: theme.border, borderWidth: 1 },
                ]}
              >
                <ThemedText>Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleCreateMaterialRequest}
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
              >
                <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>
                  Submit Request
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* SITE DETAILS MODAL */}
      <Modal
        visible={activeModal === "details"}
        transparent
        animationType="slide"
      >
        <View style={styles.modalBack}>
          <ThemedView
            style={[
              styles.detailsModalBox,
              { backgroundColor: theme.backgroundRoot },
            ]}
          >
            <ThemedText type="h2" style={styles.modalTitle}>
              {selectedSiteForDetails?.name}
            </ThemedText>
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
            >
              <ThemedText type="h3" style={{ marginTop: 10 }}>
                Workforce Allocation
              </ThemedText>
              {workers
                .filter((w) => w.projectId === selectedSiteForDetails?.id)
                .map((w) => (
                  <ThemedText key={w.id} style={{ paddingVertical: 4 }}>
                    • {w.name} ({w.category})
                  </ThemedText>
                ))}
              {workers.filter((w) => w.projectId === selectedSiteForDetails?.id)
                .length === 0 && (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  No workers allocated yet.
                </ThemedText>
              )}

              <ThemedText type="h3" style={{ marginTop: 15 }}>
                Today's Tasks
              </ThemedText>
              {dailyPlans
                .filter((p) => p.siteId === selectedSiteForDetails?.id)
                .map((p) => (
                  <ThemedText key={p.id} style={{ paddingVertical: 4 }}>
                    • {p.taskName} ({p.status.toUpperCase()})
                  </ThemedText>
                ))}
              {dailyPlans.filter((p) => p.siteId === selectedSiteForDetails?.id)
                .length === 0 && (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  No work plans logged.
                </ThemedText>
              )}
            </ScrollView>
            <Pressable
              onPress={() => setActiveModal(null)}
              style={[
                styles.sosCancelBtn,
                { borderColor: theme.border, borderWidth: 1 },
              ]}
            >
              <ThemedText>Close Dashboard</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>

      {/* SOS SELECTION MODAL */}
      <Modal visible={showEmergencyModal} transparent animationType="fade">
        <View style={styles.modalBack}>
          <ThemedView
            style={[
              styles.modalBoxContent,
              { backgroundColor: theme.backgroundRoot },
            ]}
          >
            <Feather
              name="alert-octagon"
              size={48}
              color={theme.error}
              style={{ alignSelf: "center", marginBottom: 12 }}
            />
            <ThemedText
              type="h2"
              style={{ textAlign: "center", marginBottom: 6 }}
            >
              CRITICAL SOS ALERT
            </ThemedText>
            <ThemedText
              type="small"
              style={{
                textAlign: "center",
                color: theme.textSecondary,
                marginBottom: 18,
              }}
            >
              Select the alert category. This will broadcast immediately to all
              dashboards and safety networks.
            </ThemedText>
            <Pressable
              onPress={() => handleTriggerEmergencySOS("Fire")}
              style={[styles.sosAlertBtn, { backgroundColor: "#FF3B30" }]}
            >
              <ThemedText style={styles.sosAlertBtnText}>
                🔥 Fire Alert
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => handleTriggerEmergencySOS("Injury")}
              style={[styles.sosAlertBtn, { backgroundColor: "#FF9500" }]}
            >
              <ThemedText style={styles.sosAlertBtnText}>
                🩹 Worker Injury
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => handleTriggerEmergencySOS("Damage")}
              style={[styles.sosAlertBtn, { backgroundColor: "#5856D6" }]}
            >
              <ThemedText style={styles.sosAlertBtnText}>
                🏗 Structural Damage
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setShowEmergencyModal(false)}
              style={[
                styles.sosCancelBtn,
                { borderColor: theme.border, borderWidth: 1 },
              ]}
            >
              <ThemedText>Cancel</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  deniedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing["3xl"],
  },
  deniedTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: Spacing.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.OS === "ios" ? 54 : 32,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
  },
  backArrow: {
    marginRight: Spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  sosButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.pill,
  },
  sosButtonText: {
    fontWeight: "bold",
    fontSize: 13,
    marginLeft: Spacing.xs,
  },
  scrollBody: {
    padding: Spacing.xl,
    gap: Spacing.xl,
    paddingBottom: 80,
  },
  weatherCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  weatherHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  weatherBody: {
    marginTop: Spacing.md,
  },
  cardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  summaryCard: {
    width: "47%",
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    height: 110,
    justifyContent: "space-between",
    ...Shadows.md,
  },
  summaryCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryNum: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#FFFFFFEE",
    fontWeight: "600",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  widgetHeader: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: Spacing.xs,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    height: 38,
    borderRadius: BorderRadius.xs,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  noDataBox: {
    padding: Spacing.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  siteItemCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  siteItemHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.pill,
  },
  divider: {
    height: 1,
  },
  siteItemStats: {
    gap: Spacing.sm,
  },
  siteStatRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressValue: {
    height: "100%",
  },
  detailsBtn: {
    height: 38,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  planRowCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    padding: Spacing.lg,
  },
  planRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  distributionCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  distRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  distLabel: {
    width: 90,
    fontWeight: "600",
  },
  distTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#E0E0E0",
    borderRadius: 4,
    overflow: "hidden",
  },
  distFill: {
    height: "100%",
    borderRadius: 4,
  },
  distCount: {
    width: 70,
    textAlign: "right",
  },
  approvalsCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  approvalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  approvalInfo: {
    flex: 1,
  },
  approvalBtns: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  btnMini: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  resolveBtn: {
    paddingHorizontal: Spacing.md,
    height: 28,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
  },
  materialLogCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    padding: Spacing.lg,
  },
  matLogHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  matLogBtns: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  matBtn: {
    flex: 1,
    height: 32,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
  },
  matBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },
  matDeliverBtn: {
    height: 32,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  aiCommandBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    height: 300,
    overflow: "hidden",
  },
  aiHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  aiChatScroll: {
    flex: 1,
  },
  chatBubble: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    maxWidth: "80%",
  },
  userBubble: {
    backgroundColor: "#FF6B35",
    alignSelf: "flex-end",
    borderBottomRightRadius: 0,
  },
  haiBubble: {
    backgroundColor: "#353739",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 0,
  },
  aiInputRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderTopWidth: 1,
  },
  aiInput: {
    flex: 1,
    height: 36,
    fontSize: 13,
    paddingHorizontal: Spacing.md,
  },
  aiSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  timelineCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  timelineItem: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  timelineIndicators: {
    alignItems: "center",
    width: 16,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: Spacing.lg,
  },
  analyticsCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  chartBarGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  chartBarTrack: {
    flex: 1,
    height: 12,
    backgroundColor: "#E0E0E0",
    borderRadius: 6,
    overflow: "hidden",
  },
  chartBarFill: {
    height: "100%",
    borderRadius: 6,
  },
  emergencyLogCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  emergencyHeadRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalBack: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalBoxContent: {
    width: "100%",
    borderRadius: BorderRadius.xs,
    padding: Spacing.xl,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  label: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    marginBottom: Spacing.sm,
  },
  modalBtns: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.pill,
    marginRight: Spacing.sm,
    justifyContent: "center",
  },
  sosAlertBtn: {
    height: 48,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sosAlertBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  sosCancelBtn: {
    height: 48,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  detailsModalBox: {
    width: "100%",
    height: 400,
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    elevation: 5,
  },
});
