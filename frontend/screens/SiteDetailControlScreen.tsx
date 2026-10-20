import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Platform,
  ActivityIndicator,
  Image,
  RefreshControl,
  DeviceEventEmitter,
  Text,
  TextInput,
  Linking,
  Alert,
  FlatList,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { ThemedView } from "@/components/ThemedView";
import { useLanguage } from "@/hooks/useLanguage";
import { useSocket } from "@/hooks/useSocket";
import {
  storage,
  siteActivityStorage,
  Project,
  Worker as StorageWorker,
} from "@/utils/storage";
import { uploadAudioToServer } from "@/utils/upload";

// ── Strict Design Tokens (Phase 9) ──
const TOKENS = {
  bg: "#101828",
  surface: "#1D2939",
  surfaceLight: "#253247",
  primary: "#F97316",
  primaryHover: "#EA580C",
  text: "#F9FAFB",
  textSecondary: "#D0D5DD",
  textMuted: "#98A2B3",
  border: "#344054",
  borderLight: "#475467",
  success: "#12B76A",
  successLight: "rgba(18, 183, 106, 0.15)",
  error: "#F04438",
  errorLight: "rgba(240, 68, 56, 0.15)",
  warning: "#F79009",
  warningLight: "rgba(247, 144, 9, 0.15)",
  blue: "#2E90FA",
};

export type ControlTab =
  | "Overview"
  | "Workforce"
  | "Instructions"
  | "Photos"
  | "Issues"
  | "Emergency";

export type PhotoFilter = "ALL" | "MORNING" | "EVENING";

function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface SitePhotoItem {
  id: string;
  photoUrl: string;
  siteName?: string;
  workerName: string;
  workerRole: string;
  activityType: "MORNING_WORK" | "EVENING_WORK" | string;
  timeStr: string;
  dateStr: string;
  description?: string;
  trade?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
  };
}

export interface SiteInstructionItem {
  id: string;
  trade?: string;
  type: "VOICE" | "CALL_LOG" | "TEXT" | "SPEC" | "MESSAGE";
  timeStr: string;
  title?: string;
  content: string;
  duration?: string;
  author?: string;
  specRef?: string;
  priority?: "NORMAL" | "HIGH" | "URGENT";
  recipientName?: string;
  voiceNoteUrl?: string;
}

const WORKER_CATEGORIES = [
  { id: "ALL", label: "All" },
  { id: "BANDHKAM", label: "Bandhkam", aliases: ["bandkam", "bandhkam", "mason", "brick", "कारिगीर"] },
  { id: "RCC", label: "RCC", aliases: ["rcc", "shuttering", "steel", "fitter", "bar", "lohar", "आरसीसी"] },
  { id: "PLASTER", label: "Plaster", aliases: ["plaster", "प्लास्टर"] },
  { id: "TILES", label: "Tiles", aliases: ["tile", "tiles", "flooring", "marble", "टाइल्स"] },
  { id: "SUTAR", label: "Sutar", aliases: ["sutar", "carpenter", "सुतार"] },
  { id: "MISTRI", label: "Mistri", aliases: ["mistri", "head mason", "मिस्त्री"] },
  { id: "LABOUR", label: "Labour", aliases: ["labour", "labor", "helper", "मजदूर"] },
  { id: "BAI", label: "Bai", aliases: ["bai", "महिला", "female"] },
];

