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
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius } from "@/constants/theme";
import { storage, siteActivityStorage, Site } from "@/utils/storage";
import { useLanguage } from "@/hooks/useLanguage";
import { SkeletonLoader } from "@/components/ui/SkeletonLoader";

const FILTER_OPTIONS = [
  "All",
  "Active",
  "Attention Required",
  "Delayed",
  "Completed",
];

interface ContractorSiteCard {
  id: string;
  name: string;
  address: string;
  projectType: string;
  status: string;
  statusBadge: "Active" | "Completed" | "Attention Required" | string;
  totalWorkers: number;
  presentWorkers: number;
  updatesCount: number;
  openIssuesCount: number;
  morningSubmitted: number;
  morningTotal: number;
  eveningSubmitted: number;
  eveningTotal: number;
  supervisorName?: string;
  lastUpdateAt?: string;
}

interface ContractorOverviewMetrics {
  totalSites: number;
  activeSites: number;
  totalWorkers: number;
  workersPresent: number;
  totalUpdates: number;
  totalOpenIssues: number;
}

export default function SiteControlDashboardScreen() {
  const { theme, isDark } = useTheme();
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

  // Search & Filter States
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  // Three-Dot Menu State
  const [menuTargetSite, setMenuTargetSite] = useState<ContractorSiteCard | null>(null);
  const [deleteTargetSite, setDeleteTargetSite] = useState<ContractorSiteCard | null>(null);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Greeting helper
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  // Formatted date string (e.g. Wednesday, Sep 17, 2026)
  const getFormattedDate = () => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const loadData = async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) setIsLoading(true);
    try {
      // 1. Fetch rich Site Control data from backend
      const result = await siteActivityStorage.getContractorSitesControl();
      if (result && result.success) {
        setContractorName(result.contractorName || "Contractor");
        if (result.metrics) setMetrics(result.metrics);
        if (result.sites) setSites(result.sites);
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
          address: s.address || "Nashik",
          projectType: s.projectType || "Residential Project",
          status: s.status || "Active",
          statusBadge: s.status === "Completed" ? "Completed" : "Active",
          totalWorkers: s.totalWorkers || 0,
          presentWorkers: s.presentWorkers || 0,
          updatesCount: 0,
          openIssuesCount: 0,
          morningSubmitted: 0,
          morningTotal: s.totalWorkers || 0,
          eveningSubmitted: 0,
          eveningTotal: s.totalWorkers || 0,
          supervisorName: s.supervisor?.name,
        }));
        setSites(adapted);
      }
    } catch (e) {
      console.warn("Failed to load contractor site control data", e);
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
    if (activeFilter === "Active") return item.statusBadge === "Active" || item.status === "Active" || item.status === "Started" || item.status === "In Progress";
    if (activeFilter === "Attention Required") return item.statusBadge === "Attention Required" || item.openIssuesCount > 0;
    if (activeFilter === "Delayed") return item.status === "Delayed";
    if (activeFilter === "Completed") return item.status === "Completed" || item.statusBadge === "Completed";
    return true;
  });

  const getStatusBadgeStyle = (badge: string) => {
    if (badge === "Attention Required") {
      return {
        bg: isDark ? "rgba(239, 68, 68, 0.2)" : "#FEE2E2",
        text: "#DC2626",
        dot: "#DC2626",
        label: "Attention Required",
      };
    }
    if (badge === "Completed") {
      return {
        bg: isDark ? "rgba(100, 116, 139, 0.2)" : "#F1F5F9",
        text: "#64748B",
        dot: "#64748B",
        label: "Completed",
      };
    }
    return {
      bg: isDark ? "rgba(16, 185, 129, 0.18)" : "#DCFCE7",
      text: "#16A34A",
      dot: "#16A34A",
      label: "Active",
    };
  };

  const renderSiteCard = ({ item }: { item: ContractorSiteCard }) => {
    const badgeStyle = getStatusBadgeStyle(item.statusBadge);
    const hasAttention = item.statusBadge === "Attention Required" || item.openIssuesCount > 0;

    return (
      <Pressable
        onPress={() => {
          triggerHaptic();
          navigation.navigate("SiteDetailControl", {
            siteId: item.id,
            siteName: item.name,
            initialTab: "updates",
          });
        }}
        style={({ pressed }) => [
          styles.siteRow,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: hasAttention ? (isDark ? "rgba(239, 68, 68, 0.4)" : "#FCA5A5") : theme.border,
            opacity: pressed ? 0.96 : 1,
            transform: [{ scale: pressed ? 0.995 : 1 }],
          },
        ]}
      >
        {/* Top Header of the Site Row */}
        <View style={styles.siteRowHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 16 }}>🏗️</Text>
              <ThemedText style={styles.siteRowTitle} numberOfLines={1}>
                {item.name}
              </ThemedText>
            </View>
            <ThemedText style={styles.siteRowSubtitle} numberOfLines={1}>
              📍 {item.address} {item.projectType ? `• ${item.projectType}` : ""}
            </ThemedText>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {/* Status Pill */}
            <View style={[styles.statusPill, { backgroundColor: badgeStyle.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: badgeStyle.dot }]} />
              <Text style={[styles.statusPillText, { color: badgeStyle.text }]}>
                {badgeStyle.label}
              </Text>
            </View>

            {/* Three Dot Action Button */}
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                triggerHaptic();
                setMenuTargetSite(item);
              }}
              hitSlop={12}
              style={styles.threeDotBtn}
            >
              <Feather name="more-vertical" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* Attention Banner if open issues */}
        {hasAttention ? (
          <View
            style={[
              styles.attentionBanner,
              {
                backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEF2F2",
                borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "#FECACA",
              },
            ]}
          >
            <Feather name="alert-triangle" size={13} color="#DC2626" />
            <Text style={styles.attentionBannerText}>
              {item.openIssuesCount > 0
                ? `${item.openIssuesCount} Open issue${item.openIssuesCount > 1 ? "s" : ""} require attention`
                : "Attention required on this site"}
            </Text>
          </View>
        ) : null}

        {/* Real-time Metric Indicators Strip */}
        <View
          style={[
            styles.siteMetricsStrip,
            {
              backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
              borderColor: theme.border,
            },
          ]}
        >
          {/* Workforce */}
          <View style={styles.metricCell}>
            <Text style={styles.metricCellIcon}>👷</Text>
            <View>
              <Text style={[styles.metricCellValue, { color: theme.text }]}>
                {item.presentWorkers}/{item.totalWorkers}
              </Text>
              <Text style={styles.metricCellLabel}>PRESENT</Text>
            </View>
          </View>

          <View style={[styles.cellDivider, { backgroundColor: theme.border }]} />

          {/* Updates */}
          <View style={styles.metricCell}>
            <Text style={styles.metricCellIcon}>📸</Text>
            <View>
              <Text style={[styles.metricCellValue, { color: theme.text }]}>
                {item.updatesCount}
              </Text>
              <Text style={styles.metricCellLabel}>UPDATES</Text>
            </View>
          </View>

          <View style={[styles.cellDivider, { backgroundColor: theme.border }]} />

          {/* Issues */}
          <View style={styles.metricCell}>
            <Text style={styles.metricCellIcon}>⚠️</Text>
            <View>
              <Text
                style={[
                  styles.metricCellValue,
                  { color: item.openIssuesCount > 0 ? "#DC2626" : theme.text },
                ]}
              >
                {item.openIssuesCount}
              </Text>
              <Text
                style={[
                  styles.metricCellLabel,
                  item.openIssuesCount > 0 ? { color: "#DC2626", fontWeight: "700" } : {},
                ]}
              >
                ISSUES
              </Text>
            </View>
          </View>
        </View>

        {/* Morning & Evening Update Badges Footer */}
        <View style={styles.siteFooterRow}>
          <View style={styles.progressTagsContainer}>
            <View
              style={[
                styles.shiftBadge,
                {
                  backgroundColor:
                    item.morningSubmitted > 0 && item.morningSubmitted >= item.totalWorkers && item.totalWorkers > 0
                      ? isDark
                        ? "rgba(16, 185, 129, 0.15)"
                        : "#DCFCE7"
                      : isDark
                      ? "#1E293B"
                      : "#F1F5F9",
                },
              ]}
            >
              <Text style={styles.shiftBadgeEmoji}>🌅</Text>
              <Text style={[styles.shiftBadgeText, { color: theme.textSecondary }]}>
                Morning: <Text style={{ fontWeight: "700", color: item.morningSubmitted >= item.totalWorkers && item.totalWorkers > 0 ? "#16A34A" : theme.text }}>{item.morningSubmitted}/{item.morningTotal}</Text>
              </Text>
            </View>

            <View
              style={[
                styles.shiftBadge,
                {
                  backgroundColor:
                    item.eveningSubmitted > 0 && item.eveningSubmitted >= item.totalWorkers && item.totalWorkers > 0
                      ? isDark
                        ? "rgba(16, 185, 129, 0.15)"
                        : "#DCFCE7"
                      : isDark
                      ? "#1E293B"
                      : "#F1F5F9",
                },
              ]}
            >
              <Text style={styles.shiftBadgeEmoji}>🌆</Text>
              <Text style={[styles.shiftBadgeText, { color: theme.textSecondary }]}>
                Evening: <Text style={{ fontWeight: "700", color: item.eveningSubmitted >= item.totalWorkers && item.totalWorkers > 0 ? "#16A34A" : theme.text }}>{item.eveningSubmitted}/{item.eveningTotal}</Text>
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={[styles.viewSiteLinkText, { color: theme.primary }]}>Command</Text>
            <Feather name="chevron-right" size={15} color={theme.primary} />
          </View>
        </View>
      </Pressable>
    );
  };

  const renderEmptyState = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyStateContainer}>
        <View
          style={[
            styles.emptyIconCircle,
            { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" },
          ]}
        >
          <Text style={{ fontSize: 32 }}>🏗️</Text>
        </View>
        <ThemedText style={styles.emptyStateTitle}>No Sites Found</ThemedText>
        <ThemedText style={styles.emptyStateSub}>
          {search
            ? `No sites match "${search}". Try adjusting your filters.`
            : "Get started by creating your first construction site project."}
        </ThemedText>
        {!search && (
          <Pressable
            onPress={() => {
              triggerHaptic();
              navigation.navigate("CreateSite");
            }}
            style={[styles.emptyAddBtn, { backgroundColor: theme.primary }]}
          >
            <Feather name="plus" size={16} color="#FFFFFF" />
            <Text style={styles.emptyAddBtnText}>Add First Site</Text>
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
          paddingTop: Math.max(insets.top, 12),
          backgroundColor: theme.backgroundRoot,
        },
      ]}
    >
      {/* 1. TOP COMMAND HEADER */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 20 }}>🏗️</Text>
            <ThemedText style={styles.headerTitle}>Site Control</ThemedText>
          </View>
          <ThemedText style={styles.headerSubtitle}>
            {getGreeting()}, {contractorName} • {getFormattedDate()}
          </ThemedText>
        </View>

        <Pressable
          onPress={() => {
            triggerHaptic();
            navigation.navigate("CreateSite");
          }}
          style={[styles.addSiteHeaderBtn, { backgroundColor: theme.primary }]}
        >
          <Feather name="plus" size={16} color="#FFFFFF" />
          <Text style={styles.addSiteHeaderBtnText}>New Site</Text>
        </Pressable>
      </View>

      {/* 2. UNIFIED COMMAND CENTER STATS STRIP (No multiple bulky cards) */}
      <View
        style={[
          styles.commandCenterStrip,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: theme.border,
          },
        ]}
      >
        {/* Active Sites */}
        <View style={styles.stripCol}>
          <Text style={[styles.stripVal, { color: theme.text }]}>
            {metrics.activeSites}
          </Text>
          <Text style={styles.stripLabel}>ACTIVE</Text>
        </View>

        <View style={[styles.stripDivider, { backgroundColor: theme.border }]} />

        {/* Workers Present */}
        <View style={styles.stripCol}>
          <Text style={[styles.stripVal, { color: "#16A34A" }]}>
            {metrics.workersPresent}
            <Text style={{ fontSize: 11, color: theme.textSecondary, fontWeight: "600" }}>
              /{metrics.totalWorkers}
            </Text>
          </Text>
          <Text style={styles.stripLabel}>PRESENT</Text>
        </View>

        <View style={[styles.stripDivider, { backgroundColor: theme.border }]} />

        {/* Updates Today */}
        <View style={styles.stripCol}>
          <Text style={[styles.stripVal, { color: theme.text }]}>
            {metrics.totalUpdates}
          </Text>
          <Text style={styles.stripLabel}>UPDATES</Text>
        </View>

        <View style={[styles.stripDivider, { backgroundColor: theme.border }]} />

        {/* Open Issues */}
        <View style={styles.stripCol}>
          <Text
            style={[
              styles.stripVal,
              { color: metrics.totalOpenIssues > 0 ? "#DC2626" : theme.text },
            ]}
          >
            {metrics.totalOpenIssues}
          </Text>
          <Text
            style={[
              styles.stripLabel,
              metrics.totalOpenIssues > 0 ? { color: "#DC2626", fontWeight: "700" } : {},
            ]}
          >
            ISSUES
          </Text>
        </View>
      </View>

      {/* 3. COMPACT SEARCH BAR */}
      <View style={styles.searchSection}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
        >
          <Feather name="search" size={16} color={theme.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search sites by name or location..."
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={10}>
              <Feather name="x" size={15} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* 4. COMPACT HORIZONTAL FILTER PILLS */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {FILTER_OPTIONS.map((filter) => {
            const isSelected = activeFilter === filter;
            return (
              <Pressable
                key={filter}
                onPress={() => {
                  triggerHaptic();
                  setActiveFilter(filter);
                }}
                style={[
                  styles.filterPill,
                  isSelected
                    ? { backgroundColor: theme.primary, borderColor: theme.primary }
                    : {
                        backgroundColor: theme.backgroundDefault,
                        borderColor: theme.border,
                      },
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    isSelected
                      ? { color: "#FFFFFF", fontWeight: "700" }
                      : { color: theme.textSecondary },
                  ]}
                >
                  {filter}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 5. HIGH-DENSITY SITE ROWS LIST */}
      {isLoading && !isRefreshing ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <SkeletonLoader width="100%" height={150} style={{ borderRadius: 12, marginBottom: 12 }} />
          <SkeletonLoader width="100%" height={150} style={{ borderRadius: 12, marginBottom: 12 }} />
          <SkeletonLoader width="100%" height={150} style={{ borderRadius: 12, marginBottom: 12 }} />
        </View>
      ) : (
        <FlatList
          data={filteredSites}
          keyExtractor={(item) => item.id}
          renderItem={renderSiteCard}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 110,
            paddingTop: 2,
          }}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[theme.primary]}
            />
          }
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS === "android"}
        />
      )}

      {/* 6. THREE-DOT ACTION MENU MODAL */}
      <Modal
        visible={menuTargetSite !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuTargetSite(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setMenuTargetSite(null)}
        >
          <View
            style={[
              styles.menuSheetContent,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.menuHeader}>
              <ThemedText style={styles.menuHeaderTitle} numberOfLines={1}>
                {menuTargetSite?.name}
              </ThemedText>
              <Pressable onPress={() => setMenuTargetSite(null)} hitSlop={10}>
                <Feather name="x" size={18} color={theme.textSecondary} />
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
              <Feather name="edit-2" size={16} color="#2563EB" />
              <Text style={[styles.menuOptionText, { color: theme.text }]}>
                Edit Site Details
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (menuTargetSite) {
                  const targetId = menuTargetSite.id;
                  setMenuTargetSite(null);
                  navigation.navigate("SiteDetailControl", {
                    siteId: targetId,
                    initialTab: "workers",
                  });
                }
              }}
              style={styles.menuOptionBtn}
            >
              <Feather name="users" size={16} color="#2563EB" />
              <Text style={[styles.menuOptionText, { color: theme.text }]}>
                Manage Workforce
              </Text>
            </Pressable>

            {menuTargetSite && menuTargetSite.status !== "Completed" && (
              <Pressable
                onPress={() =>
                  menuTargetSite && handleArchiveSite(menuTargetSite)
                }
                style={styles.menuOptionBtn}
              >
                <Feather name="archive" size={16} color="#D97706" />
                <Text style={[styles.menuOptionText, { color: theme.text }]}>
                  Archive Site
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => menuTargetSite && handleDeleteSite(menuTargetSite)}
              style={[styles.menuOptionBtn, { borderBottomWidth: 0 }]}
            >
              <Feather name="trash-2" size={16} color="#DC2626" />
              <Text style={[styles.menuOptionText, { color: "#DC2626" }]}>
                Delete Site
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* 7. CONFIRM DELETE DIALOG MODAL */}
      <Modal
        visible={deleteTargetSite !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteTargetSite(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.dialogContent,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <Feather
              name="alert-triangle"
              size={36}
              color="#DC2626"
              style={{ marginBottom: 10 }}
            />
            <ThemedText style={styles.dialogTitle}>Delete Site?</ThemedText>
            <ThemedText style={styles.dialogDesc}>
              Are you sure you want to delete "{deleteTargetSite?.name}"? All
              associated attendance records and daily logs will remain safely
              stored.
            </ThemedText>
            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => setDeleteTargetSite(null)}
                style={[
                  styles.dialogBtn,
                  { backgroundColor: isDark ? "#334155" : "#E2E8F0" },
                ]}
              >
                <Text style={{ fontWeight: "700", color: theme.text, fontSize: 13 }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={confirmDeleteSite}
                style={[styles.dialogBtn, { backgroundColor: "#DC2626" }]}
              >
                <Text style={{ fontWeight: "700", color: "#FFFFFF", fontSize: 13 }}>
                  Delete
                </Text>
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
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  addSiteHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: BorderRadius.md,
  },
  addSiteHeaderBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  // 2. UNIFIED COMMAND CENTER STATS STRIP
  commandCenterStrip: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: 10,
  },
  stripCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stripVal: {
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 21,
  },
  stripLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    marginTop: 2,
    letterSpacing: 0.4,
  },
  stripDivider: {
    width: 1,
    height: 26,
  },

  // Search Section
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },

  // Filter Section
  filterSection: {
    marginBottom: 10,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // High-Density Site Row
  siteRow: {
    padding: 13,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: 10,
  },
  siteRowHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  siteRowTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  siteRowSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  threeDotBtn: {
    padding: 3,
  },

  // Status Indicator
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // Attention Banner
  attentionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 8,
  },
  attentionBannerText: {
    fontSize: 11,
    color: "#DC2626",
    fontWeight: "700",
    flex: 1,
  },

  // Site Metrics Strip
  siteMetricsStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 8,
  },
  metricCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metricCellIcon: {
    fontSize: 14,
  },
  metricCellValue: {
    fontSize: 13,
    fontWeight: "800",
  },
  metricCellLabel: {
    fontSize: 9,
    color: "#64748B",
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  cellDivider: {
    width: 1,
    height: 18,
  },

  // Footer / Shift Badges
  siteFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressTagsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  shiftBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  shiftBadgeEmoji: {
    fontSize: 11,
  },
  shiftBadgeText: {
    fontSize: 11,
  },
  viewSiteLinkText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Empty State
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  emptyStateSub: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.md,
  },
  emptyAddBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  menuSheetContent: {
    width: "100%",
    maxWidth: 320,
    borderRadius: BorderRadius.lg,
    padding: 14,
    borderWidth: 1,
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(100,116,139,0.2)",
    marginBottom: 6,
  },
  menuHeaderTitle: {
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  menuOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(100,116,139,0.1)",
  },
  menuOptionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  dialogContent: {
    width: "100%",
    maxWidth: 320,
    borderRadius: BorderRadius.lg,
    padding: 20,
    alignItems: "center",
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  dialogDesc: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  dialogActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  dialogBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
