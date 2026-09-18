import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Linking,
  Alert,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useSocket } from "@/hooks/useSocket";
import { BorderRadius } from "@/constants/theme";
import {
  storage,
  siteActivityStorage,
  Project,
} from "@/utils/storage";

type ControlTab =
  | "BANDHKAM"
  | "RCC"
  | "PLASTER"
  | "TILES"
  | "IMAGES"
  | "EMERGENCY"
  | "REQUESTS";

type PhotoFilter = "ALL" | "MORNING" | "EVENING";

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

interface SitePhotoItem {
  id: string;
  photoUrl: string;
  workerName: string;
  workerRole: string;
  activityType: "MORNING_WORK" | "EVENING_WORK" | string;
  timeStr: string;
  dateStr: string;
  description?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
  };
}

export default function SiteDetailControlScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const { socket } = useSocket();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { siteId } = route.params || {};

  const [site, setSite] = useState<Project | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [activeTab, setActiveTab] = useState<ControlTab>("BANDHKAM");
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>("ALL");
  const [controlData, setControlData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [resolvingIssueId, setResolvingIssueId] = useState<string | null>(null);

  // Photo Full-Screen Viewer Modal State
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<SitePhotoItem | null>(null);

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
        // 1. Fetch site control center metrics, workers & photos
        const ctrl = await siteActivityStorage.getSiteControlCenter(siteId, selectedDate);
        if (ctrl && ctrl.success) {
          setControlData(ctrl);
        }

        // 2. Fetch basic site details
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
  }, [socket, siteId, loadSiteData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadSiteData(false);
  };

  const siteDisplayName = controlData?.site?.name || site?.name || "Site Control";
  const siteDisplayAddress = controlData?.site?.address || site?.location || "Site Location";

  // Categorize Workers
  const allWorkers: any[] = useMemo(() => {
    return controlData?.workers || [];
  }, [controlData]);

  const bandhkamWorkers = useMemo(() => {
    const filtered = allWorkers.filter((w) => {
      const cat = (w.category || "").toLowerCase();
      const name = (w.name || "").toLowerCase();
      return (
        cat.includes("mason") ||
        cat.includes("brick") ||
        cat.includes("mistri") ||
        cat.includes("bandhkam") ||
        cat.includes("BANDHKAM") ||
        cat.includes("कारिगीर")
      );
    });
    return filtered.length > 0 ? filtered : allWorkers;
  }, [allWorkers]);

  const rccWorkers = useMemo(() => {
    return allWorkers.filter((w) => {
      const cat = (w.category || "").toLowerCase();
      return (
        cat.includes("rcc") ||
        cat.includes("shuttering") ||
        cat.includes("steel") ||
        cat.includes("fitter") ||
        cat.includes("bar") ||
        cat.includes("lohar") ||
        cat.includes("आरसीसी")
      );
    });
  }, [allWorkers]);

  const plasterWorkers = useMemo(() => {
    return allWorkers.filter((w) => {
      const cat = (w.category || "").toLowerCase();
      return cat.includes("plaster") || cat.includes("प्लास्टर");
    });
  }, [allWorkers]);

  const tilesWorkers = useMemo(() => {
    return allWorkers.filter((w) => {
      const cat = (w.category || "").toLowerCase();
      return (
        cat.includes("tile") ||
        cat.includes("टाइल्स") ||
        cat.includes("flooring") ||
        cat.includes("marble")
      );
    });
  }, [allWorkers]);

  // Extract all photos
  const allPhotos: SitePhotoItem[] = useMemo(() => {
    const rawPhotos = controlData?.sitePhotos || [];
    return rawPhotos
      .map((p: any) => ({
        id: p.id || p._id || `${Math.random()}`,
        photoUrl:
          p.photo?.url || (typeof p.photo === "string" ? p.photo : p.photoUri || p.url || ""),
        workerName: p.workerName || p.userName || p.workerId?.name || "Worker",
        workerRole: p.workerRole || p.workerId?.category || "Labour",
        activityType: p.activityType || p.photoType || "MORNING_WORK",
        timeStr: p.timeStr || "Today",
        dateStr: p.dateStr || selectedDate,
        description: p.description,
        location: p.location,
      }))
      .filter((p: SitePhotoItem) => !!p.photoUrl);
  }, [controlData, selectedDate]);

  const filteredPhotos = useMemo(() => {
    if (photoFilter === "MORNING") {
      return allPhotos.filter(
        (p) => p.activityType === "MORNING_WORK" || p.activityType === "MORNING"
      );
    }
    if (photoFilter === "EVENING") {
      return allPhotos.filter(
        (p) => p.activityType === "EVENING_WORK" || p.activityType === "EVENING"
      );
    }
    return allPhotos;
  }, [allPhotos, photoFilter]);

  // Emergency Contacts
  const emergencyContacts = useMemo(() => {
    const serverContacts = controlData?.emergencyContacts || [];
    const defaults = [
      {
        role: "Site Supervisor",
        name: controlData?.site?.supervisor?.name || "Site Supervisor",
        phone: controlData?.site?.supervisor?.phone || "9876543210",
        icon: "account-tie",
      },
      {
        role: "Contractor Office",
        name: "Main Office / Helpdesk",
        phone: "1800123456",
        icon: "domain",
      },
      {
        role: "Nearest Hospital / Ambulance",
        name: "Emergency Medical Care",
        phone: "108",
        icon: "hospital-box",
      },
      {
        role: "Police Station",
        name: "Local Police Desk",
        phone: "100",
        icon: "shield-alert",
      },
      {
        role: "Fire Brigade",
        name: "Fire Emergency",
        phone: "101",
        icon: "fire-truck",
      },
    ];

    if (serverContacts.length > 0) {
      return [
        ...serverContacts.map((c: any) => ({
          role: c.role || "Contact",
          name: c.name || "Officer",
          phone: c.phone || "",
          icon: "phone",
        })),
        ...defaults.slice(2),
      ];
    }
    return defaults;
  }, [controlData]);

  // User Requests / Feedback / Issues
  const userRequests: any[] = useMemo(() => {
    const issues = controlData?.openIssues || [];
    const activities = (controlData?.dailyTimeline || []).filter(
      (a: any) => a.activityType === "ISSUE" || a.activityType === "REQUEST"
    );

    const map = new Map<string, any>();
    [...issues, ...activities].forEach((item: any) => {
      map.set(item._id || item.id, item);
    });

    return Array.from(map.values());
  }, [controlData]);

  const openInGoogleMaps = (location?: { latitude: number; longitude: number }) => {
    if (!location?.latitude || !location?.longitude) return;
    const { latitude, longitude } = location;
    const url = Platform.select({
      ios: `maps://app?daddr=${latitude},${longitude}`,
      android: `google.navigation:q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    });
    Linking.openURL(url!).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
    });
  };

  const handleCall = (phone?: string) => {
    if (!phone) {
      Alert.alert("Phone Number Unavailable", "No contact phone number provided for this contact.");
      return;
    }
    triggerHaptic();
    const cleanPhone = phone.replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert("Error", `Could not initiate call to ${phone}`);
    });
  };

  const handleResolveRequest = async (issueId: string) => {
    try {
      setResolvingIssueId(issueId);
      triggerHaptic();
      await siteActivityStorage.resolveSiteIssue(issueId, "Resolved by Contractor");
      Alert.alert("Success", "Request has been marked as resolved.");
      await loadSiteData(false);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to resolve request.");
    } finally {
      setResolvingIssueId(null);
    }
  };

  // Render Trade Worker Card
  const renderWorkerCard = (w: any) => {
    const isPresent = w.attendanceStatus === "P" || w.attendanceStatus === "OT";
    const isHalfDay = w.attendanceStatus === "H";
    const isAbsent = w.attendanceStatus === "A";

    return (
      <View
        key={w.id}
        style={[
          styles.workerCard,
          {
            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
            borderColor: isDark ? "#334155" : "#E2E8F0",
          },
        ]}
      >
        <View style={styles.workerTopRow}>
          <View style={styles.workerAvatar}>
            <Text style={styles.workerAvatarText}>
              {(w.name || "W").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText numberOfLines={1} style={styles.workerNameTitle}>
              {w.name}
            </ThemedText>
            <Text style={styles.workerCategorySub}>
              {w.category || "Labour"} {w.uniqueId ? `• ID: ${w.uniqueId}` : ""}
            </Text>
          </View>
          {/* Attendance Badge */}
          <View
            style={[
              styles.attBadge,
              isPresent
                ? { backgroundColor: "#DCFCE7" }
                : isHalfDay
                ? { backgroundColor: "#FEF3C7" }
                : isAbsent
                ? { backgroundColor: "#FEE2E2" }
                : { backgroundColor: isDark ? "#334155" : "#F1F5F9" },
            ]}
          >
            <Text
              style={[
                styles.attBadgeText,
                isPresent
                  ? { color: "#166534" }
                  : isHalfDay
                  ? { color: "#92400E" }
                  : isAbsent
                  ? { color: "#991B1B" }
                  : { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              {isPresent ? "Present" : isHalfDay ? "Half Day" : isAbsent ? "Absent" : "Unmarked"}
            </Text>
          </View>
        </View>

        {/* Progress & Work Photos Indicators */}
        <View style={styles.workerFooterRow}>
          <View style={styles.photoIndicatorPill}>
            <MaterialCommunityIcons
              name="weather-sunny"
              size={14}
              color={w.morningStatus === "submitted" ? "#10B981" : "#94A3B8"}
            />
            <Text
              style={[
                styles.photoIndicatorText,
                { color: w.morningStatus === "submitted" ? "#10B981" : "#94A3B8" },
              ]}
            >
              {w.morningStatus === "submitted" ? `Morning (${w.morningTime || "✓"})` : "Morning: No"}
            </Text>
          </View>

          <View style={styles.photoIndicatorPill}>
            <MaterialCommunityIcons
              name="weather-sunset"
              size={14}
              color={w.eveningStatus === "submitted" ? "#10B981" : "#94A3B8"}
            />
            <Text
              style={[
                styles.photoIndicatorText,
                { color: w.eveningStatus === "submitted" ? "#10B981" : "#94A3B8" },
              ]}
            >
              {w.eveningStatus === "submitted" ? `Evening (${w.eveningTime || "✓"})` : "Evening: No"}
            </Text>
          </View>

          {w.phone ? (
            <Pressable
              onPress={() => handleCall(w.phone)}
              style={styles.workerCallBtn}
            >
              <Feather name="phone-call" size={14} color="#2563EB" />
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  const tabs: { id: ControlTab; label: string; icon: string; count?: number }[] = [
    { id: "BANDHKAM", label: "BANDHKAM", icon: "wall", count: bandhkamWorkers.length },
    { id: "RCC", label: "RCC", icon: "shield-home", count: rccWorkers.length },
    { id: "PLASTER", label: "Plaster", icon: "format-paint", count: plasterWorkers.length },
    { id: "TILES", label: "Tiles", icon: "view-grid", count: tilesWorkers.length },
    { id: "IMAGES", label: "Images", icon: "camera-burst", count: allPhotos.length },
    { id: "EMERGENCY", label: "Emergency Contact", icon: "phone-alert" },
    { id: "REQUESTS", label: "User Requests", icon: "comment-question", count: userRequests.length },
  ];

  if (!site && !controlData && isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* 1. TOP HEADER */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 14),
            borderBottomColor: theme.border,
            backgroundColor: theme.backgroundDefault,
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <Pressable
            onPress={() => {
              triggerHaptic();
              navigation.goBack();
            }}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={22} color={theme.text} />
          </Pressable>

          <View style={{ flex: 1, marginLeft: 10 }}>
            <ThemedText numberOfLines={1} style={styles.headerTitle}>
              {siteDisplayName}
            </ThemedText>
            <ThemedText numberOfLines={1} style={styles.headerSubtitle}>
              📍 {siteDisplayAddress}
            </ThemedText>
          </View>

          {/* Date Selector Pills */}
          <View style={styles.dateSelectorRow}>
            <Pressable
              onPress={() => {
                triggerHaptic();
                setSelectedDate(getTodayStr());
              }}
              style={[
                styles.datePill,
                selectedDate === getTodayStr()
                  ? { backgroundColor: theme.primary, borderColor: theme.primary }
                  : { backgroundColor: isDark ? "#1E293B" : "#F1F5F9", borderColor: theme.border },
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
                  : { backgroundColor: isDark ? "#1E293B" : "#F1F5F9", borderColor: theme.border },
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

        {/* 2. 7 HORIZONTAL SCROLLING TABS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
          style={styles.tabsScroll}
        >
          {tabs.map((tItem) => {
            const isSelected = activeTab === tItem.id;
            return (
              <Pressable
                key={tItem.id}
                onPress={() => {
                  triggerHaptic();
                  setActiveTab(tItem.id);
                }}
                style={[
                  styles.tabItem,
                  isSelected
                    ? [styles.tabItemActive, { borderBottomColor: theme.primary }]
                    : null,
                ]}
              >
                <MaterialCommunityIcons
                  name={tItem.icon as any}
                  size={17}
                  color={isSelected ? theme.primary : isDark ? "#94A3B8" : "#64748B"}
                />
                <Text
                  style={[
                    styles.tabItemText,
                    isSelected
                      ? [styles.tabItemTextActive, { color: theme.primary }]
                      : { color: isDark ? "#94A3B8" : "#64748B" },
                  ]}
                >
                  {tItem.label}
                  {typeof tItem.count === "number" ? ` (${tItem.count})` : ""}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. MAIN TAB CONTENT */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
          />
        }
      >
        {/* TAB 1: BANDHKAM (Bandhkam / Masonry) */}
        {activeTab === "BANDHKAM" && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <ThemedText style={styles.sectionTitle}>🧱 BANDHKAM (Masonry Workers)</ThemedText>
              <Text style={styles.sectionCountText}>{bandhkamWorkers.length} Workers</Text>
            </View>
            {bandhkamWorkers.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>🧱</Text>
                <ThemedText style={styles.emptyTitle}>No Masonry Workers Assigned</ThemedText>
                <ThemedText style={styles.emptyDesc}>Workers tagged under BANDHKAM or Masonry will appear here.</ThemedText>
              </View>
            ) : (
              bandhkamWorkers.map((w) => renderWorkerCard(w))
            )}
          </View>
        )}

        {/* TAB 2: RCC */}
        {activeTab === "RCC" && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <ThemedText style={styles.sectionTitle}>🏗️ RCC & Steel Workers</ThemedText>
              <Text style={styles.sectionCountText}>{rccWorkers.length} Workers</Text>
            </View>
            {rccWorkers.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>🏗️</Text>
                <ThemedText style={styles.emptyTitle}>No RCC Workers Assigned</ThemedText>
                <ThemedText style={styles.emptyDesc}>Workers tagged under RCC, Steel, or Shuttering will appear here.</ThemedText>
              </View>
            ) : (
              rccWorkers.map((w) => renderWorkerCard(w))
            )}
          </View>
        )}

        {/* TAB 3: Plaster */}
        {activeTab === "PLASTER" && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <ThemedText style={styles.sectionTitle}>🎨 Plaster & Finishing Workers</ThemedText>
              <Text style={styles.sectionCountText}>{plasterWorkers.length} Workers</Text>
            </View>
            {plasterWorkers.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>🎨</Text>
                <ThemedText style={styles.emptyTitle}>No Plaster Workers Assigned</ThemedText>
                <ThemedText style={styles.emptyDesc}>Workers tagged under Plaster will appear here.</ThemedText>
              </View>
            ) : (
              plasterWorkers.map((w) => renderWorkerCard(w))
            )}
          </View>
        )}

        {/* TAB 4: Tiles */}
        {activeTab === "TILES" && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <ThemedText style={styles.sectionTitle}>📐 Tiles & Flooring Workers</ThemedText>
              <Text style={styles.sectionCountText}>{tilesWorkers.length} Workers</Text>
            </View>
            {tilesWorkers.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>📐</Text>
                <ThemedText style={styles.emptyTitle}>No Tiles Workers Assigned</ThemedText>
                <ThemedText style={styles.emptyDesc}>Workers tagged under Tiles or Flooring will appear here.</ThemedText>
              </View>
            ) : (
              tilesWorkers.map((w) => renderWorkerCard(w))
            )}
          </View>
        )}

        {/* TAB 5: Images (Morning / Evening Work Photos) */}
        {activeTab === "IMAGES" && (
          <View>
            {/* Filter Sub-Pills */}
            <View style={styles.photoFilterRow}>
              {(["ALL", "MORNING", "EVENING"] as PhotoFilter[]).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => {
                    triggerHaptic();
                    setPhotoFilter(f);
                  }}
                  style={[
                    styles.photoFilterPill,
                    photoFilter === f
                      ? { backgroundColor: theme.primary, borderColor: theme.primary }
                      : { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", borderColor: theme.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.photoFilterPillText,
                      photoFilter === f
                        ? { color: "#FFFFFF", fontWeight: "700" }
                        : { color: theme.textSecondary },
                    ]}
                  >
                    {f === "ALL" ? `All Photos (${allPhotos.length})` : f === "MORNING" ? "☀️ Morning" : "🌙 Evening"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {filteredPhotos.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>📸</Text>
                <ThemedText style={styles.emptyTitle}>No Work Photos Uploaded</ThemedText>
                <ThemedText style={styles.emptyDesc}>When workers capture Morning or Evening work photos with GPS, they will appear here.</ThemedText>
              </View>
            ) : (
              <View style={styles.photosGrid}>
                {filteredPhotos.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      triggerHaptic();
                      setSelectedPhotoModal(item);
                    }}
                    style={[
                      styles.photoGridCard,
                      {
                        backgroundColor: theme.backgroundDefault,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <View style={styles.photoThumbWrapper}>
                      <Image
                        source={{ uri: item.photoUrl }}
                        style={styles.photoThumb}
                        resizeMode="cover"
                      />
                      <View style={styles.photoExpandBadge}>
                        <Feather name="maximize-2" size={12} color="#FFFFFF" />
                      </View>
                      <View
                        style={[
                          styles.photoTypeBadge,
                          {
                            backgroundColor:
                              item.activityType === "MORNING_WORK" || item.activityType === "MORNING"
                                ? "#F59E0B"
                                : "#2563EB",
                          },
                        ]}
                      >
                        <Text style={styles.photoTypeBadgeText}>
                          {item.activityType === "MORNING_WORK" || item.activityType === "MORNING"
                            ? "☀️ Morning"
                            : "🌙 Evening"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.photoCardBody}>
                      <ThemedText numberOfLines={1} style={styles.photoWorkerName}>
                        👷 {item.workerName}
                      </ThemedText>
                      <View style={styles.photoMetaRow}>
                        <View style={styles.photoTimePill}>
                          <Feather name="clock" size={11} color="#64748B" />
                          <Text style={styles.photoTimeText}>{item.timeStr}</Text>
                        </View>
                        {item.location?.latitude ? (
                          <View style={styles.photoGpsPill}>
                            <Feather name="map-pin" size={11} color="#10B981" />
                            <Text style={styles.photoGpsText}>GPS Verified</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* TAB 6: Emergency Contact */}
        {activeTab === "EMERGENCY" && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <ThemedText style={styles.sectionTitle}>🚨 Site Emergency Contacts</ThemedText>
            </View>
            <Text style={[styles.emergencyNotice, { color: isDark ? "#94A3B8" : "#64748B" }]}>
              Tap the call button to immediately connect with site supervisors, medical support, or emergency services.
            </Text>

            {emergencyContacts.map((contact, index) => (
              <View
                key={`${contact.role}_${index}`}
                style={[
                  styles.emergencyCard,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  },
                ]}
              >
                <View style={styles.emergencyIconWrap}>
                  <MaterialCommunityIcons
                    name={(contact.icon as any) || "phone"}
                    size={22}
                    color="#DC2626"
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText style={styles.emergencyRole}>{contact.role}</ThemedText>
                  <Text style={styles.emergencyName}>{contact.name}</Text>
                  <Text style={styles.emergencyPhone}>{contact.phone}</Text>
                </View>

                <Pressable
                  onPress={() => handleCall(contact.phone)}
                  style={styles.emergencyCallBtn}
                >
                  <Feather name="phone-call" size={18} color="#FFFFFF" />
                  <Text style={styles.emergencyCallBtnText}>Call</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* TAB 7: User Requests */}
        {activeTab === "REQUESTS" && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <ThemedText style={styles.sectionTitle}>📋 Worker Requests & Feedback</ThemedText>
              <Text style={styles.sectionCountText}>{userRequests.length} Total</Text>
            </View>

            {userRequests.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>✅</Text>
                <ThemedText style={styles.emptyTitle}>No Pending Requests</ThemedText>
                <ThemedText style={styles.emptyDesc}>All worker inquiries and site feedback for this site are up to date.</ThemedText>
              </View>
            ) : (
              userRequests.map((reqItem) => {
                const isResolved = reqItem.status === "RESOLVED";
                const isResolving = resolvingIssueId === (reqItem._id || reqItem.id);

                return (
                  <View
                    key={reqItem._id || reqItem.id}
                    style={[
                      styles.requestCard,
                      {
                        backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                        borderColor: isResolved ? "#10B981" : isDark ? "#334155" : "#E2E8F0",
                      },
                    ]}
                  >
                    <View style={styles.requestTopRow}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.requestUser}>
                          👤 {reqItem.userName || "Worker"}
                        </ThemedText>
                        <Text style={styles.requestTime}>
                          {reqItem.dateStr || "Today"} • {reqItem.timeStr || "Recent"}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.requestStatusBadge,
                          { backgroundColor: isResolved ? "#DCFCE7" : "#FEF3C7" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.requestStatusBadgeText,
                            { color: isResolved ? "#166534" : "#92400E" },
                          ]}
                        >
                          {isResolved ? "RESOLVED" : "OPEN"}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.requestDesc,
                        { color: isDark ? "#F8FAFC" : "#0F172A" },
                      ]}
                    >
                      {reqItem.description || reqItem.notes || "Worker feedback / issue report"}
                    </Text>

                    {!isResolved && (
                      <Pressable
                        onPress={() => handleResolveRequest(reqItem._id || reqItem.id)}
                        disabled={isResolving}
                        style={styles.resolveBtn}
                      >
                        {isResolving ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Feather name="check" size={14} color="#FFFFFF" />
                            <Text style={styles.resolveBtnText}>Mark as Resolved</Text>
                          </>
                        )}
                      </Pressable>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* 4. FULLSCREEN PHOTO VIEWER MODAL */}
      <Modal
        visible={selectedPhotoModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhotoModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.modalWorkerName}>
                  👷 {selectedPhotoModal?.workerName}
                </ThemedText>
                <Text style={styles.modalWorkerRole}>
                  {selectedPhotoModal?.workerRole} •{" "}
                  {selectedPhotoModal?.activityType === "MORNING_WORK" || selectedPhotoModal?.activityType === "MORNING"
                    ? "☀️ Morning"
                    : "🌙 Evening"}
                </Text>
              </View>
              <Pressable
                onPress={() => setSelectedPhotoModal(null)}
                style={styles.modalCloseBtn}
              >
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            {selectedPhotoModal?.photoUrl ? (
              <Image
                source={{ uri: selectedPhotoModal.photoUrl }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            ) : null}

            <View style={styles.modalFooter}>
              <View style={styles.modalMetaRow}>
                <Feather name="clock" size={14} color="#64748B" />
                <Text style={styles.modalMetaText}>
                  {selectedPhotoModal?.dateStr} at {selectedPhotoModal?.timeStr}
                </Text>
              </View>

              {selectedPhotoModal?.location?.latitude ? (
                <View style={styles.modalLocationSection}>
                  <View style={styles.modalMetaRow}>
                    <Feather name="map-pin" size={14} color="#10B981" />
                    <Text style={styles.modalMetaText}>
                      Lat: {selectedPhotoModal.location.latitude.toFixed(5)}, Lng:{" "}
                      {selectedPhotoModal.location.longitude.toFixed(5)}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => openInGoogleMaps(selectedPhotoModal.location)}
                    style={styles.mapsActionBtn}
                  >
                    <Feather name="navigation" size={14} color="#FFFFFF" />
                    <Text style={styles.mapsActionBtnText}>Open in Google Maps</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    borderBottomWidth: 1,
    paddingBottom: 0,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  dateSelectorRow: {
    flexDirection: "row",
    gap: 6,
  },
  datePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  datePillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  tabsScroll: {
    maxHeight: 46,
  },
  tabsScrollContent: {
    paddingHorizontal: 12,
    gap: 4,
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2.5,
    borderBottomColor: "transparent",
  },
  tabItemActive: {
    borderBottomWidth: 2.5,
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: "600",
  },
  tabItemTextActive: {
    fontWeight: "700",
  },
  scrollContent: {
    padding: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  sectionCountText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  workerCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  workerTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  workerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  workerAvatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  workerNameTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  workerCategorySub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  attBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  attBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  workerFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2E8F0",
    gap: 8,
  },
  photoIndicatorPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  photoIndicatorText: {
    fontSize: 11,
    fontWeight: "600",
  },
  workerCallBtn: {
    marginLeft: "auto",
    padding: 6,
    borderRadius: 6,
    backgroundColor: "#EFF6FF",
  },
  photoFilterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  photoFilterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  photoFilterPillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  photosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  photoGridCard: {
    width: "48%",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  photoThumbWrapper: {
    width: "100%",
    height: 120,
    position: "relative",
    backgroundColor: "#0F172A",
  },
  photoThumb: {
    width: "100%",
    height: "100%",
  },
  photoExpandBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 4,
    borderRadius: 4,
  },
  photoTypeBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  photoTypeBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  photoCardBody: {
    padding: 10,
  },
  photoWorkerName: {
    fontSize: 13,
    fontWeight: "700",
  },
  photoMetaRow: {
    flexDirection: "column",
    gap: 4,
    marginTop: 6,
  },
  photoTimePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  photoTimeText: {
    fontSize: 11,
    color: "#64748B",
  },
  photoGpsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  photoGpsText: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "600",
  },
  emergencyNotice: {
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },
  emergencyCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  emergencyIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  emergencyRole: {
    fontSize: 14,
    fontWeight: "700",
  },
  emergencyName: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  emergencyPhone: {
    fontSize: 13,
    fontWeight: "600",
    color: "#DC2626",
    marginTop: 2,
  },
  emergencyCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#DC2626",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emergencyCallBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  requestCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  requestTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  requestUser: {
    fontSize: 14,
    fontWeight: "700",
  },
  requestTime: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  requestStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  requestStatusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  requestDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  resolveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#10B981",
    paddingVertical: 8,
    borderRadius: 8,
  },
  resolveBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    width: "100%",
    maxHeight: "85%",
    borderRadius: 16,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  modalWorkerName: {
    fontSize: 15,
    fontWeight: "700",
  },
  modalWorkerRole: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalImage: {
    width: "100%",
    height: 280,
    backgroundColor: "#000000",
  },
  modalFooter: {
    padding: 14,
    gap: 8,
  },
  modalMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modalMetaText: {
    fontSize: 12,
    color: "#64748B",
  },
  modalLocationSection: {
    gap: 8,
    marginTop: 4,
  },
  mapsActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#2563EB",
    paddingVertical: 10,
    borderRadius: 8,
  },
  mapsActionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});

