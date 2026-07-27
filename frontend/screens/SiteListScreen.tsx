import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Platform,
  RefreshControl
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { storage, Site } from "@/utils/storage";

const STATUS_OPTIONS = ["All", "Planning", "Started", "In Progress", "On Hold", "Delayed", "Completed", "Archived"];
const SORT_OPTIONS = ["Recently Updated", "Alphabetical", "Newest", "Oldest"];

export default function SiteListScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter, Search, Sort States
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedSort, setSelectedSort] = useState("Recently Updated");
  
  // Modals / Confirmation State
  const [showSortModal, setShowSortModal] = useState(false);
  const [deleteTargetSite, setDeleteTargetSite] = useState<Site | null>(null);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const fetchSites = async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) setIsLoading(true);
    try {
      const queryStatus = selectedStatus === "All" ? undefined : selectedStatus;
      const res = await storage.getSites({
        search,
        status: queryStatus,
        sortBy: selectedSort
      });
      setSites(res.sites || []);
    } catch (e: any) {
      console.warn("Failed to load sites", e);
      Alert.alert("Error", "Could not load sites. Please try again.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchSites(true);
    }, [search, selectedStatus, selectedSort])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchSites(false);
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
          style: "default",
          onPress: async () => {
            const success = await storage.archiveSite(site.id);
            if (success) {
              fetchSites(false);
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
      } else {
        Alert.alert("Error", "Failed to delete site");
      }
    } catch (e) {
      Alert.alert("Error", "Network or server failure");
    }
  };

  const getStatusColor = (status: string) => {
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

  const renderSiteCard = ({ item }: { item: Site }) => {
    const statusColors = getStatusColor(item.status);
    const dateStr = item.startDate ? new Date(item.startDate).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }) : "N/A";

    const supervisorName = typeof item.supervisor === "object" && item.supervisor 
      ? item.supervisor.name 
      : "No Supervisor Assigned";

    return (
      <View style={[styles.card, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
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

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Feather name="map-pin" size={14} color={theme.textSecondary} style={styles.detailIcon} />
            <ThemedText style={styles.detailText} numberOfLines={1}>{item.address}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <Feather name="user" size={14} color={theme.textSecondary} style={styles.detailIcon} />
            <ThemedText style={styles.detailText} numberOfLines={1}>Supervisor: {supervisorName}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <Feather name="calendar" size={14} color={theme.textSecondary} style={styles.detailIcon} />
            <ThemedText style={styles.detailText}>Start Date: {dateStr}</ThemedText>
          </View>
        </View>

        <View style={[styles.cardActions, { borderTopColor: theme.border }]}>
          <Pressable
            onPress={() => {
              triggerHaptic();
              navigation.navigate("SiteDetails", { siteId: item.id });
            }}
            style={[styles.actionBtn, { backgroundColor: theme.backgroundSecondary }]}
          >
            <Feather name="eye" size={14} color={theme.text} />
            <ThemedText style={styles.actionBtnText}>Open</ThemedText>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic();
              navigation.navigate("EditSite", { siteId: item.id });
            }}
            style={[styles.actionBtn, { backgroundColor: theme.backgroundSecondary }]}
          >
            <Feather name="edit-2" size={14} color={theme.text} />
            <ThemedText style={styles.actionBtnText}>Edit</ThemedText>
          </Pressable>

          {!item.isArchived && item.status !== "Completed" && (
            <Pressable
              onPress={() => handleArchiveSite(item)}
              style={[styles.actionBtn, { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="archive" size={14} color={theme.text} />
              <ThemedText style={styles.actionBtnText}>Archive</ThemedText>
            </Pressable>
          )}

          <Pressable
            onPress={() => handleDeleteSite(item)}
            style={[styles.actionBtn, { backgroundColor: isDark ? "#451A20" : "#FEE2E2" }]}
          >
            <Feather name="trash-2" size={14} color="#EF4444" />
            <ThemedText style={[styles.actionBtnText, { color: "#EF4444" }]}>Delete</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) return null;
    
    const isFiltered = search || selectedStatus !== "All";

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
            ? "Try adjustments to filter criteria or search keyword."
            : "Create your first site to start managing attendance, workers, progress and reports."}
        </ThemedText>
        {isFiltered ? (
          <Pressable
            onPress={() => {
              triggerHaptic();
              setSearch("");
              setSelectedStatus("All");
            }}
            style={[styles.resetBtn, { backgroundColor: theme.primary }]}
          >
            <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>Reset Filters</ThemedText>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => {
              triggerHaptic();
              navigation.navigate("CreateSite");
            }}
            style={[styles.resetBtn, { backgroundColor: theme.primary }]}
          >
            <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>Create Site</ThemedText>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Header bar */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Sites</ThemedText>
        </View>
        <Pressable
          onPress={() => {
            triggerHaptic();
            navigation.navigate("CreateSite");
          }}
          style={[styles.createBtn, { backgroundColor: theme.primary }]}
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Search and Sorting controls */}
      <View style={styles.searchControls}>
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <Feather name="search" size={18} color={theme.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search by site, client, location..."
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

      {/* Filter Status Chips */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {STATUS_OPTIONS.map((status) => {
            const isActive = selectedStatus === status;
            return (
              <Pressable
                key={status}
                onPress={() => {
                  triggerHaptic();
                  setSelectedStatus(status);
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
                  {status}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* FlatList container */}
      {isLoading && !isRefreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={sites}
          renderItem={renderSiteCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
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
            <ThemedText style={styles.modalTitle}>Sort Sites</ThemedText>
            {SORT_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => {
                  triggerHaptic();
                  setSelectedSort(opt);
                  setShowSortModal(false);
                }}
                style={styles.modalOpt}
              >
                <ThemedText style={{ fontWeight: selectedSort === opt ? "700" : "400", color: selectedSort === opt ? theme.primary : theme.text }}>
                  {opt}
                </ThemedText>
                {selectedSort === opt && <Feather name="check" size={16} color={theme.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Confirmation Dialog Modal */}
      <Modal visible={deleteTargetSite !== null} transparent animationType="fade" onRequestClose={() => setDeleteTargetSite(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.dialogContent, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="alert-triangle" size={40} color="#EF4444" style={{ marginBottom: 12 }} />
            <ThemedText style={styles.dialogTitle}>Delete Site</ThemedText>
            <ThemedText style={styles.dialogDesc}>
              Are you sure you want to delete "{deleteTargetSite?.name}"? All associated progress tracking records will be removed.
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
    paddingBottom: 12
  },
  backBtn: {
    padding: 6,
    marginRight: 8
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800"
  },
  createBtn: {
    padding: 10,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center"
  },
  searchControls: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    paddingHorizontal: 12
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0
  },
  sortBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  filterContainer: {
    marginBottom: 12
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
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
  card: {
    borderRadius: BorderRadius.sm,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800"
  },
  cardDetails: {
    gap: 6,
    marginBottom: 16
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  detailIcon: {
    marginRight: 8,
    opacity: 0.7
  },
  detailText: {
    fontSize: 13,
    opacity: 0.8
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
    paddingVertical: 60,
    paddingHorizontal: 24
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6
  },
  emptyDesc: {
    fontSize: 14,
    textAlign: "center",
    opacity: 0.7,
    marginBottom: 20
  },
  resetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    maxWidth: 320,
    borderRadius: BorderRadius.sm,
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
    maxWidth: 340,
    borderRadius: BorderRadius.sm,
    padding: 24,
    alignItems: "center"
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8
  },
  dialogDesc: {
    fontSize: 14,
    textAlign: "center",
    opacity: 0.8,
    marginBottom: 20,
    lineHeight: 20
  },
  dialogActions: {
    flexDirection: "row",
    gap: 12
  },
  dialogBtn: {
    flex: 1,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BorderRadius.xs
  }
});
