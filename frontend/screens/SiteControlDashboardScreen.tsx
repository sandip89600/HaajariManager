import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  DeviceEventEmitter,
  Linking,
  Image,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { storage, siteActivityStorage, Site } from "@/utils/storage";
import { useLanguage } from "@/hooks/useLanguage";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";

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

// Wireframe 1 Filter Pills: All, Active, Delay, Complete
const FILTER_OPTIONS = [
  { id: "All", label: "All" },
  { id: "Active", label: "Active" },
  { id: "Delay", label: "Delay" },
  { id: "Complete", label: "Complete" },
];

export interface ContractorSiteCard {
  id: string;
  name: string;
  address: string;
  projectType: string;
  status: string;
  statusBadge: "Active" | "Completed" | "Attention Required" | "Delayed" | string;
  totalWorkers: number;
  presentWorkers: number;
  updatesCount: number;
  openIssuesCount: number;
  morningSubmitted: number;
  morningTotal: number;
  eveningSubmitted: number;
  eveningTotal: number;
  supervisorName?: string;
  supervisorPhone?: string;
  lastUpdateAt?: string;
}

export interface ContractorOverviewMetrics {
  totalSites: number;
  activeSites: number;
  totalWorkers: number;
  workersPresent: number;
  totalUpdates: number;
  totalOpenIssues: number;
}

