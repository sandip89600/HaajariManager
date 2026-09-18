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
} from "react-native";
import { Feather } from "@expo/vector-icons";
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

type PhotoTab = "MORNING" | "EVENING";

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
  const [activeTab, setActiveTab] = useState<PhotoTab>("MORNING");
  const [controlData, setControlData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Photo Full-Screen Viewer Modal State
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<SitePhotoItem | null>(null);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const loadSiteData = useCallback(async (showIndicator = true) => {
    if (!siteId) return;
    if (showIndicator) setIsLoading(true);
    try {
      // 1. Fetch site control center metrics & photos
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
  }, [siteId, selectedDate]);

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

  // Extract all photos and filter by activeTab (MORNING / EVENING)
  const allPhotos: SitePhotoItem[] = useMemo(() => {
    const rawPhotos = controlData?.sitePhotos || [];
    return rawPhotos
      .map((p: any) => ({
        id: p.id || p._id || `${Math.random()}`,
        photoUrl: p.photo?.url || (typeof p.photo === "string" ? p.photo : p.photoUri || p.url || ""),
        workerName: p.workerName || p.workerId?.name || "Worker",
        workerRole: p.workerRole || p.workerId?.category || "Labour",
        activityType: p.activityType || p.photoType || "MORNING_WORK",
        timeStr: p.timeStr || "Today",
        dateStr: p.dateStr || selectedDate,
        location: p.location,
      }))
      .filter((p: SitePhotoItem) => !!p.photoUrl);
  }, [controlData, selectedDate]);

  const morningPhotos = useMemo(() => {
    return allPhotos.filter(
      (p) => p.activityType === "MORNING_WORK" || p.activityType === "MORNING"
    );
  }, [allPhotos]);

  const eveningPhotos = useMemo(() => {
    return allPhotos.filter(
      (p) => p.activityType === "EVENING_WORK" || p.activityType === "EVENING"
    );
  }, [allPhotos]);

  const currentTabPhotos = activeTab === "MORNING" ? morningPhotos : eveningPhotos;

  const siteDisplayName = controlData?.site?.name || site?.name || "Site Details";
  const siteDisplayAddress = controlData?.site?.address || site?.location || "Nashik";

  const openInGoogleMaps = (location?: { latitude: number; longitude: number }) => {
    if (!location?.latitude || !location?.longitude) return;
    const { latitude, longitude } = location;
    const url = Platform.select({
      ios: `maps://app?daddr=${latitude},${longitude}`,
      android: `google.navigation:q=${latitude},${longitude}`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    });
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
    });
  };

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

      {/* 2. TAB SWITCHER: [ 🌅 MORNING ] / [ 🌆 EVENING ] */}
      <View
        style={[
          styles.tabSwitcherContainer,
          {
            backgroundColor: theme.backgroundDefault,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <Pressable
          onPress={() => {
            triggerHaptic();
            setActiveTab("MORNING");
          }}
          style={[
            styles.tabButton,
            activeTab === "MORNING"
              ? { borderBottomColor: "#F59E0B", borderBottomWidth: 3 }
              : { borderBottomColor: "transparent" },
          ]}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "MORNING"
                ? { color: "#F59E0B", fontWeight: "800" }
                : { color: theme.textSecondary },
            ]}
          >
            🌅 MORNING ({morningPhotos.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            triggerHaptic();
            setActiveTab("EVENING");
          }}
          style={[
            styles.tabButton,
            activeTab === "EVENING"
              ? { borderBottomColor: "#2563EB", borderBottomWidth: 3 }
              : { borderBottomColor: "transparent" },
          ]}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "EVENING"
                ? { color: "#2563EB", fontWeight: "800" }
                : { color: theme.textSecondary },
            ]}
          >
            🌆 EVENING ({eveningPhotos.length})
          </Text>
        </Pressable>
      </View>

      {/* 3. PHOTO GRID CONTENT */}
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
        {currentTabPhotos.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={{ fontSize: 40, marginBottom: 12 }}>
              {activeTab === "MORNING" ? "🌅" : "🌆"}
            </Text>
            <ThemedText style={styles.emptyTitle}>
              {activeTab === "MORNING"
                ? "No Morning Photos Uploaded"
                : "No Evening Photos Uploaded"}
            </ThemedText>
            <ThemedText style={styles.emptyDesc}>
              {activeTab === "MORNING"
                ? "When workers upload their morning work photo with GPS location, it will appear here."
                : "When workers upload their evening work completion photo with GPS location, it will appear here."}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {currentTabPhotos.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  triggerHaptic();
                  setSelectedPhotoModal(item);
                }}
                style={[
                  styles.photoCard,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                  },
                ]}
              >
                {/* Photo Thumbnail */}
                <View style={styles.photoThumbWrapper}>
                  <Image
                    source={{ uri: item.photoUrl }}
                    style={styles.photoThumb}
                    resizeMode="cover"
                  />
                  <View style={styles.photoExpandBadge}>
                    <Feather name="maximize-2" size={12} color="#FFFFFF" />
                  </View>
                </View>

                {/* Card Details */}
                <View style={styles.cardInfo}>
                  <ThemedText numberOfLines={1} style={styles.workerName}>
                    👷 {item.workerName}
                  </ThemedText>
                  <Text style={styles.workerRole} numberOfLines={1}>
                    {item.workerRole}
                  </Text>

                  <View style={styles.metaRow}>
                    <View style={styles.timeTag}>
                      <Feather name="clock" size={11} color="#64748B" />
                      <Text style={styles.timeText}>{item.timeStr}</Text>
                    </View>

                    {item.location?.latitude ? (
                      <View style={styles.gpsTag}>
                        <Feather name="map-pin" size={11} color="#10B981" />
                        <Text style={styles.gpsText}>GPS</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            ))}
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
          {/* Header */}
          <View
            style={[
              styles.modalHeaderBar,
              { paddingTop: Math.max(insets.top, 16) + 8 },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.modalWorkerTitle}>
                👷 {selectedPhotoModal?.workerName} ({selectedPhotoModal?.workerRole})
              </Text>
              <Text style={styles.modalPhotoType}>
                {selectedPhotoModal?.activityType === "MORNING_WORK"
                  ? "🌅 Morning Work Photo"
                  : "🌆 Evening Work Photo"}{" "}
                • {selectedPhotoModal?.timeStr}
              </Text>
            </View>

            <Pressable
              onPress={() => setSelectedPhotoModal(null)}
              style={styles.modalCloseBtn}
            >
              <Feather name="x" size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Full Photo */}
          {selectedPhotoModal?.photoUrl ? (
            <Image
              source={{ uri: selectedPhotoModal.photoUrl }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          ) : null}

          {/* Bottom GPS & Details Card */}
          <View
            style={[
              styles.modalFooterBar,
              { paddingBottom: Math.max(insets.bottom, 16) + 12 },
            ]}
          >
            <View style={styles.modalSiteInfoRow}>
              <Feather name="home" size={14} color="#94A3B8" />
              <Text style={styles.modalSiteText}>{siteDisplayName}</Text>
            </View>

            {selectedPhotoModal?.location?.latitude ? (
              <View style={styles.modalGpsRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Feather name="map-pin" size={13} color="#10B981" />
                    <Text style={styles.modalGpsCoords}>
                      {selectedPhotoModal.location.latitude.toFixed(6)},{" "}
                      {selectedPhotoModal.location.longitude.toFixed(6)}
                    </Text>
                  </View>
                  {selectedPhotoModal.location.address ? (
                    <Text style={styles.modalGpsAddress} numberOfLines={2}>
                      {selectedPhotoModal.location.address}
                    </Text>
                  ) : null}
                </View>

                {/* Open in Google Maps Button */}
                <Pressable
                  onPress={() => openInGoogleMaps(selectedPhotoModal.location)}
                  style={styles.openMapsBtn}
                >
                  <Feather name="navigation" size={14} color="#FFFFFF" />
                  <Text style={styles.openMapsBtnText}>Open Maps</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.noGpsText}>No GPS coordinates recorded.</Text>
            )}
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
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 6,
    borderRadius: BorderRadius.md,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
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
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  datePillText: {
    fontSize: 11,
  },
  tabSwitcherContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 16,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  photoCard: {
    width: "48%",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 4,
  },
  photoThumbWrapper: {
    width: "100%",
    height: 150,
    backgroundColor: "#1E293B",
    position: "relative",
  },
  photoThumb: {
    width: "100%",
    height: "100%",
  },
  photoExpandBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 4,
    borderRadius: 4,
  },
  cardInfo: {
    padding: 10,
  },
  workerName: {
    fontSize: 13,
    fontWeight: "800",
  },
  workerRole: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  timeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  timeText: {
    fontSize: 10,
    color: "#64748B",
  },
  gpsTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gpsText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#10B981",
  },
  emptyBox: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  emptyDesc: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "space-between",
  },
  modalHeaderBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  modalWorkerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  modalPhotoType: {
    color: "#CBD5E1",
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  modalImage: {
    flex: 1,
    width: "100%",
  },
  modalFooterBar: {
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  modalSiteInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  modalSiteText: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "600",
  },
  modalGpsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalGpsCoords: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "700",
  },
  modalGpsAddress: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 2,
  },
  openMapsBtn: {
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  openMapsBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  noGpsText: {
    color: "#94A3B8",
    fontSize: 12,
    fontStyle: "italic",
  },
});
