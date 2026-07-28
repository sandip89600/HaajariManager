import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Dimensions
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { storage, Site } from "@/utils/storage";

const FILTER_OPTIONS = ["All", "Planning", "Started", "In Progress", "Delayed", "Completed", "Archived"];
const SORT_OPTIONS = ["Newest", "Recently Updated", "Alphabetical", "Progress"];

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
  const navigation = useNavigation<any>();

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
    completedSites: 0
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search, Filter, Sort States
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [activeSort, setActiveSort] = useState("Recently Updated");

  // Modals
  const [showSortModal, setShowSortModal] = useState(false);
  const [deleteTargetSite, setDeleteTargetSite] = useState<Site | null>(null);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const loadData = async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) setIsLoading(true);
    try {
      // 1. Fetch dashboard stats
      const statsData = await storage.getSiteDashboardStats();
      setStats(statsData);

      // 2. Fetch sites list
      const queryStatus = activeFilter === "All" ? undefined : activeFilter;
      const sitesData = await storage.getSites({
        search,
        status: queryStatus,
        sortBy: activeSort
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
    }, [search, activeFilter, activeSort])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData(false);
  };

  const handleArchiveSite = async (site: Site) => {
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
          }
        }
      ]
    );
  };

  const handleDeleteSite = (site: Site) => {
    triggerHaptic();
    setDeleteTargetSite(site);
  };

  const confirmDeleteSite = async () => {
    if (!deleteTargetSite) return;
    try {
      const success = await storage.deleteSite(deleteTargetSite.id);
      if (success) {
        setSites(prev => prev.filter(s => s.id !== deleteTargetSite.id));
        setDeleteTargetSite(null);
        // Refresh stats
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
      case "Planning": return { text: isDark ? "#E2E8F0" : "#475569", bg: isDark ? "#334155" : "#E2E8F0" };
      case "Started": return { text: "#10B981", bg: "#10B98115" };
      case "In Progress": return { text: "#3B82F6", bg: "#3B82F615" };
      case "On Hold": return { text: "#F59E0B", bg: "#F59E0B15" };
      case "Delayed": return { text: "#EF4444", bg: "#EF444415" };
      case "Completed": return { text: "#10B981", bg: "#10B98125" };
      default: return { text: "#64748B", bg: "#64748B15" };
    }
  };

  // Site completion percentage helper
  const getProgressPercentage = (site: Site) => {
    if (site.status === "Completed") return 100;
    if (site.status === "Planning") return 0;
    if (site.status === "Started") return 15;
    if (site.status === "On Hold") return 40;
    if (site.status === "In Progress") return 65;
    if (site.status === "Delayed") return 50;
    return 0;
  };

  const renderSiteCard = ({ item }: { item: Site }) => {
    const statusColors = getStatusColors(item.status);
    const progress = getProgressPercentage(item);
    const dateStr = item.startDate ? new Date(item.startDate).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }) : "N/A";

    const supervisorName = typeof item.supervisor === "object" && item.supervisor 
      ? item.supervisor.name 
      : "Unassigned";

    return (
      <View style={[styles.siteCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.cardTitle}>{item.name}</ThemedText>
            <ThemedText style={styles.cardSubtitle}>{item.projectType}</ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColors.text }]} />
            <ThemedText style={[styles.statusText, { color: statusColors.text }]}>{item.status}</ThemedText>
          </View>
        </View>

        <View style={styles.cardInfoGrid}>
          <View style={styles.infoCol}>
            <ThemedText style={styles.infoLabel}>Address</ThemedText>
            <ThemedText style={styles.infoVal} numberOfLines={1}>{item.address}</ThemedText>
          </View>
          <View style={styles.infoCol}>
            <Feather name="user" size={12} color={theme.textSecondary} style={{ marginRight: 4, display: "none" }} />
            <ThemedText style={styles.infoLabel}>Supervisor</ThemedText>
            <ThemedText style={styles.infoVal} numberOfLines={1}>{supervisorName}</ThemedText>
          </View>
        </View>

        {/* Attendance stats */}
        <View style={styles.attendanceRow}>
          <View style={styles.attItem}>
            <ThemedText style={styles.attLabel}>Workers</ThemedText>
            <ThemedText style={styles.attVal}>Total</ThemedText>
          </View>
          <View style={styles.attItem}>
            <ThemedText style={[styles.attLabel, { color: "#10B981" }]}>Present</ThemedText>
            <ThemedText style={[styles.attVal, { color: "#10B981" }]}>Today</ThemedText>
          </View>
          <View style={styles.attItem}>
            <ThemedText style={[styles.attLabel, { color: "#EF4444" }]}>Absent</ThemedText>
            <ThemedText style={[styles.attVal, { color: "#EF4444" }]}>Today</ThemedText>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <ThemedText style={styles.progressLabel}>Completion Progress</ThemedText>
            <ThemedText style={styles.progressVal}>{progress}%</ThemedText>
          </View>
          <View style={[styles.progressBarBg, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.progressBarFill, { backgroundColor: theme.primary, width: `${progress}%` }]} />
          </View>
        </View>

        <View style={[styles.cardActions, { borderTopColor: theme.border, flexWrap: "wrap" }]}>
          <Pressable
            onPress={() => {
              triggerHaptic();
              navigation.navigate("SiteDetails", { siteId: item.id });
            }}
            style={[styles.actionBtn, { backgroundColor: theme.backgroundSecondary, minWidth: "30%" }]}
          >
            <Feather name="eye" size={13} color={theme.text} />
            <ThemedText style={styles.actionBtnText}>Open</ThemedText>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic();
              navigation.navigate("EditSite", { siteId: item.id });
            }}
            style={[styles.actionBtn, { backgroundColor: theme.backgroundSecondary, minWidth: "30%" }]}
          >
            <Feather name="edit-2" size={13} color={theme.text} />
            <ThemedText style={styles.actionBtnText}>Edit</ThemedText>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic();
              navigation.navigate("SiteDetailControl", { siteId: item.id, initialTab: "workers" });
            }}
            style={[styles.actionBtn, { backgroundColor: theme.backgroundSecondary, minWidth: "30%" }]}
          >
            <Feather name="users" size={13} color={theme.text} />
            <ThemedText style={styles.actionBtnText}>Workforce</ThemedText>
          </Pressable>

          {!item.isArchived && item.status !== "Completed" && (
            <Pressable
              onPress={() => handleArchiveSite(item)}
              style={[styles.actionBtn, { backgroundColor: theme.backgroundSecondary, minWidth: "30%" }]}
            >
              <Feather name="archive" size={13} color={theme.text} />
              <ThemedText style={styles.actionBtnText}>Archive</ThemedText>
            </Pressable>
          )}

          <Pressable
            onPress={() => handleDeleteSite(item)}
            style={[styles.actionBtn, { backgroundColor: isDark ? "#451A20" : "#FEE2E2", minWidth: "30%" }]}
          >
            <Feather name="trash-2" size={13} color="#EF4444" />
            <ThemedText style={[styles.actionBtnText, { color: "#EF4444" }]}>Delete</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) return null;
    
    const isFiltered = search || activeFilter !== "All";

    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconCircle, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="layers" size={36} color={theme.primary} />
        </View>
        <ThemedText style={styles.emptyTitle}>
          {isFiltered ? "No Search Results" : "No Construction Sites Yet"}
        </ThemedText>
        <ThemedText style={styles.emptyDesc}>
          {isFiltered 
            ? "Try resetting filter chips or typing a different search keyword."
            : "Create your first site to start managing attendance, workers, progress and reports."}
        </ThemedText>
        
        {isFiltered && (
          <Pressable
            onPress={() => {
              triggerHaptic();
              setSearch("");
              setActiveFilter("All");
            }}
            style={[styles.resetBtn, { backgroundColor: theme.primary }]}
          >
            <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>Reset Filters</ThemedText>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Top Header Row with Title */}
      <View style={[styles.header, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.headerSubtitle}>Haajari Manager</ThemedText>
          <ThemedText style={styles.headerTitle}>Site Control Center</ThemedText>
        </View>
        <Pressable
          onPress={() => {
            triggerHaptic();
            navigation.navigate("CreateSite");
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: theme.primary,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: BorderRadius.xs || 8,
            alignSelf: "center"
          }}
        >
          <Feather name="plus" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
          <ThemedText style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 13 }}>Create Site</ThemedText>
        </Pressable>
      </View>

      {/* Search and Sorting Bar */}
      <View style={styles.searchControls}>
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
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => {
            triggerHaptic();
            setShowSortModal(true);
          }}
          style={[styles.sortBtn, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
        >
          <Feather name="sliders" size={16} color={theme.text} />
        </Pressable>
      </View>

      {/* Filter Chip Toggles */}
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
                    backgroundColor: isActive ? theme.primary : theme.backgroundDefault,
                    borderColor: isActive ? theme.primary : theme.border
                  }
                ]}
              >
                <ThemedText style={[styles.filterChipText, { color: isActive ? "#FFFFFF" : theme.text }]}>
                  {opt}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Sites flat list */}
      {isLoading && !isRefreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={sites}
          renderItem={renderSiteCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
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

      {/* Sorting Sheet Modal */}
      <Modal visible={showSortModal} transparent animationType="fade" onRequestClose={() => setShowSortModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowSortModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={styles.modalTitle}>Sort By</ThemedText>
            {SORT_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => {
                  triggerHaptic();
                  setActiveSort(opt);
                  setShowSortModal(false);
                }}
                style={styles.modalOpt}
              >
                <ThemedText style={{ fontWeight: activeSort === opt ? "700" : "400", color: activeSort === opt ? theme.primary : theme.text }}>
                  {opt}
                </ThemedText>
                {activeSort === opt && <Feather name="check" size={16} color={theme.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Confirmation Delete Dialog Modal */}
      <Modal visible={deleteTargetSite !== null} transparent animationType="fade" onRequestClose={() => setDeleteTargetSite(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.dialogContent, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="alert-triangle" size={38} color="#EF4444" style={{ marginBottom: 12 }} />
            <ThemedText style={styles.dialogTitle}>Delete Site</ThemedText>
            <ThemedText style={styles.dialogDesc}>
              Are you sure you want to delete "{deleteTargetSite?.name}"? All associated attendance logs will remain stored but project associations will be unassigned.
            </ThemedText>
            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => setDeleteTargetSite(null)}
                style={[styles.dialogBtn, { backgroundColor: theme.backgroundSecondary }]}
              >
                <ThemedText style={{ fontWeight: "700", color: theme.text }}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={confirmDeleteSite}
                style={[styles.dialogBtn, { backgroundColor: "#EF4444" }]}
              >
                <ThemedText style={{ fontWeight: "700", color: "#FFFFFF" }}>Delete</ThemedText>
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
    flex: 1
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 54 : 16,
    paddingBottom: 14
  },
  headerSubtitle: {
    fontSize: 12,
    opacity: 0.6
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginTop: 2
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.xs
  },
  createBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800"
  },
  statsContainer: {
    marginBottom: 16
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    opacity: 0.8,
    paddingHorizontal: 16,
    marginBottom: 8
  },
  statsScroll: {
    paddingHorizontal: 16,
    gap: 10
  },
  statCard: {
    width: 110,
    padding: 12,
    borderRadius: BorderRadius.xs,
    borderWidth: 1
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800"
  },
  statLabel: {
    fontSize: 11,
    opacity: 0.7,
    marginTop: 4
  },
  searchControls: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 42,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    paddingHorizontal: 12
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0
  },
  sortBtn: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  filtersScrollContainer: {
    marginBottom: 14
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "700"
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  siteCard: {
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800"
  },
  cardSubtitle: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800"
  },
  cardInfoGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12
  },
  infoCol: {
    flex: 1
  },
  infoLabel: {
    fontSize: 10,
    opacity: 0.6,
    textTransform: "uppercase"
  },
  infoVal: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2
  },
  attendanceRow: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "rgba(0,0,0,0.02)",
    padding: 8,
    borderRadius: 6,
    marginBottom: 14
  },
  attItem: {
    flex: 1,
    alignItems: "center"
  },
  attLabel: {
    fontSize: 10,
    opacity: 0.6
  },
  attVal: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2
  },
  progressContainer: {
    marginBottom: 16
  },
  progressLabel: {
    fontSize: 11,
    opacity: 0.6
  },
  progressVal: {
    fontSize: 11,
    fontWeight: "700"
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden"
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 12
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 6
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: "700"
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    paddingHorizontal: 24
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: "center",
    opacity: 0.7,
    marginBottom: 20,
    lineHeight: 18
  },
  resetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: BorderRadius.xs
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  modalContent: {
    width: "100%",
    maxWidth: 300,
    borderRadius: BorderRadius.xs,
    padding: 20,
    gap: 4
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12
  },
  modalOpt: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12
  },
  dialogContent: {
    width: "100%",
    maxWidth: 320,
    borderRadius: BorderRadius.xs,
    padding: 20,
    alignItems: "center"
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 8
  },
  dialogDesc: {
    fontSize: 13,
    textAlign: "center",
    opacity: 0.8,
    marginBottom: 20,
    lineHeight: 18
  },
  dialogActions: {
    flexDirection: "row",
    gap: 12
  },
  dialogBtn: {
    flex: 1,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BorderRadius.xs
  }
});