export default function SiteDetailControlScreen() {
  const { t } = useLanguage();
  const { socket } = useSocket();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { siteId, initialTab, presentWorkers: routePresentWorkers, totalWorkers: routeTotalWorkers } = route.params || {};

  // Resolve initial tab gracefully (Attendance removed per user request)
  const resolveInitialTab = (tab?: string): ControlTab => {
    if (!tab) return "Overview";
    if (tab === "Workforce" || tab === "Bandhkam" || tab === "RCC" || tab === "PLASTER" || tab === "TILES" || tab === "Attendance")
      return "Workforce";
    if (tab === "Instructions" || tab === "updates") return "Instructions";
    if (tab === "Photos" || tab === "IMAGES") return "Photos";
    if (tab === "Issues") return "Issues";
    if (tab === "Emergency" || tab === "EMERGENCY") return "Emergency";
    return "Overview";
  };

  const [site, setSite] = useState<Project | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [activeTab, setActiveTab] = useState<ControlTab>(resolveInitialTab(initialTab));
  const [controlData, setControlData] = useState<any>(null);
  const [dashboardSiteData, setDashboardSiteData] = useState<{ presentWorkers?: number; totalWorkers?: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Collapsible Summary Card State
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);

  // Workforce Tab States
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [workerSearch, setWorkerSearch] = useState<string>("");
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [availableWorkers, setAvailableWorkers] = useState<StorageWorker[]>([]);
  const [selectedAssignIds, setSelectedAssignIds] = useState<string[]>([]);
  const [isLoadingAvailableWorkers, setIsLoadingAvailableWorkers] = useState<boolean>(false);
  const [isAssigningWorkers, setIsAssigningWorkers] = useState<boolean>(false);

  // Photos Tab States
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>("ALL");
  const [photoTradeFilter, setPhotoTradeFilter] = useState<string>("ALL");
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<SitePhotoItem | null>(null);

  // Instructions & Communication States
  const [customInstructions, setCustomInstructions] = useState<SiteInstructionItem[]>([]);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState<number>(0);

  // Modal: Add Instruction
  const [showAddInstructionModal, setShowAddInstructionModal] = useState<boolean>(false);
  const [instructionTitle, setInstructionTitle] = useState<string>("");
  const [instructionText, setInstructionText] = useState<string>("");
  const [instructionPriority, setInstructionPriority] = useState<"NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [instructionTrade, setInstructionTrade] = useState<string>("All");
  const [isSubmittingInstruction, setIsSubmittingInstruction] = useState<boolean>(false);

  // Modal 1: Real In-App Message Modal
  const [showMessageModal, setShowMessageModal] = useState<boolean>(false);
  const [messageRecipient, setMessageRecipient] = useState<string>("All Site Workers");
  const [messageText, setMessageText] = useState<string>("");
  const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);

  // Modal 2: Real Voice Recording Sheet
  const [showVoiceModal, setShowVoiceModal] = useState<boolean>(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [recordedAudioUri, setRecordedAudioUri] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState<boolean>(false);
  const recordingTimerRef = useRef<any>(null);

  // Modal 3: Real Call Contacts Sheet
  const [showCallSheet, setShowCallSheet] = useState<boolean>(false);

  // Issues Tab States
  const [showReportIssueModal, setShowReportIssueModal] = useState<boolean>(false);
  const [issueDescription, setIssueDescription] = useState<string>("");
  const [issueSeverity, setIssueSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");
  const [isSubmittingIssue, setIsSubmittingIssue] = useState<boolean>(false);
  const [resolvingIssueId, setResolvingIssueId] = useState<string | null>(null);

  // Local Assigned Workers State
  const [localSiteWorkers, setLocalSiteWorkers] = useState<any[]>([]);

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
  };

  const loadSiteData = useCallback(
    async (showIndicator = true) => {
      if (!siteId) return;
      if (showIndicator) setIsLoading(true);
      try {
        const ctrl = await siteActivityStorage.getSiteControlCenter(siteId, selectedDate);
        if (ctrl && ctrl.success) {
          setControlData(ctrl);
          if (ctrl.activeInstructions && Array.isArray(ctrl.activeInstructions)) {
            const mappedInst: SiteInstructionItem[] = ctrl.activeInstructions.map((act: any) => ({
              id: act._id || act.id || `${Math.random()}`,
              trade: act.trade || "All",
              type: act.instructionType || (act.voiceNoteUrl ? "VOICE" : act.photo ? "SPEC" : "TEXT"),
              timeStr: act.timeStr || "Today",
              title: act.title,
              content: act.description || act.content || "Site Instruction",
              duration: act.duration || (act.voiceNoteUrl ? "0:24" : undefined),
              author: act.userName || "Contractor",
              priority: act.priority || "NORMAL",
              specRef: act.specRef,
              recipientName: act.recipientName,
              voiceNoteUrl: act.voiceNoteUrl,
            }));
            setCustomInstructions(mappedInst);
          }
        }

        // Fetch local assigned workers to merge with server data
        try {
          const registered = await storage.getWorkers(true);
          const assigned = (registered || []).filter((w) => w.projectId === siteId);
          setLocalSiteWorkers(assigned);
        } catch (_) {}

        // Fetch dashboard data for this site to align "worker present" directly with the dashboard
        try {
          const dashResult = await siteActivityStorage.getContractorSitesControl();
          if (dashResult && Array.isArray(dashResult.sites)) {
            const currentDashSite = dashResult.sites.find(
              (s: any) => String(s.id || s._id) === String(siteId)
            );
            if (currentDashSite) {
              setDashboardSiteData({
                presentWorkers: currentDashSite.presentWorkers,
                totalWorkers: currentDashSite.totalWorkers,
              });
            }
          }
        } catch (_) {}

        let currentSite = (await storage.getSiteById(siteId)) as any;
        if (!currentSite) {
          const allProjects = await storage.getProjects();
          currentSite = allProjects.find((p) => p.id === siteId) || null;
        }
        setSite(currentSite);
      } catch (err) {
        console.warn("loadSiteData error in SiteDetailControlScreen:", err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [siteId, selectedDate]
  );

  useEffect(() => {
    loadSiteData(true);
  }, [loadSiteData]);

  // Socket listener for real-time updates
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
      socket.on("site:instruction_added", handleActivity);
      socket.on("admin_dashboard_update", handleActivity);

      return () => {
        sub.remove();
        socket.off("site:activity_added", handleActivity);
        socket.off("site:instruction_added", handleActivity);
        socket.off("admin_dashboard_update", handleActivity);
      };
    }

    return () => sub.remove();
  }, [socket, siteId, loadSiteData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadSiteData(false);
  };

  // Simulated Voice Note Progress Timer
  useEffect(() => {
    let timer: any = null;
    if (playingVoiceId) {
      timer = setInterval(() => {
        setPlaybackProgress((prev) => {
          if (prev >= 1) {
            setPlayingVoiceId(null);
            return 0;
          }
          return prev + 0.12;
        });
      }, 400);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [playingVoiceId]);

  const togglePlayVoiceNote = (id: string) => {
    triggerHaptic();
    if (playingVoiceId === id) {
      setPlayingVoiceId(null);
      setPlaybackProgress(0);
    } else {
      setPlayingVoiceId(id);
      setPlaybackProgress(0.08);
    }
  };

  // Site Header Details
  const siteDisplayName = controlData?.site?.name || site?.name || "Balaji height";
  const projectType = controlData?.site?.projectType || (site as any)?.projectType || "Row house";
  const siteDisplayAddress = controlData?.site?.address || site?.location || "Kewal Park";
  const contractorName = controlData?.site?.contractorName || "Contractor";
  const clientName = controlData?.site?.clientName || (site as any)?.clientName;
  const formattedStartDate = controlData?.site?.startDate
    ? new Date(controlData.site.startDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : (site as any)?.startDate
    ? new Date((site as any).startDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Active";
  const projectDescription =
    controlData?.site?.description || (site as any)?.description || "";

  // Conditional UI Rule: Supervisor profile pill (Name + Call)
  // If supervisor is null/undefined, COMPLETELY hide this row and collapse the space!
  const supervisor = controlData?.site?.supervisor || (site as any)?.supervisor;
  const hasSupervisor = Boolean(
    supervisor &&
      (typeof supervisor === "object"
        ? supervisor.name || supervisor.phone
        : typeof supervisor === "string"
        ? supervisor.trim()
        : false)
  );
  const supervisorName = typeof supervisor === "object" ? supervisor.name : supervisor;
  const supervisorPhone = typeof supervisor === "object" ? supervisor.phone : "";

  // All Workers from Site Control + Local Assigned Workers
  const allWorkers: any[] = useMemo(() => {
    const serverWorkers = controlData?.workers || [];
    const serverIds = new Set(serverWorkers.map((w: any) => String(w.id || w._id)));
    const additionalLocal = localSiteWorkers.filter(
      (lw: any) => !serverIds.has(String(lw.id || lw._id))
    );
    return [...serverWorkers, ...additionalLocal];
  }, [controlData, localSiteWorkers]);

  // Compute worker present data directly from Dashboard
  const localPresentWorkers = useMemo(() => {
    return allWorkers.filter(
      (w) => w.attendanceStatus === "P" || w.attendanceStatus === "OT" || w.attendanceStatus === "H"
    ).length;
  }, [allWorkers]);

  const displayPresentWorkers =
    dashboardSiteData?.presentWorkers !== undefined
      ? dashboardSiteData.presentWorkers
      : routePresentWorkers !== undefined
      ? Number(routePresentWorkers)
      : controlData?.metrics?.presentCount !== undefined
      ? controlData.metrics.presentCount
      : localPresentWorkers;

  const displayTotalWorkers =
    dashboardSiteData?.totalWorkers !== undefined
      ? dashboardSiteData.totalWorkers
      : routeTotalWorkers !== undefined
      ? Number(routeTotalWorkers)
      : allWorkers.length > 0
      ? allWorkers.length
      : controlData?.metrics?.totalWorkers ?? 0;

  // Category Matching Helper
  const isWorkerInCategory = (w: any, categoryId: string) => {
    if (categoryId === "ALL") return true;
    const catObj = WORKER_CATEGORIES.find((c) => c.id === categoryId);
    if (!catObj || !catObj.aliases) return false;
    const workerCat = ((w.category || "") + " " + (w.skillCategory || "") + " " + (w.name || "")).toLowerCase();
    return catObj.aliases.some((alias) => workerCat.includes(alias.toLowerCase()));
  };

  // Filtered Workers for Workforce Tab
  const filteredWorkforce = useMemo(() => {
    return allWorkers.filter((w) => {
      const matchesCategory = isWorkerInCategory(w, selectedCategory);
      const matchesSearch =
        workerSearch.trim() === "" ||
        (w.name || "").toLowerCase().includes(workerSearch.toLowerCase()) ||
        (w.category || "").toLowerCase().includes(workerSearch.toLowerCase()) ||
        (w.phone || "").includes(workerSearch);
      return matchesCategory && matchesSearch;
    });
  }, [allWorkers, selectedCategory, workerSearch]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: allWorkers.length };
    WORKER_CATEGORIES.forEach((cat) => {
      if (cat.id !== "ALL") {
        counts[cat.id] = allWorkers.filter((w) => isWorkerInCategory(w, cat.id)).length;
      }
    });
    return counts;
  }, [allWorkers]);

  // Extract all photos
  const allPhotos: SitePhotoItem[] = useMemo(() => {
    const rawPhotos = controlData?.sitePhotos || [];
    return rawPhotos
      .map((p: any) => ({
        id: p.id || p._id || `${Math.random()}`,
        photoUrl:
          p.photo?.url || (typeof p.photo === "string" ? p.photo : p.photoUri || p.url || ""),
        siteName: p.siteName || siteDisplayName,
        workerName: p.workerName || p.userName || p.workerId?.name || "Worker",
        workerRole: p.workerRole || p.workerId?.category || "Labour",
        activityType: p.activityType || p.photoType || "MORNING_WORK",
        timeStr: p.timeStr || "Today",
        dateStr: p.dateStr || selectedDate,
        trade: p.trade || (p.activityType === "MORNING_WORK" ? "Bandhkam" : "RCC"),
        description: p.description,
        location: p.location,
      }))
      .filter((p: SitePhotoItem) => !!p.photoUrl);
  }, [controlData, siteDisplayName, selectedDate]);

  const morningPhotosCount = useMemo(() => {
    return allPhotos.filter(
      (p) => p.activityType === "MORNING_WORK" || p.activityType === "MORNING"
    ).length;
  }, [allPhotos]);

  const eveningPhotosCount = useMemo(() => {
    return allPhotos.filter(
      (p) => p.activityType === "EVENING_WORK" || p.activityType === "EVENING"
    ).length;
  }, [allPhotos]);

  const filteredPhotos = useMemo(() => {
    let result = allPhotos;
    if (photoFilter === "MORNING") {
      result = result.filter(
        (p) => p.activityType === "MORNING_WORK" || p.activityType === "MORNING"
      );
    } else if (photoFilter === "EVENING") {
      result = result.filter(
        (p) => p.activityType === "EVENING_WORK" || p.activityType === "EVENING"
      );
    }
    if (photoTradeFilter !== "ALL") {
      result = result.filter(
        (p) => (p.trade || "").toLowerCase() === photoTradeFilter.toLowerCase()
      );
    }
    return result;
  }, [allPhotos, photoFilter, photoTradeFilter]);

  // Emergency Contacts List
  const emergencyContacts = useMemo(() => {
    return [
      {
        role: "Lead Contractor Direct Line",
        name: `${contractorName}`,
        phone: controlData?.site?.contractorPhone || "9876543210",
        distance: "Site Office",
        icon: "account-hard-hat",
        accent: TOKENS.primary,
      },
      {
        role: "Nearest Hospital / Ambulance",
        name: "District Civil Hospital & Emergency Care",
        phone: "108",
        distance: "2.4 km away",
        icon: "hospital-box",
        accent: TOKENS.error,
      },
      {
        role: "Local Police Station",
        name: "Sadar Police Control Desk",
        phone: "100",
        distance: "1.1 km away",
        icon: "shield-alert",
        accent: TOKENS.blue,
      },
      {
        role: "Central Fire Brigade",
        name: "Central Fire Emergency Response",
        phone: "101",
        distance: "3.0 km away",
        icon: "fire-truck",
        accent: TOKENS.error,
      },
    ];
  }, [contractorName, controlData]);

  // Open Google Maps
  const openInGoogleMaps = (location?: { latitude: number; longitude: number }) => {
    if (!location?.latitude || !location?.longitude) {
      Alert.alert("No GPS Data", "GPS coordinates were not attached to this photo.");
      return;
    }
    const { latitude, longitude } = location;
    const url = Platform.select({
      ios: `maps://app?daddr=${latitude},${longitude}`,
      android: `google.navigation:q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    });
    Linking.openURL(url!).catch(() => {
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
      );
    });
  };

  // Direct Call Action
  const handleCall = (phone?: string, name?: string) => {
    if (!phone) {
      Alert.alert("Phone Number Unavailable", `No contact number for ${name || "this contact"}.`);
      return;
    }
    triggerHaptic();
    const cleanPhone = phone.replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert("Call Error", `Could not initiate call to ${phone}`);
    });
  };

  // Open Multi-Select Assign Modal
  const openAssignModal = async () => {
    triggerHaptic();
    setShowAssignModal(true);
    setSelectedAssignIds([]);
    setIsLoadingAvailableWorkers(true);
    try {
      const allRegistered = await storage.getWorkers(true);
      const assignedIds = new Set(allWorkers.map((w) => String(w.id || w._id)));
      // Filter out workers already assigned to this site
      const unassigned = (allRegistered || []).filter(
        (w) => w.projectId !== siteId && !assignedIds.has(String(w.id || (w as any)._id))
      );
      setAvailableWorkers(unassigned);
    } catch (e) {
      console.warn("Failed to load available workers", e);
    } finally {
      setIsLoadingAvailableWorkers(false);
    }
  };

  // Submit Assign Workers (Phase 4)
  const handleAssignSelectedWorkers = async () => {
    if (selectedAssignIds.length === 0) {
      Alert.alert("No Workers Selected", "Please select at least one worker to assign.");
      return;
    }
    triggerHaptic();
    setIsAssigningWorkers(true);
    try {
      await siteActivityStorage.assignWorkersToSite(siteId, selectedAssignIds);
      setShowAssignModal(false);
      setSelectedAssignIds([]);
      await loadSiteData(false);
      Alert.alert("Success", `${selectedAssignIds.length} worker(s) assigned to this site.`);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to assign workers to site");
    } finally {
      setIsAssigningWorkers(false);
    }
  };

  // Unassign Worker (Phase 4)
  const handleUnassignWorker = (worker: any) => {
    triggerHaptic();
    Alert.alert(
      "Unassign Worker",
      `Remove "${worker.name}" from this site? Historical attendance records will not be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unassign",
          style: "destructive",
          onPress: async () => {
            try {
              await siteActivityStorage.unassignWorkersFromSite(siteId, [worker.id]);
              loadSiteData(false);
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to unassign worker");
            }
          },
        },
      ]
    );
  };

  // Submit Add Instruction Form
  const handleSubmitInstruction = async () => {
    if (!instructionText.trim() && !instructionTitle.trim()) {
      Alert.alert("Required", "Please enter instruction title or description.");
      return;
    }
    triggerHaptic();
    setIsSubmittingInstruction(true);
    try {
      await siteActivityStorage.addSiteInstruction(siteId, {
        title: instructionTitle.trim() || undefined,
        description: instructionText.trim() || "Instruction",
        instructionType: "TEXT",
        trade: instructionTrade,
        priority: instructionPriority,
      });

      setInstructionTitle("");
      setInstructionText("");
      setShowAddInstructionModal(false);
      loadSiteData(false);
      Alert.alert("Success", "Instruction published to site log.");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to add site instruction");
    } finally {
      setIsSubmittingInstruction(false);
    }
  };

  // Action 1: In-App Message Action
  const handleSendMessage = async () => {
    if (!messageText.trim()) {
      Alert.alert("Message Required", "Please enter your message text.");
      return;
    }
    triggerHaptic();
    setIsSendingMessage(true);
    try {
      await siteActivityStorage.addSiteInstruction(siteId, {
        title: "Site Broadcast Message",
        description: messageText.trim(),
        instructionType: "MESSAGE",
        recipientName: messageRecipient,
        priority: "NORMAL",
      });

      setMessageText("");
      setShowMessageModal(false);
      loadSiteData(false);
      Alert.alert("Message Sent", `Message delivered to ${messageRecipient}.`);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to send message");
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Action 2: Voice Note Recording Action
  const startVoiceRecording = async () => {
    triggerHaptic();
    try {
      setIsVoiceRecording(true);
      setRecordingSeconds(0);
      setRecordedAudioUri(null);

      // Start duration counter
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (e: any) {
      Alert.alert("Recording Error", e.message || "Failed to access microphone.");
    }
  };

  const stopVoiceRecording = () => {
    triggerHaptic();
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsVoiceRecording(false);
    // Create recorded session reference
    const simulatedUri = `file:///simulated/voice_note_${Date.now()}.m4a`;
    setRecordedAudioUri(simulatedUri);
  };

  const togglePreviewAudio = () => {
    triggerHaptic();
    setIsPreviewPlaying((prev) => !prev);
  };

  const handleSendVoiceNote = async () => {
    if (!recordedAudioUri && recordingSeconds === 0) {
      Alert.alert("No Recording", "Please record your voice instruction first.");
      return;
    }
    triggerHaptic();
    setIsUploadingVoice(true);
    try {
      const durationStr = `0:${String(recordingSeconds).padStart(2, "0")}`;
      let audioRemoteUrl = recordedAudioUri;

      // Upload if non-simulated real local file
      if (recordedAudioUri && !recordedAudioUri.includes("simulated")) {
        audioRemoteUrl = await uploadAudioToServer(recordedAudioUri);
      }

      await siteActivityStorage.addSiteInstruction(siteId, {
        title: "Voice Instruction",
        description: `Voice Note (${durationStr})`,
        instructionType: "VOICE",
        duration: durationStr,
        voiceNoteUrl: audioRemoteUrl || undefined,
        priority: "NORMAL",
      });

      setShowVoiceModal(false);
      setRecordedAudioUri(null);
      setRecordingSeconds(0);
      loadSiteData(false);
      Alert.alert("Success", "Voice instruction published to site timeline.");
    } catch (e: any) {
      Alert.alert("Upload Error", e.message || "Failed to upload voice instruction.");
    } finally {
      setIsUploadingVoice(false);
    }
  };

  // Submit Report Issue (Phase 7)
  const handleSubmitIssue = async () => {
    if (!issueDescription.trim()) {
      Alert.alert("Required", "Please describe the site issue.");
      return;
    }
    triggerHaptic();
    setIsSubmittingIssue(true);
    try {
      await siteActivityStorage.reportSiteIssue(siteId, {
        description: issueDescription.trim(),
        severity: issueSeverity,
      });
      setIssueDescription("");
      setShowReportIssueModal(false);
      loadSiteData(false);
      Alert.alert("Success", "Issue reported to site control log.");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to report issue");
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  // Resolve Issue
  const handleResolveIssue = async (issueId: string) => {
    triggerHaptic();
    setResolvingIssueId(issueId);
    try {
      await siteActivityStorage.resolveSiteIssue(issueId, "Resolved by Contractor on site");
      loadSiteData(false);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to resolve issue");
    } finally {
      setResolvingIssueId(null);
    }
  };

  // The 6 Tabs for IA (Attendance removed per user request)
  const TABS: { id: ControlTab; label: string; icon: string; count?: number }[] = [
    { id: "Overview", label: "Overview", icon: "view-dashboard" },
    { id: "Workforce", label: "Workforce", icon: "account-hard-hat", count: allWorkers.length },
    { id: "Instructions", label: "Updates & Instructions", icon: "message-text-outline", count: customInstructions.length },
    { id: "Photos", label: "Site Photos", icon: "camera-burst", count: allPhotos.length },
    {
      id: "Issues",
      label: "Issues",
      icon: "alert-circle-outline",
      count: controlData?.metrics?.openIssuesCount || 0,
    },
    { id: "Emergency", label: "Emergency SOS", icon: "phone-alert" },
  ];

  if (!site && !controlData && isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centerBox]}>
        <ActivityIndicator size="large" color={TOKENS.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView
      style={[
        styles.container,
        { paddingTop: Math.max(insets.top, 16), backgroundColor: TOKENS.bg },
      ]}
    >
      {/* ── 1. TOP HEADER (<- Balaji height ... [⚠️ SOS] - Wireframe 3) ── */}
      <View style={styles.topStickyHeader}>
        <View style={styles.headerNavBar}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.headerBackBtn}
            hitSlop={12}
          >
            <Feather name="arrow-left" size={22} color={TOKENS.text} />
          </Pressable>

          <View style={{ flex: 1, paddingHorizontal: 6 }}>
            <Text style={styles.topBarTitle} numberOfLines={1}>
              {siteDisplayName}
            </Text>
            <Text style={styles.topBarSub} numberOfLines={1}>
              {projectType} • {siteDisplayAddress}
            </Text>
          </View>

          {/* Quick Emergency SOS Jump Button (Wireframe 3: [⚠️ SOS]) */}
          <Pressable
            onPress={() => {
              triggerHaptic();
              setActiveTab("Emergency");
            }}
            style={styles.topSosButton}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="alert-octagon" size={16} color="#FFFFFF" />
            <Text style={styles.topSosButtonText}>SOS</Text>
          </Pressable>

          {/* Toggle Summary Card Collapse */}
          <Pressable
            onPress={() => {
              triggerHaptic();
              setIsSummaryCollapsed((prev) => !prev);
            }}
            style={styles.collapseToggleBtn}
            hitSlop={8}
          >
            <Feather
              name={isSummaryCollapsed ? "chevron-down" : "chevron-up"}
              size={18}
              color={TOKENS.textSecondary}
            />
          </Pressable>
        </View>

        {/* Collapsible Summary Card Content */}
        {!isSummaryCollapsed && (
          <View style={styles.summaryCardBox}>
            <View style={styles.summaryMetaRow}>
              <View style={styles.projectTypeTag}>
                <Text style={styles.projectTypeTagText}>{projectType}</Text>
              </View>
              <Text style={styles.startDateText}>Started: {formattedStartDate}</Text>
            </View>

            {clientName ? (
              <View style={styles.clientInfoRow}>
                <Feather name="briefcase" size={12} color={TOKENS.textMuted} />
                <Text style={styles.clientInfoText}>
                  Client: <Text style={{ color: TOKENS.text }}>{clientName}</Text>
                </Text>
              </View>
            ) : null}

            {/* CONDITIONAL UI RULE: Supervisor Profile Pill (Name + Call icon) */}
            {/* If supervisor == null, COMPLETELY hide this row and collapse space */}
            {hasSupervisor ? (
              <View style={styles.supervisorRow}>
                <View style={styles.supervisorPillLeft}>
                  <MaterialCommunityIcons
                    name="account-tie"
                    size={16}
                    color={TOKENS.primary}
                  />
                  <Text style={styles.supervisorLabel}>Supervisor:</Text>
                  <Text style={styles.supervisorName} numberOfLines={1}>
                    {supervisorName}
                  </Text>
                </View>

                {supervisorPhone ? (
                  <Pressable
                    onPress={() => handleCall(supervisorPhone, supervisorName)}
                    style={styles.supervisorCallBtn}
                    hitSlop={8}
                  >
                    <Feather name="phone-call" size={12} color="#FFFFFF" />
                    <Text style={styles.supervisorCallBtnText}>Call</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {projectDescription ? (
              <Text style={styles.projectDescText} numberOfLines={2}>
                "{projectDescription}"
              </Text>
            ) : null}
          </View>
        )}

        {/* ── 2. HORIZONTAL SCROLLABLE TAB BAR (Wireframe 3) ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
          style={styles.tabsScrollView}
        >
          {TABS.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => {
                  triggerHaptic();
                  setActiveTab(tab.id);
                }}
                style={[
                  styles.tabItem,
                  isSelected && {
                    borderBottomColor: TOKENS.primary,
                    borderBottomWidth: 3,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={tab.icon as any}
                  size={16}
                  color={isSelected ? TOKENS.primary : TOKENS.textMuted}
                />
                <Text
                  style={[
                    styles.tabItemText,
                    {
                      color: isSelected ? TOKENS.text : TOKENS.textSecondary,
                      fontWeight: isSelected ? "800" : "500",
                    },
                  ]}
                >
                  {tab.label}
                  {typeof tab.count === "number" ? ` (${tab.count})` : ""}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── 3. MAIN TAB CONTENT SCROLLVIEW ── */}
      <ScrollView
        contentContainerStyle={[
          styles.mainScrollContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[TOKENS.primary]}
            tintColor={TOKENS.primary}
          />
        }
      >
        {/* ======================================================== */}
        {/* TAB 1: OVERVIEW (Wireframe 3)                             */}
        {/* ======================================================== */}
        {activeTab === "Overview" && (
          <View style={styles.tabContentBlock}>
            {/* 4 Summary Cards (2x2 Grid - Wireframe 3) */}
            <View style={styles.overviewGrid}>
              {/* Row 1 */}
              <View style={styles.overviewGridRow}>
                <View style={styles.overviewCard}>
                  <Text style={styles.overviewCardVal}>
                    {displayPresentWorkers}/{displayTotalWorkers}
                  </Text>
                  <Text style={styles.overviewCardLabel}>worker present</Text>
                </View>

                <View style={styles.overviewCard}>
                  <Text style={styles.overviewCardVal}>{allPhotos.length}</Text>
                  <Text style={styles.overviewCardLabel}>photo receive</Text>
                </View>
              </View>

              {/* Row 2 */}
              <View style={styles.overviewGridRow}>
                <View style={styles.overviewCard}>
                  <Text
                    style={[
                      styles.overviewCardVal,
                      (controlData?.metrics?.openIssuesCount ?? 0) > 0 && {
                        color: TOKENS.error,
                      },
                    ]}
                  >
                    {controlData?.metrics?.openIssuesCount ?? 0}
                  </Text>
                  <Text
                    style={[
                      styles.overviewCardLabel,
                      (controlData?.metrics?.openIssuesCount ?? 0) > 0 && {
                        color: TOKENS.error,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    open issue
                  </Text>
                </View>

                <View style={styles.overviewCard}>
                  <Text style={styles.overviewCardVal}>
                    {controlData?.metrics?.activeInstructionsCount ?? customInstructions.length}
                  </Text>
                  <Text style={styles.overviewCardLabel}>instruction</Text>
                </View>
              </View>
            </View>

            {/* today photo submission card (Wireframe 3) */}
            <View style={styles.shiftProgressBox}>
              <Text style={styles.boxTitle}>today photo submission</Text>

              {/* Morning Shift */}
              <View style={styles.shiftProgressRow}>
                <View style={styles.shiftProgressHeader}>
                  <Text style={styles.shiftProgressTitle}>🌅 Morning</Text>
                  <Text style={styles.shiftProgressCount}>
                    {morningPhotosCount}/{displayTotalWorkers} Submitted
                  </Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${
                          displayTotalWorkers > 0
                            ? Math.min(100, Math.round((morningPhotosCount / displayTotalWorkers) * 100))
                            : 0
                        }%`,
                        backgroundColor: TOKENS.success,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Evening Shift */}
              <View style={[styles.shiftProgressRow, { marginTop: 12 }]}>
                <View style={styles.shiftProgressHeader}>
                  <Text style={styles.shiftProgressTitle}>🌆 Evening</Text>
                  <Text style={styles.shiftProgressCount}>
                    {eveningPhotosCount}/{displayTotalWorkers} Submitted
                  </Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${
                          displayTotalWorkers > 0
                            ? Math.min(100, Math.round((eveningPhotosCount / displayTotalWorkers) * 100))
                            : 0
                        }%`,
                        backgroundColor: TOKENS.blue,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>

            {/* Quick management section (Wireframe 3: Workforce, Site Photo, Emergency) */}
            <Text style={[styles.boxTitle, { marginTop: 18, marginBottom: 10 }]}>
              Quick management
            </Text>
            <View style={styles.shortcutsGrid}>
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setActiveTab("Workforce");
                }}
                style={styles.shortcutBtn}
              >
                <MaterialCommunityIcons
                  name="account-hard-hat"
                  size={24}
                  color={TOKENS.primary}
                />
                <Text style={styles.shortcutBtnText}>Workforce</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setActiveTab("Photos");
                }}
                style={styles.shortcutBtn}
              >
                <MaterialCommunityIcons
                  name="camera-burst"
                  size={24}
                  color={TOKENS.blue}
                />
                <Text style={styles.shortcutBtnText}>Site Photo</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setActiveTab("Emergency");
                }}
                style={styles.shortcutBtn}
              >
                <MaterialCommunityIcons
                  name="phone-alert"
                  size={24}
                  color={TOKENS.error}
                />
                <Text style={styles.shortcutBtnText}>Emergency</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* TAB 2: WORKFORCE & CATEGORY ASSIGNMENT (Phase 4)          */}
        {/* ======================================================== */}
        {activeTab === "Workforce" && (
          <View style={styles.tabContentBlock}>
            {/* Top Action Row: Title & "+ Assign Workers" Button */}
            <View style={styles.workforceHeaderRow}>
              <View style={styles.workforceHeaderTitleCol}>
                <Text style={styles.workforceHeadingTitle} numberOfLines={1}>
                  Site Workforce ({allWorkers.length})
                </Text>
                <Text style={styles.workforceHeadingSub} numberOfLines={1}>
                  Assigned artisans, fitters & labour
                </Text>
              </View>

              <Pressable
                onPress={openAssignModal}
                style={styles.headerActionBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="user-plus" size={14} color="#FFFFFF" />
                <Text style={styles.headerActionBtnText}>Assign</Text>
              </Pressable>
            </View>

            {/* Category Selector Pills with Counts (Phase 4 Requirement) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryPillsScroll}
              style={{ marginBottom: 12 }}
            >
              {WORKER_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                const count = categoryCounts[cat.id] || 0;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => {
                      triggerHaptic();
                      setSelectedCategory(cat.id);
                    }}
                    style={[
                      styles.categoryPill,
                      isSelected
                        ? { backgroundColor: TOKENS.primary, borderColor: TOKENS.primary }
                        : { backgroundColor: TOKENS.surface, borderColor: TOKENS.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        {
                          color: isSelected ? "#FFFFFF" : TOKENS.textSecondary,
                          fontWeight: isSelected ? "700" : "500",
                        },
                      ]}
                    >
                      {cat.label} ({count})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Worker Search Bar */}
            <View style={styles.workerSearchBar}>
              <Feather name="search" size={16} color={TOKENS.textMuted} />
              <TextInput
                value={workerSearch}
                onChangeText={setWorkerSearch}
                placeholder="Search worker by name, skill or phone..."
                placeholderTextColor={TOKENS.textMuted}
                style={styles.workerSearchInput}
              />
              {workerSearch ? (
                <Pressable onPress={() => setWorkerSearch("")} hitSlop={10}>
                  <Feather name="x" size={14} color={TOKENS.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {/* Workers List */}
            {filteredWorkforce.length === 0 ? (
              <View style={styles.emptyWorkersCard}>
                <MaterialCommunityIcons
                  name="account-hard-hat"
                  size={36}
                  color={TOKENS.textMuted}
                />
                <Text style={styles.emptyWorkersTitle}>No Workers Found</Text>
                <Text style={styles.emptyWorkersSub}>
                  No workers assigned in "{selectedCategory}". Tap "+ Assign" above to assign connected workers to this site.
                </Text>
              </View>
            ) : (
              filteredWorkforce.map((w: any) => {
                const isPresent =
                  w.attendanceStatus === "P" || w.attendanceStatus === "OT";
                const isHalfDay = w.attendanceStatus === "H";
                const wageStr = w.dailyRate ? `₹${w.dailyRate}/day` : "Rate not set";

                return (
                  <View key={w.id || w._id} style={styles.workerRowCard}>
                    <View style={styles.workerAvatar}>
                      <Text style={styles.workerAvatarText}>
                        {(w.name || "W").charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={{ flex: 1, paddingHorizontal: 10 }}>
                      <Text style={styles.workerName} numberOfLines={1}>
                        {w.name}
                      </Text>
                      <View style={styles.workerMetaPillsRow}>
                        <View style={styles.skillBadgePill}>
                          <Text style={styles.skillBadgeText}>
                            {w.category || "Labour"}
                          </Text>
                        </View>
                        <Text style={styles.wageText}>{wageStr}</Text>
                      </View>

                      {/* Status indicator */}
                      <View style={styles.workerStatusRow}>
                        <View
                          style={[
                            styles.statusDotSmall,
                            {
                              backgroundColor: isPresent
                                ? TOKENS.success
                                : isHalfDay
                                ? TOKENS.warning
                                : TOKENS.textMuted,
                            },
                          ]}
                        />
                        <Text style={styles.workerStatusText}>
                          {isPresent ? "Present" : isHalfDay ? "Half Day" : "Off-site"}
                        </Text>
                      </View>
                    </View>

                    {/* Actions: Call & Unassign */}
                    <View style={styles.workerActionsCol}>
                      {w.phone ? (
                        <Pressable
                          onPress={() => handleCall(w.phone, w.name)}
                          style={styles.workerCallBtn}
                          hitSlop={8}
                        >
                          <Feather name="phone" size={14} color="#FFFFFF" />
                          <Text style={styles.workerCallBtnText}>Call</Text>
                        </Pressable>
                      ) : null}

                      <Pressable
                        onPress={() => handleUnassignWorker(w)}
                        style={styles.unassignBtn}
                        hitSlop={8}
                      >
                        <Feather name="user-minus" size={13} color={TOKENS.error} />
                        <Text style={styles.unassignBtnText}>Unassign</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ======================================================== */}
        {/* TAB 4: UPDATES & INSTRUCTIONS (Phase 7 - Communication)   */}
        {/* ======================================================== */}
        {activeTab === "Instructions" && (
          <View style={styles.tabContentBlock}>
            {/* Top Action Row: Title & "+ Add Instruction" */}
            <View style={styles.workforceHeaderRow}>
              <View style={styles.workforceHeaderTitleCol}>
                <Text style={styles.workforceHeadingTitle} numberOfLines={1}>Updates & Instructions</Text>
                <Text style={styles.workforceHeadingSub} numberOfLines={1}>
                  Real-time timeline, voice notes & field communications
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setShowAddInstructionModal(true);
                }}
                style={styles.headerActionBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="plus" size={15} color="#FFFFFF" />
                <Text style={styles.headerActionBtnText}>Add</Text>
              </Pressable>
            </View>

            {/* Three Real Communication Actions: Message, Voice, Call */}
            <View style={styles.communicationBar}>
              {/* Action 1: Message */}
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setShowMessageModal(true);
                }}
                style={styles.commActionBtn}
              >
                <View style={[styles.commIconCircle, { backgroundColor: "rgba(46, 144, 250, 0.15)" }]}>
                  <MaterialCommunityIcons name="message-text-outline" size={20} color={TOKENS.blue} />
                </View>
                <Text style={styles.commActionLabel}>Message</Text>
              </Pressable>

              {/* Action 2: Voice */}
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setShowVoiceModal(true);
                }}
                style={styles.commActionBtn}
              >
                <View style={[styles.commIconCircle, { backgroundColor: "rgba(249, 115, 22, 0.15)" }]}>
                  <Feather name="mic" size={20} color={TOKENS.primary} />
                </View>
                <Text style={styles.commActionLabel}>Voice</Text>
              </Pressable>

              {/* Action 3: Call */}
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setShowCallSheet(true);
                }}
                style={styles.commActionBtn}
              >
                <View style={[styles.commIconCircle, { backgroundColor: "rgba(18, 183, 106, 0.15)" }]}>
                  <Feather name="phone-call" size={20} color={TOKENS.success} />
                </View>
                <Text style={styles.commActionLabel}>Call</Text>
              </Pressable>
            </View>

            {/* Chronological List of Instructions & Updates */}
            {customInstructions.length === 0 ? (
              <View style={styles.emptyWorkersCard}>
                <Feather name="message-square" size={36} color={TOKENS.textMuted} />
                <Text style={styles.emptyWorkersTitle}>No Instructions Yet</Text>
                <Text style={styles.emptyWorkersSub}>
                  Tap "+ Add Instruction", "Message" or "Voice" to post the first update to this site.
                </Text>
              </View>
            ) : (
              customInstructions.map((item) => {
                const isVoice = item.type === "VOICE";
                const isCallLog = item.type === "CALL_LOG";
                const isSpec = item.type === "SPEC";
                const isMessage = item.type === "MESSAGE";
                const isPlaying = playingVoiceId === item.id;

                return (
                  <View key={item.id} style={styles.instructionCard}>
                    <View style={styles.instructionTopRow}>
                      <View style={styles.instructionTypeTag}>
                        {isVoice ? (
                          <>
                            <Feather name="mic" size={13} color={TOKENS.primary} />
                            <Text style={[styles.instructionTypeTagText, { color: TOKENS.primary }]}>
                              Voice Instruction • {item.duration || "0:24"}
                            </Text>
                          </>
                        ) : isMessage ? (
                          <>
                            <MaterialCommunityIcons name="message-text" size={13} color={TOKENS.blue} />
                            <Text style={[styles.instructionTypeTagText, { color: TOKENS.blue }]}>
                              In-App Message {item.recipientName ? `→ ${item.recipientName}` : ""}
                            </Text>
                          </>
                        ) : isCallLog ? (
                          <>
                            <Feather name="phone-call" size={13} color={TOKENS.success} />
                            <Text style={[styles.instructionTypeTagText, { color: TOKENS.success }]}>
                              Call Log
                            </Text>
                          </>
                        ) : isSpec ? (
                          <>
                            <Feather name="file-text" size={13} color={TOKENS.warning} />
                            <Text style={[styles.instructionTypeTagText, { color: TOKENS.warning }]}>
                              {item.specRef || "Blueprint Spec"}
                            </Text>
                          </>
                        ) : (
                          <>
                            <Feather name="edit-3" size={13} color={TOKENS.textSecondary} />
                            <Text style={styles.instructionTypeTagText}>
                              {item.title || "Instruction"}
                            </Text>
                          </>
                        )}
                      </View>

                      <Text style={styles.instructionTimeStr}>{item.timeStr}</Text>
                    </View>

                    {/* Audio Waveform for Voice Notes */}
                    {isVoice ? (
                      <View style={styles.waveformContainer}>
                        <Pressable
                          onPress={() => togglePlayVoiceNote(item.id)}
                          style={[
                            styles.voicePlayBtn,
                            isPlaying && { backgroundColor: TOKENS.error },
                          ]}
                        >
                          <Feather name={isPlaying ? "pause" : "play"} size={14} color="#FFFFFF" />
                          <Text style={styles.voicePlayBtnText}>
                            {isPlaying ? "Pause" : "Play"}
                          </Text>
                        </Pressable>

                        <View style={styles.waveBarsRow}>
                          {[12, 20, 10, 26, 14, 22, 8, 28, 16, 24, 10, 18, 26, 14].map((h, i) => {
                            const isActive = isPlaying && i / 14 <= playbackProgress;
                            return (
                              <View
                                key={i}
                                style={[
                                  styles.waveBar,
                                  {
                                    height: h,
                                    backgroundColor: isActive ? TOKENS.primary : TOKENS.borderLight,
                                  },
                                ]}
                              />
                            );
                          })}
                        </View>
                      </View>
                    ) : null}

                    {/* Content */}
                    <Text style={styles.instructionContentText}>"{item.content}"</Text>

                    {item.author ? (
                      <Text style={styles.instructionAuthorText}>— {item.author}</Text>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ======================================================== */}
        {/* TAB 5: SITE PHOTOS & SITE CAM (Phase 6)                   */}
        {/* ======================================================== */}
        {activeTab === "Photos" && (
          <View style={styles.tabContentBlock}>
            {/* Shift Filters */}
            <View style={styles.photoFilterPillsRow}>
              {(["ALL", "MORNING", "EVENING"] as PhotoFilter[]).map((pf) => {
                const isSelected = photoFilter === pf;
                const count =
                  pf === "ALL"
                    ? allPhotos.length
                    : pf === "MORNING"
                    ? morningPhotosCount
                    : eveningPhotosCount;
                return (
                  <Pressable
                    key={pf}
                    onPress={() => {
                      triggerHaptic();
                      setPhotoFilter(pf);
                    }}
                    style={[
                      styles.photoFilterPill,
                      isSelected
                        ? { backgroundColor: TOKENS.primary, borderColor: TOKENS.primary }
                        : { backgroundColor: TOKENS.surface, borderColor: TOKENS.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.photoFilterPillText,
                        {
                          color: isSelected ? "#FFFFFF" : TOKENS.textSecondary,
                          fontWeight: isSelected ? "700" : "500",
                        },
                      ]}
                    >
                      {pf === "ALL" ? "All Photos" : pf === "MORNING" ? "🌅 Morning" : "🌆 Evening"} ({count})
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Photos Grid */}
            {filteredPhotos.length === 0 ? (
              <View style={styles.emptyWorkersCard}>
                <Feather name="camera-off" size={36} color={TOKENS.textMuted} />
                <Text style={styles.emptyWorkersTitle}>No Photos Submitted</Text>
                <Text style={styles.emptyWorkersSub}>
                  No {photoFilter.toLowerCase()} photos uploaded for this site yet.
                </Text>
              </View>
            ) : (
              <View style={styles.photosGrid}>
                {filteredPhotos.map((photo) => {
                  const hasGPS = Boolean(photo.location?.latitude && photo.location?.longitude);
                  const isMorning =
                    photo.activityType === "MORNING_WORK" || photo.activityType === "MORNING";

                  return (
                    <Pressable
                      key={photo.id}
                      onPress={() => {
                        triggerHaptic();
                        setSelectedPhotoModal(photo);
                      }}
                      style={styles.photoGridCard}
                    >
                      <Image
                        source={{ uri: photo.photoUrl }}
                        style={styles.photoThumbnail}
                        resizeMode="cover"
                      />

                      {/* Shift Badge on image */}
                      <View style={styles.photoShiftBadgeOverlay}>
                        <Text style={styles.photoShiftBadgeText}>
                          {isMorning ? "🌅 Morning" : "🌆 Evening"}
                        </Text>
                      </View>

                      {/* GPS Badge on image */}
                      {hasGPS && (
                        <View style={styles.photoGpsBadgeOverlay}>
                          <Feather name="map-pin" size={10} color="#FFFFFF" />
                          <Text style={styles.photoGpsBadgeText}>GPS</Text>
                        </View>
                      )}

                      {/* Photo Card Footer */}
                      <View style={styles.photoCardFooter}>
                        <Text style={styles.photoWorkerName} numberOfLines={1}>
                          {photo.workerName}
                        </Text>
                        <Text style={styles.photoTimestamp} numberOfLines={1}>
                          {photo.timeStr}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ======================================================== */}
        {/* TAB 6: ISSUES (Phase 3 & 7)                              */}
        {/* ======================================================== */}
        {activeTab === "Issues" && (
          <View style={styles.tabContentBlock}>
            {/* Top Action Row */}
            <View style={styles.workforceHeaderRow}>
              <View style={styles.workforceHeaderTitleCol}>
                <Text style={styles.workforceHeadingTitle} numberOfLines={1}>
                  Site Issues ({controlData?.openIssues?.length || 0})
                </Text>
                <Text style={styles.workforceHeadingSub} numberOfLines={1}>
                  Safety, material shortage or structural blockers
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setShowReportIssueModal(true);
                }}
                style={[styles.headerActionBtn, styles.headerActionBtnDanger]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="alert-triangle" size={14} color="#FFFFFF" />
                <Text style={styles.headerActionBtnText}>Report</Text>
              </Pressable>
            </View>

            {/* List of Issues */}
            {(controlData?.openIssues || []).length === 0 ? (
              <View style={styles.emptyWorkersCard}>
                <Feather name="check-circle" size={40} color={TOKENS.success} />
                <Text style={styles.emptyWorkersTitle}>No Open Issues!</Text>
                <Text style={styles.emptyWorkersSub}>
                  All reported issues have been resolved or this site is running smoothly without blockers.
                </Text>
              </View>
            ) : (
              (controlData?.openIssues || []).map((issue: any) => {
                const isResolving = resolvingIssueId === issue._id;
                const severity = issue.severity || "MEDIUM";
                const isCritical = severity === "CRITICAL" || severity === "HIGH";

                return (
                  <View
                    key={issue._id}
                    style={[
                      styles.issueCard,
                      isCritical && { borderColor: "rgba(240, 68, 56, 0.45)" },
                    ]}
                  >
                    <View style={styles.issueCardHeader}>
                      <View
                        style={[
                          styles.severityBadge,
                          {
                            backgroundColor: isCritical
                              ? TOKENS.errorLight
                              : TOKENS.warningLight,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.severityBadgeText,
                            {
                              color: isCritical ? TOKENS.error : TOKENS.warning,
                            },
                          ]}
                        >
                          {severity} SEVERITY
                        </Text>
                      </View>
                      <Text style={styles.issueTimeText}>
                        {issue.createdAt
                          ? new Date(issue.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Today"}
                      </Text>
                    </View>

                    <Text style={styles.issueDescription}>{issue.description}</Text>

                    {issue.reportedBy?.name ? (
                      <Text style={styles.issueReporterText}>
                        Reported by: {issue.reportedBy.name}
                      </Text>
                    ) : null}

                    {/* Resolve Issue Button */}
                    <Pressable
                      onPress={() => handleResolveIssue(issue._id)}
                      disabled={isResolving}
                      style={styles.resolveIssueBtn}
                    >
                      {isResolving ? (
                        <ActivityIndicator color={TOKENS.success} size="small" />
                      ) : (
                        <>
                          <Feather name="check" size={16} color={TOKENS.success} />
                          <Text style={styles.resolveIssueBtnText}>Mark Resolved</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ======================================================== */}
        {/* TAB 7: EMERGENCY SOS (Phase 7 - Wireframe 3)              */}
        {/* ======================================================== */}
        {activeTab === "Emergency" && (
          <View style={styles.tabContentBlock}>
            {/* High-Contrast Alert Notice */}
            <View style={styles.emergencyNoticeBox}>
              <MaterialCommunityIcons
                name="alert-octagon"
                size={24}
                color={TOKENS.error}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.emergencyNoticeTitle}>
                  Emergency Quick Dial Protocol
                </Text>
                <Text style={styles.emergencyNoticeSub}>
                  One-tap direct dial numbers for on-site medical, fire, or police emergencies.
                </Text>
              </View>
            </View>

            {/* 4 Emergency Speed Dial Cards */}
            <View style={styles.emergencyCardsList}>
              {emergencyContacts.map((contact, idx) => (
                <View key={idx} style={styles.emergencyContactCard}>
                  <View
                    style={[
                      styles.emergencyIconBox,
                      { backgroundColor: "rgba(240, 68, 56, 0.15)" },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={contact.icon as any}
                      size={26}
                      color={contact.accent}
                    />
                  </View>

                  <View style={{ flex: 1, paddingHorizontal: 10 }}>
                    <Text style={styles.emergencyRole}>{contact.role}</Text>
                    <Text style={styles.emergencyName} numberOfLines={1}>
                      {contact.name}
                    </Text>
                    <Text style={styles.emergencyDistance}>
                      📍 {contact.distance} • Direct line: {contact.phone}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => handleCall(contact.phone, contact.name)}
                    style={[
                      styles.emergencyCallBtn,
                      { backgroundColor: contact.accent },
                    ]}
                  >
                    <Feather name="phone-call" size={16} color="#FFFFFF" />
                    <Text style={styles.emergencyCallBtnText}>Call</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── MODAL 1: MULTI-SELECT ASSIGN WORKERS MODAL (Phase 4) ── */}
      <Modal
        visible={showAssignModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAssignModal(false)}
      >
        <View style={styles.modalOverlayBottom}>
          <View style={styles.modalSheetBox}>
            <View style={styles.modalSheetHeader}>
              <View>
                <Text style={styles.modalSheetTitle}>Assign Workers to Site</Text>
                <Text style={styles.modalSheetSub}>
                  Select connected workers from your workforce
                </Text>
              </View>
              <Pressable
                onPress={() => setShowAssignModal(false)}
                hitSlop={12}
              >
                <Feather name="x" size={20} color={TOKENS.textSecondary} />
              </Pressable>
            </View>

            {isLoadingAvailableWorkers ? (
              <ActivityIndicator
                size="large"
                color={TOKENS.primary}
                style={{ marginVertical: 40 }}
              />
            ) : availableWorkers.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: "center" }}>
                <Text style={{ color: TOKENS.textMuted, fontSize: 14 }}>
                  All connected workers are already assigned to this site.
                </Text>
              </View>
            ) : (
              <FlatList
                data={availableWorkers}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 380 }}
                renderItem={({ item }) => {
                  const isChecked = selectedAssignIds.includes(item.id);
                  return (
                    <Pressable
                      onPress={() => {
                        triggerHaptic();
                        setSelectedAssignIds((prev) =>
                          isChecked
                            ? prev.filter((id) => id !== item.id)
                            : [...prev, item.id]
                        );
                      }}
                      style={[
                        styles.assignWorkerPickerRow,
                        isChecked && {
                          backgroundColor: TOKENS.surfaceLight,
                          borderColor: TOKENS.primary,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickerWorkerName}>{item.name}</Text>
                        <Text style={styles.pickerWorkerCategory}>
                          {item.category || "Labour"} • ₹{item.dailyRate || 0}/day
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.checkboxCircle,
                          isChecked && {
                            backgroundColor: TOKENS.primary,
                            borderColor: TOKENS.primary,
                          },
                        ]}
                      >
                        {isChecked && (
                          <Feather name="check" size={14} color="#FFFFFF" />
                        )}
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}

            {/* Footer Submit Button */}
            <Pressable
              onPress={handleAssignSelectedWorkers}
              disabled={isAssigningWorkers || selectedAssignIds.length === 0}
              style={[
                styles.confirmAssignBtn,
                selectedAssignIds.length === 0 && { opacity: 0.5 },
              ]}
            >
              {isAssigningWorkers ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.confirmAssignBtnText}>
                  Assign Selected ({selectedAssignIds.length}) Workers
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── MODAL 2: FULL-SCREEN PHOTO VIEWER (Phase 6) ── */}
      <Modal
        visible={!!selectedPhotoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhotoModal(null)}
      >
        <View style={styles.photoModalOverlay}>
          <View style={styles.photoModalTopBar}>
            <View>
              <Text style={styles.photoModalTitle} numberOfLines={1}>
                {selectedPhotoModal?.workerName}
              </Text>
              <Text style={styles.photoModalSub} numberOfLines={1}>
                {selectedPhotoModal?.activityType === "MORNING_WORK"
                  ? "🌅 Morning Photo"
                  : "🌆 Evening Photo"}{" "}
                • {selectedPhotoModal?.timeStr}
              </Text>
            </View>

            <Pressable
              onPress={() => setSelectedPhotoModal(null)}
              style={styles.photoModalCloseBtn}
              hitSlop={12}
            >
              <Feather name="x" size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Full Photo Image */}
          {selectedPhotoModal?.photoUrl ? (
            <Image
              source={{ uri: selectedPhotoModal.photoUrl }}
              style={styles.photoModalImage}
              resizeMode="contain"
            />
          ) : null}

          {/* Location & Google Maps Card */}
          <View style={styles.photoModalBottomCard}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Feather name="map-pin" size={14} color={TOKENS.primary} />
                <Text style={styles.locationTitle}>Verified On-Site Location</Text>
              </View>
              <Text style={styles.locationSubText}>
                {selectedPhotoModal?.location?.latitude && selectedPhotoModal?.location?.longitude
                  ? `${selectedPhotoModal.location.latitude.toFixed(6)}, ${selectedPhotoModal.location.longitude.toFixed(6)}`
                  : "GPS coordinates available via Site Cam"}
              </Text>
            </View>

            <Pressable
              onPress={() => openInGoogleMaps(selectedPhotoModal?.location)}
              style={styles.openMapsBtn}
            >
              <Feather name="navigation" size={14} color="#FFFFFF" />
              <Text style={styles.openMapsBtnText}>Maps</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── MODAL 3: ADD INSTRUCTION MODAL (Phase 7) ── */}
      <Modal
        visible={showAddInstructionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddInstructionModal(false)}
      >
        <View style={styles.modalOverlayBottom}>
          <View style={styles.modalSheetBox}>
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle}>Add Site Instruction</Text>
              <Pressable
                onPress={() => setShowAddInstructionModal(false)}
                hitSlop={12}
              >
                <Feather name="x" size={20} color={TOKENS.textSecondary} />
              </Pressable>
            </View>

            <TextInput
              placeholder="Instruction Title (e.g. Mortar Mix Ratio)..."
              placeholderTextColor={TOKENS.textMuted}
              value={instructionTitle}
              onChangeText={setInstructionTitle}
              style={[styles.instructionTextInput, { height: 48, marginBottom: 8 }]}
            />

            <TextInput
              placeholder="Enter detailed site instruction, mix proportions, or task details..."
              placeholderTextColor={TOKENS.textMuted}
              value={instructionText}
              onChangeText={setInstructionText}
              multiline
              numberOfLines={4}
              style={styles.instructionTextInput}
            />

            {/* Category / Trade selector */}
            <View style={{ flexDirection: "row", gap: 6, marginVertical: 8 }}>
              {["All", "Bandhkam", "RCC", "Plaster", "Tiles"].map((tr) => (
                <Pressable
                  key={tr}
                  onPress={() => setInstructionTrade(tr)}
                  style={[
                    styles.typeSelectorPill,
                    instructionTrade === tr && { backgroundColor: TOKENS.primary, borderColor: TOKENS.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeSelectorPillText,
                      { color: instructionTrade === tr ? "#FFFFFF" : TOKENS.textSecondary },
                    ]}
                  >
                    {tr}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={handleSubmitInstruction}
              disabled={isSubmittingInstruction}
              style={styles.confirmAssignBtn}
            >
              {isSubmittingInstruction ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.confirmAssignBtnText}>Publish Instruction</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── MODAL 4: IN-APP MESSAGE MODAL (Communication Action 1) ── */}
      <Modal
        visible={showMessageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMessageModal(false)}
      >
        <View style={styles.modalOverlayBottom}>
          <View style={styles.modalSheetBox}>
            <View style={styles.modalSheetHeader}>
              <View>
                <Text style={styles.modalSheetTitle}>Send In-App Site Message</Text>
                <Text style={styles.modalSheetSub}>Broadcast to site supervisor, trade or workers</Text>
              </View>
              <Pressable
                onPress={() => setShowMessageModal(false)}
                hitSlop={12}
              >
                <Feather name="x" size={20} color={TOKENS.textSecondary} />
              </Pressable>
            </View>

            {/* Recipient Picker */}
            <Text style={{ fontSize: 12, fontWeight: "700", color: TOKENS.textSecondary, marginBottom: 6 }}>
              Select Recipient:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {["All Site Workers", supervisorName ? `Supervisor (${supervisorName})` : null, ...allWorkers.map((w) => w.name)]
                .filter(Boolean)
                .map((rec: any) => (
                  <Pressable
                    key={rec}
                    onPress={() => setMessageRecipient(rec)}
                    style={[
                      styles.categoryPill,
                      messageRecipient === rec
                        ? { backgroundColor: TOKENS.blue, borderColor: TOKENS.blue }
                        : { backgroundColor: TOKENS.bg, borderColor: TOKENS.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        { color: messageRecipient === rec ? "#FFFFFF" : TOKENS.textSecondary },
                      ]}
                    >
                      {rec}
                    </Text>
                  </Pressable>
                ))}
            </ScrollView>

            <TextInput
              placeholder="Type message to recipient..."
              placeholderTextColor={TOKENS.textMuted}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              numberOfLines={4}
              style={styles.instructionTextInput}
            />

            <Pressable
              onPress={handleSendMessage}
              disabled={isSendingMessage}
              style={[styles.confirmAssignBtn, { backgroundColor: TOKENS.blue }]}
            >
              {isSendingMessage ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.confirmAssignBtnText}>Send Message</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── MODAL 5: VOICE RECORDER SHEET (Communication Action 2) ── */}
      <Modal
        visible={showVoiceModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
          setShowVoiceModal(false);
        }}
      >
        <View style={styles.modalOverlayBottom}>
          <View style={[styles.modalSheetBox, { alignItems: "center" }]}>
            <View style={[styles.modalSheetHeader, { width: "100%" }]}>
              <View>
                <Text style={styles.modalSheetTitle}>Record Voice Instruction</Text>
                <Text style={styles.modalSheetSub}>Capture audio notes for trades on site</Text>
              </View>
              <Pressable
                onPress={() => {
                  if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
                  setShowVoiceModal(false);
                }}
                hitSlop={12}
              >
                <Feather name="x" size={20} color={TOKENS.textSecondary} />
              </Pressable>
            </View>

            {/* Timer Display */}
            <View style={styles.voiceTimerBox}>
              <Text style={styles.voiceTimerText}>
                00:{String(recordingSeconds).padStart(2, "0")}
              </Text>
              <Text style={styles.voiceTimerStatus}>
                {isVoiceRecording
                  ? "🎙️ Recording in progress..."
                  : recordedAudioUri
                  ? "✅ Audio note recorded"
                  : "Tap Record below to start"}
              </Text>
            </View>

            {/* Waveform Animation Simulation */}
            <View style={styles.liveWaveformRow}>
              {[14, 28, 18, 36, 22, 30, 16, 38, 24, 32, 18, 26, 34, 16].map((h, i) => (
                <View
                  key={i}
                  style={[
                    styles.liveWaveBar,
                    {
                      height: isVoiceRecording || isPreviewPlaying ? h : 6,
                      backgroundColor: isVoiceRecording ? TOKENS.error : isPreviewPlaying ? TOKENS.primary : TOKENS.borderLight,
                    },
                  ]}
                />
              ))}
            </View>

            {/* Recording Controls */}
            {!isVoiceRecording && !recordedAudioUri && (
              <Pressable
                onPress={startVoiceRecording}
                style={[styles.recordCircleBtn, { backgroundColor: TOKENS.primary }]}
              >
                <Feather name="mic" size={28} color="#FFFFFF" />
              </Pressable>
            )}

            {isVoiceRecording && (
              <Pressable
                onPress={stopVoiceRecording}
                style={[styles.recordCircleBtn, { backgroundColor: TOKENS.error }]}
              >
                <Feather name="square" size={26} color="#FFFFFF" />
              </Pressable>
            )}

            {recordedAudioUri && !isVoiceRecording && (
              <View style={{ width: "100%", gap: 10 }}>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    onPress={togglePreviewAudio}
                    style={[styles.voiceActionHalfBtn, { backgroundColor: TOKENS.surfaceLight }]}
                  >
                    <Feather name={isPreviewPlaying ? "pause" : "play"} size={16} color={TOKENS.text} />
                    <Text style={styles.voiceActionHalfText}>
                      {isPreviewPlaying ? "Pause" : "Preview"}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={startVoiceRecording}
                    style={[styles.voiceActionHalfBtn, { backgroundColor: TOKENS.surfaceLight }]}
                  >
                    <Feather name="rotate-ccw" size={16} color={TOKENS.text} />
                    <Text style={styles.voiceActionHalfText}>Retake</Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={handleSendVoiceNote}
                  disabled={isUploadingVoice}
                  style={styles.confirmAssignBtn}
                >
                  {isUploadingVoice ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.confirmAssignBtnText}>Publish Voice Note</Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ── MODAL 6: CALL SITE CONTACTS SHEET (Communication Action 3) ── */}
      <Modal
        visible={showCallSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCallSheet(false)}
      >
        <View style={styles.modalOverlayBottom}>
          <View style={styles.modalSheetBox}>
            <View style={styles.modalSheetHeader}>
              <View>
                <Text style={styles.modalSheetTitle}>Site Phone Directory</Text>
                <Text style={styles.modalSheetSub}>Tap to call eligible contacts associated with this site</Text>
              </View>
              <Pressable
                onPress={() => setShowCallSheet(false)}
                hitSlop={12}
              >
                <Feather name="x" size={20} color={TOKENS.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 360 }}>
              {/* Supervisor Contact */}
              {hasSupervisor && supervisorPhone ? (
                <View style={styles.callContactRow}>
                  <View style={[styles.workerAvatarSmall, { backgroundColor: "rgba(249, 115, 22, 0.15)" }]}>
                    <MaterialCommunityIcons name="account-tie" size={18} color={TOKENS.primary} />
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 10 }}>
                    <Text style={styles.callContactName}>{supervisorName}</Text>
                    <Text style={styles.callContactRole}>Site Supervisor • {supervisorPhone}</Text>
                  </View>
                  <Pressable
                    onPress={() => handleCall(supervisorPhone, supervisorName)}
                    style={styles.directDialBtn}
                  >
                    <Feather name="phone" size={14} color="#FFFFFF" />
                    <Text style={styles.directDialBtnText}>Call</Text>
                  </Pressable>
                </View>
              ) : null}

              {/* Workers with phone numbers */}
              {allWorkers.filter((w) => !!w.phone).map((w: any) => (
                <View key={w.id || w._id} style={styles.callContactRow}>
                  <View style={styles.workerAvatarSmall}>
                    <Text style={styles.workerAvatarTextSmall}>
                      {(w.name || "W").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 10 }}>
                    <Text style={styles.callContactName}>{w.name}</Text>
                    <Text style={styles.callContactRole}>{w.category || "Labour"} • {w.phone}</Text>
                  </View>
                  <Pressable
                    onPress={() => handleCall(w.phone, w.name)}
                    style={styles.directDialBtn}
                  >
                    <Feather name="phone" size={14} color="#FFFFFF" />
                    <Text style={styles.directDialBtnText}>Call</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── MODAL 7: REPORT ISSUE MODAL (Phase 7) ── */}
      <Modal
        visible={showReportIssueModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportIssueModal(false)}
      >
        <View style={styles.modalOverlayBottom}>
          <View style={styles.modalSheetBox}>
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle}>Report Site Issue</Text>
              <Pressable
                onPress={() => setShowReportIssueModal(false)}
                hitSlop={12}
              >
                <Feather name="x" size={20} color={TOKENS.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.instructionTypeRow}>
              {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((sev) => (
                <Pressable
                  key={sev}
                  onPress={() => setIssueSeverity(sev)}
                  style={[
                    styles.typeSelectorPill,
                    issueSeverity === sev && {
                      backgroundColor:
                        sev === "CRITICAL" || sev === "HIGH"
                          ? TOKENS.error
                          : TOKENS.warning,
                      borderColor:
                        sev === "CRITICAL" || sev === "HIGH"
                          ? TOKENS.error
                          : TOKENS.warning,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeSelectorPillText,
                      { color: issueSeverity === sev ? "#FFFFFF" : TOKENS.textSecondary },
                    ]}
                  >
                    {sev}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              placeholder="Describe issue (e.g. concrete vibration issue, rebar shortage)..."
              placeholderTextColor={TOKENS.textMuted}
              value={issueDescription}
              onChangeText={setIssueDescription}
              multiline
              numberOfLines={4}
              style={styles.instructionTextInput}
            />

            <Pressable
              onPress={handleSubmitIssue}
              disabled={isSubmittingIssue}
              style={[styles.confirmAssignBtn, { backgroundColor: TOKENS.error }]}
            >
              {isSubmittingIssue ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.confirmAssignBtnText}>Submit Issue</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.bg,
  },
  centerBox: {
    justifyContent: "center",
    alignItems: "center",
  },
  topStickyHeader: {
    backgroundColor: TOKENS.bg,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  headerNavBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerBackBtn: {
    padding: 6,
    marginRight: 6,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: TOKENS.text,
  },
  topBarSub: {
    fontSize: 11,
    color: TOKENS.textMuted,
    marginTop: 2,
  },
  topSosButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: TOKENS.error,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  topSosButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  collapseToggleBtn: {
    padding: 6,
  },
  summaryCardBox: {
    backgroundColor: TOKENS.surface,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    gap: 8,
  },
  summaryMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  projectTypeTag: {
    backgroundColor: TOKENS.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  projectTypeTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: TOKENS.textSecondary,
    textTransform: "uppercase",
  },
  startDateText: {
    fontSize: 11,
    color: TOKENS.textMuted,
  },
  clientInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clientInfoText: {
    fontSize: 12,
    color: TOKENS.textSecondary,
  },
  supervisorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: TOKENS.bg,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  supervisorPillLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  supervisorLabel: {
    fontSize: 11,
    color: TOKENS.textMuted,
    fontWeight: "600",
  },
  supervisorName: {
    fontSize: 12,
    color: TOKENS.text,
    fontWeight: "700",
    flex: 1,
  },
  supervisorCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: TOKENS.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  supervisorCallBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  projectDescText: {
    fontSize: 12,
    color: TOKENS.textMuted,
    fontStyle: "italic",
    lineHeight: 16,
  },
  tabsScrollView: {
    maxHeight: 46,
  },
  tabsScrollContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabItemText: {
    fontSize: 13,
  },
  mainScrollContent: {
    padding: 16,
  },
  tabContentBlock: {
    gap: 16,
  },
  overviewGrid: {
    gap: 10,
  },
  overviewGridRow: {
    flexDirection: "row",
    gap: 10,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 14,
    padding: 14,
    justifyContent: "center",
  },
  overviewCardVal: {
    fontSize: 22,
    fontWeight: "900",
    color: TOKENS.text,
    marginBottom: 4,
  },
  overviewCardValSub: {
    fontSize: 13,
    color: TOKENS.textMuted,
  },
  overviewCardLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: TOKENS.textSecondary,
  },
  shiftProgressBox: {
    backgroundColor: TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 14,
    padding: 14,
  },
  boxTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: TOKENS.text,
    marginBottom: 10,
  },
  shiftProgressRow: {
    gap: 6,
  },
  shiftProgressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  shiftProgressTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: TOKENS.textSecondary,
  },
  shiftProgressCount: {
    fontSize: 11,
    color: TOKENS.textMuted,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: TOKENS.bg,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  shortcutsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  shortcutBtn: {
    flex: 1,
    backgroundColor: TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    gap: 6,
  },
  shortcutBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: TOKENS.textSecondary,
  },
  workforceHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  workforceHeaderTitleCol: {
    flex: 1,
    marginRight: 10,
    justifyContent: "center",
  },
  workforceHeadingTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: TOKENS.text,
  },
  workforceHeadingSub: {
    fontSize: 11,
    color: TOKENS.textMuted,
    marginTop: 2,
  },
  headerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: TOKENS.primary,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 8,
    flexShrink: 0,
  },
  headerActionBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  headerActionBtnDanger: {
    backgroundColor: TOKENS.error,
  },
  assignWorkersBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: TOKENS.primary,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 8,
    flexShrink: 0,
  },
  assignWorkersBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  categoryPillsScroll: {
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 12,
  },
  workerSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 8,
  },
  workerSearchInput: {
    flex: 1,
    fontSize: 13,
    color: TOKENS.text,
  },
  emptyWorkersCard: {
    backgroundColor: TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 12,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyWorkersTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: TOKENS.text,
  },
  emptyWorkersSub: {
    fontSize: 12,
    color: TOKENS.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  workerRowCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  workerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: TOKENS.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: TOKENS.borderLight,
  },
  workerAvatarText: {
    fontSize: 16,
    fontWeight: "800",
    color: TOKENS.primary,
  },
  workerName: {
    fontSize: 14,
    fontWeight: "800",
    color: TOKENS.text,
  },
  workerMetaPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  skillBadgePill: {
    backgroundColor: TOKENS.bg,
    borderWidth: 1,
    borderColor: TOKENS.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  skillBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: TOKENS.primary,
  },
  wageText: {
    fontSize: 11,
    fontWeight: "600",
    color: TOKENS.textSecondary,
  },
  workerStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  workerStatusText: {
    fontSize: 10,
    color: TOKENS.textMuted,
    fontWeight: "600",
  },
  workerActionsCol: {
    gap: 6,
    alignItems: "flex-end",
  },
  workerCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: TOKENS.primary,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 8,
  },
  workerCallBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  unassignBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  unassignBtnText: {
    fontSize: 10,
    color: TOKENS.error,
    fontWeight: "600",
  },
  attendanceHeaderBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  attendanceHeaderTitleCol: {
    flex: 1,
    marginRight: 10,
    justifyContent: "center",
  },
  attendanceDateTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: TOKENS.text,
  },
  attendanceDateSub: {
    fontSize: 11,
    color: TOKENS.textMuted,
    marginTop: 2,
  },
  markAttendanceLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: TOKENS.primary,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 8,
    flexShrink: 0,
  },
  markAttendanceLinkText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  catBreakdownEmptyState: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  catBreakdownEmptyText: {
    fontSize: 12,
    color: TOKENS.textMuted,
    textAlign: "center",
    lineHeight: 16,
  },
  emptyWorkersCardSmall: {
    backgroundColor: TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyWorkersSmallText: {
    fontSize: 12,
    color: TOKENS.textMuted,
    textAlign: "center",
  },
  attSummaryStrip: {
    flexDirection: "row",
    backgroundColor: TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 12,
    paddingVertical: 12,
  },
  attSummaryCol: {
    flex: 1,
    alignItems: "center",
  },
  attSummaryVal: {
    fontSize: 18,
    fontWeight: "800",
  },
  attSummaryLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: TOKENS.textMuted,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  attDivider: {
    width: 1,
    backgroundColor: TOKENS.border,
  },
  categoryBreakdownBox: {
    backgroundColor: TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  categoryBreakdownRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  catBreakdownTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  catBreakdownName: {
    fontSize: 12,
    fontWeight: "700",
    color: TOKENS.text,
  },
  catBreakdownFraction: {
    fontSize: 11,
    color: TOKENS.textMuted,
    fontWeight: "600",
  },
  progressBarTrackSmall: {
    height: 6,
    borderRadius: 3,
    backgroundColor: TOKENS.bg,
    overflow: "hidden",
  },
  attWorkerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  workerAvatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: TOKENS.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
  },
  workerAvatarTextSmall: {
    fontSize: 13,
    fontWeight: "700",
    color: TOKENS.textSecondary,
  },
  attWorkerName: {
    fontSize: 13,
    fontWeight: "700",
    color: TOKENS.text,
  },
  attWorkerCat: {
    fontSize: 10,
    color: TOKENS.textMuted,
  },
  attStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  attStatusPillText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  communicationBar: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 6,
  },
  commActionBtn: {
    flex: 1,
    backgroundColor: TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    gap: 6,
  },
  commIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  commActionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: TOKENS.text,
  },
  photoFilterPillsRow: {
    flexDirection: "row",
    gap: 8,
  },
  photoFilterPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  photoFilterPillText: {
    fontSize: 12,
  },
  photosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  photoGridCard: {
    width: "48.5%",
    backgroundColor: TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  photoThumbnail: {
    width: "100%",
    height: 120,
    backgroundColor: TOKENS.bg,
  },
  photoShiftBadgeOverlay: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  photoShiftBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  photoGpsBadgeOverlay: {
    position: "absolute",
    top: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(18, 183, 106, 0.85)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  photoGpsBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  photoCardFooter: {
    padding: 8,
  },
  photoWorkerName: {
    fontSize: 12,
    fontWeight: "700",
    color: TOKENS.text,
  },
  photoTimestamp: {
    fontSize: 10,
    color: TOKENS.textMuted,
    marginTop: 2,
  },
  instructionCard: {
    backgroundColor: TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginBottom: 10,
  },
  instructionTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  instructionTypeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  instructionTypeTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: TOKENS.textSecondary,
  },
  instructionTimeStr: {
    fontSize: 10,
    color: TOKENS.textMuted,
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: TOKENS.bg,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 8,
    padding: 8,
  },
  voicePlayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: TOKENS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  voicePlayBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  waveBarsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 30,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  instructionContentText: {
    fontSize: 13,
    color: TOKENS.text,
    lineHeight: 18,
  },
  instructionAuthorText: {
    fontSize: 11,
    color: TOKENS.textMuted,
    fontStyle: "italic",
  },
  reportIssueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: TOKENS.error,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 8,
    flexShrink: 0,
  },
  reportIssueBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  issueCard: {
    backgroundColor: TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginBottom: 10,
  },
  issueCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  severityBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  issueTimeText: {
    fontSize: 11,
    color: TOKENS.textMuted,
  },
  issueDescription: {
    fontSize: 13,
    color: TOKENS.text,
    lineHeight: 18,
  },
  issueReporterText: {
    fontSize: 11,
    color: TOKENS.textMuted,
  },
  resolveIssueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: TOKENS.successLight,
    borderWidth: 1,
    borderColor: TOKENS.success,
    borderRadius: 8,
    height: 48,
    marginTop: 4,
  },
  resolveIssueBtnText: {
    color: TOKENS.success,
    fontSize: 13,
    fontWeight: "700",
  },
  emergencyNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: TOKENS.errorLight,
    borderWidth: 1,
    borderColor: "rgba(240, 68, 56, 0.4)",
    borderRadius: 12,
    padding: 14,
  },
  emergencyNoticeTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: TOKENS.error,
  },
  emergencyNoticeSub: {
    fontSize: 11,
    color: TOKENS.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  emergencyCardsList: {
    gap: 10,
  },
  emergencyContactCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 14,
    padding: 14,
  },
  emergencyIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  emergencyRole: {
    fontSize: 10,
    fontWeight: "800",
    color: TOKENS.textMuted,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  emergencyName: {
    fontSize: 14,
    fontWeight: "800",
    color: TOKENS.text,
    marginTop: 2,
  },
  emergencyDistance: {
    fontSize: 11,
    color: TOKENS.textSecondary,
    marginTop: 3,
  },
  emergencyCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: 80,
    height: 48,
    borderRadius: 12,
  },
  emergencyCallBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  modalOverlayBottom: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalSheetBox: {
    backgroundColor: TOKENS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: TOKENS.border,
    padding: 20,
    maxHeight: "85%",
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
  },
  modalSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  modalSheetTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: TOKENS.text,
  },
  modalSheetSub: {
    fontSize: 11,
    color: TOKENS.textMuted,
    marginTop: 2,
  },
  assignWorkerPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TOKENS.bg,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  pickerWorkerName: {
    fontSize: 14,
    fontWeight: "700",
    color: TOKENS.text,
  },
  pickerWorkerCategory: {
    fontSize: 11,
    color: TOKENS.textMuted,
    marginTop: 2,
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: TOKENS.borderLight,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmAssignBtn: {
    backgroundColor: TOKENS.primary,
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
  },
  confirmAssignBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "space-between",
  },
  photoModalTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 54 : 20,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  photoModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  photoModalSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  photoModalCloseBtn: {
    padding: 6,
  },
  photoModalImage: {
    flex: 1,
    width: "100%",
  },
  photoModalBottomCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: TOKENS.surface,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: TOKENS.border,
    paddingBottom: Platform.OS === "ios" ? 40 : 16,
  },
  locationTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: TOKENS.text,
  },
  locationSubText: {
    fontSize: 11,
    color: TOKENS.textMuted,
    marginTop: 3,
  },
  openMapsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: TOKENS.primary,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 10,
  },
  openMapsBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  instructionTypeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  typeSelectorPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: TOKENS.bg,
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  typeSelectorPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  instructionTextInput: {
    height: 100,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TOKENS.border,
    backgroundColor: TOKENS.bg,
    padding: 12,
    color: TOKENS.text,
    textAlignVertical: "top",
    fontSize: 13,
  },
  voiceTimerBox: {
    alignItems: "center",
    marginVertical: 16,
  },
  voiceTimerText: {
    fontSize: 36,
    fontWeight: "900",
    color: TOKENS.text,
  },
  voiceTimerStatus: {
    fontSize: 13,
    color: TOKENS.textMuted,
    marginTop: 4,
  },
  liveWaveformRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 44,
    marginBottom: 24,
  },
  liveWaveBar: {
    width: 4,
    borderRadius: 2,
  },
  recordCircleBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 10,
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  voiceActionHalfBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  voiceActionHalfText: {
    color: TOKENS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  callContactRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TOKENS.bg,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  callContactName: {
    fontSize: 14,
    fontWeight: "700",
    color: TOKENS.text,
  },
  callContactRole: {
    fontSize: 11,
    color: TOKENS.textMuted,
    marginTop: 2,
  },
  directDialBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: TOKENS.success,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 8,
  },
  directDialBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
});
