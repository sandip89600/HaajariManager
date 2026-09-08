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
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius } from "@/constants/theme";
import { storage, Site } from "@/utils/storage";
import { useLanguage } from "@/hooks/useLanguage";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";

const FILTER_OPTIONS = ["All", "Planning", "Started", "In Progress", "Delayed", "Completed"];

interface DashboardStats {
  totalSites: number;
  activeSites: number;
  workersPresent: number;
  workersAbsent: number;
  totalWorkers: number;
  sitesInProgress: number;
  delayedSites: number;
  completedSites: number;
}

export default function SiteControlDashboardScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  // Data States
  const [sites, setSites] = useState<Site[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalSites: 0,
    activeSites: 0,
    workersPresent: 0,
    workersAbsent: 0,
    totalWorkers: 0,
    sitesInProgress: 0,
    delayedSites: 0,
    completedSites: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search & Filter States
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  // Three-Dot Menu State
  const [menuTargetSite, setMenuTargetSite] = useState<Site | null>(null);
  const [deleteTargetSite, setDeleteTargetSite] = useState<Site | null>(null);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const loadData = async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) setIsLoading(true);
    try {
      const statsData = await storage.getSiteDashboardStats();
      setStats(statsData);

      const queryStatus = activeFilter === "All" ? undefined : activeFilter;
      const sitesData = await storage.getSites({
        search,
        status: queryStatus,
        sortBy: "Recently Updated",
      });
      setSites(sitesData.sites || []);
    } catch (e) {
      console.warn("Failed to load dashboard data", e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData(true);
    }, [search, activeFilter])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData(false);
  };

  const handleArchiveSite = async (site: Site) => {
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

  const handleDeleteSite = (site: Site) => {
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
        const statsData = await storage.getSiteDashboardStats();
        setStats(statsData);
      } else {
        Alert.alert("Error", "Failed to delete site");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to delete site. Please try again.");
    }
  };

  const getStatusColors = (status: string) => {
    switch (status) {
      case "Planning":
        return { text: isDark ? "#CBD5E1" : "#475569", bg: isDark ? "#334155" : "#E2E8F0" };
      case "Started":
        return { text: "#16A34A", bg: "rgba(22,163,74,0.12)" };
      case "In Progress":
      case "Active":
        return { text: "#2563EB", bg: "rgba(37,99,235,0.12)" };
      case "On Hold":
        return { text: "#D97706", bg: "rgba(217,119,6,0.12)" };
      case "Delayed":
        return { text: "#DC2626", bg: "rgba(220,38,38,0.12)" };
      case "Completed":
        return { text: "#16A34A", bg: "rgba(22,163,74,0.16)" };
      default:
        return { text: "#64748B", bg: "rgba(100,116,139,0.12)" };
    }
  };

  const getProgressPercentage = (site: Site) => {
    if (site.status === "Completed") return 100;
    if (site.status === "Planning") return 0;
    if (site.status === "Started") return 15;
    if (site.status === "On Hold") return 40;
    if (site.status === "In Progress") return 65;
    if (site.status === "Delayed") return 50;
    return site.currentProgress || 65;
  };

  const renderSiteCard = ({ item }: { item: Site }) => {
    const statusColors = getStatusColors(item.status || "Active");
    const progress = getProgressPercentage(item);

    const totalWorkers = (item as any).totalWorkers || 8;
    const presentWorkers = (item as any).presentWorkers || 7;
    const morningPhoto = (item as any).morningPhoto || true;
    const eveningPhoto = (item as any).eveningPhoto || true;

    return (
      <View style={[styles.siteOverviewCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
        {/* Top Header: Title, Description, and Three-Dot Menu (⋮) */}
        <View style={styles.cardTopRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <ThemedText style={styles.cardSiteName} numberOfLines={1}>
              🏠 {item.name}
            </ThemedText>
            <ThemedText style={styles.cardSiteType} numberOfLines={1}>
              {item.projectType || item.description || "Duplex Row House"}
            </ThemedText>
          </View>

          <Pressable
            onPress={() => {
              triggerHaptic();
              setMenuTargetSite(item);
            }}
            hitSlop={12}
            style={styles.threeDotBtn}
          >
            <Feather name="more-vertical" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>

        {/* Row 2: Status Badge & Progress Badge */}
        <View style={styles.statusProgressRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusDot, { color: statusColors.text }]}>●</Text>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {item.status || "Active"}
            </Text>
          </View>
          <Text style={[styles.progressPctBadgeText, { color: theme.primary }]}>{progress}% Complete</Text>
        </View>

        {/* Row 3: TODAY'S WORK Section */}
        <View style={[styles.todaysWorkBox, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC", borderColor: theme.border }]}>
          <ThemedText style={styles.todaysWorkHeaderTitle}>TODAY'S WORK</ThemedText>
          <View style={styles.workDetailRow}>
            <Text style={styles.workTypeTitle}>🧱 {item.currentWork || "Brick Work"}</Text>
            <Text style={styles.workProgressVal}>Progress: {item.currentProgress || progress}%</Text>
          </View>
          <View style={[styles.progressBarBg, { backgroundColor: isDark ? "#334155" : "#E2E8F0" }]}>
            <View style={[styles.progressBarFill, { width: `${item.currentProgress || progress}%`, backgroundColor: theme.primary }]} />
          </View>
        </View>

        {/* Row 4: Workforce & Photo Status Row */}
        <View style={styles.workforcePhotoRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 15 }}>👷</Text>
            <Text style={{ fontSize: 13, fontWeight: "800", color: theme.text }}>{totalWorkers} Workers</Text>
            <Text style={{ color: "#94A3B8", fontSize: 12 }}>•</Text>
            <Text style={{ color: "#16A34A", fontSize: 13, fontWeight: "800" }}>✓ {presentWorkers} Present</Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: morningPhoto ? "#16A34A" : "#64748B" }}>
              📷 Morning {morningPhoto ? "✓" : "—"}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: "800", color: eveningPhoto ? "#16A34A" : "#64748B" }}>
              Evening {eveningPhoto ? "✓" : "—"}
            </Text>
          </View>
        </View>

        {/* Row 5: ONLY ONE MAIN ACTION BUTTON: [ Open Site ] */}
        <Pressable
          onPress={() => {
            triggerHaptic();
            navigation.navigate("SiteDetails", { siteId: item.id });
          }}
          style={[styles.openSiteMainBtn, { backgroundColor: theme.primary }]}
        >
          <Text style={styles.openSiteMainBtnText}>Open Site</Text>
          <Feather name="arrow-right" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconCircle, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="layers" size={36} color={theme.primary} />
        </View>
        <ThemedText style={styles.emptyTitle}>No Sites Yet</ThemedText>
        <ThemedText style={styles.emptyDesc}>
          Create your first construction site to start tracking work, workers and daily progress.
        </ThemedText>

        <Pressable
          onPress={() => {
            triggerHaptic();
            navigation.navigate("CreateSite");
          }}
          style={[styles.createSiteEmptyBtn, { backgroundColor: theme.primary }]}
        >
          <Feather name="plus" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 14 }}>+ Create Site</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* 1. HEADER SECTION */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 12, 28) }]}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.headerTitle}>Site Control Center</ThemedText>
        </View>
        <Pressable
          onPress={() => {
            triggerHaptic();
            navigation.navigate("CreateSite");
          }}
          style={[styles.topCreateSiteBtn, { backgroundColor: theme.primary }]}
        >
          <Feather name="plus" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.topCreateSiteBtnText}>Create Site</Text>
        </Pressable>
      </View>

      {/* 2. FULL-WIDTH SEARCH BAR */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <Feather name="search" size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search by site, client, supervisor..."
            placeholderTextColor={theme.textSecondary}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: theme.text }]}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={10}>
              <Feather name="x" size={16} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* 3. HORIZONTALLY SCROLLABLE FILTERS */}
      <View style={styles.filtersScrollContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {FILTER_OPTIONS.map((opt) => {
            const isActive = activeFilter === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => {
                  triggerHaptic();
                  setActiveFilter(opt);
                }}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? theme.primary : (isDark ? "#1E293B" : "#F1F5F9"),
                    borderColor: isActive ? theme.primary : (isDark ? "#334155" : "#E2E8F0"),
                  },
                ]}
              >
                <Text style={[styles.filterChipText, { color: isActive ? "#FFFFFF" : (isDark ? "#CBD5E1" : "#475569") }]}>
                  {opt}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. SKELETON LOADING OR SITE CARDS LIST */}
      {isLoading && !isRefreshing ? (
        <View style={{ paddingHorizontal: 16, gap: 16, paddingTop: 8 }}>
          <SkeletonLoader width="100%" height={220} borderRadius={16} />
          <SkeletonLoader width="100%" height={220} borderRadius={16} />
          <SkeletonLoader width="100%" height={220} borderRadius={16} />
        </View>
      ) : (
        <FlatList
          data={sites}
          renderItem={renderSiteCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 4 }}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[theme.primary]} />
          }
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS === "android"}
        />
      )}

      {/* 5. THREE-DOT ACTION MENU MODAL (Edit Site, Manage Workforce, Archive Site, Delete Site) */}
      <Modal visible={menuTargetSite !== null} transparent animationType="fade" onRequestClose={() => setMenuTargetSite(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setMenuTargetSite(null)}>
          <View style={[styles.menuSheetContent, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <View style={styles.menuHeader}>
              <ThemedText style={styles.menuHeaderTitle}>{menuTargetSite?.name}</ThemedText>
              <Pressable onPress={() => setMenuTargetSite(null)} hitSlop={10}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                if (menuTargetSite) {
                  const targetId = menuTargetSite.id;
                  setMenuTargetSite(null);
                  navigation.navigate("EditSite", { siteId: targetId });
                }
              }}
              style={styles.menuOptionBtn}
            >
              <Feather name="edit-2" size={18} color="#2563EB" />
              <Text style={[styles.menuOptionText, { color: theme.text }]}>Edit Site</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (menuTargetSite) {
                  const targetId = menuTargetSite.id;
                  setMenuTargetSite(null);
                  navigation.navigate("SiteDetailControl", { siteId: targetId, initialTab: "workers" });
                }
              }}
              style={styles.menuOptionBtn}
            >
              <Feather name="users" size={18} color="#2563EB" />
              <Text style={[styles.menuOptionText, { color: theme.text }]}>Manage Workforce</Text>
            </Pressable>

            {menuTargetSite && !menuTargetSite.isArchived && menuTargetSite.status !== "Completed" && (
              <Pressable
                onPress={() => menuTargetSite && handleArchiveSite(menuTargetSite)}
                style={styles.menuOptionBtn}
              >
                <Feather name="archive" size={18} color="#D97706" />
                <Text style={[styles.menuOptionText, { color: theme.text }]}>Archive Site</Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => menuTargetSite && handleDeleteSite(menuTargetSite)}
              style={[styles.menuOptionBtn, { borderBottomWidth: 0 }]}
            >
              <Feather name="trash-2" size={18} color="#DC2626" />
              <Text style={[styles.menuOptionText, { color: "#DC2626" }]}>Delete Site</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* 6. CONFIRM DELETE DIALOG MODAL */}
      <Modal visible={deleteTargetSite !== null} transparent animationType="fade" onRequestClose={() => setDeleteTargetSite(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.dialogContent, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="alert-triangle" size={38} color="#DC2626" style={{ marginBottom: 12 }} />
            <ThemedText style={styles.dialogTitle}>Delete Site?</ThemedText>
            <ThemedText style={styles.dialogDesc}>
              Are you sure you want to delete "{deleteTargetSite?.name}"? All associated attendance records and daily logs will remain safely stored.
            </ThemedText>
            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => setDeleteTargetSite(null)}
                style={[styles.dialogBtn, { backgroundColor: isDark ? "#334155" : "#E2E8F0" }]}
              >
                <Text style={{ fontWeight: "700", color: theme.text }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmDeleteSite}
                style={[styles.dialogBtn, { backgroundColor: "#DC2626" }]}
              >
                <Text style={{ fontWeight: "800", color: "#FFFFFF" }}>Delete</Text>
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
  },
  topCreateSiteBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  topCreateSiteBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  /* Full Width Search Bar */
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },

  /* Filters Horizontal Scroll */
  filtersScrollContainer: {
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "700",
  },

  /* Site Overview Card */
  siteOverviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardSiteName: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 2,
  },
  cardSiteType: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  threeDotBtn: {
    padding: 6,
    marginTop: -2,
  },
  statusProgressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 10,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    fontSize: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  progressPctBadgeText: {
    fontSize: 14,
    fontWeight: "900",
  },
  todaysWorkBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginVertical: 6,
  },
  todaysWorkHeaderTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  workDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  workTypeTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  workProgressVal: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 8,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  workforcePhotoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 10,
  },
  openSiteMainBtn: {
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
  },
  openSiteMainBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  /* Empty State */
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    marginTop: 40,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDesc: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  createSiteEmptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },

  /* Three Dot Sheet Menu Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  menuSheetContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  menuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  menuHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  menuOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  menuOptionText: {
    fontSize: 15,
    fontWeight: "700",
  },

  /* Dialog Modal */
  dialogContent: {
    width: "85%",
    alignSelf: "center",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  dialogDesc: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  dialogActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  dialogBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
});
