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

    return (
      <View
        style={[
          styles.siteCard,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: item.statusBadge === "Attention Required" ? "#FCA5A5" : theme.border,
          },
        ]}
      >
        {/* Card Header Row: Site Name & Options Menu */}
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <ThemedText style={styles.cardSiteName} numberOfLines={1}>
                🏗️ {item.name}
              </ThemedText>
            </View>
            <ThemedText style={styles.cardSiteLocation} numberOfLines={1}>
              📍 {item.address} {item.projectType ? `• ${item.projectType}` : ""}
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

        {/* Status Indicator Badge Row */}
        <View style={styles.statusRow}>
          <View style={[styles.statusPill, { backgroundColor: badgeStyle.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: badgeStyle.dot }]} />
            <Text style={[styles.statusPillText, { color: badgeStyle.text }]}>
              {badgeStyle.label}
            </Text>
          </View>

          {item.supervisorName ? (
            <ThemedText style={styles.supervisorText} numberOfLines={1}>
              👤 {item.supervisorName}
            </ThemedText>
          ) : null}
        </View>

        {/* Real-Time Metrics Chips Grid */}
        <View
          style={[
            styles.metricsGrid,
            {
              backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
              borderColor: theme.border,
            },
          ]}
        >
          {/* Workforce Metric */}
          <View style={styles.metricItem}>
            <Text style={styles.metricItemIcon}>👷</Text>
            <View>
              <Text style={[styles.metricItemValue, { color: theme.text }]}>
                {item.presentWorkers} / {item.totalWorkers}
              </Text>
              <Text style={styles.metricItemLabel}>Present</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />

          {/* Updates Metric */}
          <View style={styles.metricItem}>
            <Text style={styles.metricItemIcon}>📸</Text>
            <View>
              <Text style={[styles.metricItemValue, { color: theme.text }]}>
                {item.updatesCount}
              </Text>
              <Text style={styles.metricItemLabel}>Updates</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />

          {/* Issues Metric */}
          <View style={styles.metricItem}>
            <Text style={styles.metricItemIcon}>⚠️</Text>
            <View>
              <Text
                style={[
                  styles.metricItemValue,
                  { color: item.openIssuesCount > 0 ? "#DC2626" : theme.text },
                ]}
              >
                {item.openIssuesCount}
              </Text>
              <Text style={styles.metricItemLabel}>Issues</Text>
            </View>
          </View>
        </View>

        {/* Morning & Evening Work Updates Progress Pills */}
        <View style={styles.workProgressRow}>
          <View
            style={[
              styles.workProgressPill,
              {
                backgroundColor:
                  item.morningSubmitted > 0 && item.morningSubmitted >= item.totalWorkers && item.totalWorkers > 0
                    ? isDark
                      ? "rgba(16, 185, 129, 0.15)"
                      : "#DCFCE7"
                    : isDark
                    ? "#1E293B"
                    : "#F1F5F9",
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={styles.workProgressEmoji}>🌅</Text>
            <Text style={[styles.workProgressLabel, { color: theme.textSecondary }]}>Morning:</Text>
            <Text
              style={[
                styles.workProgressValue,
                {
                  color:
                    item.morningSubmitted >= item.totalWorkers && item.totalWorkers > 0
                      ? "#16A34A"
                      : theme.text,
                },
              ]}
            >
              {item.morningSubmitted}/{item.morningTotal}
            </Text>
            {item.morningSubmitted >= item.totalWorkers && item.totalWorkers > 0 ? (
              <Feather name="check-circle" size={14} color="#16A34A" />
            ) : null}
          </View>

          <View
            style={[
              styles.workProgressPill,
              {
                backgroundColor:
                  item.eveningSubmitted > 0 && item.eveningSubmitted >= item.totalWorkers && item.totalWorkers > 0
                    ? isDark
                      ? "rgba(16, 185, 129, 0.15)"
                      : "#DCFCE7"
                    : isDark
                    ? "#1E293B"
                    : "#F1F5F9",
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={styles.workProgressEmoji}>🌆</Text>
            <Text style={[styles.workProgressLabel, { color: theme.textSecondary }]}>Evening:</Text>
            <Text
              style={[
                styles.workProgressValue,
                {
                  color:
                    item.eveningSubmitted >= item.totalWorkers && item.totalWorkers > 0
                      ? "#16A34A"
                      : theme.text,
                },
              ]}
            >
              {item.eveningSubmitted}/{item.eveningTotal}
            </Text>
            {item.eveningSubmitted >= item.totalWorkers && item.totalWorkers > 0 ? (
              <Feather name="check-circle" size={14} color="#16A34A" />
            ) : null}
          </View>
        </View>

        {/* Primary Single Action: [ VIEW SITE ] */}
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
            styles.viewSiteBtn,
            {
              backgroundColor: theme.primary,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            },
          ]}
        >
          <Text style={styles.viewSiteBtnText}>VIEW SITE</Text>
          <Feather name="arrow-right" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
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
          <Text style={{ fontSize: 36 }}>🏗️</Text>
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
            <Feather name="plus" size={18} color="#FFFFFF" />
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
      {/* 1. TOP HEADER */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 24 }}>🏗️</Text>
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
          <Feather name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.addSiteHeaderBtnText}>New Site</Text>
        </Pressable>
      </View>

      {/* 2. KPI SUMMARY METRIC CARDS (Active Sites, Workforce, Updates, Issues) */}
      <View style={styles.kpiContainer}>
        {/* Active Sites */}
        <View
          style={[
            styles.kpiCard,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.kpiTopRow}>
            <Text style={styles.kpiEmoji}>🏗️</Text>
            <Text style={[styles.kpiValue, { color: theme.text }]}>
              {metrics.activeSites}
            </Text>
          </View>
          <Text style={styles.kpiLabel}>Active Sites</Text>
        </View>

        {/* Workforce */}
        <View
          style={[
            styles.kpiCard,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.kpiTopRow}>
            <Text style={styles.kpiEmoji}>👷</Text>
            <Text style={[styles.kpiValue, { color: "#16A34A" }]}>
              {metrics.workersPresent}
              <Text style={{ fontSize: 13, color: theme.textSecondary }}>
                /{metrics.totalWorkers}
              </Text>
            </Text>
          </View>
          <Text style={styles.kpiLabel}>Workers Present</Text>
        </View>

        {/* Updates */}
        <View
          style={[
            styles.kpiCard,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.kpiTopRow}>
            <Text style={styles.kpiEmoji}>📸</Text>
            <Text style={[styles.kpiValue, { color: theme.text }]}>
              {metrics.totalUpdates}
            </Text>
          </View>
          <Text style={styles.kpiLabel}>Updates Today</Text>
        </View>

        {/* Issues */}
        <View
          style={[
            styles.kpiCard,
            {
              backgroundColor: metrics.totalOpenIssues > 0 && !isDark ? "#FEF2F2" : theme.backgroundDefault,
              borderColor: metrics.totalOpenIssues > 0 ? "#FCA5A5" : theme.border,
            },
          ]}
        >
          <View style={styles.kpiTopRow}>
            <Text style={styles.kpiEmoji}>⚠️</Text>
            <Text
              style={[
                styles.kpiValue,
                { color: metrics.totalOpenIssues > 0 ? "#DC2626" : theme.text },
              ]}
            >
              {metrics.totalOpenIssues}
            </Text>
          </View>
          <Text
            style={[
              styles.kpiLabel,
              metrics.totalOpenIssues > 0 ? { color: "#DC2626", fontWeight: "700" } : {},
            ]}
          >
            Open Issues
          </Text>
        </View>
      </View>

      {/* 3. SEARCH BAR */}
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
          <Feather name="search" size={18} color={theme.textSecondary} />
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
              <Feather name="x" size={16} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* 4. HORIZONTAL FILTER PILLS */}
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

      {/* 5. SITE CARDS LIST */}
      {isLoading && !isRefreshing ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <SkeletonLoader width="100%" height={210} style={{ borderRadius: 16, marginBottom: 16 }} />
          <SkeletonLoader width="100%" height={210} style={{ borderRadius: 16, marginBottom: 16 }} />
          <SkeletonLoader width="100%" height={210} style={{ borderRadius: 16, marginBottom: 16 }} />
        </View>
      ) : (
        <FlatList
          data={filteredSites}
          keyExtractor={(item) => item.id}
          renderItem={renderSiteCard}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 120,
            paddingTop: 4,
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
              <Feather name="users" size={18} color="#2563EB" />
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
                <Feather name="archive" size={18} color="#D97706" />
                <Text style={[styles.menuOptionText, { color: theme.text }]}>
                  Archive Site
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => menuTargetSite && handleDeleteSite(menuTargetSite)}
              style={[styles.menuOptionBtn, { borderBottomWidth: 0 }]}
            >
              <Feather name="trash-2" size={18} color="#DC2626" />
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
              size={38}
              color="#DC2626"
              style={{ marginBottom: 12 }}
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
                <Text style={{ fontWeight: "700", color: theme.text }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={confirmDeleteSite}
                style={[styles.dialogBtn, { backgroundColor: "#DC2626" }]}
              >
                <Text style={{ fontWeight: "700", color: "#FFFFFF" }}>
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
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  addSiteHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.lg,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  addSiteHeaderBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // KPI Grid
  kpiContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    minWidth: "47%",
    padding: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  kpiTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  kpiEmoji: {
    fontSize: 18,
  },
  kpiValue: {
    fontSize: 19,
    fontWeight: "800",
  },
  kpiLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },

  // Search Section
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },

  // Filter Section
  filterSection: {
    marginBottom: 12,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Site Cards
  siteCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardSiteName: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  cardSiteLocation: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  threeDotBtn: {
    padding: 4,
    marginTop: -2,
  },

  // Status Indicator
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  supervisorText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: 12,
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metricItemIcon: {
    fontSize: 16,
  },
  metricItemValue: {
    fontSize: 14,
    fontWeight: "800",
  },
  metricItemLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  metricDivider: {
    width: 1,
    height: 24,
  },

  // Work Progress
  workProgressRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  workProgressPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  workProgressEmoji: {
    fontSize: 14,
  },
  workProgressLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  workProgressValue: {
    fontSize: 12,
    fontWeight: "800",
    marginLeft: "auto",
  },

  // View Site Button
  viewSiteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  viewSiteBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // Empty State
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  emptyStateSub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.lg,
  },
  emptyAddBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  menuSheetContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    padding: 16,
    borderWidth: 1,
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(100,116,139,0.2)",
    marginBottom: 8,
  },
  menuHeaderTitle: {
    fontSize: 16,
    fontWeight: "800",
    flex: 1,
  },
  menuOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(100,116,139,0.1)",
  },
  menuOptionText: {
    fontSize: 15,
    fontWeight: "600",
  },
  dialogContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    padding: 24,
    alignItems: "center",
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  dialogDesc: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  dialogActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  dialogBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