export default function SiteControlDashboardScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  // Data States
  const [contractorName, setContractorName] = useState<string>("Contractor");
  const [sites, setSites] = useState<ContractorSiteCard[]>([]);
  const [metrics, setMetrics] = useState<ContractorOverviewMetrics>({
    totalSites: 0,
    activeSites: 0,
    totalWorkers: 0,
    workersPresent: 0,
    totalUpdates: 0,
    totalOpenIssues: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Search & Filter States
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  // Three-Dot Menu & Delete Target
  const [menuTargetSite, setMenuTargetSite] = useState<ContractorSiteCard | null>(null);
  const [deleteTargetSite, setDeleteTargetSite] = useState<ContractorSiteCard | null>(null);

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
  };

  const loadData = async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) setIsLoading(true);
    setLoadError(null);
    try {
      // 1. Get authenticated contractor display name directly
      const auth = await storage.getAuth();
      if (auth?.userId) {
        const u = await storage.getUserById(auth.userId);
        if (u?.name) setContractorName(u.name);
        else if (auth.username) setContractorName(auth.username);
      }
      const profile = await storage.getProfile();
      if (profile?.name && profile.name !== "Admin") {
        setContractorName(profile.name);
      }

      // 2. Fetch rich Site Control data from backend
      const result = await siteActivityStorage.getContractorSitesControl();
      if (result && result.success) {
        if (result.contractorName) setContractorName(result.contractorName);
        if (result.metrics) setMetrics(result.metrics);
        if (result.sites) {
          const mapped = result.sites.map((s: any) => ({
            ...s,
            supervisorPhone: s.supervisor?.phone || s.supervisorPhone,
            supervisorName: s.supervisor?.name || s.supervisorName,
          }));
          setSites(mapped);
        }
      } else {
        // Fallback to legacy dashboard stats & sites
        const statsData = await storage.getSiteDashboardStats();
        setMetrics({
          totalSites: statsData.totalSites || 0,
          activeSites: statsData.activeSites || 0,
          totalWorkers: statsData.totalWorkers || 0,
          workersPresent: statsData.workersPresent || 0,
          totalUpdates: 0,
          totalOpenIssues: 0,
        });

        const legacySites = await storage.getSites({ search });
        const adapted = (legacySites.sites || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          address: s.address || "Location not set",
          projectType: s.projectType || "Row house",
          status: s.status || "Active",
          statusBadge: s.status === "Completed" ? "Completed" : s.status === "Delayed" ? "Delayed" : "Active",
          totalWorkers: s.totalWorkers || 0,
          presentWorkers: s.presentWorkers || 0,
          updatesCount: 0,
          openIssuesCount: 0,
          morningSubmitted: 0,
          morningTotal: s.totalWorkers || 0,
          eveningSubmitted: 0,
          eveningTotal: s.totalWorkers || 0,
          supervisorName: s.supervisor?.name,
          supervisorPhone: s.supervisor?.phone,
        }));
        setSites(adapted);
      }
    } catch (e: any) {
      console.warn("Failed to load contractor site control data", e);
      setLoadError(e?.message || "Failed to load sites. Please check connection and retry.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData(true);
    }, [])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("refreshData", () => {
      loadData(false);
    });
    return () => sub.remove();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData(false);
  };

  const handleArchiveSite = async (site: ContractorSiteCard) => {
    setMenuTargetSite(null);
    triggerHaptic();
    Alert.alert(
      "Archive Site",
      `Are you sure you want to archive "${site.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          onPress: async () => {
            const success = await storage.archiveSite(site.id);
            if (success) {
              loadData(false);
            } else {
              Alert.alert("Error", "Failed to archive site");
            }
          },
        },
      ]
    );
  };

  const handleDeleteSite = (site: ContractorSiteCard) => {
    setMenuTargetSite(null);
    triggerHaptic();
    setDeleteTargetSite(site);
  };

  const confirmDeleteSite = async () => {
    if (!deleteTargetSite) return;
    try {
      const success = await storage.deleteSite(deleteTargetSite.id);
      if (success) {
        setSites((prev) => prev.filter((s) => s.id !== deleteTargetSite.id));
        setDeleteTargetSite(null);
        loadData(false);
      } else {
        Alert.alert("Error", "Failed to delete site");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to delete site. Please try again.");
    }
  };

  // Filtered sites based on search and status pills
  const filteredSites = sites.filter((item) => {
    const matchesSearch =
      search.trim() === "" ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.address.toLowerCase().includes(search.toLowerCase()) ||
      item.projectType.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === "All") return true;
    if (activeFilter === "Active")
      return (
        item.statusBadge === "Active" ||
        item.status === "Active" ||
        item.status === "Started" ||
        item.status === "In Progress"
      );
    if (activeFilter === "Delay")
      return item.status === "Delayed" || item.statusBadge === "Delayed";
    if (activeFilter === "Complete")
      return item.status === "Completed" || item.statusBadge === "Completed";
    return true;
  });

  const getStatusBadgeStyle = (badge: string) => {
    if (badge === "Attention Required" || badge === "Delayed") {
      return {
        bg: TOKENS.errorLight,
        text: TOKENS.error,
        dot: TOKENS.error,
        label: badge,
      };
    }
    if (badge === "Completed") {
      return {
        bg: "rgba(152, 162, 179, 0.15)",
        text: TOKENS.textMuted,
        dot: TOKENS.textMuted,
        label: "Completed",
      };
    }
    return {
      bg: TOKENS.successLight,
      text: TOKENS.success,
      dot: TOKENS.success,
      label: "Active",
    };
  };

  // Render Site Card Matching Wireframe 1
  const renderSiteCard = ({ item }: { item: ContractorSiteCard }) => {
    const badgeStyle = getStatusBadgeStyle(item.statusBadge);
    const hasAttention = item.openIssuesCount > 0;

    return (
      <View
        style={[
          styles.siteCard,
          hasAttention && { borderColor: "rgba(240, 68, 56, 0.45)" },
        ]}
      >
        {/* Row 1: Header - Logo, Site Name, Active status, Project Type, 3-dots (Wireframe 1) */}
        <View style={styles.siteCardHeader}>
          <View style={styles.siteTitleRow}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.siteMiniLogo}
            />
            <Text style={styles.siteTitle} numberOfLines={1}>
              {item.name}
            </Text>
          </View>

          <View style={styles.headerRightCol}>
            {/* Status Pill */}
            <View style={[styles.statusPill, { backgroundColor: badgeStyle.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: badgeStyle.dot }]} />
              <Text style={[styles.statusPillText, { color: badgeStyle.text }]}>
                {item.statusBadge || "Active"}
              </Text>
            </View>

            {/* Project Type Badge */}
            <View style={styles.projectTypeBadge}>
              <Text style={styles.projectTypeText} numberOfLines={1}>
                {item.projectType || "Row house"}
              </Text>
            </View>

            {/* Three Dot Action Button */}
            <Pressable
              onPress={() => {
                triggerHaptic();
                setMenuTargetSite(item);
              }}
              hitSlop={12}
              style={styles.threeDotBtn}
            >
              <Feather name="more-vertical" size={18} color={TOKENS.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* Row 2: Location Address with Pin (Wireframe 1) */}
        <View style={styles.siteAddressRow}>
          <Feather name="map-pin" size={13} color={TOKENS.textMuted} />
          <Text style={styles.siteAddressText} numberOfLines={1}>
            {item.address}
          </Text>
        </View>

        {/* Row 3: Metrics Strip: [ 0/0 present ] | [ 0 photos ] | [ ⚠️ 0 issues ] */}
        <View style={styles.siteMetricsStrip}>
          <View style={styles.metricCell}>
            <Text style={styles.metricCellValue}>
              {item.presentWorkers}/{item.totalWorkers}
            </Text>
            <Text style={styles.metricCellLabel}>present</Text>
          </View>

          <View style={styles.cellDivider} />

          <View style={styles.metricCell}>
            <Text style={styles.metricCellValue}>
              {item.updatesCount ?? 0}
            </Text>
            <Text style={styles.metricCellLabel}>photos</Text>
          </View>

          <View style={styles.cellDivider} />

          <View style={styles.metricCell}>
            <Text
              style={[
                styles.metricCellValue,
                item.openIssuesCount > 0 && { color: TOKENS.error },
              ]}
            >
              {item.openIssuesCount > 0 ? "⚠️ " : ""}{item.openIssuesCount}
            </Text>
            <Text
              style={[
                styles.metricCellLabel,
                item.openIssuesCount > 0 && { color: TOKENS.error, fontWeight: "700" },
              ]}
            >
              issues
            </Text>
          </View>
        </View>

        {/* Row 4: Morning & Evening Shift Boxes: [ morning 0/0 ] [ evening 0/0 ] (Wireframe 1) */}
        <View style={styles.photoShiftsRow}>
          <View style={styles.shiftBadge}>
            <Text style={styles.shiftBadgeText}>
              morning{" "}
              <Text style={{ fontWeight: "700", color: TOKENS.text }}>
                {item.morningSubmitted}/{item.morningTotal}
              </Text>
            </Text>
          </View>

          <View style={styles.shiftBadge}>
            <Text style={styles.shiftBadgeText}>
              evening{" "}
              <Text style={{ fontWeight: "700", color: TOKENS.text }}>
                {item.eveningSubmitted}/{item.eveningTotal}
              </Text>
            </Text>
          </View>
        </View>

        {/* Row 5: Manage Site Button: [ manage site -> ] (Wireframe 1) */}
        <Pressable
          onPress={() => {
            triggerHaptic();
            navigation.navigate("SiteDetailControl", {
              siteId: item.id,
              siteName: item.name,
              initialTab: "Overview",
              presentWorkers: item.presentWorkers,
              totalWorkers: item.totalWorkers,
            });
          }}
          style={({ pressed }) => [
            styles.manageSiteBtn,
            { opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={styles.manageSiteBtnText}>manage site  →</Text>
        </Pressable>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyStateContainer}>
        <View style={styles.emptyIconCircle}>
          <Text style={{ fontSize: 32 }}>🏗️</Text>
        </View>
        <Text style={styles.emptyStateTitle}>No Sites Found</Text>
        <Text style={styles.emptyStateSub}>
          {search
            ? `No sites match "${search}". Try adjusting your filters.`
            : "Get started by registering your first construction site project."}
        </Text>
        {!search && (
          <Pressable
            onPress={() => {
              triggerHaptic();
              navigation.navigate("CreateSite");
            }}
            style={styles.emptyAddBtn}
          >
            <Feather name="plus" size={18} color="#FFFFFF" />
            <Text style={styles.emptyAddBtnText}>Create Your First Site</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <ThemedView
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 16),
          backgroundColor: TOKENS.bg,
        },
      ]}
    >
      {/* ── 1. TOP HEADER (Logo + Site Control + Contractor Name + "+ Add Site") ── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.headerTitleRow}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.headerLogo}
            />
            <Text style={styles.headerTitle}>Site Control</Text>
          </View>
          {/* Authenticated Contractor Name below title (Wireframe 1) */}
          <Text style={styles.contractorNameSub} numberOfLines={1}>
            {contractorName}
          </Text>
        </View>

        {/* Prominent "+ Add Site" Button (Wireframe 1) */}
        <Pressable
          onPress={() => {
            triggerHaptic();
            navigation.navigate("CreateSite");
          }}
          style={({ pressed }) => [
            styles.addSiteHeaderBtn,
            { opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Feather name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.addSiteHeaderBtnText}>Add site</Text>
        </Pressable>
      </View>

      {/* Network Error Banner with Retry */}
      {loadError && (
        <View style={styles.errorBannerBox}>
          <Feather name="alert-circle" size={16} color={TOKENS.error} />
          <Text style={styles.errorBannerText} numberOfLines={2}>
            {loadError}
          </Text>
          <Pressable onPress={() => loadData(true)} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* ── 2. 4 SUMMARY CARDS IN A RESPONSIVE 2x2 GRID (Wireframe 1) ── */}
      <View style={styles.summaryGrid}>
        {/* Row 1: Active Site & Worker Present */}
        <View style={styles.summaryGridRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryVal}>{metrics.activeSites}</Text>
            <Text style={styles.summaryLabel}>Active site</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={[styles.summaryVal, { color: TOKENS.success }]}>
              {metrics.workersPresent}/{metrics.totalWorkers}
            </Text>
            <Text style={styles.summaryLabel}>Worker present</Text>
          </View>
        </View>

        {/* Row 2: Photos Receive & Issues */}
        <View style={styles.summaryGridRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryVal}>{metrics.totalUpdates}</Text>
            <Text style={styles.summaryLabel}>Photos receive</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text
              style={[
                styles.summaryVal,
                metrics.totalOpenIssues > 0 && { color: TOKENS.error },
              ]}
            >
              {metrics.totalOpenIssues}
            </Text>
            <Text
              style={[
                styles.summaryLabel,
                metrics.totalOpenIssues > 0 && { color: TOKENS.error, fontWeight: "700" },
              ]}
            >
              Issues
            </Text>
          </View>
        </View>
      </View>

      {/* ── 3. SEARCH BAR (Wireframe 1) ── */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={TOKENS.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="search bar"
            placeholderTextColor={TOKENS.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={10}>
              <Feather name="x" size={16} color={TOKENS.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* ── 4. FILTER PILLS: All, Active, Delay, Complete (Wireframe 1) ── */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {FILTER_OPTIONS.map((filter) => {
            const isSelected = activeFilter === filter.id;
            return (
              <Pressable
                key={filter.id}
                onPress={() => {
                  triggerHaptic();
                  setActiveFilter(filter.id);
                }}
                style={[
                  styles.filterPill,
                  isSelected
                    ? {
                        backgroundColor: TOKENS.primary,
                        borderColor: TOKENS.primary,
                      }
                    : {
                        backgroundColor: TOKENS.surface,
                        borderColor: TOKENS.border,
                      },
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    {
                      color: isSelected ? "#FFFFFF" : TOKENS.textSecondary,
                      fontWeight: isSelected ? "700" : "500",
                    },
                  ]}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── 5. SITES LIST (Wireframe 1 Cards) ── */}
      <FlatList
        data={filteredSites}
        keyExtractor={(item) => item.id}
        renderItem={renderSiteCard}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 80 },
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
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 12, paddingHorizontal: 16 }}>
              <SkeletonLoader width="100%" height={180} borderRadius={16} />
              <SkeletonLoader width="100%" height={180} borderRadius={16} />
            </View>
          ) : (
            renderEmptyState
          )
        }
      />

      {/* THREE-DOT ACTIONS MODAL */}
      <Modal
        visible={!!menuTargetSite}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuTargetSite(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setMenuTargetSite(null)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalSheetHeader}>
              <Text style={styles.modalSheetTitle} numberOfLines={1}>
                {menuTargetSite?.name}
              </Text>
              <Pressable
                onPress={() => setMenuTargetSite(null)}
                hitSlop={12}
              >
                <Feather name="x" size={18} color={TOKENS.textMuted} />
              </Pressable>
            </View>

            <Pressable
              style={styles.modalSheetRow}
              onPress={() => {
                const s = menuTargetSite;
                setMenuTargetSite(null);
                if (s) {
                  navigation.navigate("SiteDetailControl", {
                    siteId: s.id,
                    siteName: s.name,
                    initialTab: "Overview",
                    presentWorkers: s.presentWorkers,
                    totalWorkers: s.totalWorkers,
                  });
                }
              }}
            >
              <MaterialCommunityIcons
                name="view-dashboard-outline"
                size={20}
                color={TOKENS.primary}
              />
              <Text style={styles.modalSheetRowText}>Manage Site</Text>
            </Pressable>

            <Pressable
              style={styles.modalSheetRow}
              onPress={() => {
                const s = menuTargetSite;
                setMenuTargetSite(null);
                if (s) {
                  navigation.navigate("SiteDetailControl", {
                    siteId: s.id,
                    siteName: s.name,
                    initialTab: "Workforce",
                    presentWorkers: s.presentWorkers,
                    totalWorkers: s.totalWorkers,
                  });
                }
              }}
            >
              <Feather name="users" size={18} color={TOKENS.text} />
              <Text style={styles.modalSheetRowText}>Assign Workers</Text>
            </Pressable>

            <Pressable
              style={styles.modalSheetRow}
              onPress={() => menuTargetSite && handleArchiveSite(menuTargetSite)}
            >
              <Feather name="archive" size={18} color={TOKENS.textSecondary} />
              <Text style={styles.modalSheetRowText}>Archive Site</Text>
            </Pressable>

            <Pressable
              style={[styles.modalSheetRow, { borderBottomWidth: 0 }]}
              onPress={() => menuTargetSite && handleDeleteSite(menuTargetSite)}
            >
              <Feather name="trash-2" size={18} color={TOKENS.error} />
              <Text style={[styles.modalSheetRowText, { color: TOKENS.error }]}>
                Delete Site
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        visible={!!deleteTargetSite}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteTargetSite(null)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.confirmDeleteCard}>
            <View style={styles.deleteIconCircle}>
              <Feather name="trash-2" size={24} color={TOKENS.error} />
            </View>
            <Text style={styles.confirmDeleteTitle}>Delete Site Project?</Text>
            <Text style={styles.confirmDeleteSub}>
              Are you sure you want to delete{" "}
              <Text style={{ fontWeight: "700", color: TOKENS.text }}>
                "{deleteTargetSite?.name}"
              </Text>
              ? This action will remove the site from active control.
            </Text>

            <View style={styles.confirmDeleteButtonsRow}>
              <Pressable
                onPress={() => setDeleteTargetSite(null)}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmDeleteSite}
                style={styles.confirmDeleteBtn}
              >
                <Text style={styles.confirmDeleteBtnText}>Delete</Text>
              </Pressable>
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
    backgroundColor: TOKENS.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerLogo: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: TOKENS.text,
    letterSpacing: -0.3,
  },
  contractorNameSub: {
    fontSize: 13,
    color: TOKENS.textSecondary,
    fontWeight: "600",
    marginTop: 2,
  },
  addSiteHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: TOKENS.primary,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 12,
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  addSiteHeaderBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  errorBannerBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TOKENS.errorLight,
    borderWidth: 1,
    borderColor: "rgba(240, 68, 56, 0.4)",
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    color: TOKENS.error,
    fontSize: 12,
    fontWeight: "600",
  },
  retryBtn: {
    backgroundColor: TOKENS.error,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  summaryGrid: {
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  summaryGridRow: {
    flexDirection: "row",
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 14,
    padding: 14,
    justifyContent: "center",
  },
  summaryVal: {
    fontSize: 24,
    fontWeight: "900",
    color: TOKENS.text,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: TOKENS.textSecondary,
  },
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: TOKENS.text,
    height: "100%",
  },
  filterSection: {
    marginBottom: 12,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 14,
  },
  siteCard: {
    backgroundColor: TOKENS.surface,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  siteCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  siteTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  siteMiniLogo: {
    width: 22,
    height: 22,
    borderRadius: 4,
  },
  siteTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: TOKENS.text,
    flex: 1,
  },
  headerRightCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  projectTypeBadge: {
    backgroundColor: TOKENS.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  projectTypeText: {
    fontSize: 10,
    fontWeight: "700",
    color: TOKENS.textSecondary,
  },
  threeDotBtn: {
    padding: 4,
  },
  siteAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  siteAddressText: {
    fontSize: 12,
    color: TOKENS.textMuted,
    flex: 1,
  },
  siteMetricsStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TOKENS.bg,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  metricCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  metricCellValue: {
    fontSize: 13,
    fontWeight: "800",
    color: TOKENS.text,
  },
  metricCellLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: TOKENS.textMuted,
  },
  cellDivider: {
    width: 1,
    height: 20,
    backgroundColor: TOKENS.border,
  },
  photoShiftsRow: {
    flexDirection: "row",
    gap: 8,
  },
  shiftBadge: {
    flex: 1,
    backgroundColor: TOKENS.bg,
    borderWidth: 1,
    borderColor: TOKENS.border,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  shiftBadgeText: {
    fontSize: 12,
    color: TOKENS.textSecondary,
  },
  manageSiteBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: TOKENS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  manageSiteBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  emptyStateContainer: {
    alignItems: "center",
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: TOKENS.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: TOKENS.text,
    marginBottom: 6,
  },
  emptyStateSub: {
    fontSize: 13,
    color: TOKENS.textMuted,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: TOKENS.primary,
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 12,
  },
  emptyAddBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: TOKENS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: TOKENS.border,
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
    fontSize: 16,
    fontWeight: "800",
    color: TOKENS.text,
    flex: 1,
  },
  modalSheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  modalSheetRowText: {
    fontSize: 14,
    fontWeight: "600",
    color: TOKENS.text,
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  confirmDeleteCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: TOKENS.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  deleteIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: TOKENS.errorLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: TOKENS.error,
  },
  confirmDeleteTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: TOKENS.text,
    marginBottom: 8,
  },
  confirmDeleteSub: {
    fontSize: 13,
    color: TOKENS.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  confirmDeleteButtonsRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    backgroundColor: TOKENS.surfaceLight,
    borderWidth: 1,
    borderColor: TOKENS.borderLight,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtnText: {
    color: TOKENS.textSecondary,
    fontSize: 14,
    fontWeight: "700",
  },
  confirmDeleteBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    backgroundColor: TOKENS.error,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmDeleteBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
