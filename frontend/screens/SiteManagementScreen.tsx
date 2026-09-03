import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius, Colors, Shadows } from "@/constants/theme";
import { storage, Project, authenticatedFetch, API_URL } from "@/utils/storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── DATA MODEL ───────────────────────────────────────────────────────────────
export interface DailyWorkUpdateItem {
  id?: string;
  _id?: string;
  siteId: string;
  createdBy?: { _id?: string; name: string; role: string };
  dateStr: string;
  status: "not_started" | "in_progress" | "completed";

  // Morning Data
  workType?: string;
  description?: string;
  startingPoint?: string;
  morningPhoto?: string;
  morningTimestamp?: string;
  morningLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };

  // Evening Data
  completionDescription?: string;
  endingPoint?: string;
  eveningPhoto?: string;
  eveningTimestamp?: string;
  eveningLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  progress?: string;
  progressPercent?: number;
  issues?: string;

  createdAt?: string;
  updatedAt?: string;
}

const WORK_TYPES = [
  "Brick Work",
  "Shuttering",
  "RCC",
  "Plaster",
  "Tiles",
  "Painting",
  "Electrical",
  "Plumbing",
  "Flooring",
  "Other",
];

export default function SiteManagementScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  // Role permissions
  const role = user?.role || "contractor";
  const canSubmitWork = role === "supervisor" || role === "contractor" || role === "builder" || role === "admin";

  // Main State
  const [sites, setSites] = useState<Project[]>([]);
  const [selectedSite, setSelectedSite] = useState<Project | null>(null);
  const [todayUpdate, setTodayUpdate] = useState<DailyWorkUpdateItem | null>(null);
  const [dailyHistory, setDailyHistory] = useState<DailyWorkUpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals & Views State
  const [startWorkModalVisible, setStartWorkModalVisible] = useState(false);
  const [completeWorkModalVisible, setCompleteWorkModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedDetailUpdate, setSelectedDetailUpdate] = useState<DailyWorkUpdateItem | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Morning Form State
  const [morningPhoto, setMorningPhoto] = useState<string>("");
  const [isUploadingMorningPhoto, setIsUploadingMorningPhoto] = useState(false);
  const [workType, setWorkType] = useState<string>("Brick Work");
  const [customWorkType, setCustomWorkType] = useState<string>("");
  const [workDescription, setWorkDescription] = useState<string>("");
  const [startingPoint, setStartingPoint] = useState<string>("");
  const [morningLocation, setMorningLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null);
  const [isSubmittingStart, setIsSubmittingStart] = useState(false);

  // Evening Form State
  const [eveningPhoto, setEveningPhoto] = useState<string>("");
  const [isUploadingEveningPhoto, setIsUploadingEveningPhoto] = useState(false);
  const [completionDescription, setCompletionDescription] = useState<string>("");
  const [endingPoint, setEndingPoint] = useState<string>("");
  const [progressOption, setProgressOption] = useState<string>("Completed");
  const [progressPercent, setProgressPercent] = useState<number>(100);
  const [progressText, setProgressText] = useState<string>("100%");
  const [issues, setIssues] = useState<string>("");
  const [eveningLocation, setEveningLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null);
  const [isSubmittingComplete, setIsSubmittingComplete] = useState(false);

  const [isCapturingLocation, setIsCapturingLocation] = useState(false);

  // ─── LOAD DATA ─────────────────────────────────────────────────────────────
  const loadSiteData = useCallback(async () => {
    try {
      setLoading(true);
      const allSites = await storage.getProjects();
      const activeList = allSites.filter((s: any) => s.status === "active" || !s.isArchived);
      setSites(activeList);

      let current = selectedSite;
      if (!current && activeList.length > 0) {
        current = activeList[0];
        setSelectedSite(current);
      }

      if (current) {
        await fetchSiteUpdates(current.id);
      }
    } catch (error) {
      console.warn("Failed to load site data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSite]);

  const fetchSiteUpdates = async (siteId: string) => {
    try {
      // 1. Fetch Today's Update
      const resToday = await authenticatedFetch(`${API_URL}/sites/${siteId}/daily-work/today`);
      if (resToday.ok) {
        const data = await resToday.json();
        setTodayUpdate(data || null);
      }

      // 2. Fetch Daily History Timeline
      const resHistory = await authenticatedFetch(`${API_URL}/sites/${siteId}/daily-work/history`);
      if (resHistory.ok) {
        const list = await resHistory.json();
        setDailyHistory(Array.isArray(list) ? list : []);
      }
    } catch (e) {
      console.warn("Failed to fetch daily updates:", e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSiteData();
    }, [])
  );

  const handleSelectSite = async (site: Project) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedSite(site);
    setLoading(true);
    await fetchSiteUpdates(site.id);
    setLoading(false);
  };

  // ─── PHOTO UPLOADER HELPER ──────────────────────────────────────────────────
  const uploadImageFile = async (localUri: string): Promise<string> => {
    try {
      const filename = localUri.split("/").pop() || "photo.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      const formData = new FormData();
      formData.append("image", {
        uri: Platform.OS === "android" ? localUri : localUri.replace("file://", ""),
        name: filename,
        type,
      } as any);

      const authData = await storage.getAuth();
      const token = authData?.token;
      const response = await fetch(`${API_URL}/upload/image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (response.ok && data.url) {
        return data.url;
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (error) {
      console.warn("Failed to upload image file to backend:", error);
      // Fallback: Return local URI so UI never freezes or blocks user
      return localUri;
    }
  };

  const handlePickPhoto = async (mode: "camera" | "gallery", target: "morning" | "evening") => {
    try {
      let result: ImagePicker.ImagePickerResult;

      if (mode === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            "Camera Permission Required",
            "Camera permission is required to capture work photos. You can also pick a photo from your gallery.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Choose from Gallery", onPress: () => handlePickPhoto("gallery", target) },
            ]
          );
          return;
        }

        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
        });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            "Gallery Permission Required",
            "Media library access is needed to pick photos.",
            [{ text: "OK" }]
          );
          return;
        }

        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        if (target === "morning") {
          setIsUploadingMorningPhoto(true);
          const url = await uploadImageFile(uri);
          setMorningPhoto(url);
          setIsUploadingMorningPhoto(false);
        } else {
          setIsUploadingEveningPhoto(true);
          const url = await uploadImageFile(uri);
          setEveningPhoto(url);
          setIsUploadingEveningPhoto(false);
        }
      }
    } catch (error) {
      console.warn("Photo picker error:", error);
      Alert.alert("Photo Capture Failed", "Unable to select photo. Please try again.", [
        { text: "Report a Problem", onPress: handleReportProblem },
        { text: "OK" },
      ]);
      if (target === "morning") setIsUploadingMorningPhoto(false);
      else setIsUploadingEveningPhoto(false);
    }
  };

  // ─── GPS LOCATION HELPER ────────────────────────────────────────────────────
  const handleCaptureLocation = async (target: "morning" | "evening") => {
    try {
      setIsCapturingLocation(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location Permission Denied",
          "Location permission is optional. You can continue submitting without location.",
          [{ text: "Continue Without Location" }]
        );
        setIsCapturingLocation(false);
        return;
      }

      let loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        address: `Lat: ${loc.coords.latitude.toFixed(4)}, Lon: ${loc.coords.longitude.toFixed(4)}`,
      };

      if (target === "morning") setMorningLocation(coords);
      else setEveningLocation(coords);

      setIsCapturingLocation(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.warn("Location error:", error);
      setIsCapturingLocation(false);
      Alert.alert("Location Capture Failed", "You can continue submitting without location.", [
        { text: "Continue Without Location" },
      ]);
    }
  };

  // ─── SUBMIT MORNING START WORK ──────────────────────────────────────────────
  const handleStartWorkSubmit = async () => {
    if (!morningPhoto) {
      Alert.alert("Morning Photo Required", "Please take or upload a morning photo before starting work.");
      return;
    }

    const selectedType = workType === "Other" ? customWorkType.trim() : workType;
    if (!selectedType) {
      Alert.alert("Work Type Required", "Please select or enter the work type.");
      return;
    }

    if (!workDescription.trim()) {
      Alert.alert("Description Required", "Please enter what work you are starting today.");
      return;
    }

    if (!startingPoint.trim()) {
      Alert.alert("Starting Point Required", "Please describe where the work is starting.");
      return;
    }

    if (!selectedSite) return;

    try {
      setIsSubmittingStart(true);
      const payload = {
        workType: selectedType,
        description: workDescription.trim(),
        startingPoint: startingPoint.trim(),
        morningPhoto,
        morningLocation,
      };

      const res = await authenticatedFetch(`${API_URL}/sites/${selectedSite.id}/daily-work/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start work");
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTodayUpdate(data);
      setStartWorkModalVisible(false);
      Alert.alert("Success", t.sites?.workStartedSuccess || "Work started successfully.");
      await fetchSiteUpdates(selectedSite.id);
    } catch (error: any) {
      console.warn("Start work submit error:", error);
      Alert.alert("Submission Failed", error.message || "Unable to save today's work start update.", [
        { text: "Report a Problem", onPress: handleReportProblem },
        { text: "Retry" },
      ]);
    } finally {
      setIsSubmittingStart(false);
    }
  };

  // ─── SUBMIT EVENING COMPLETE WORK ───────────────────────────────────────────
  const handleCompleteWorkSubmit = async () => {
    if (!eveningPhoto) {
      Alert.alert("Evening Photo Required", "Please take or upload an evening final work photo.");
      return;
    }

    if (!completionDescription.trim()) {
      Alert.alert("Completion Description Required", "Please describe what work was completed today.");
      return;
    }

    if (!endingPoint.trim()) {
      Alert.alert("Ending Point Required", "Please specify where the work ended today.");
      return;
    }

    if (!selectedSite) return;

    try {
      setIsSubmittingComplete(true);
      const payload = {
        completionDescription: completionDescription.trim(),
        endingPoint: endingPoint.trim(),
        eveningPhoto,
        eveningLocation,
        progress: progressText,
        progressPercent,
        issues: issues.trim() || undefined,
      };

      const res = await authenticatedFetch(`${API_URL}/sites/${selectedSite.id}/daily-work/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to complete work");
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTodayUpdate(data);
      setCompleteWorkModalVisible(false);
      Alert.alert("Success", t.sites?.workCompletedSuccess || "Work completed successfully.");
      await fetchSiteUpdates(selectedSite.id);
    } catch (error: any) {
      console.warn("Complete work submit error:", error);
      Alert.alert("Submission Failed", error.message || "Unable to save today's work completion update.", [
        { text: "Report a Problem", onPress: handleReportProblem },
        { text: "Retry" },
      ]);
    } finally {
      setIsSubmittingComplete(false);
    }
  };

  const handleReportProblem = () => {
    navigation.navigate("Support", {
      preselectCategory: "Site Management",
      preselectFeature: "Daily Work Update",
    });
  };

  // ─── COMPUTED STATUS BADGE ──────────────────────────────────────────────────
  const todayStatus = todayUpdate?.status || "not_started";
  const isMorningDone = !!todayUpdate?.morningPhoto;
  const isEveningDone = !!todayUpdate?.eveningPhoto;

  return (
    <ThemedView style={styles.container}>
      {/* ─── HEADER BAR ──────────────────────────────────────────────────── */}
      <LinearGradient
        colors={isDark ? ["#0F172A", "#1E293B"] : ["#FFF7ED", "#FFFFFF"]}
        style={styles.header}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={isDark ? "#FFFFFF" : "#0F172A"} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.headerTitle}>{t.sites?.siteManagement || "Site Management"}</ThemedText>
            <ThemedText style={styles.headerSubtitle}>Daily Work Photo & Progress Tracking</ThemedText>
          </View>
          {canSubmitWork && (
            <Pressable
              onPress={() => setHistoryModalVisible(true)}
              style={[styles.historyIconBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(249,115,22,0.1)" }]}
            >
              <Feather name="clock" size={18} color="#F97316" />
            </Pressable>
          )}
        </View>

        {/* ─── SITE SELECTOR HORIZONTAL BAR ───────────────────────────────── */}
        {sites.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.siteChipsScroll}>
            {sites.map((site) => {
              const isSelected = selectedSite?.id === site.id;
              return (
                <Pressable
                  key={site.id}
                  onPress={() => handleSelectSite(site)}
                  style={[
                    styles.siteChip,
                    {
                      backgroundColor: isSelected
                        ? "#F97316"
                        : isDark
                        ? "#334155"
                        : "#F1F5F9",
                    },
                  ]}
                >
                  <Feather
                    name="map-pin"
                    size={13}
                    color={isSelected ? "#FFFFFF" : isDark ? "#94A3B8" : "#64748B"}
                  />
                  <ThemedText
                    style={[
                      styles.siteChipText,
                      { color: isSelected ? "#FFFFFF" : isDark ? "#E2E8F0" : "#334155" },
                    ]}
                    numberOfLines={1}
                  >
                    {site.name}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </LinearGradient>

      {/* ─── MAIN CONTENT SCROLLVIEW ──────────────────────────────────────── */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F97316" />
            <ThemedText style={{ marginTop: 12, color: theme.textSecondary }}>
              Loading site details...
            </ThemedText>
          </View>
        ) : selectedSite ? (
          <>
            {/* ─── 1. SITE HEADER CARD ─────────────────────────────────────── */}
            <View style={[styles.card, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", borderColor: theme.border }]}>
              <View style={styles.siteCardHeader}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.siteNameText}>{selectedSite.name}</ThemedText>
                  <View style={styles.siteLocationRow}>
                    <Feather name="map-pin" size={14} color="#F97316" style={{ marginRight: 4 }} />
                    <ThemedText style={styles.siteAddressText}>{selectedSite.location || selectedSite.clientName || "Main Construction Site"}</ThemedText>
                  </View>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        (selectedSite as any).status === "Completed"
                          ? "#DCFCE7"
                          : (selectedSite as any).status === "Delayed"
                          ? "#FEE2E2"
                          : "#FEF3C7",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          (selectedSite as any).status === "Completed"
                            ? "#166534"
                            : (selectedSite as any).status === "Delayed"
                            ? "#EF4444"
                            : "#D97706",
                      },
                    ]}
                  />
                  <ThemedText
                    style={[
                      styles.statusBadgeText,
                      {
                        color:
                          (selectedSite as any).status === "Completed"
                            ? "#166534"
                            : (selectedSite as any).status === "Delayed"
                            ? "#991B1B"
                            : "#92400E",
                      },
                    ]}
                  >
                    {selectedSite.status || "Active"}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.supervisorInfoRow}>
                <Feather name="user-check" size={14} color={theme.textSecondary} style={{ marginRight: 6 }} />
                <ThemedText style={[styles.supervisorText, { color: theme.textSecondary }]}>
                  Supervisor: <ThemedText style={{ fontWeight: "700" }}>{
                    typeof (selectedSite as any)?.supervisor === "object" && (selectedSite as any)?.supervisor?.name
                      ? (selectedSite as any).supervisor.name
                      : typeof (selectedSite as any)?.supervisor === "string" && (selectedSite as any).supervisor.trim().length > 0
                      ? (selectedSite as any).supervisor
                      : (selectedSite as any)?.supervisorName
                      ? (selectedSite as any).supervisorName
                      : "Not Assigned"
                  }</ThemedText>
                </ThemedText>
              </View>
            </View>

            {/* ─── 2. PROMINENT TODAY'S WORK CARD ─────────────────────────── */}
            <View style={[styles.card, styles.todayWorkCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", borderColor: "#F97316" }]}>
              <View style={styles.todayCardHeader}>
                <View style={styles.todayCardTitleRow}>
                  <Feather name="clipboard" size={20} color="#F97316" />
                  <ThemedText style={styles.todayCardTitle}>{t.sites?.todaysWork || "Today's Work"}</ThemedText>
                </View>

                {/* Status Badge */}
                {todayStatus === "completed" ? (
                  <View style={[styles.workStatusBadge, { backgroundColor: "#DCFCE7" }]}>
                    <Feather name="check-circle" size={12} color="#166534" style={{ marginRight: 4 }} />
                    <ThemedText style={{ color: "#166534", fontSize: 12, fontWeight: "800" }}>
                      {t.sites?.workCompleted || "Work Completed"}
                    </ThemedText>
                  </View>
                ) : todayStatus === "in_progress" ? (
                  <View style={[styles.workStatusBadge, { backgroundColor: "#FEF3C7" }]}>
                    <View style={[styles.statusDot, { backgroundColor: "#D97706" }]} />
                    <ThemedText style={{ color: "#92400E", fontSize: 12, fontWeight: "800" }}>
                      {t.sites?.workInProgress || "Work In Progress"}
                    </ThemedText>
                  </View>
                ) : (
                  <View style={[styles.workStatusBadge, { backgroundColor: "#F1F5F9" }]}>
                    <ThemedText style={{ color: "#64748B", fontSize: 12, fontWeight: "700" }}>
                      {t.sites?.notStarted || "Not Started"}
                    </ThemedText>
                  </View>
                )}
              </View>

              {/* Work Details Summary */}
              {todayUpdate && (
                <View style={styles.todayDetailsBox}>
                  <ThemedText style={styles.workTypeNameText}>
                    {todayUpdate.workType || "General Work"}
                  </ThemedText>
                  {todayUpdate.description && (
                    <ThemedText style={styles.workDescText}>{todayUpdate.description}</ThemedText>
                  )}
                  {todayUpdate.morningTimestamp && (
                    <ThemedText style={styles.timeInfoText}>
                      Started: {new Date(todayUpdate.morningTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </ThemedText>
                  )}
                </View>
              )}

              {/* Photos Progress Status Indicators */}
              <View style={styles.photoCheckRow}>
                <View style={styles.photoCheckItem}>
                  <Feather
                    name={isMorningDone ? "check-circle" : "circle"}
                    size={16}
                    color={isMorningDone ? "#22C55E" : "#94A3B8"}
                  />
                  <ThemedText style={[styles.photoCheckText, { color: isMorningDone ? "#22C55E" : "#94A3B8" }]}>
                    Morning {isMorningDone ? "✓" : "—"}
                  </ThemedText>
                </View>

                <View style={styles.photoCheckItem}>
                  <Feather
                    name={isEveningDone ? "check-circle" : "circle"}
                    size={16}
                    color={isEveningDone ? "#22C55E" : "#94A3B8"}
                  />
                  <ThemedText style={[styles.photoCheckText, { color: isEveningDone ? "#22C55E" : "#94A3B8" }]}>
                    Evening {isEveningDone ? "✓" : "—"}
                  </ThemedText>
                </View>
              </View>

              {/* Primary Action Button */}
              {todayStatus === "not_started" && canSubmitWork && (
                <Pressable
                  onPress={() => setStartWorkModalVisible(true)}
                  style={styles.primaryActionBtn}
                >
                  <Feather name="plus-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <ThemedText style={styles.primaryActionBtnText}>
                    {t.sites?.startTodaysWork || "+ Start Today's Work"}
                  </ThemedText>
                </Pressable>
              )}

              {todayStatus === "in_progress" && canSubmitWork && (
                <Pressable
                  onPress={() => setCompleteWorkModalVisible(true)}
                  style={[styles.primaryActionBtn, { backgroundColor: "#10B981" }]}
                >
                  <Feather name="check-square" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <ThemedText style={styles.primaryActionBtnText}>
                    {t.sites?.completeTodaysWork || "Complete Today's Work"}
                  </ThemedText>
                </Pressable>
              )}

              {todayStatus === "completed" && (
                <Pressable
                  onPress={() => {
                    setSelectedDetailUpdate(todayUpdate);
                    setDetailModalVisible(true);
                  }}
                  style={[styles.primaryActionBtn, { backgroundColor: "#3B82F6" }]}
                >
                  <Feather name="eye" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <ThemedText style={styles.primaryActionBtnText}>
                    {t.sites?.viewTodaysUpdate || "View Today's Update"}
                  </ThemedText>
                </Pressable>
              )}
            </View>

            {/* ─── 3. SECONDARY FEATURE CARDS (COMPACT GRID) ──────────────── */}
            <ThemedText style={styles.sectionTitle}>Site Overview & Features</ThemedText>
            <View style={styles.secondaryGrid}>
              {/* Progress Card */}
              <Pressable
                onPress={() => setHistoryModalVisible(true)}
                style={[styles.gridCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", borderColor: theme.border }]}
              >
                <View style={[styles.gridIconWrap, { backgroundColor: "rgba(168, 85, 247, 0.15)" }]}>
                  <Feather name="trending-up" size={18} color="#A855F7" />
                </View>
                <ThemedText style={styles.gridCardTitle}>{t.sites?.progress || "Progress"}</ThemedText>
                <ThemedText style={styles.gridCardSub}>{(selectedSite as any).currentProgress || 0}% Completed</ThemedText>
              </Pressable>

              {/* Materials Card */}
              <Pressable
                onPress={() => navigation.navigate("SiteDetailControl", { siteId: selectedSite.id, tab: "materials" })}
                style={[styles.gridCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", borderColor: theme.border }]}
              >
                <View style={[styles.gridIconWrap, { backgroundColor: "rgba(249, 115, 22, 0.15)" }]}>
                  <Feather name="box" size={18} color="#F97316" />
                </View>
                <ThemedText style={styles.gridCardTitle}>{t.sites?.materials || "Materials"}</ThemedText>
                <ThemedText style={styles.gridCardSub}>Stock & Usage</ThemedText>
              </Pressable>

              {/* Expenses Card */}
              <Pressable
                onPress={() => navigation.navigate("SiteDetailControl", { siteId: selectedSite.id, tab: "expenses" })}
                style={[styles.gridCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", borderColor: theme.border }]}
              >
                <View style={[styles.gridIconWrap, { backgroundColor: "rgba(236, 72, 153, 0.15)" }]}>
                  <Feather name="credit-card" size={18} color="#EC4899" />
                </View>
                <ThemedText style={styles.gridCardTitle}>{t.sites?.expenses || "Expenses"}</ThemedText>
                <ThemedText style={styles.gridCardSub}>Petty Cash Log</ThemedText>
              </Pressable>

              {/* Photos Gallery Card */}
              <Pressable
                onPress={() => setHistoryModalVisible(true)}
                style={[styles.gridCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", borderColor: theme.border }]}
              >
                <View style={[styles.gridIconWrap, { backgroundColor: "rgba(6, 182, 212, 0.15)" }]}>
                  <Feather name="camera" size={18} color="#06B6D4" />
                </View>
                <ThemedText style={styles.gridCardTitle}>{t.sites?.photos || "Photos"}</ThemedText>
                <ThemedText style={styles.gridCardSub}>Before / After</ThemedText>
              </Pressable>

              {/* Issues Card */}
              <Pressable
                onPress={() => setHistoryModalVisible(true)}
                style={[styles.gridCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", borderColor: theme.border }]}
              >
                <View style={[styles.gridIconWrap, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
                  <Feather name="alert-triangle" size={18} color="#EF4444" />
                </View>
                <ThemedText style={styles.gridCardTitle}>{t.sites?.issues || "Issues"}</ThemedText>
                <ThemedText style={styles.gridCardSub}>Delays & Problems</ThemedText>
              </Pressable>

              {/* Location Card */}
              <Pressable
                onPress={() => setHistoryModalVisible(true)}
                style={[styles.gridCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", borderColor: theme.border }]}
              >
                <View style={[styles.gridIconWrap, { backgroundColor: "rgba(34, 197, 94, 0.15)" }]}>
                  <Feather name="map-pin" size={18} color="#22C55E" />
                </View>
                <ThemedText style={styles.gridCardTitle}>{t.sites?.gpsLocation || "Location"}</ThemedText>
                <ThemedText style={styles.gridCardSub}>GPS Verification</ThemedText>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Feather name="folder-plus" size={48} color="#F97316" />
            <ThemedText style={{ fontSize: 16, fontWeight: "700", marginTop: 12 }}>
              {t.sites?.noSites || "No construction sites found"}
            </ThemedText>
            <ThemedText style={{ color: theme.textSecondary, textAlign: "center", marginTop: 4 }}>
              Create your first project site to begin tracking daily work progress.
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {/* ─── MODAL 1: START WORK (MORNING WORKFLOW) ─────────────────────────── */}
      <Modal visible={startWorkModalVisible} animationType="slide" transparent={false}>
        <ThemedView style={{ flex: 1 }}>
          <View style={[styles.modalHeader, { backgroundColor: isDark ? "#1E293B" : "#FFF7ED" }]}>
            <ThemedText style={styles.modalHeaderTitle}>🌅 Start Today's Work</ThemedText>
            <Pressable onPress={() => setStartWorkModalVisible(false)}>
              <Feather name="x" size={24} color={isDark ? "#FFFFFF" : "#0F172A"} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll}>
            {/* Step 1: Morning Photo */}
            <ThemedText style={styles.inputGroupLabel}>📷 Step 1: Take Morning Photo</ThemedText>
            {morningPhoto ? (
              <View style={styles.photoPreviewContainer}>
                <Image source={{ uri: morningPhoto }} style={styles.photoPreviewImg} />
                <View style={styles.photoActionRow}>
                  <Pressable onPress={() => handlePickPhoto("camera", "morning")} style={styles.photoBtnOutline}>
                    <Feather name="refresh-cw" size={14} color="#F97316" style={{ marginRight: 6 }} />
                    <ThemedText style={{ color: "#F97316", fontWeight: "700" }}>{t.sites?.retake || "Retake"}</ThemedText>
                  </Pressable>
                  <Pressable onPress={() => handlePickPhoto("gallery", "morning")} style={styles.photoBtnOutline}>
                    <Feather name="image" size={14} color="#F97316" style={{ marginRight: 6 }} />
                    <ThemedText style={{ color: "#F97316", fontWeight: "700" }}>Change</ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.photoPickerBox}>
                {isUploadingMorningPhoto ? (
                  <ActivityIndicator size="large" color="#F97316" />
                ) : (
                  <>
                    <Feather name="camera" size={36} color="#F97316" style={{ marginBottom: 12 }} />
                    <ThemedText style={{ fontWeight: "700", marginBottom: 12 }}>Capture Morning Work Site Photo</ThemedText>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Pressable onPress={() => handlePickPhoto("camera", "morning")} style={styles.primaryPhotoBtn}>
                        <Feather name="camera" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>{t.sites?.openCamera || "Open Camera"}</ThemedText>
                      </Pressable>
                      <Pressable onPress={() => handlePickPhoto("gallery", "morning")} style={styles.secondaryPhotoBtn}>
                        <Feather name="image" size={16} color="#F97316" style={{ marginRight: 6 }} />
                        <ThemedText style={{ color: "#F97316", fontWeight: "700" }}>{t.sites?.chooseGallery || "Gallery"}</ThemedText>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Step 2: Work Type Selection */}
            <ThemedText style={[styles.inputGroupLabel, { marginTop: 20 }]}>🔨 Step 2: Select Work Type</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {WORK_TYPES.map((type) => {
                const isSel = workType === type;
                return (
                  <Pressable
                    key={type}
                    onPress={() => setWorkType(type)}
                    style={[
                      styles.chipItem,
                      {
                        backgroundColor: isSel ? "#F97316" : isDark ? "#334155" : "#F1F5F9",
                      },
                    ]}
                  >
                    <ThemedText style={{ color: isSel ? "#FFFFFF" : isDark ? "#E2E8F0" : "#334155", fontWeight: "700", fontSize: 13 }}>
                      {type}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>

            {workType === "Other" && (
              <TextInput
                style={[styles.textInput, { backgroundColor: isDark ? "#334155" : "#F8FAFC", color: isDark ? "#FFF" : "#000", marginTop: 8 }]}
                placeholder={t.sites?.enterCustomWork || "Enter custom work name"}
                placeholderTextColor={theme.textSecondary}
                value={customWorkType}
                onChangeText={setCustomWorkType}
              />
            )}

            {/* Step 3: Work Description */}
            <ThemedText style={[styles.inputGroupLabel, { marginTop: 16 }]}>📝 Work Description</ThemedText>
            <TextInput
              style={[styles.textInput, styles.textArea, { backgroundColor: isDark ? "#334155" : "#F8FAFC", color: isDark ? "#FFF" : "#000" }]}
              placeholder={t.sites?.whatWorkStarting || "What work are you starting today?"}
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
              value={workDescription}
              onChangeText={setWorkDescription}
            />

            {/* Step 4: Starting Point */}
            <ThemedText style={[styles.inputGroupLabel, { marginTop: 16 }]}>📍 Starting Point</ThemedText>
            <TextInput
              style={[styles.textInput, { backgroundColor: isDark ? "#334155" : "#F8FAFC", color: isDark ? "#FFF" : "#000" }]}
              placeholder="e.g. Ground Floor – East Wall"
              placeholderTextColor={theme.textSecondary}
              value={startingPoint}
              onChangeText={setStartingPoint}
            />

            {/* Step 5: Optional Location */}
            <View style={styles.locationSectionRow}>
              <View style={{ flex: 1 }}>
                <ThemedText style={{ fontWeight: "700" }}>GPS Location (Optional)</ThemedText>
                <ThemedText style={{ fontSize: 12, color: theme.textSecondary }}>
                  {morningLocation ? "Location Captured ✓" : "Optionally verify your site location"}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => handleCaptureLocation("morning")}
                disabled={isCapturingLocation}
                style={[styles.locationBtn, { backgroundColor: morningLocation ? "#22C55E" : "#F97316" }]}
              >
                {isCapturingLocation ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Feather name="map-pin" size={14} color="#FFF" style={{ marginRight: 4 }} />
                    <ThemedText style={{ color: "#FFF", fontWeight: "700", fontSize: 12 }}>
                      {morningLocation ? "Captured ✓" : "Capture"}
                    </ThemedText>
                  </>
                )}
              </Pressable>
            </View>

            {/* Submit Start Work Button */}
            <Pressable
              onPress={handleStartWorkSubmit}
              disabled={isSubmittingStart}
              style={[styles.modalSubmitBtn, { marginTop: 24 }]}
            >
              {isSubmittingStart ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <ThemedText style={styles.modalSubmitBtnText}>
                  {t.sites?.startWorkBtn || "Start Work"}
                </ThemedText>
              )}
            </Pressable>
          </ScrollView>
        </ThemedView>
      </Modal>

      {/* ─── MODAL 2: COMPLETE WORK (EVENING WORKFLOW) ─────────────────────── */}
      <Modal visible={completeWorkModalVisible} animationType="slide" transparent={false}>
        <ThemedView style={{ flex: 1 }}>
          <View style={[styles.modalHeader, { backgroundColor: isDark ? "#1E293B" : "#ECFDF5" }]}>
            <ThemedText style={styles.modalHeaderTitle}>🌆 Complete Today's Work</ThemedText>
            <Pressable onPress={() => setCompleteWorkModalVisible(false)}>
              <Feather name="x" size={24} color={isDark ? "#FFFFFF" : "#0F172A"} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll}>
            {/* Step 1: Evening Photo */}
            <ThemedText style={styles.inputGroupLabel}>📷 Step 1: Capture Final Work Photo</ThemedText>
            {eveningPhoto ? (
              <View style={styles.photoPreviewContainer}>
                <Image source={{ uri: eveningPhoto }} style={styles.photoPreviewImg} />
                <View style={styles.photoActionRow}>
                  <Pressable onPress={() => handlePickPhoto("camera", "evening")} style={styles.photoBtnOutline}>
                    <Feather name="refresh-cw" size={14} color="#F97316" style={{ marginRight: 6 }} />
                    <ThemedText style={{ color: "#F97316", fontWeight: "700" }}>{t.sites?.retake || "Retake"}</ThemedText>
                  </Pressable>
                  <Pressable onPress={() => handlePickPhoto("gallery", "evening")} style={styles.photoBtnOutline}>
                    <Feather name="image" size={14} color="#F97316" style={{ marginRight: 6 }} />
                    <ThemedText style={{ color: "#F97316", fontWeight: "700" }}>Change</ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.photoPickerBox}>
                {isUploadingEveningPhoto ? (
                  <ActivityIndicator size="large" color="#F97316" />
                ) : (
                  <>
                    <Feather name="camera" size={36} color="#10B981" style={{ marginBottom: 12 }} />
                    <ThemedText style={{ fontWeight: "700", marginBottom: 12 }}>Capture Evening Final Work Site Photo</ThemedText>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <Pressable onPress={() => handlePickPhoto("camera", "evening")} style={[styles.primaryPhotoBtn, { backgroundColor: "#10B981" }]}>
                        <Feather name="camera" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>{t.sites?.openCamera || "Open Camera"}</ThemedText>
                      </Pressable>
                      <Pressable onPress={() => handlePickPhoto("gallery", "evening")} style={styles.secondaryPhotoBtn}>
                        <Feather name="image" size={16} color="#10B981" style={{ marginRight: 6 }} />
                        <ThemedText style={{ color: "#10B981", fontWeight: "700" }}>{t.sites?.chooseGallery || "Gallery"}</ThemedText>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Step 2: Completion Description */}
            <ThemedText style={[styles.inputGroupLabel, { marginTop: 20 }]}>📝 What was completed today?</ThemedText>
            <TextInput
              style={[styles.textInput, styles.textArea, { backgroundColor: isDark ? "#334155" : "#F8FAFC", color: isDark ? "#FFF" : "#000" }]}
              placeholder={t.sites?.whatWorkCompleted || "What was completed today?"}
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
              value={completionDescription}
              onChangeText={setCompletionDescription}
            />

            {/* Step 3: Ending Point */}
            <ThemedText style={[styles.inputGroupLabel, { marginTop: 16 }]}>📍 Ending Point</ThemedText>
            <TextInput
              style={[styles.textInput, { backgroundColor: isDark ? "#334155" : "#F8FAFC", color: isDark ? "#FFF" : "#000" }]}
              placeholder="e.g. East Wall – 17 ft completed"
              placeholderTextColor={theme.textSecondary}
              value={endingPoint}
              onChangeText={setEndingPoint}
            />

            {/* Step 4: Progress */}
            <ThemedText style={[styles.inputGroupLabel, { marginTop: 16 }]}>📈 Progress</ThemedText>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
              {["In Progress", "Mostly Completed", "Completed"].map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => {
                    setProgressOption(opt);
                    const pct = opt === "Completed" ? 100 : opt === "Mostly Completed" ? 75 : 50;
                    setProgressPercent(pct);
                    setProgressText(opt);
                  }}
                  style={[
                    styles.chipItem,
                    {
                      backgroundColor: progressOption === opt ? "#10B981" : isDark ? "#334155" : "#F1F5F9",
                    },
                  ]}
                >
                  <ThemedText style={{ color: progressOption === opt ? "#FFF" : isDark ? "#E2E8F0" : "#334155", fontWeight: "700", fontSize: 12 }}>
                    {opt}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={[styles.textInput, { backgroundColor: isDark ? "#334155" : "#F8FAFC", color: isDark ? "#FFF" : "#000" }]}
              placeholder="Custom Progress (e.g. 17 / 25 ft or 68%)"
              placeholderTextColor={theme.textSecondary}
              value={progressText}
              onChangeText={setProgressText}
            />

            {/* Step 5: Optional Issues */}
            <ThemedText style={[styles.inputGroupLabel, { marginTop: 16 }]}>⚠️ Issues (Optional)</ThemedText>
            <TextInput
              style={[styles.textInput, { backgroundColor: isDark ? "#334155" : "#F8FAFC", color: isDark ? "#FFF" : "#000" }]}
              placeholder={t.sites?.issuePlaceholder || "Any problem or delay today?"}
              placeholderTextColor={theme.textSecondary}
              value={issues}
              onChangeText={setIssues}
            />

            {/* Submit Complete Work Button */}
            <Pressable
              onPress={handleCompleteWorkSubmit}
              disabled={isSubmittingComplete}
              style={[styles.modalSubmitBtn, { backgroundColor: "#10B981", marginTop: 24 }]}
            >
              {isSubmittingComplete ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <ThemedText style={styles.modalSubmitBtnText}>
                  {t.sites?.completeWorkBtn || "Complete Today's Work"}
                </ThemedText>
              )}
            </Pressable>
          </ScrollView>
        </ThemedView>
      </Modal>

      {/* ─── MODAL 3: DAILY UPDATES TIMELINE HISTORY (CONTRACTOR VIEW) ───────────── */}
      <Modal visible={historyModalVisible} animationType="slide" transparent={false}>
        <ThemedView style={{ flex: 1 }}>
          <View style={[styles.modalHeader, { backgroundColor: isDark ? "#1E293B" : "#FFF7ED" }]}>
            <ThemedText style={styles.modalHeaderTitle}>📅 Daily Updates History</ThemedText>
            <Pressable onPress={() => setHistoryModalVisible(false)}>
              <Feather name="x" size={24} color={isDark ? "#FFFFFF" : "#0F172A"} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll}>
            {dailyHistory.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Feather name="calendar" size={40} color={theme.textSecondary} />
                <ThemedText style={{ marginTop: 12, fontWeight: "700" }}>No daily updates recorded yet</ThemedText>
              </View>
            ) : (
              dailyHistory.map((item) => (
                <View
                  key={item._id || item.id || item.dateStr}
                  style={[styles.timelineCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", borderColor: theme.border }]}
                >
                  <View style={styles.timelineHeaderRow}>
                    <ThemedText style={styles.timelineDateText}>{item.dateStr}</ThemedText>
                    <View
                      style={[
                        styles.workStatusBadge,
                        { backgroundColor: item.status === "completed" ? "#DCFCE7" : "#FEF3C7" },
                      ]}
                    >
                      <ThemedText
                        style={{
                          fontSize: 11,
                          fontWeight: "800",
                          color: item.status === "completed" ? "#166534" : "#92400E",
                        }}
                      >
                        {item.status === "completed" ? "Work Completed" : "In Progress"}
                      </ThemedText>
                    </View>
                  </View>

                  <ThemedText style={styles.timelineWorkType}>{item.workType || "General Construction Work"}</ThemedText>

                  {/* Morning / Evening Photos Comparison */}
                  <View style={styles.photoCompareRow}>
                    {item.morningPhoto ? (
                      <View style={styles.comparePhotoCol}>
                        <ThemedText style={styles.comparePhotoTag}>🌅 MORNING</ThemedText>
                        <Image source={{ uri: item.morningPhoto }} style={styles.comparePhotoImg} />
                        {item.morningTimestamp && (
                          <ThemedText style={styles.compareTimeText}>
                            {new Date(item.morningTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </ThemedText>
                        )}
                      </View>
                    ) : null}

                    {item.eveningPhoto ? (
                      <View style={styles.comparePhotoCol}>
                        <ThemedText style={styles.comparePhotoTag}>🌆 EVENING</ThemedText>
                        <Image source={{ uri: item.eveningPhoto }} style={styles.comparePhotoImg} />
                        {item.eveningTimestamp && (
                          <ThemedText style={styles.compareTimeText}>
                            {new Date(item.eveningTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </ThemedText>
                        )}
                      </View>
                    ) : null}
                  </View>

                  {/* Details */}
                  <View style={styles.timelineDetailsBox}>
                    {item.startingPoint && (
                      <ThemedText style={styles.timelineDetailText}>
                        <ThemedText style={{ fontWeight: "700" }}>Started From: </ThemedText>
                        {item.startingPoint}
                      </ThemedText>
                    )}
                    {item.endingPoint && (
                      <ThemedText style={styles.timelineDetailText}>
                        <ThemedText style={{ fontWeight: "700" }}>Ended At: </ThemedText>
                        {item.endingPoint}
                      </ThemedText>
                    )}
                    {item.progress && (
                      <ThemedText style={styles.timelineDetailText}>
                        <ThemedText style={{ fontWeight: "700" }}>Progress: </ThemedText>
                        {item.progress}
                      </ThemedText>
                    )}
                    {item.issues && (
                      <ThemedText style={[styles.timelineDetailText, { color: "#EF4444" }]}>
                        <ThemedText style={{ fontWeight: "700" }}>Issues: </ThemedText>
                        {item.issues}
                      </ThemedText>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </ThemedView>
      </Modal>

      {/* ─── MODAL 4: SINGLE UPDATE DETAIL VIEW ───────────────────────────── */}
      <Modal visible={detailModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.detailCardContainer, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]}>
            <View style={styles.detailCardHeader}>
              <ThemedText style={{ fontSize: 18, fontWeight: "800" }}>Today's Work Summary</ThemedText>
              <Pressable onPress={() => setDetailModalVisible(false)}>
                <Feather name="x" size={22} color={isDark ? "#FFF" : "#000"} />
              </Pressable>
            </View>

            {selectedDetailUpdate && (
              <ScrollView style={{ maxHeight: 450 }}>
                <ThemedText style={{ fontSize: 16, fontWeight: "800", color: "#F97316", marginBottom: 6 }}>
                  {selectedDetailUpdate.workType}
                </ThemedText>
                <ThemedText style={{ fontSize: 14, color: theme.textSecondary, marginBottom: 12 }}>
                  {selectedDetailUpdate.description}
                </ThemedText>

                <View style={styles.photoCompareRow}>
                  {selectedDetailUpdate.morningPhoto && (
                    <View style={styles.comparePhotoCol}>
                      <ThemedText style={styles.comparePhotoTag}>🌅 MORNING</ThemedText>
                      <Image source={{ uri: selectedDetailUpdate.morningPhoto }} style={styles.comparePhotoImg} />
                    </View>
                  )}
                  {selectedDetailUpdate.eveningPhoto && (
                    <View style={styles.comparePhotoCol}>
                      <ThemedText style={styles.comparePhotoTag}>🌆 EVENING</ThemedText>
                      <Image source={{ uri: selectedDetailUpdate.eveningPhoto }} style={styles.comparePhotoImg} />
                    </View>
                  )}
                </View>

                <View style={{ marginTop: 12, gap: 6 }}>
                  <ThemedText><ThemedText style={{ fontWeight: "700" }}>Started Point:</ThemedText> {selectedDetailUpdate.startingPoint || "N/A"}</ThemedText>
                  <ThemedText><ThemedText style={{ fontWeight: "700" }}>Ended Point:</ThemedText> {selectedDetailUpdate.endingPoint || "N/A"}</ThemedText>
                  <ThemedText><ThemedText style={{ fontWeight: "700" }}>Work Completed:</ThemedText> {selectedDetailUpdate.completionDescription || "N/A"}</ThemedText>
                  <ThemedText><ThemedText style={{ fontWeight: "700" }}>Progress:</ThemedText> {selectedDetailUpdate.progress || "100%"}</ThemedText>
                  {selectedDetailUpdate.issues && (
                    <ThemedText style={{ color: "#EF4444" }}><ThemedText style={{ fontWeight: "700" }}>Issues:</ThemedText> {selectedDetailUpdate.issues}</ThemedText>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === "ios" ? 54 : 36,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748B",
  },
  historyIconBtn: {
    padding: 10,
    borderRadius: 12,
  },
  siteChipsScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  siteChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  siteChipText: {
    fontSize: 13,
    fontWeight: "700",
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },

  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  siteCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  siteNameText: {
    fontSize: 18,
    fontWeight: "800",
  },
  siteLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  siteAddressText: {
    fontSize: 13,
    color: "#64748B",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  supervisorInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(150,150,150,0.2)",
  },
  supervisorText: {
    fontSize: 13,
  },

  // Today Work Prominent Card
  todayWorkCard: {
    borderWidth: 1.5,
  },
  todayCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  todayCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  todayCardTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  workStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  todayDetailsBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(249, 115, 22, 0.06)",
  },
  workTypeNameText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#F97316",
  },
  workDescText: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  timeInfoText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 6,
    fontWeight: "600",
  },

  photoCheckRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 14,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(150,150,150,0.2)",
  },
  photoCheckItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  photoCheckText: {
    fontSize: 13,
    fontWeight: "700",
  },

  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F97316",
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryActionBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  // Secondary Grid
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 8,
  },
  secondaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  gridCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  gridIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  gridCardTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  gridCardSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },

  // Modals
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(150,150,150,0.2)",
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  modalScroll: {
    padding: 20,
    paddingBottom: 40,
  },
  inputGroupLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  textInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },

  photoPickerBox: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#F97316",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(249, 115, 22, 0.04)",
  },
  primaryPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F97316",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  secondaryPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(249, 115, 22, 0.12)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  photoPreviewContainer: {
    alignItems: "center",
  },
  photoPreviewImg: {
    width: "100%",
    height: 200,
    borderRadius: 14,
  },
  photoActionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  photoBtnOutline: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F97316",
  },

  chipItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },

  locationSectionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(150,150,150,0.08)",
  },
  locationBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },

  modalSubmitBtn: {
    backgroundColor: "#F97316",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSubmitBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  // Timeline History
  timelineCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  timelineHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  timelineDateText: {
    fontSize: 15,
    fontWeight: "800",
  },
  timelineWorkType: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F97316",
    marginBottom: 12,
  },
  photoCompareRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  comparePhotoCol: {
    flex: 1,
  },
  comparePhotoTag: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    marginBottom: 4,
  },
  comparePhotoImg: {
    width: "100%",
    height: 120,
    borderRadius: 10,
  },
  compareTimeText: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
    textAlign: "center",
  },
  timelineDetailsBox: {
    gap: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(150,150,150,0.2)",
  },
  timelineDetailText: {
    fontSize: 12,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  detailCardContainer: {
    width: "100%",
    borderRadius: 20,
    padding: 20,
  },
  detailCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
});
