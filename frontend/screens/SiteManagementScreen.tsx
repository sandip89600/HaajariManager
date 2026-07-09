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
import { storage, Project, Worker, generateId, authenticatedFetch, API_URL } from "@/utils/storage";
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

  const getSiteStatusAndColor = (site: Project) => {
    let status: "planning" | "in_progress" | "on_hold" | "delayed" | "completed" = "in_progress";
    
    if (site.status === "inactive") {
      status = "completed";
    } else {
      let pct = 0;
      if (site.phases && site.phases.length > 0) {
        const sumWeight = site.phases.reduce((sum, p) => sum + (p.weight || 0), 0);
        const achievedWeight = site.phases.reduce((sum, p) => {
          return sum + (((p.percentDone || 0) * (p.weight || 0)) / 100);
        }, 0);
        pct = sumWeight > 0 ? (achievedWeight / sumWeight) * 100 : 0;
      } else if (site.plannedQty && site.plannedQty > 0) {
        pct = ((site.completedQty || 0) / site.plannedQty) * 100;
      }
      
      if (pct === 0) {
        status = "planning";
      } else if (pct >= 100) {
        status = "completed";
      }
    }

    const statusColors = {
      planning: { bg: "#F3F4F6", text: "#1F2937", label: "planning" },
      in_progress: { bg: "#E0F2FE", text: "#0369A1", label: "in progress" },
      on_hold: { bg: "#FEF3C7", text: "#B45309", label: "on hold" },
      delayed: { bg: "#FEE2E2", text: "#B91C1C", label: "delayed" },
      completed: { bg: "#D1FAE5", text: "#047857", label: "completed" },
    };

    return statusColors[status] || statusColors.in_progress;
  };

  const getProjectTypeIcon = (projectName: string, location: string = "") => {
    const combined = (projectName + " " + location).toLowerCase();
    if (combined.includes("metro") || combined.includes("rail") || combined.includes("train")) {
      return "train";
    }
    if (combined.includes("bridge") || combined.includes("flyover") || combined.includes("overpass")) {
      return "grid";
    }
    if (combined.includes("road") || combined.includes("highway") || combined.includes("street")) {
      return "navigation";
    }
    return "home";
  };

  const renderMeasuringTapeProgress = (percentage: number) => {
    const ticks = [10, 20, 30, 40, 50, 60, 70, 80, 90];
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: Spacing.sm }}>
        <View
          style={{
            flex: 1,
            height: 20,
            backgroundColor: "#FFE066",
            borderColor: "#D4AF37",
            borderWidth: 1.5,
            borderRadius: 4,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${percentage}%`,
              backgroundColor: "#E2B800",
            }}
          />
          {ticks.map((tick) => (
            <View
              key={tick}
              style={{
                position: "absolute",
                left: `${tick}%`,
                top: 0,
                width: 1.2,
                height: tick % 50 === 0 ? "70%" : "40%",
                backgroundColor: "#2B2B2B",
              }}
            />
          ))}
        </View>
        <ThemedText style={{ fontSize: 13, fontWeight: "500", color: theme.text }}>
          {percentage}%
        </ThemedText>
      </View>
    );
  };

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
  
  // Multi-step Site Creation states
  const [createStep, setCreateStep] = useState(1);
  const [clientName, setClientName] = useState("");
  const [budget, setBudget] = useState("");
  const [startDateStr, setStartDateStr] = useState("");
  const [endDateStr, setEndDateStr] = useState("");
  const [retentionPercentage, setRetentionPercentage] = useState("");
  const [mobilizationAdvance, setMobilizationAdvance] = useState("");
  const [labourLicenseNumber, setLabourLicenseNumber] = useState("");
  const [pfEsicStatus, setPfEsicStatus] = useState<"applicable" | "not_applicable">("not_applicable");
  const [wcPolicyNumber, setWcPolicyNumber] = useState("");
  const [progressUnit, setProgressUnit] = useState("cum");
  const [plannedQty, setPlannedQty] = useState("");
  const [phase1Name, setPhase1Name] = useState("Excavation");
  const [phase1Weight, setPhase1Weight] = useState("20");
  const [phase2Name, setPhase2Name] = useState("Structure");
  const [phase2Weight, setPhase2Weight] = useState("50");
  const [phase3Name, setPhase3Name] = useState("Finishing");
  const [phase3Weight, setPhase3Weight] = useState("30");

  // Site Detail tabs
  const [detailTab, setDetailTab] = useState<"progress" | "ledger" | "compliance">("progress");

  // Measurement Book states
  const [mbTaskName, setMbTaskName] = useState("");
  const [mbQuantity, setMbQuantity] = useState("");
  const [mbUnit, setMbUnit] = useState("cum");
  const [mbPhotoUri, setMbPhotoUri] = useState<string | null>(null);
  const [mbEntries, setMbEntries] = useState<any[]>([]);

  // Expense states
  const [expType, setExpType] = useState<"material" | "machinery" | "labour" | "vendor" | "other">("material");
  const [expAmount, setExpAmount] = useState("");
  const [expVendor, setExpVendor] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [expQty, setExpQty] = useState("");
  const [expUnit, setExpUnit] = useState("");
  const [expPhotoUri, setExpPhotoUri] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [dashboardMetrics, setDashboardMetrics] = useState<any>(null);

  // Delay states
  const [delayDays, setDelayDays] = useState("");
  const [delayReason, setDelayReason] = useState<"weather" | "material_shortage" | "labour_shortage" | "design_change" | "machinery_breakdown" | "other">("weather");
  const [delayDesc, setDelayDesc] = useState("");
  const [delayLogs, setDelayLogs] = useState<any[]>([]);

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

  const pickMBPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Error", "Camera permission is required.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      allowsEditing: true,
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      setMbPhotoUri(result.assets[0].uri);
    }
  };

  const pickExpensePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Error", "Camera permission is required.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      allowsEditing: true,
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      setExpPhotoUri(result.assets[0].uri);
    }
  };

  const handleSubmitMBEntry = async () => {
    if (!selectedSiteForDetails) return;
    if (!mbTaskName.trim() || !mbQuantity.trim() || !mbUnit.trim()) {
      Alert.alert("Error", "Task, quantity, and unit are required.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/projects/${selectedSiteForDetails.id}/mb-entry`, {
        method: "POST",
        body: JSON.stringify({
          taskName: mbTaskName.trim(),
          quantity: parseFloat(mbQuantity),
          unit: mbUnit.trim(),
          photoProofUri: mbPhotoUri || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMbEntries((prev) => [data, ...prev]);
        setMbTaskName("");
        setMbQuantity("");
        setMbPhotoUri(null);
        await loadSiteDetails(selectedSiteForDetails.id);
        Alert.alert("Success", "MB entry recorded successfully.");
      } else {
        Alert.alert("Error", "Failed to submit MB entry.");
      }
    } catch (e) {
      console.warn("Failed to submit MB entry", e);
      Alert.alert("Error", "Failed to submit MB entry.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitExpense = async () => {
    if (!selectedSiteForDetails) return;
    if (!expAmount.trim()) {
      Alert.alert("Error", "Amount is required.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/projects/${selectedSiteForDetails.id}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          type: expType,
          amount: parseFloat(expAmount),
          vendorName: expVendor.trim() || undefined,
          description: expDesc.trim() || undefined,
          quantity: parseFloat(expQty) || undefined,
          unit: expUnit.trim() || undefined,
          photoProofUri: expPhotoUri || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setExpenses((prev) => [data, ...prev]);
        setExpAmount("");
        setExpVendor("");
        setExpDesc("");
        setExpQty("");
        setExpUnit("");
        setExpPhotoUri(null);
        await loadSiteDetails(selectedSiteForDetails.id);
        Alert.alert("Success", "Expense logged successfully.");
      } else {
        Alert.alert("Error", "Failed to log expense.");
      }
    } catch (e) {
      console.warn("Failed to log expense", e);
      Alert.alert("Error", "Failed to log expense.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitDelayLog = async () => {
    if (!selectedSiteForDetails) return;
    if (!delayDays.trim()) {
      Alert.alert("Error", "Delay days is required.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/projects/${selectedSiteForDetails.id}/delay-log`, {
        method: "POST",
        body: JSON.stringify({
          delayDays: parseFloat(delayDays),
          reasonCode: delayReason,
          description: delayDesc.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDelayLogs((prev) => [data, ...prev]);
        setDelayDays("");
        setDelayDesc("");
        await loadSiteDetails(selectedSiteForDetails.id);
        Alert.alert("Success", "Delay log registered successfully.");
      } else {
        Alert.alert("Error", "Failed to register delay log.");
      }
    } catch (e) {
      console.warn("Failed to log delay", e);
      Alert.alert("Error", "Failed to register delay log.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadSiteDetails = async (siteId: string) => {
    try {
      const res = await authenticatedFetch(`${API_URL}/projects/${siteId}/dashboard`);
      if (res.ok) {
        const data = await res.json();
        setDashboardMetrics(data);
      }
      
      const mbRes = await authenticatedFetch(`${API_URL}/projects/${siteId}/mb-entries`);
      if (mbRes.ok) {
        const data = await mbRes.json();
        setMbEntries(data);
      }

      const expRes = await authenticatedFetch(`${API_URL}/projects/${siteId}/expenses`);
      if (expRes.ok) {
        const data = await expRes.json();
        setExpenses(data);
      }

      const delayRes = await authenticatedFetch(`${API_URL}/projects/${siteId}/delay-logs`);
      if (delayRes.ok) {
        const data = await delayRes.json();
        setDelayLogs(data);
      }
    } catch (e) {
      console.warn("Failed to fetch dashboard detail", e);
    }
  };

  useEffect(() => {
    if (selectedSiteForDetails) {
      loadSiteDetails(selectedSiteForDetails.id);
    }
  }, [selectedSiteForDetails]);

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
        id: "",
        name: siteName.trim(),
        location: siteLocation.trim() || "N/A",
        status: "active",
        clientName: clientName.trim() || undefined,
        budget: parseFloat(budget) || 0,
        startDate: startDateStr.trim() || undefined,
        endDate: endDateStr.trim() || undefined,
        retentionPercentage: parseFloat(retentionPercentage) || 0,
        mobilizationAdvance: parseFloat(mobilizationAdvance) || 0,
        labourLicenseNumber: labourLicenseNumber.trim() || undefined,
        pfEsicStatus,
        wcPolicyNumber: wcPolicyNumber.trim() || undefined,
        progressUnit: progressUnit,
        plannedQty: parseFloat(plannedQty) || 0,
        completedQty: 0,
        phases: [
          { name: phase1Name, weight: parseFloat(phase1Weight) || 0, status: "pending", percentDone: 0 },
          { name: phase2Name, weight: parseFloat(phase2Weight) || 0, status: "pending", percentDone: 0 },
          { name: phase3Name, weight: parseFloat(phase3Weight) || 0, status: "pending", percentDone: 0 },
        ],
        createdAt: Date.now(),
      };
      await storage.addProject(newProj);
      setSites((prev) => [newProj, ...prev]);

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
      setClientName("");
      setBudget("");
      setStartDateStr("");
      setEndDateStr("");
      setRetentionPercentage("");
      setMobilizationAdvance("");
      setLabourLicenseNumber("");
      setPfEsicStatus("not_applicable");
      setWcPolicyNumber("");
      setProgressUnit("cum");
      setPlannedQty("");
      setPhase1Name("Excavation");
      setPhase1Weight("20");
      setPhase2Name("Structure");
      setPhase2Weight("50");
      setPhase3Name("Finishing");
      setPhase3Weight("30");
      setCreateStep(1);
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
      {/* custom header */}
      <View style={[styles.header, { borderBottomColor: theme.border, shadowOpacity: 0, elevation: 0 }]}>
        {navigation.canGoBack() && (
          <Pressable onPress={() => navigation.goBack()} style={styles.backArrow}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
        )}
        <View style={styles.headerInfo}>
          <ThemedText type="h1" style={[styles.headerTitle, { fontWeight: "500", textTransform: "lowercase" }]}>
            haajari command center
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, textTransform: "lowercase" }}>
            site command and control terminal
          </ThemedText>
        </View>
        <Pressable
          onPress={() => setShowEmergencyModal(true)}
          style={[
            styles.sosButton,
            { backgroundColor: sosActive ? theme.error : theme.error + "15", height: 44, borderRadius: 8, elevation: 0 },
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
              { color: sosActive ? "#FFFFFF" : theme.error, fontWeight: "500", textTransform: "lowercase" },
            ]}
          >
            sos
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollBody}
        showsVerticalScrollIndicator={false}
      >


        {/* summary stats */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: Spacing.lg }}>
          {[
            { label: "active sites", num: activeSitesCount, icon: "map", bg: "#E0F2FE", text: "#0369A1" },
            { label: "total workers", num: workers.length, icon: "users", bg: "#F3F4F6", text: "#1F2937" },
            { label: "completed tasks", num: completedTasksCount, icon: "check-circle", bg: "#D1FAE5", text: "#047857" },
            { label: "blocked tasks", num: blockedTasksCount, icon: "alert-triangle", bg: "#FEE2E2", text: "#B91C1C" },
          ].map((item, idx) => (
            <View
              key={idx}
              style={{
                flex: 1,
                minWidth: "45%",
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
                borderWidth: 1.5,
                borderRadius: 12,
                padding: 12,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Feather name={item.icon as any} size={14} color={theme.textSecondary} />
                <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: item.bg }}>
                  <ThemedText style={{ color: item.text, fontSize: 9, fontWeight: "500", textTransform: "lowercase" }}>{item.label}</ThemedText>
                </View>
              </View>
              <ThemedText style={{ fontSize: 20, fontWeight: "500", color: theme.text }}>
                {item.num}
              </ThemedText>
            </View>
          ))}
        </View>

        {/* search bar */}
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
              borderRadius: 8,
              borderWidth: 1.5,
              elevation: 0,
              height: 44,
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
            style={[styles.searchInput, { color: theme.text, fontSize: 14 }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="search sites, workers, or supervisors..."
            placeholderTextColor={theme.textSecondary}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Feather name="x" size={16} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        {/* quick command actions */}
        <ThemedText type="h3" style={[styles.widgetHeader, { fontWeight: "500", textTransform: "lowercase", marginBottom: 10 }]}>
          quick command actions
        </ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: Spacing.sm }}
          style={{ marginBottom: Spacing.lg }}
        >
          {[
            { label: "create site", icon: "map", action: "site" },
            { label: "assign task", icon: "clipboard", action: "task" },
            { label: "add worker", icon: "user-plus", action: "worker" },
            { label: "create notice", icon: "volume-2", action: "notice" },
            { label: "record voice", icon: "mic", action: "voice" },
            { label: "order material", icon: "shopping-cart", action: "material" },
          ].map((action, idx) => (
            <Pressable
              key={idx}
              onPress={() => setActiveModal(action.action as any)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
                borderWidth: 1.5,
                borderRadius: 8,
                paddingHorizontal: 12,
                height: 44,
              }}
            >
              <Feather name={action.icon as any} size={14} color={theme.primary} />
              <ThemedText style={{ color: theme.text, fontSize: 12, fontWeight: "500", textTransform: "lowercase" }}>{action.label}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        {/* my sites directory */}
        <ThemedText type="h3" style={[styles.widgetHeader, { fontWeight: "500", textTransform: "lowercase", marginBottom: 10 }]}>
          my sites directory
        </ThemedText>
        {filteredSites.length === 0 ? (
          <View style={styles.noDataBox}>
            <ThemedText style={{ color: theme.textSecondary, textTransform: "lowercase" }}>
              no sites matched search query.
            </ThemedText>
          </View>
        ) : (
          filteredSites.map((site) => {
            const siteWorkers = workers.filter((w) => w.projectId === site.id);
            const statusConfig = getSiteStatusAndColor(site);
            const projectIcon = getProjectTypeIcon(site.name, site.location);
            const progressPercent = (() => {
              let pct = 0;
              if (site.phases && site.phases.length > 0) {
                const sumWeight = site.phases.reduce((sum: number, p: any) => sum + (p.weight || 0), 0);
                const achievedWeight = site.phases.reduce((sum: number, p: any) => {
                  return sum + (((p.percentDone || 0) * (p.weight || 0)) / 100);
                }, 0);
                pct = sumWeight > 0 ? (achievedWeight / sumWeight) * 100 : 0;
              } else if (site.plannedQty && site.plannedQty > 0) {
                pct = ((site.completedQty || 0) / site.plannedQty) * 100;
              }
              return Math.min(100, Math.max(0, Math.round(pct)));
            })();

            return (
              <View
                key={site.id}
                style={{
                  flexDirection: "row",
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                  borderWidth: 1.5,
                  borderRadius: 12,
                  marginBottom: Spacing.md,
                  overflow: "hidden",
                }}
              >
                {/* Status Color Strip on Left Edge */}
                <View style={{ width: 5, backgroundColor: statusConfig.text }} />

                <View style={{ flex: 1, padding: Spacing.md }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                      <Feather name={projectIcon as any} size={18} color={theme.textSecondary} />
                      <ThemedText style={{ fontSize: 16, fontWeight: "500", color: theme.text, flex: 1, textTransform: "lowercase" }}>
                        {site.name}
                      </ThemedText>
                    </View>
                    
                    {/* Status Badge */}
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 4,
                        backgroundColor: statusConfig.bg,
                      }}
                    >
                      <ThemedText
                        style={{
                          color: statusConfig.text,
                          fontWeight: "500",
                          fontSize: 10,
                          textTransform: "lowercase",
                        }}
                      >
                        {statusConfig.label}
                      </ThemedText>
                    </View>
                  </View>

                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, marginTop: 4, marginLeft: 26, textTransform: "lowercase" }}
                  >
                    📍 {site.location || "location not set"}
                  </ThemedText>

                  {/* Divider */}
                  <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 10, marginLeft: 26 }} />

                  {/* Workers and supervisor */}
                  <View style={{ marginLeft: 26, gap: 4, marginBottom: 5 }}>
                    <ThemedText type="small" style={{ color: theme.textSecondary, textTransform: "lowercase" }}>
                      supervisor: <ThemedText type="small" style={{ fontWeight: "500", color: theme.text, textTransform: "lowercase" }}>{siteSupervisor}</ThemedText>
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary, textTransform: "lowercase" }}>
                      workers present: <ThemedText type="small" style={{ fontWeight: "500", color: theme.text }}>{siteWorkers.length}</ThemedText>
                    </ThemedText>
                  </View>

                  {/* Measuring Tape Progress Bar */}
                  <View style={{ marginLeft: 26 }}>
                    {renderMeasuringTapeProgress(progressPercent)}
                  </View>

                  <Pressable
                    onPress={() => {
                      setSelectedSiteForDetails(site);
                      setActiveModal("details");
                    }}
                    style={{
                      height: 44,
                      borderRadius: 8,
                      borderColor: theme.primary,
                      borderWidth: 1.5,
                      justifyContent: "center",
                      alignItems: "center",
                      marginTop: 12,
                      marginLeft: 26,
                      backgroundColor: "transparent",
                    }}
                  >
                    <ThemedText
                      style={{
                        color: theme.primary,
                        fontWeight: "500",
                        fontSize: 13,
                        textTransform: "lowercase",
                      }}
                    >
                      view dashboard
                    </ThemedText>
                  </Pressable>
                </View>
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

      {/* SITE CREATE MODAL (MULTI-STEP) */}
      <Modal visible={activeModal === "site"} transparent animationType="slide">
        <View style={styles.modalBack}>
          <ThemedView
            style={[
              styles.modalBoxContent,
              { backgroundColor: theme.backgroundRoot, maxHeight: "90%", width: "92%" },
            ]}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <ThemedText type="h2" style={{ fontSize: 20, fontWeight: "800" }}>
                Create Site
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.primary, fontWeight: "700" }}>
                Step {createStep} of 3
              </ThemedText>
            </View>

            {/* Step Indicators */}
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 15 }}>
              {[1, 2, 3].map((s) => (
                <View
                  key={s}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: createStep >= s ? theme.primary : theme.border,
                  }}
                />
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 15 }}>
              {createStep === 1 && (
                <View style={{ gap: Spacing.sm }}>
                  <ThemedText type="small" style={styles.label}>Site Name *</ThemedText>
                  <TextInput
                    style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
                    value={siteName}
                    onChangeText={setSiteName}
                    placeholder="e.g. Metro Heights Phase 1"
                    placeholderTextColor={theme.textSecondary}
                  />

                  <ThemedText type="small" style={styles.label}>Location / Address</ThemedText>
                  <TextInput
                    style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
                    value={siteLocation}
                    onChangeText={setSiteLocation}
                    placeholder="e.g. Sector 62, Noida"
                    placeholderTextColor={theme.textSecondary}
                  />

                  <ThemedText type="small" style={styles.label}>Client Name</ThemedText>
                  <TextInput
                    style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
                    value={clientName}
                    onChangeText={setClientName}
                    placeholder="e.g. Delhi Metro Rail Corp"
                    placeholderTextColor={theme.textSecondary}
                  />

                  <View style={{ flexDirection: "row", gap: Spacing.md }}>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="small" style={styles.label}>Start Date</ThemedText>
                      <TextInput
                        style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
                        value={startDateStr}
                        onChangeText={setStartDateStr}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={theme.textSecondary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="small" style={styles.label}>End Date</ThemedText>
                      <TextInput
                        style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
                        value={endDateStr}
                        onChangeText={setEndDateStr}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={theme.textSecondary}
                      />
                    </View>
                  </View>
                </View>
              )}

              {createStep === 2 && (
                <View style={{ gap: Spacing.sm }}>
                  <ThemedText type="small" style={styles.label}>Total Budget ({t.common.currency})</ThemedText>
                  <TextInput
                    style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
                    value={budget}
                    onChangeText={setBudget}
                    placeholder="e.g. 5000000"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                  />

                  <View style={{ flexDirection: "row", gap: Spacing.md }}>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="small" style={styles.label}>Retention Money %</ThemedText>
                      <TextInput
                        style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
                        value={retentionPercentage}
                        onChangeText={setRetentionPercentage}
                        placeholder="e.g. 5"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="small" style={styles.label}>Mobilization Advance</ThemedText>
                      <TextInput
                        style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
                        value={mobilizationAdvance}
                        onChangeText={setMobilizationAdvance}
                        placeholder="e.g. 200000"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: Spacing.md }}>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="small" style={styles.label}>Planned Target Qty</ThemedText>
                      <TextInput
                        style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
                        value={plannedQty}
                        onChangeText={setPlannedQty}
                        placeholder="e.g. 600"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="small" style={styles.label}>Qty Unit</ThemedText>
                      <TextInput
                        style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
                        value={progressUnit}
                        onChangeText={setProgressUnit}
                        placeholder="e.g. cum, sqft, tons"
                        placeholderTextColor={theme.textSecondary}
                      />
                    </View>
                  </View>

                  <ThemedText style={{ fontWeight: "700", marginTop: 10, marginBottom: 5 }}>Phases Config (Weights must sum to 100%)</ThemedText>
                  <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                    <TextInput
                      style={[styles.modalInput, { flex: 2, color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
                      value={phase1Name}
                      onChangeText={setPhase1Name}
                      placeholder="Phase 1"
                    />
                    <TextInput
                      style={[styles.modalInput, { flex: 1, color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
                      value={phase1Weight}
                      onChangeText={setPhase1Weight}
                      placeholder="Weight %"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                    <TextInput
                      style={[styles.modalInput, { flex: 2, color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
                      value={phase2Name}
                      onChangeText={setPhase2Name}
                      placeholder="Phase 2"
                    />
                    <TextInput
                      style={[styles.modalInput, { flex: 1, color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
                      value={phase2Weight}
                      onChangeText={setPhase2Weight}
                      placeholder="Weight %"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                    <TextInput
                      style={[styles.modalInput, { flex: 2, color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
                      value={phase3Name}
                      onChangeText={setPhase3Name}
                      placeholder="Phase 3"
                    />
                    <TextInput
                      style={[styles.modalInput, { flex: 1, color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
                      value={phase3Weight}
                      onChangeText={setPhase3Weight}
                      placeholder="Weight %"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              )}

              {createStep === 3 && (
                <View style={{ gap: Spacing.sm }}>
                  <ThemedText type="small" style={styles.label}>Labour License Number</ThemedText>
                  <TextInput
                    style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
                    value={labourLicenseNumber}
                    onChangeText={setLabourLicenseNumber}
                    placeholder="e.g. LIC/2026/0927"
                    placeholderTextColor={theme.textSecondary}
                  />

                  <ThemedText type="small" style={styles.label}>PF / ESIC Registration Status</ThemedText>
                  <View style={{ flexDirection: "row", gap: 8, marginVertical: 4 }}>
                    {(["applicable", "not_applicable"] as const).map((status) => {
                      const isSelected = pfEsicStatus === status;
                      return (
                        <Pressable
                          key={status}
                          onPress={() => setPfEsicStatus(status)}
                          style={[
                            styles.dropdownPill,
                            {
                              backgroundColor: isSelected ? theme.primary : theme.backgroundDefault,
                              borderColor: theme.border,
                              borderWidth: 1.5,
                              flex: 1,
                              alignItems: "center",
                              justifyContent: "center",
                              height: 40,
                            },
                          ]}
                        >
                          <ThemedText style={{ color: isSelected ? "#FFFFFF" : theme.text, fontWeight: "600", fontSize: 12 }}>
                            {status === "applicable" ? "Applicable" : "Not Applicable"}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>

                  <ThemedText type="small" style={styles.label}>Workmen Compensation (WC) Insurance Policy</ThemedText>
                  <TextInput
                    style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
                    value={wcPolicyNumber}
                    onChangeText={setWcPolicyNumber}
                    placeholder="e.g. WC-9012384-IN"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              )}
            </ScrollView>

            <View style={styles.modalBtns}>
              {createStep === 1 ? (
                <Pressable
                  onPress={() => setActiveModal(null)}
                  style={[styles.modalBtn, { borderColor: theme.border, borderWidth: 1 }]}
                >
                  <ThemedText>Cancel</ThemedText>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => setCreateStep((s) => s - 1)}
                  style={[styles.modalBtn, { borderColor: theme.border, borderWidth: 1 }]}
                >
                  <ThemedText>Back</ThemedText>
                </Pressable>
              )}

              {createStep < 3 ? (
                <Pressable
                  onPress={() => {
                    if (createStep === 1 && !siteName.trim()) {
                      Alert.alert("Error", "Site name is required.");
                      return;
                    }
                    setCreateStep((s) => s + 1);
                  }}
                  style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                >
                  <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>
                    Next
                  </ThemedText>
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleCreateSite}
                  style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                >
                  <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>
                    Save
                  </ThemedText>
                </Pressable>
              )}
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

      {/* SITE DETAILS COMMAND DASHBOARD MODAL */}
      <Modal
        visible={activeModal === "details"}
        transparent
        animationType="slide"
      >
        <View style={styles.modalBack}>
          <ThemedView
            style={[
              styles.detailsModalBox,
              { backgroundColor: theme.backgroundRoot, height: "92%", width: "95%", padding: Spacing.md, borderRadius: BorderRadius.md },
            ]}
          >
            {/* Header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <ThemedText type="h2" style={{ fontSize: 18, fontWeight: "800" }}>
                  {selectedSiteForDetails?.name}
                </ThemedText>
                {selectedSiteForDetails?.clientName ? (
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Client: {selectedSiteForDetails.clientName}
                  </ThemedText>
                ) : null}
              </View>
              <Pressable
                onPress={() => setActiveModal(null)}
                style={{ padding: 4 }}
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            {/* Tab Headers */}
            <View style={{ flexDirection: "row", backgroundColor: theme.backgroundDefault, borderRadius: 10, padding: 4, marginBottom: 15 }}>
              {(["progress", "ledger", "compliance"] as const).map((tab) => {
                const isActive = detailTab === tab;
                const labels = {
                  progress: "Progress (MB)",
                  ledger: "Ledger",
                  compliance: "Compliance & Delay"
                };
                return (
                  <Pressable
                    key={tab}
                    onPress={() => setDetailTab(tab)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 8,
                      alignItems: "center",
                      backgroundColor: isActive ? theme.primary : "transparent",
                    }}
                  >
                    <ThemedText
                      style={{
                        color: isActive ? "#FFFFFF" : theme.textSecondary,
                        fontWeight: "700",
                        fontSize: 11,
                      }}
                    >
                      {labels[tab]}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              
              {/* TAB 1: PROGRESS (MEASUREMENT BOOK) */}
              {detailTab === "progress" && (
                <View style={{ gap: Spacing.md }}>
                  {/* Progress Gauge */}
                  <View style={{ backgroundColor: theme.backgroundDefault, borderRadius: BorderRadius.sm, padding: Spacing.md, borderWidth: 1, borderColor: theme.border }}>
                    <ThemedText type="h4" style={{ fontWeight: "700", marginBottom: 5 }}>Site Progress Status</ThemedText>
                    {selectedSiteForDetails?.plannedQty ? (
                      <View style={{ marginBottom: 10 }}>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>
                          Target Quantity: {selectedSiteForDetails.completedQty || 0} / {selectedSiteForDetails.plannedQty} {selectedSiteForDetails.progressUnit || "cum"}
                        </ThemedText>
                        <View style={{ height: 6, backgroundColor: theme.border, borderRadius: 3, marginTop: 4, overflow: "hidden" }}>
                          <View
                            style={{
                              height: "100%",
                              backgroundColor: theme.info,
                              width: `${Math.min(100, Math.round(((selectedSiteForDetails.completedQty || 0) / selectedSiteForDetails.plannedQty) * 100))}%`,
                            }}
                          />
                        </View>
                      </View>
                    ) : null}

                    {selectedSiteForDetails?.phases && selectedSiteForDetails.phases.length > 0 ? (
                      <View>
                        <ThemedText type="small" style={{ fontWeight: "700", marginBottom: 4, color: theme.textSecondary }}>Phases Progress:</ThemedText>
                        {selectedSiteForDetails.phases.map((ph: any, i: number) => (
                          <View key={i} style={{ marginBottom: 6 }}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                              <ThemedText type="small">{ph.name} ({ph.weight}%)</ThemedText>
                              <ThemedText type="small" style={{ fontWeight: "700" }}>{ph.percentDone}%</ThemedText>
                            </View>
                            <View style={{ height: 4, backgroundColor: theme.border, borderRadius: 2, marginTop: 2, overflow: "hidden" }}>
                              <View style={{ height: "100%", backgroundColor: theme.primary, width: `${ph.percentDone}%` }} />
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>No phases configured.</ThemedText>
                    )}
                  </View>

                  {/* Measurement Book Form */}
                  <View style={{ backgroundColor: theme.backgroundDefault, borderRadius: BorderRadius.sm, padding: Spacing.md, borderWidth: 1, borderColor: theme.border, gap: Spacing.sm }}>
                    <ThemedText type="h4" style={{ fontWeight: "700" }}>Log Measurement Book (MB) Entry</ThemedText>
                    
                    <ThemedText type="small" style={styles.label}>Task / Component Name</ThemedText>
                    <TextInput
                      style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundRoot }]}
                      value={mbTaskName}
                      onChangeText={setMbTaskName}
                      placeholder="e.g. Column Concreting M25"
                      placeholderTextColor={theme.textSecondary}
                    />

                    <View style={{ flexDirection: "row", gap: Spacing.md }}>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="small" style={styles.label}>Quantity Done</ThemedText>
                        <TextInput
                          style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundRoot }]}
                          value={mbQuantity}
                          onChangeText={setMbQuantity}
                          placeholder="e.g. 45"
                          placeholderTextColor={theme.textSecondary}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="small" style={styles.label}>Unit</ThemedText>
                        <TextInput
                          style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundRoot }]}
                          value={mbUnit}
                          onChangeText={setMbUnit}
                          placeholder="cum, sqft, tons"
                          placeholderTextColor={theme.textSecondary}
                        />
                      </View>
                    </View>

                    {/* Camera */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 4 }}>
                      <Pressable
                        onPress={pickMBPhoto}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: theme.primary + "15",
                          padding: 10,
                          borderRadius: 8,
                          gap: 6
                        }}
                      >
                        <Feather name="camera" size={16} color={theme.primary} />
                        <ThemedText type="small" style={{ color: theme.primary, fontWeight: "700" }}>Upload Work Photo</ThemedText>
                      </Pressable>
                      {mbPhotoUri ? (
                        <ThemedText type="small" style={{ color: theme.success }}>✓ Photo Selected</ThemedText>
                      ) : null}
                    </View>

                    <Pressable
                      onPress={handleSubmitMBEntry}
                      style={{ backgroundColor: theme.primary, paddingVertical: 12, borderRadius: 8, alignItems: "center", marginTop: 5 }}
                    >
                      <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>Record Measurement</ThemedText>
                    </Pressable>
                  </View>

                  {/* MB Entries Log */}
                  <View>
                    <ThemedText type="h4" style={{ fontWeight: "700", marginBottom: 8 }}>Measurement History Log</ThemedText>
                    {mbEntries.length === 0 ? (
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>No measurements recorded yet.</ThemedText>
                    ) : (
                      mbEntries.map((entry) => (
                        <View
                          key={entry._id || entry.id}
                          style={{
                            backgroundColor: theme.backgroundDefault,
                            borderRadius: 8,
                            padding: Spacing.md,
                            marginBottom: 8,
                            borderWidth: 1,
                            borderColor: theme.border,
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center"
                          }}
                        >
                          <View>
                            <ThemedText style={{ fontWeight: "700" }}>{entry.taskName}</ThemedText>
                            <ThemedText type="small" style={{ color: theme.textSecondary }}>
                              {entry.quantity} {entry.unit} • {new Date(entry.date).toLocaleDateString()}
                            </ThemedText>
                          </View>
                          {entry.photoProofUri ? (
                            <Feather name="image" size={18} color={theme.primary} />
                          ) : null}
                        </View>
                      ))
                    )}
                  </View>
                </View>
              )}

              {/* TAB 2: LEDGER */}
              {detailTab === "ledger" && (
                <View style={{ gap: Spacing.md }}>
                  {/* Financial Stats */}
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1, backgroundColor: theme.backgroundDefault, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: theme.border }}>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>Budget</ThemedText>
                      <ThemedText style={{ fontWeight: "800", fontSize: 15 }}>₹{selectedSiteForDetails?.budget || 0}</ThemedText>
                    </View>
                    <View style={{ flex: 1, backgroundColor: theme.backgroundDefault, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: theme.border }}>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>Spent</ThemedText>
                      <ThemedText style={{ fontWeight: "800", fontSize: 15, color: theme.error }}>₹{dashboardMetrics?.totalSpent || 0}</ThemedText>
                    </View>
                    <View style={{ flex: 1, backgroundColor: theme.backgroundDefault, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: theme.border }}>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>Balance</ThemedText>
                      <ThemedText style={{ fontWeight: "800", fontSize: 15, color: theme.success }}>₹{dashboardMetrics?.remainingBudget || 0}</ThemedText>
                    </View>
                  </View>

                  {/* Add Expense Form */}
                  <View style={{ backgroundColor: theme.backgroundDefault, borderRadius: BorderRadius.sm, padding: Spacing.md, borderWidth: 1, borderColor: theme.border, gap: Spacing.sm }}>
                    <ThemedText type="h4" style={{ fontWeight: "700" }}>Log Material / Machinery / Vendor Expense</ThemedText>
                    
                    <ThemedText type="small" style={styles.label}>Expense Category</ThemedText>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {(["material", "machinery", "labour", "vendor", "other"] as const).map((cat) => {
                        const isSelected = expType === cat;
                        const catLabels = {
                          material: "Material",
                          machinery: "Machinery Rent",
                          labour: "Labour Wages",
                          vendor: "Vendor Payment",
                          other: "Other"
                        };
                        return (
                          <Pressable
                            key={cat}
                            onPress={() => setExpType(cat)}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 16,
                              borderWidth: 1.5,
                              borderColor: isSelected ? theme.primary : theme.border,
                              backgroundColor: isSelected ? theme.primary : "transparent"
                            }}
                          >
                            <ThemedText style={{ color: isSelected ? "#FFFFFF" : theme.textSecondary, fontSize: 10, fontWeight: "700" }}>
                              {catLabels[cat]}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>

                    <ThemedText type="small" style={styles.label}>Amount (INR) *</ThemedText>
                    <TextInput
                      style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundRoot }]}
                      value={expAmount}
                      onChangeText={setExpAmount}
                      placeholder="e.g. 25000"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                    />

                    <View style={{ flexDirection: "row", gap: Spacing.md }}>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="small" style={styles.label}>Quantity</ThemedText>
                        <TextInput
                          style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundRoot }]}
                          value={expQty}
                          onChangeText={setExpQty}
                          placeholder="e.g. 50"
                          placeholderTextColor={theme.textSecondary}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="small" style={styles.label}>Unit</ThemedText>
                        <TextInput
                          style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundRoot }]}
                          value={expUnit}
                          onChangeText={setExpUnit}
                          placeholder="bags, tons, days"
                          placeholderTextColor={theme.textSecondary}
                        />
                      </View>
                    </View>

                    <ThemedText type="small" style={styles.label}>Vendor / Subcontractor Name</ThemedText>
                    <TextInput
                      style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundRoot }]}
                      value={expVendor}
                      onChangeText={setExpVendor}
                      placeholder="e.g. Ultratech Cement Agency"
                      placeholderTextColor={theme.textSecondary}
                    />

                    <ThemedText type="small" style={styles.label}>Description</ThemedText>
                    <TextInput
                      style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundRoot }]}
                      value={expDesc}
                      onChangeText={setExpDesc}
                      placeholder="e.g. Purchase of 50 bags of OPC cement"
                      placeholderTextColor={theme.textSecondary}
                    />

                    {/* Camera */}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 4 }}>
                      <Pressable
                        onPress={pickExpensePhoto}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: theme.primary + "15",
                          padding: 10,
                          borderRadius: 8,
                          gap: 6
                        }}
                      >
                        <Feather name="camera" size={16} color={theme.primary} />
                        <ThemedText type="small" style={{ color: theme.primary, fontWeight: "700" }}>Upload Receipt Bill</ThemedText>
                      </Pressable>
                      {expPhotoUri ? (
                        <ThemedText type="small" style={{ color: theme.success }}>✓ Bill Attached</ThemedText>
                      ) : null}
                    </View>

                    <Pressable
                      onPress={handleSubmitExpense}
                      style={{ backgroundColor: theme.primary, paddingVertical: 12, borderRadius: 8, alignItems: "center", marginTop: 5 }}
                    >
                      <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>Log Expense</ThemedText>
                    </Pressable>
                  </View>

                  {/* Expenses History */}
                  <View>
                    <ThemedText type="h4" style={{ fontWeight: "700", marginBottom: 8 }}>Expense History Ledger</ThemedText>
                    {expenses.length === 0 ? (
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>No expenses recorded yet.</ThemedText>
                    ) : (
                      expenses.map((exp) => (
                        <View
                          key={exp._id || exp.id}
                          style={{
                            backgroundColor: theme.backgroundDefault,
                            borderRadius: 8,
                            padding: Spacing.md,
                            marginBottom: 8,
                            borderWidth: 1,
                            borderColor: theme.border,
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center"
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <View style={{ backgroundColor: theme.primary + "15", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                <ThemedText type="small" style={{ fontSize: 9, textTransform: "uppercase", fontWeight: "700", color: theme.primary }}>
                                  {exp.type}
                                </ThemedText>
                              </View>
                              <ThemedText style={{ fontWeight: "700" }}>₹{exp.amount}</ThemedText>
                            </View>
                            {exp.vendorName ? (
                              <ThemedText type="small" style={{ fontWeight: "600", marginTop: 2 }}>Vendor: {exp.vendorName}</ThemedText>
                            ) : null}
                            {exp.description ? (
                              <ThemedText type="small" style={{ color: theme.textSecondary }}>{exp.description}</ThemedText>
                            ) : null}
                          </View>
                          {exp.photoProofUri ? (
                            <Feather name="file-text" size={18} color={theme.primary} />
                          ) : null}
                        </View>
                      ))
                    )}
                  </View>
                </View>
              )}

              {/* TAB 3: COMPLIANCE & DELAYS */}
              {detailTab === "compliance" && (
                <View style={{ gap: Spacing.md }}>
                  {/* Compliance Indicators */}
                  <View style={{ backgroundColor: theme.backgroundDefault, borderRadius: BorderRadius.sm, padding: Spacing.md, borderWidth: 1, borderColor: theme.border, gap: Spacing.sm }}>
                    <ThemedText type="h4" style={{ fontWeight: "700" }}>Statutory Compliance Check</ThemedText>
                    
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 }}>
                      <ThemedText type="small" style={{ fontWeight: "600" }}>Labour License:</ThemedText>
                      <ThemedText type="small" style={{ fontWeight: "700", color: selectedSiteForDetails?.labourLicenseNumber ? theme.success : theme.error }}>
                        {selectedSiteForDetails?.labourLicenseNumber || "MISSING / NOT REGISTERED"}
                      </ThemedText>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 }}>
                      <ThemedText type="small" style={{ fontWeight: "600" }}>PF / ESIC Status:</ThemedText>
                      <ThemedText type="small" style={{ fontWeight: "700", color: selectedSiteForDetails?.pfEsicStatus === "applicable" ? theme.info : theme.textSecondary }}>
                        {selectedSiteForDetails?.pfEsicStatus === "applicable" ? "Applicable" : "Not Applicable"}
                      </ThemedText>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 }}>
                      <ThemedText type="small" style={{ fontWeight: "600" }}>WC Safety Policy:</ThemedText>
                      <ThemedText type="small" style={{ fontWeight: "700", color: selectedSiteForDetails?.wcPolicyNumber ? theme.success : theme.error }}>
                        {selectedSiteForDetails?.wcPolicyNumber || "MISSING Safety WC Policy"}
                      </ThemedText>
                    </View>
                  </View>

                  {/* Delay log form */}
                  <View style={{ backgroundColor: theme.backgroundDefault, borderRadius: BorderRadius.sm, padding: Spacing.md, borderWidth: 1, borderColor: theme.border, gap: Spacing.sm }}>
                    <ThemedText type="h4" style={{ fontWeight: "700" }}>Log Delay & EOT Event</ThemedText>
                    
                    <ThemedText type="small" style={styles.label}>Reason for Delay</ThemedText>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {(["weather", "material_shortage", "labour_shortage", "design_change", "machinery_breakdown", "other"] as const).map((r) => {
                        const isSelected = delayReason === r;
                        const rLabels = {
                          weather: "Weather/Rain",
                          material_shortage: "Material Short",
                          labour_shortage: "Labour Short",
                          design_change: "Design Change",
                          machinery_breakdown: "Machinery Breakdown",
                          other: "Other"
                        };
                        return (
                          <Pressable
                            key={r}
                            onPress={() => setDelayReason(r)}
                            style={{
                              paddingHorizontal: 8,
                              paddingVertical: 5,
                              borderRadius: 12,
                              borderWidth: 1.5,
                              borderColor: isSelected ? theme.primary : theme.border,
                              backgroundColor: isSelected ? theme.primary : "transparent"
                            }}
                          >
                            <ThemedText style={{ color: isSelected ? "#FFFFFF" : theme.textSecondary, fontSize: 9, fontWeight: "700" }}>
                              {rLabels[r]}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>

                    <ThemedText type="small" style={styles.label}>Delay Duration (Days) *</ThemedText>
                    <TextInput
                      style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundRoot }]}
                      value={delayDays}
                      onChangeText={setDelayDays}
                      placeholder="e.g. 5"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                    />

                    <ThemedText type="small" style={styles.label}>Description</ThemedText>
                    <TextInput
                      style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundRoot }]}
                      value={delayDesc}
                      onChangeText={setDelayDesc}
                      placeholder="e.g. Heavy monsoon rain flooded the basement pit"
                      placeholderTextColor={theme.textSecondary}
                    />

                    <Pressable
                      onPress={handleSubmitDelayLog}
                      style={{ backgroundColor: theme.primary, paddingVertical: 12, borderRadius: 8, alignItems: "center", marginTop: 5 }}
                    >
                      <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>Log Delay Event</ThemedText>
                    </Pressable>
                  </View>

                  {/* Delay registry list */}
                  <View>
                    <ThemedText type="h4" style={{ fontWeight: "700", marginBottom: 8 }}>Delay Incident Register</ThemedText>
                    {delayLogs.length === 0 ? (
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>No delay events registered.</ThemedText>
                    ) : (
                      delayLogs.map((log) => (
                        <View
                          key={log._id || log.id}
                          style={{
                            backgroundColor: theme.backgroundDefault,
                            borderRadius: 8,
                            padding: Spacing.md,
                            marginBottom: 8,
                            borderWidth: 1,
                            borderColor: theme.border
                          }}
                        >
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <ThemedText style={{ fontWeight: "700", textTransform: "capitalize", color: theme.error }}>
                              ⚠️ {log.reasonCode.replace("_", " ")}
                            </ThemedText>
                            <ThemedText style={{ fontWeight: "700" }}>{log.delayDays} Days Delay</ThemedText>
                          </View>
                          {log.description ? (
                            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>{log.description}</ThemedText>
                          ) : null}
                          <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10, marginTop: 2 }}>
                            Logged on: {new Date(log.date).toLocaleDateString()}
                          </ThemedText>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              )}

            </ScrollView>
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
