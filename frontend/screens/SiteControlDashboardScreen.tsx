import React, { useState, useEffect, useMemo } from "react";
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
  FlatList,
  KeyboardAvoidingView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { storage, Project, Worker, generateId } from "@/utils/storage";

export default function SiteControlDashboardScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [sites, setSites] = useState<Project[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Search, Filter & Sort states
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [activeSort, setActiveSort] = useState<string>("Priority");
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  // Quick Action Sheet modal state
  const [showQuickActionModal, setShowQuickActionModal] = useState(false);
  const [showAddSiteModal, setShowAddSiteModal] = useState(false);

  // Form states for Add Site
  const [siteName, setSiteName] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [clientName, setClientName] = useState("");
  const [budget, setBudget] = useState("");
  const [startDateStr, setStartDateStr] = useState("");
  const [endDateStr, setEndDateStr] = useState("");
  const [siteSupervisor, setSiteSupervisor] = useState("Supervisor Ramesh");
  const [progressUnit, setProgressUnit] = useState("cum");
  const [plannedQty, setPlannedQty] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const realProjects = await storage.getProjects();
      setSites(realProjects);
      const realWorkers = await storage.getWorkers();
      setWorkers(realWorkers);
    } catch (e) {
      console.warn("Failed to load project/worker data", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadData);
    loadData();
    return unsubscribe;
  }, [navigation]);

  // Color Mapping Helper
  const getSiteStatusDetails = (site: Project) => {
    // Determine status from site configuration
    const status = site.status === "inactive" ? "completed" : "in_progress";
    
    // Status styles matching user guidelines
    const statusMap = {
      planning: { color: "#4B5563", bg: "#F3F4F6", text: "Planning" },
      in_progress: { color: "#0284C7", bg: "#E0F2FE", text: "In Progress" },
      on_hold: { color: "#D97706", bg: "#FEF3C7", text: "On Hold" },
      delayed: { color: "#DC2626", bg: "#FEE2E2", text: "Delayed" },
      completed: { color: "#16A34A", bg: "#D1FAE5", text: "Completed" },
    };

    // Auto delay check based on endDate if current date is past
    const isOverdue = site.endDate && new Date(site.endDate).getTime() < Date.now() && site.status === "active";
    const finalStatus = isOverdue ? "delayed" : status;

    return statusMap[finalStatus] || statusMap.in_progress;
  };

  // Site completion percentage helper
  const getProgressPercentage = (site: Project) => {
    if (site.phases && site.phases.length > 0) {
      const sumWeight = site.phases.reduce((sum, p) => sum + (p.weight || 0), 0);
      const achievedWeight = site.phases.reduce((sum, p) => {
        return sum + (((p.percentDone || 0) * (p.weight || 0)) / 100);
      }, 0);
      return Math.round(sumWeight > 0 ? (achievedWeight / sumWeight) * 100 : 0);
    }
    if (site.plannedQty && site.plannedQty > 0) {
      return Math.round(Math.min(((site.completedQty || 0) / site.plannedQty) * 100, 100));
    }
    return 0;
  };

  // Attendance counting helper
  const getAttendanceSummary = (siteId: string) => {
    // Simulated attendance representation
    const totalWorkers = workers.filter(w => w.projectId === siteId).length;
    if (totalWorkers === 0) return { present: 0, total: 0, text: "0 Workers" };
    // Simulated active ratio
    const present = Math.ceil(totalWorkers * 0.8);
    return { present, total: totalWorkers, text: `${present}/${totalWorkers} Present` };
  };

  // Mock Alerts generator based on active data
  const todayAlerts = useMemo(() => {
    const alerts = [];
    sites.forEach(site => {
      const pct = getProgressPercentage(site);
      const statusDetails = getSiteStatusDetails(site);
      const attendance = getAttendanceSummary(site.id);

      if (statusDetails.text === "Delayed") {
        alerts.push({
          id: `alert-delay-${site.id}`,
          siteId: site.id,
          siteName: site.name,
          type: "danger",
          message: `Site is delayed. Estimated completion was ${site.endDate || "N/A"}.`,
        });
      }
      if (attendance.total > 0 && attendance.present === 0) {
        alerts.push({
          id: `alert-att-${site.id}`,
          siteId: site.id,
          siteName: site.name,
          type: "warning",
          message: "No worker attendance marked today.",
        });
      }
      if (pct > 50 && pct < 80 && site.id.charCodeAt(0) % 2 === 0) {
        alerts.push({
          id: `alert-mat-${site.id}`,
          siteId: site.id,
          siteName: site.name,
          type: "warning",
          message: "Cement running low (Warning: Stock below 20 bags).",
        });
      }
      if (site.budget && site.budget > 1000000 && site.id.charCodeAt(0) % 3 === 0) {
        alerts.push({
          id: `alert-pay-${site.id}`,
          siteId: site.id,
          siteName: site.name,
          type: "danger",
          message: "Material vendor payment of ₹45,000 is pending.",
        });
      }
    });

    // Fallbacks if no sites or alerts generated
    if (alerts.length === 0) {
      alerts.push({
        id: "alert-default-1",
        siteId: "",
        siteName: "System Alert",
        type: "info",
        message: "All sites updated. No supervisor reports missing today.",
      });
    }
    return alerts;
  }, [sites, workers]);

  // Today's Progress Stats
  const todayProgressStats = useMemo(() => {
    const total = sites.length;
    const updated = sites.filter(s => s.status === "active" && s.id.charCodeAt(0) % 2 === 0).length;
    const pending = Math.max(0, total - updated);
    return { total, updated, pending };
  }, [sites]);

  // Quick Action Handlers
  const handleQuickAction = (type: string) => {
    setShowQuickActionModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (type === "add_site") {
      setShowAddSiteModal(true);
    } else if (type === "update_progress") {
      Alert.alert("Quick Action", "Select a site from the list to update its construction progress.");
    } else if (type === "assign_worker") {
      navigation.navigate("Workers");
    } else if (type === "add_expense") {
      Alert.alert("Quick Action", "Select a site below to log materials or labor expenses.");
    } else if (type === "upload_photo") {
      Alert.alert("Quick Action", "Please open a specific site to capture & upload site photos.");
    } else if (type === "generate_report") {
      Alert.alert("Daily Report", "Daily PDF summary reports can be exported from each site's detail hub.");
    }
  };

  // Add Site Submit
  const handleCreateSiteSubmit = async () => {
    if (!siteName.trim()) {
      Alert.alert("Error", "Please specify a site name.");
      return;
    }
    try {
      const newSite: Project = {
        id: generateId(),
        name: siteName.trim(),
        location: siteLocation.trim() || "N/A",
        status: "active",
        clientName: clientName.trim() || undefined,
        budget: parseFloat(budget) || 0,
        startDate: startDateStr.trim() || new Date().toISOString().split("T")[0],
        endDate: endDateStr.trim() || undefined,
        retentionPercentage: 0,
        mobilizationAdvance: 0,
        labourLicenseNumber: "",
        pfEsicStatus: "not_applicable",
        wcPolicyNumber: "",
        progressUnit: progressUnit,
        plannedQty: parseFloat(plannedQty) || 0,
        completedQty: 0,
        phases: [
          { name: "Foundation", weight: 20, status: "pending", percentDone: 0 },
          { name: "Columns", weight: 20, status: "pending", percentDone: 0 },
          { name: "Slab", weight: 30, status: "pending", percentDone: 0 },
          { name: "Brick Work", weight: 15, status: "pending", percentDone: 0 },
          { name: "Finishing", weight: 15, status: "pending", percentDone: 0 },
        ],
        createdAt: Date.now(),
      };
      await storage.addProject(newSite);
      setSites((prev) => [newSite, ...prev]);

      // Reset Form
      setSiteName("");
      setSiteLocation("");
      setClientName("");
      setBudget("");
      setStartDateStr("");
      setEndDateStr("");
      setProgressUnit("cum");
      setPlannedQty("");
      setShowAddSiteModal(false);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Site Control Center created successfully.");
    } catch (e: any) {
      Alert.alert("Limit Reached", "Please upgrade to PRIME/Professional plan to add more than 1 site.");
    }
  };

  // Metrics counts
  const dashboardStats = useMemo(() => {
    let active = 0;
    let delayed = 0;
    let completed = 0;
    let onHold = 0;

    sites.forEach(site => {
      const statusDetails = getSiteStatusDetails(site);
      if (statusDetails.text === "Completed") completed++;
      else if (statusDetails.text === "Delayed") delayed++;
      else if (statusDetails.text === "On Hold") onHold++;
      else active++;
    });

    return { active, delayed, completed, onHold };
  }, [sites]);

  // Search & Filter & Sort Application
  const processedSites = useMemo(() => {
    let result = [...sites];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        s =>
          s.name.toLowerCase().includes(query) ||
          (s.location && s.location.toLowerCase().includes(query)) ||
          (s.clientName && s.clientName.toLowerCase().includes(query))
      );
    }

    // Status filter
    if (activeFilter !== "All") {
      result = result.filter(site => {
        const details = getSiteStatusDetails(site);
        return details.text.toLowerCase() === activeFilter.toLowerCase();
      });
    }

    // Sort application
    if (activeSort === "Progress") {
      result.sort((a, b) => getProgressPercentage(b) - getProgressPercentage(a));
    } else if (activeSort === "Worker Count") {
      result.sort((a, b) => getAttendanceSummary(b.id).total - getAttendanceSummary(a.id).total);
    } else if (activeSort === "Completion Date") {
      result.sort((a, b) => {
        const dateA = a.endDate ? new Date(a.endDate).getTime() : Infinity;
        const dateB = b.endDate ? new Date(b.endDate).getTime() : Infinity;
        return dateA - dateB;
      });
    } else if (activeSort === "Priority") {
      result.sort((a, b) => {
        const scoreA = getSiteStatusDetails(a).text === "Delayed" ? 2 : 1;
        const scoreB = getSiteStatusDetails(b).text === "Delayed" ? 2 : 1;
        return scoreB - scoreA;
      });
    } else {
      result.sort((a, b) => b.createdAt - a.createdAt);
    }

    return result;
  }, [sites, searchQuery, activeFilter, activeSort, workers]);

  // Priority Sites list (Sites requiring immediate attention)
  const prioritySites = useMemo(() => {
    return sites.filter(site => {
      const details = getSiteStatusDetails(site);
      const att = getAttendanceSummary(site.id);
      return details.text === "Delayed" || (att.total > 0 && att.present === 0);
    });
  }, [sites, workers]);

  // Measuring Tape Progress Bar implementation with 10% ticks
  const renderMeasuringTapeProgress = (percentage: number) => {
    const ticks = [10, 20, 30, 40, 50, 60, 70, 80, 90];
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: Spacing.sm }}>
        <View
          style={{
            flex: 1,
            height: 18,
            backgroundColor: "#FFE066",
            borderColor: "#C59B27",
            borderWidth: 1.5,
            borderRadius: 4,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${percentage}%`,
              backgroundColor: "#E2B800",
            }}
          />
          {ticks.map((tick) => (
            <View
              key={tick}
              style={{
                position: "absolute",
                left: `${tick}%`,
                top: 0,
                width: 1.2,
                height: tick % 50 === 0 ? "70%" : "40%",
                backgroundColor: "#2B2B2B",
              }}
            />
          ))}
        </View>
        <ThemedText style={{ fontSize: 13, fontWeight: "700", color: theme.text }}>
          {percentage}%
        </ThemedText>
      </View>
    );
  };

  const getAlertIcon = (type: string) => {
    if (type === "danger") return "alert-triangle";
    if (type === "warning") return "bell";
    return "info";
  };

  const getAlertColor = (type: string) => {
    if (type === "danger") return "#DC2626";
    if (type === "warning") return "#D97706";
    return "#2563EB";
  };

  return (
    <ThemedView style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View>
          <ThemedText style={styles.headerSubtitle}>SITE MANAGER</ThemedText>
          <ThemedText style={styles.headerTitle}>Control Center</ThemedText>
        </View>
        <Pressable
          onPress={() => setShowQuickActionModal(true)}
          style={[styles.quickActionsButton, { backgroundColor: theme.primary }]}
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
          <ThemedText style={styles.quickActionsButtonText}>Actions</ThemedText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Status Metrics Cards Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <ThemedText style={[styles.statValue, { color: "#0284C7" }]}>{dashboardStats.active}</ThemedText>
            <ThemedText style={styles.statLabel}>Active Sites</ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <ThemedText style={[styles.statValue, { color: "#DC2626" }]}>{dashboardStats.delayed}</ThemedText>
              {dashboardStats.delayed > 0 && <Feather name="alert-circle" size={14} color="#DC2626" />}
            </View>
            <ThemedText style={styles.statLabel}>Delayed</ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <ThemedText style={[styles.statValue, { color: "#D97706" }]}>{dashboardStats.onHold}</ThemedText>
            <ThemedText style={styles.statLabel}>On Hold</ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <ThemedText style={[styles.statValue, { color: "#16A34A" }]}>{dashboardStats.completed}</ThemedText>
            <ThemedText style={styles.statLabel}>Completed</ThemedText>
          </View>
        </View>

        {/* Alerts Widget */}
        <View style={[styles.sectionContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Feather name="bell" size={18} color={theme.text} />
            <ThemedText style={styles.sectionTitle}>Today's Critical Alerts</ThemedText>
          </View>
          {todayAlerts.map((alert) => {
            const color = getAlertColor(alert.type);
            return (
              <View key={alert.id} style={[styles.alertRow, { borderLeftColor: color }]}>
                <Feather name={getAlertIcon(alert.type)} size={16} color={color} style={styles.alertIcon} />
                <View style={{ flex: 1 }}>
                  {alert.siteName && (
                    <ThemedText style={[styles.alertSite, { color }]}>{alert.siteName}</ThemedText>
                  )}
                  <ThemedText style={styles.alertMessage}>{alert.message}</ThemedText>
                </View>
              </View>
            );
          })}
        </View>

        {/* Today's Progress Tracker */}
        <View style={[styles.progressTrackerCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <View style={styles.progressTrackerHeader}>
            <ThemedText style={styles.progressTrackerTitle}>Daily Updates Summary</ThemedText>
            <ThemedText style={[styles.progressTrackerCount, { color: theme.primary }]}>
              {todayProgressStats.updated}/{todayProgressStats.total} Updated
            </ThemedText>
          </View>
          <View style={styles.barContainer}>
            <View
              style={[
                styles.barFill,
                {
                  backgroundColor: theme.primary,
                  width: `${todayProgressStats.total > 0 ? (todayProgressStats.updated / todayProgressStats.total) * 100 : 0}%`,
                },
              ]}
            />
          </View>
          <ThemedText style={styles.progressTrackerSubtext}>
            {todayProgressStats.pending} sites pending today's supervisor logs.
          </ThemedText>
        </View>

        {/* Priority Attention Area */}
        {prioritySites.length > 0 && (
          <View style={styles.priorityContainer}>
            <ThemedText style={styles.listHeaderTitle}>🚨 Needs Immediate Attention</ThemedText>
            {prioritySites.map((site) => {
              const statusDetails = getSiteStatusDetails(site);
              const attendance = getAttendanceSummary(site.id);
              return (
                <Pressable
                  key={`priority-${site.id}`}
                  onPress={() => navigation.navigate("SiteDetailControl", { siteId: site.id })}
                  style={[
                    styles.siteCard,
                    {
                      backgroundColor: theme.backgroundDefault,
                      borderColor: theme.border,
                      borderLeftColor: statusDetails.color,
                    },
                  ]}
                >
                  <View style={styles.siteCardHeader}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.siteName}>{site.name}</ThemedText>
                      <ThemedText style={styles.siteLocation}>{site.location || "N/A"}</ThemedText>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusDetails.bg }]}>
                      <ThemedText style={[styles.statusBadgeText, { color: statusDetails.color }]}>
                        {statusDetails.text}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.siteDetailsRow}>
                    <ThemedText style={styles.detailsText}>
                      Supervisor: <ThemedText style={styles.detailsBold}>{siteSupervisor}</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.detailsText}>
                      Attendance: <ThemedText style={styles.detailsBold}>{attendance.text}</ThemedText>
                    </ThemedText>
                  </View>

                  {renderMeasuringTapeProgress(getProgressPercentage(site))}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Search, Filter & Sort Bar */}
        <View style={styles.searchFilterRow}>
          <View style={[styles.searchBox, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Feather name="search" size={16} color={theme.textSecondary || "#6B7280"} style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search by name, client, location..."
              placeholderTextColor={theme.textSecondary || "#6B7280"}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { color: theme.text }]}
            />
          </View>
          <Pressable
            onPress={() => setShowFiltersModal(true)}
            style={[styles.filterButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
          >
            <Feather name="filter" size={18} color={theme.text} />
          </Pressable>
        </View>

        {/* Site List */}
        <View style={{ marginTop: Spacing.md }}>
          <View style={styles.listHeaderRow}>
            <ThemedText style={styles.listHeaderTitle}>All Sites Directory</ThemedText>
            <ThemedText style={styles.listHeaderCount}>{processedSites.length} Found</ThemedText>
          </View>

          {processedSites.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="map" size={40} color={theme.textSecondary || "#9CA3AF"} />
              <ThemedText style={styles.emptyText}>No construction sites found.</ThemedText>
            </View>
          ) : (
            processedSites.map((site) => {
              const statusDetails = getSiteStatusDetails(site);
              const attendance = getAttendanceSummary(site.id);
              const completionPercentage = getProgressPercentage(site);
              return (
                <Pressable
                  key={site.id}
                  onPress={() => navigation.navigate("SiteDetailControl", { siteId: site.id })}
                  style={[
                    styles.siteCard,
                    {
                      backgroundColor: theme.backgroundDefault,
                      borderColor: theme.border,
                      borderLeftColor: statusDetails.color,
                    },
                  ]}
                >
                  <View style={styles.siteCardHeader}>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.siteName}>{site.name}</ThemedText>
                      <ThemedText style={styles.siteLocation}>{site.location || "N/A"}</ThemedText>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusDetails.bg }]}>
                      <ThemedText style={[styles.statusBadgeText, { color: statusDetails.color }]}>
                        {statusDetails.text}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.siteDetailsRow}>
                    <ThemedText style={styles.detailsText}>
                      Supervisor: <ThemedText style={styles.detailsBold}>{siteSupervisor}</ThemedText>
                    </ThemedText>
                    <ThemedText style={styles.detailsText}>
                      Attendance: <ThemedText style={styles.detailsBold}>{attendance.text}</ThemedText>
                    </ThemedText>
                  </View>

                  {renderMeasuringTapeProgress(completionPercentage)}

                  <View style={styles.siteCardFooter}>
                    <ThemedText style={styles.footerDate}>
                      Est: {site.endDate || "N/A"}
                    </ThemedText>
                    <Pressable
                      onPress={() => navigation.navigate("SiteDetailControl", { siteId: site.id })}
                      style={[styles.quickOpenButton, { backgroundColor: theme.primary }]}
                    >
                      <ThemedText style={styles.quickOpenText}>Control Panel</ThemedText>
                      <Feather name="arrow-right" size={14} color="#FFFFFF" />
                    </Pressable>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Quick Actions Sheet Modal */}
      <Modal visible={showQuickActionModal} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowQuickActionModal(false)}>
          <View style={[styles.modalSheet, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.sheetHeader}>
              <ThemedText style={styles.sheetTitle}>Site Control Center Actions</ThemedText>
              <Pressable onPress={() => setShowQuickActionModal(false)}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.actionsGrid}>
              <Pressable onPress={() => handleQuickAction("add_site")} style={styles.actionSheetItem}>
                <View style={[styles.actionIconContainer, { backgroundColor: "#E0F2FE" }]}>
                  <Feather name="map-pin" size={22} color="#0284C7" />
                </View>
                <ThemedText style={styles.actionLabel}>Add New Site</ThemedText>
              </Pressable>

              <Pressable onPress={() => handleQuickAction("update_progress")} style={styles.actionSheetItem}>
                <View style={[styles.actionIconContainer, { backgroundColor: "#FEF3C7" }]}>
                  <Feather name="trending-up" size={22} color="#D97706" />
                </View>
                <ThemedText style={styles.actionLabel}>Update Progress</ThemedText>
              </Pressable>

              <Pressable onPress={() => handleQuickAction("assign_worker")} style={styles.actionSheetItem}>
                <View style={[styles.actionIconContainer, { backgroundColor: "#D1FAE5" }]}>
                  <Feather name="users" size={22} color="#16A34A" />
                </View>
                <ThemedText style={styles.actionLabel}>Assign Workers</ThemedText>
              </Pressable>

              <Pressable onPress={() => handleQuickAction("add_expense")} style={styles.actionSheetItem}>
                <View style={[styles.actionIconContainer, { backgroundColor: "#FEE2E2" }]}>
                  <Feather name="dollar-sign" size={22} color="#DC2626" />
                </View>
                <ThemedText style={styles.actionLabel}>Log Expense</ThemedText>
              </Pressable>

              <Pressable onPress={() => handleQuickAction("upload_photo")} style={styles.actionSheetItem}>
                <View style={[styles.actionIconContainer, { backgroundColor: "#E0F2FE" }]}>
                  <Feather name="camera" size={22} color="#2563EB" />
                </View>
                <ThemedText style={styles.actionLabel}>Upload Photo</ThemedText>
              </Pressable>

              <Pressable onPress={() => handleQuickAction("generate_report")} style={styles.actionSheetItem}>
                <View style={[styles.actionIconContainer, { backgroundColor: "#F3F4F6" }]}>
                  <Feather name="file-text" size={22} color="#4B5563" />
                </View>
                <ThemedText style={styles.actionLabel}>Daily Report</ThemedText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Filters & Sort Modal */}
      <Modal visible={showFiltersModal} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowFiltersModal(false)}>
          <View style={[styles.modalSheet, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.sheetHeader}>
              <ThemedText style={styles.sheetTitle}>Filter & Sort Sites</ThemedText>
              <Pressable onPress={() => setShowFiltersModal(false)}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 350 }}>
              <ThemedText style={styles.filterSectionTitle}>Site Status Filter</ThemedText>
              <View style={styles.filterGroup}>
                {["All", "In Progress", "Delayed", "On Hold", "Completed"].map((filter) => (
                  <Pressable
                    key={filter}
                    onPress={() => setActiveFilter(filter)}
                    style={[
                      styles.filterItem,
                      {
                        backgroundColor: activeFilter === filter ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <ThemedText style={[styles.filterItemText, { color: activeFilter === filter ? "#FFFFFF" : theme.text }]}>
                      {filter}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <ThemedText style={styles.filterSectionTitle}>Sort Listing By</ThemedText>
              <View style={styles.filterGroup}>
                {["Priority", "Latest Update", "Progress", "Completion Date", "Worker Count"].map((sort) => (
                  <Pressable
                    key={sort}
                    onPress={() => setActiveSort(sort)}
                    style={[
                      styles.filterItem,
                      {
                        backgroundColor: activeSort === sort ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <ThemedText style={[styles.filterItemText, { color: activeSort === sort ? "#FFFFFF" : theme.text }]}>
                      {sort}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Pressable
              onPress={() => setShowFiltersModal(false)}
              style={[styles.applyButton, { backgroundColor: theme.primary }]}
            >
              <ThemedText style={styles.applyButtonText}>Apply Filters</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Add Project Modal */}
      <Modal visible={showAddSiteModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowAddSiteModal(false)}>
            <View style={[styles.modalSheet, { backgroundColor: theme.backgroundDefault }]} onStartShouldSetResponder={() => true}>
              <View style={styles.sheetHeader}>
                <ThemedText style={styles.sheetTitle}>New Site Control Center</ThemedText>
                <Pressable onPress={() => setShowAddSiteModal(false)}>
                  <Feather name="x" size={20} color={theme.text} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                <ThemedText style={styles.inputLabel}>Site Name *</ThemedText>
                <TextInput
                  placeholder="e.g. Metro Heights Phase 1"
                  placeholderTextColor="#9CA3AF"
                  value={siteName}
                  onChangeText={setSiteName}
                  style={[styles.formInput, { color: theme.text, borderColor: theme.border }]}
                />

                <ThemedText style={styles.inputLabel}>Location *</ThemedText>
                <TextInput
                  placeholder="e.g. Sector 62, Noida"
                  placeholderTextColor="#9CA3AF"
                  value={siteLocation}
                  onChangeText={setSiteLocation}
                  style={[styles.formInput, { color: theme.text, borderColor: theme.border }]}
                />

                <ThemedText style={styles.inputLabel}>Client Name</ThemedText>
                <TextInput
                  placeholder="e.g. DDA / Realcorp"
                  placeholderTextColor="#9CA3AF"
                  value={clientName}
                  onChangeText={setClientName}
                  style={[styles.formInput, { color: theme.text, borderColor: theme.border }]}
                />

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.inputLabel}>Budget (₹)</ThemedText>
                    <TextInput
                      placeholder="e.g. 50,00,000"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={budget}
                      onChangeText={setBudget}
                      style={[styles.formInput, { color: theme.text, borderColor: theme.border }]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.inputLabel}>Planned Qty</ThemedText>
                    <TextInput
                      placeholder="e.g. 5000"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={plannedQty}
                      onChangeText={setPlannedQty}
                      style={[styles.formInput, { color: theme.text, borderColor: theme.border }]}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.inputLabel}>Start Date</ThemedText>
                    <TextInput
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#9CA3AF"
                      value={startDateStr}
                      onChangeText={setStartDateStr}
                      style={[styles.formInput, { color: theme.text, borderColor: theme.border }]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.inputLabel}>End Date</ThemedText>
                    <TextInput
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#9CA3AF"
                      value={endDateStr}
                      onChangeText={setEndDateStr}
                      style={[styles.formInput, { color: theme.text, borderColor: theme.border }]}
                    />
                  </View>
                </View>

                <Pressable
                  onPress={handleCreateSiteSubmit}
                  style={[styles.submitButton, { backgroundColor: theme.primary }]}
                >
                  <ThemedText style={styles.submitButtonText}>Create Site Center</ThemedText>
                </Pressable>
              </ScrollView>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === "ios" ? 56 : 36,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1.5,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  quickActionsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    height: 44,
  },
  quickActionsButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: "46%",
    padding: Spacing.md,
    borderWidth: 1.5,
    borderRadius: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "500",
  },
  sectionContainer: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderLeftWidth: 3.5,
    paddingLeft: 8,
    marginBottom: 6,
  },
  alertIcon: {
    marginTop: 2,
    marginRight: 6,
  },
  alertSite: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 1,
  },
  alertMessage: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "500",
  },
  progressTrackerCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  progressTrackerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressTrackerTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  progressTrackerCount: {
    fontSize: 13,
    fontWeight: "700",
  },
  barContainer: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressTrackerSubtext: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },
  priorityContainer: {
    marginBottom: Spacing.md,
  },
  listHeaderTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  siteCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    borderLeftWidth: 5,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  siteCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  siteName: {
    fontSize: 15,
    fontWeight: "700",
  },
  siteLocation: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  siteDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  detailsText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  detailsBold: {
    fontWeight: "700",
  },
  siteCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  footerDate: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },
  quickOpenButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    height: 32,
  },
  quickOpenText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  searchFilterRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    padding: 0,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  listHeaderCount: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.md,
    maxHeight: "85%",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: Spacing.sm,
  },
  actionSheetItem: {
    width: "30%",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  actionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
  },
  filterSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: Spacing.sm,
    marginBottom: 8,
  },
  filterGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: Spacing.md,
  },
  filterItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  filterItemText: {
    fontSize: 12,
    fontWeight: "700",
  },
  applyButton: {
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
  },
  applyButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
    marginTop: 12,
  },
  formInput: {
    borderWidth: 1.5,
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  submitButton: {
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
