import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { Spacing } from "@/constants/theme";
import { storage, Project, Worker, authenticatedFetch, API_URL } from "@/utils/storage";

type ActiveTab = "overview" | "workers" | "materials" | "expenses" | "reports" | "analytics";

export default function SiteDetailControlScreen() {
  const { theme } = useTheme();
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { siteId } = route.params || {};

  const [site, setSite] = useState<Project | null>(null);
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [isLoading, setIsLoading] = useState(false);

  // Detail Data States from API/Cache
  const [spentAmount, setSpentAmount] = useState(0);
  const [expenseBreakdown, setExpenseBreakdown] = useState<any>({
    material: 0,
    machinery: 0,
    labour: 0,
    vendor: 0,
    other: 0,
  });
  const [delayDays, setDelayDays] = useState(0);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [mbEntries, setMbEntries] = useState<any[]>([]);

  // Worker skills filter
  const [skillFilter, setSkillFilter] = useState<string>("all");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedWorkerForTransfer, setSelectedWorkerForTransfer] = useState<Worker | null>(null);
  const [allSitesForTransfer, setAllSitesForTransfer] = useState<Project[]>([]);

  // Expense form states
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expType, setExpType] = useState<"material" | "machinery" | "labour" | "vendor" | "other">("material");
  const [expAmount, setExpAmount] = useState("");
  const [expVendor, setExpVendor] = useState("");
  const [expDesc, setExpDesc] = useState("");

  // Material Tracker Mock Database (syncs with local state for visual simulation)
  const [materials, setMaterials] = useState([
    { name: "Cement", unit: "bags", required: 500, used: 380, remaining: 120, minThreshold: 50 },
    { name: "Steel Rebars", unit: "tons", required: 15, used: 12, remaining: 3, minThreshold: 2 },
    { name: "Sand", unit: "brass", required: 80, used: 65, remaining: 15, minThreshold: 10 },
    { name: "Bricks", unit: "pcs", required: 20000, used: 18500, remaining: 1500, minThreshold: 2000 },
    { name: "Paint", unit: "litres", required: 600, used: 120, remaining: 480, minThreshold: 100 },
    { name: "Tiles", unit: "boxes", required: 400, used: 350, remaining: 50, minThreshold: 40 },
  ]);

  // Documents Local Mock state
  const [documents, setDocuments] = useState([
    { id: "doc-1", name: "Agreement_Contract_Signed.pdf", type: "Agreement", date: "2026-06-10" },
    { id: "doc-2", name: "Structural_Drawings_Slab.dwg", type: "Drawings", date: "2026-06-15" },
    { id: "doc-3", name: "BOQ_Quantities_Final.xlsx", type: "BOQ", date: "2026-06-20" },
    { id: "doc-4", name: "Cement_Invoice_UltraTech.pdf", type: "Invoices", date: "2026-07-02" },
  ]);

  const loadSiteData = async () => {
    if (!siteId) return;
    setIsLoading(true);
    try {
      const allProjects = await storage.getProjects();
      const currentSite = allProjects.find((p) => p.id === siteId) || null;
      setSite(currentSite);

      const workersList = await storage.getWorkers();
      setAllWorkers(workersList);

      setAllSitesForTransfer(allProjects.filter(p => p.id !== siteId));

      // Load analytics and ledger from Server if online, else mock fallback
      try {
        const res = await authenticatedFetch(`${API_URL}/projects/${siteId}/dashboard`);
        if (res.ok) {
          const data = await res.json();
          setSpentAmount(data.totalSpent || 0);
          setExpenseBreakdown(data.expenseBreakdown || {});
          setDelayDays(data.totalDelayDays || 0);
        }
        
        const expRes = await authenticatedFetch(`${API_URL}/projects/${siteId}/expenses`);
        if (expRes.ok) {
          setExpenses(await expRes.json());
        }

        const mbRes = await authenticatedFetch(`${API_URL}/projects/${siteId}/mb-entries`);
        if (mbRes.ok) {
          setMbEntries(await mbRes.json());
        }
      } catch (e) {
        // Offline cache / simulated values
        const spent = currentSite?.budget ? Math.round(currentSite.budget * 0.45) : 180000;
        setSpentAmount(spent);
        setExpenseBreakdown({
          material: Math.round(spent * 0.5),
          machinery: Math.round(spent * 0.15),
          labour: Math.round(spent * 0.25),
          vendor: Math.round(spent * 0.05),
          other: Math.round(spent * 0.05),
        });
        setDelayDays(currentSite?.status === "active" ? 2 : 0);
      }
    } catch (err) {
      console.warn("Failed to load details", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSiteData();
  }, [siteId]);

  const getProgressPercentage = (project: Project) => {
    if (project.phases && project.phases.length > 0) {
      const sumWeight = project.phases.reduce((sum, p) => sum + (p.weight || 0), 0);
      const achievedWeight = project.phases.reduce((sum, p) => {
        return sum + (((p.percentDone || 0) * (p.weight || 0)) / 100);
      }, 0);
      return Math.round(sumWeight > 0 ? (achievedWeight / sumWeight) * 100 : 0);
    }
    if (project.plannedQty && project.plannedQty > 0) {
      return Math.round(Math.min(((project.completedQty || 0) / project.plannedQty) * 100, 100));
    }
    return 0;
  };

  // Phase completion change updater
  const handleUpdatePhaseProgress = async (phaseName: string, newPercentage: number) => {
    if (!site) return;
    const updatedPhases = (site.phases || []).map((p) => {
      if (p.name === phaseName) {
        const finalPercent = Math.min(100, Math.max(0, newPercentage));
        return {
          ...p,
          percentDone: finalPercent,
          status: finalPercent >= 100 ? "completed" as const : finalPercent > 0 ? "in_progress" as const : "pending" as const,
        };
      }
      return p;
    });

    const updatedSite = { ...site, phases: updatedPhases };
    setSite(updatedSite);
    await storage.updateProject(updatedSite);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Worker list for current site
  const siteWorkers = useMemo(() => {
    return allWorkers.filter((w: Worker) => w.projectId === siteId);
  }, [allWorkers, siteId]);

  // Filtered workers list
  const filteredWorkers = useMemo(() => {
    if (skillFilter === "all") return siteWorkers;
    return siteWorkers.filter((w: Worker) => w.category === skillFilter);
  }, [siteWorkers, skillFilter]);

  // Worker Transfer Logic
  const handleTransferWorker = async (targetProjectId: string) => {
    if (!selectedWorkerForTransfer) return;
    try {
      const updatedWorkers = allWorkers.map((w: Worker) => {
        if (w.id === selectedWorkerForTransfer.id) {
          return { ...w, projectId: targetProjectId };
        }
        return w;
      });
      setAllWorkers(updatedWorkers);
      await storage.setWorkers(updatedWorkers);

      // Backend sync if possible
      try {
        await authenticatedFetch(`${API_URL}/workers/${selectedWorkerForTransfer.id}`, {
          method: "PUT",
          body: JSON.stringify({ ...selectedWorkerForTransfer, projectId: targetProjectId }),
        });
      } catch {}

      setShowTransferModal(false);
      setSelectedWorkerForTransfer(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Worker transferred successfully.");
    } catch {
      Alert.alert("Error", "Failed to transfer worker.");
    }
  };

  // Log Expense Submission
  const handleLogExpenseSubmit = async () => {
    if (!expAmount.trim()) {
      Alert.alert("Error", "Amount is required.");
      return;
    }
    const amount = parseFloat(expAmount);
    try {
      // Offline local update first
      const newSpent = spentAmount + amount;
      setSpentAmount(newSpent);
      setExpenseBreakdown((prev: any) => ({
        ...prev,
        [expType]: (prev[expType] || 0) + amount,
      }));

      // Server attempt
      try {
        await authenticatedFetch(`${API_URL}/projects/${siteId}/expenses`, {
          method: "POST",
          body: JSON.stringify({
            type: expType,
            amount,
            vendorName: expVendor.trim() || undefined,
            description: expDesc.trim() || undefined,
          }),
        });
      } catch {}

      setExpAmount("");
      setExpVendor("");
      setExpDesc("");
      setShowExpenseModal(false);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Expense logged successfully.");
    } catch {
      Alert.alert("Error", "Failed to submit expense.");
    }
  };

  // Material usage logger
  const handleLogMaterialUse = (materialName: string) => {
    Alert.prompt(
      "Log Material Used",
      `How many units of ${materialName} did you use today?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Log Usage",
          onPress: (val?: string) => {
            if (!val || isNaN(Number(val))) return;
            const qty = Number(val);
            setMaterials(prev =>
              prev.map(m => {
                if (m.name === materialName) {
                  const used = m.used + qty;
                  return { ...m, used, remaining: Math.max(0, m.remaining - qty) };
                }
                return m;
              })
            );
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ],
      "plain-text",
      "",
      "number-pad"
    );
  };

  // Measuring Tape progress bar
  const renderTapeProgress = (percentage: number) => {
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

  if (!site) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  const budgetUsedPct = site.budget ? Math.min(100, Math.round((spentAmount / site.budget) * 100)) : 0;
  const progressPercent = getProgressPercentage(site);

  return (
    <ThemedView style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      {/* Detail Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <ThemedText numberOfLines={1} style={styles.headerTitle}>{site.name}</ThemedText>
          <ThemedText numberOfLines={1} style={styles.headerSubtitle}>{site.location || "N/A"}</ThemedText>
        </View>
      </View>

      {/* Tabs list */}
      <View style={[styles.tabsScrollContainer, { borderBottomColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {([
            { id: "overview", label: "Timeline & Stages" },
            { id: "workers", label: "Workers & Wages" },
            { id: "materials", label: "Materials" },
            { id: "expenses", label: "Expenses Ledger" },
            { id: "reports", label: "Reports & Docs" },
            { id: "analytics", label: "Analytics" },
          ] as const).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab(tab.id);
                }}
                style={[
                  styles.tabItem,
                  { borderBottomColor: isActive ? theme.primary : "transparent" },
                ]}
              >
                <ThemedText style={[styles.tabText, { color: isActive ? theme.primary : "#6B7280" }]}>
                  {tab.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* TAB 1: OVERVIEW & STAGES */}
        {activeTab === "overview" && (
          <View>
            {/* Site Card Header Info */}
            <View style={[styles.infoCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <ThemedText style={styles.infoTitle}>Site & Client Details</ThemedText>
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Client Name</ThemedText>
                <ThemedText style={styles.infoValue}>{site.clientName || "N/A"}</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Budget</ThemedText>
                <ThemedText style={styles.infoValue}>₹{site.budget?.toLocaleString("en-IN") || "N/A"}</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Timeline</ThemedText>
                <ThemedText style={styles.infoValue}>
                  {site.startDate || "N/A"} to {site.endDate || "N/A"}
                </ThemedText>
              </View>
            </View>

            {/* Stages & Phases Controls */}
            <ThemedText style={styles.sectionHeaderTitle}>Construction Stages Completion</ThemedText>
            {(!site.phases || site.phases.length === 0) ? (
              <ThemedText style={styles.emptyText}>No stages registered for this project.</ThemedText>
            ) : (
              site.phases.map((phase) => {
                const colorBadge =
                  phase.percentDone >= 100
                    ? { bg: "#D1FAE5", text: "#16A34A", label: "Completed" }
                    : phase.percentDone > 0
                    ? { bg: "#E0F2FE", text: "#0284C7", label: "In Progress" }
                    : { bg: "#F3F4F6", text: "#4B5563", label: "Pending" };

                return (
                  <View
                    key={phase.name}
                    style={[styles.stageCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
                  >
                    <View style={styles.stageCardHeader}>
                      <ThemedText style={styles.stageName}>{phase.name}</ThemedText>
                      <View style={[styles.statusBadge, { backgroundColor: colorBadge.bg }]}>
                        <ThemedText style={[styles.statusBadgeText, { color: colorBadge.text }]}>
                          {colorBadge.label}
                        </ThemedText>
                      </View>
                    </View>

                    {renderTapeProgress(phase.percentDone)}

                    <View style={styles.stageControllerRow}>
                      <Pressable
                        onPress={() => handleUpdatePhaseProgress(phase.name, phase.percentDone - 10)}
                        style={styles.stageButton}
                      >
                        <Feather name="minus" size={16} color={theme.text} />
                      </Pressable>
                      <ThemedText style={styles.stageControllerPercent}>{phase.percentDone}% done</ThemedText>
                      <Pressable
                        onPress={() => handleUpdatePhaseProgress(phase.name, phase.percentDone + 10)}
                        style={styles.stageButton}
                      >
                        <Feather name="plus" size={16} color={theme.text} />
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* TAB 2: WORKERS & WAGES */}
        {activeTab === "workers" && (
          <View>
            <View style={styles.headcountRow}>
              <View style={[styles.headcountStat, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <ThemedText style={styles.headcountVal}>{siteWorkers.length}</ThemedText>
                <ThemedText style={styles.headcountLabel}>Workers Assigned</ThemedText>
              </View>
              <View style={[styles.headcountStat, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <ThemedText style={styles.headcountVal}>
                  ₹{(siteWorkers.reduce((sum: number, w: Worker) => sum + (w.dailyRate || 0), 0)).toLocaleString("en-IN")}
                </ThemedText>
                <ThemedText style={styles.headcountLabel}>Daily Wage Budget</ThemedText>
              </View>
            </View>

            {/* Category Filter selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.skillsFilterContainer}>
              {["all", "labour", "bai", "mistri", "tiles", "plaster"].map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setSkillFilter(cat)}
                  style={[
                    styles.skillFilterItem,
                    { backgroundColor: skillFilter === cat ? theme.primary : theme.border },
                  ]}
                >
                  <ThemedText style={{ color: skillFilter === cat ? "#FFFFFF" : theme.text, fontSize: 11, fontWeight: "700" }}>
                    {cat.toUpperCase()}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            <ThemedText style={styles.sectionHeaderTitle}>Assigned Roster List</ThemedText>
            {filteredWorkers.length === 0 ? (
              <ThemedText style={styles.emptyText}>No workers match the selected category.</ThemedText>
            ) : (
              filteredWorkers.map((worker: Worker) => (
                <View
                  key={worker.id}
                  style={[styles.workerCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.workerName}>{worker.name}</ThemedText>
                    <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                      <ThemedText style={styles.workerCategoryBadge}>{worker.category}</ThemedText>
                      <ThemedText style={styles.workerRate}>₹{worker.dailyRate}/day</ThemedText>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => {
                      setSelectedWorkerForTransfer(worker);
                      setShowTransferModal(true);
                    }}
                    style={[styles.transferButton, { backgroundColor: theme.border }]}
                  >
                    <Feather name="move" size={14} color={theme.text} />
                    <ThemedText style={styles.transferText}>Transfer</ThemedText>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}

        {/* TAB 3: MATERIALS TRACKER */}
        {activeTab === "materials" && (
          <View>
            <ThemedText style={styles.sectionHeaderTitle}>Stock Levels & Alerts</ThemedText>
            {materials.map((mat) => {
              const isLow = mat.remaining <= mat.minThreshold;
              return (
                <View
                  key={mat.name}
                  style={[styles.materialCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
                >
                  <View style={styles.materialHeader}>
                    <ThemedText style={styles.materialName}>{mat.name}</ThemedText>
                    {isLow && (
                      <View style={styles.lowStockBadge}>
                        <ThemedText style={styles.lowStockText}>LOW STOCK</ThemedText>
                      </View>
                    )}
                  </View>

                  <View style={styles.materialMetricsRow}>
                    <View>
                      <ThemedText style={styles.matMetricLabel}>Required</ThemedText>
                      <ThemedText style={styles.matMetricVal}>{mat.required} {mat.unit}</ThemedText>
                    </View>
                    <View>
                      <ThemedText style={styles.matMetricLabel}>Used</ThemedText>
                      <ThemedText style={styles.matMetricVal}>{mat.used} {mat.unit}</ThemedText>
                    </View>
                    <View>
                      <ThemedText style={styles.matMetricLabel}>Stock Remaining</ThemedText>
                      <ThemedText style={[styles.matMetricVal, { color: isLow ? "#DC2626" : theme.text }]}>
                        {mat.remaining} {mat.unit}
                      </ThemedText>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => handleLogMaterialUse(mat.name)}
                    style={[styles.logUsageButton, { backgroundColor: theme.border }]}
                  >
                    <Feather name="edit-2" size={14} color={theme.text} />
                    <ThemedText style={styles.logUsageText}>Log Usage</ThemedText>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {/* TAB 4: EXPENSES LEDGER */}
        {activeTab === "expenses" && (
          <View>
            <View style={[styles.budgetTracker, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <ThemedText style={styles.budgetTitle}>Budget Utilization</ThemedText>
              <View style={styles.budgetStats}>
                <View>
                  <ThemedText style={styles.budgetText}>Total Budget</ThemedText>
                  <ThemedText style={styles.budgetVal}>₹{site.budget?.toLocaleString("en-IN") || "N/A"}</ThemedText>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <ThemedText style={styles.budgetText}>Spent (Ledger)</ThemedText>
                  <ThemedText style={[styles.budgetVal, { color: budgetUsedPct > 80 ? "#DC2626" : theme.primary }]}>
                    ₹{spentAmount.toLocaleString("en-IN")}
                  </ThemedText>
                </View>
              </View>

              {/* Progress visual */}
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.barFill,
                    {
                      backgroundColor: budgetUsedPct > 80 ? "#DC2626" : theme.primary,
                      width: `${budgetUsedPct}%`,
                    },
                  ]}
                />
              </View>
              <ThemedText style={styles.budgetSubtext}>
                {budgetUsedPct}% of allocation consumed. Remaining: ₹{Math.max(0, (site.budget || 0) - spentAmount).toLocaleString("en-IN")}
              </ThemedText>
            </View>

            {/* Expense Breakdown Category Grid */}
            <ThemedText style={styles.sectionHeaderTitle}>Ledger Categories</ThemedText>
            <View style={styles.ledgerGrid}>
              <View style={[styles.ledgerItem, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <ThemedText style={styles.ledgerVal}>₹{expenseBreakdown.material?.toLocaleString("en-IN") || 0}</ThemedText>
                <ThemedText style={styles.ledgerLabel}>Materials</ThemedText>
              </View>
              <View style={[styles.ledgerItem, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <ThemedText style={styles.ledgerVal}>₹{expenseBreakdown.labour?.toLocaleString("en-IN") || 0}</ThemedText>
                <ThemedText style={styles.ledgerLabel}>Labor wages</ThemedText>
              </View>
              <View style={[styles.ledgerItem, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <ThemedText style={styles.ledgerVal}>₹{expenseBreakdown.machinery?.toLocaleString("en-IN") || 0}</ThemedText>
                <ThemedText style={styles.ledgerLabel}>Machinery Rent</ThemedText>
              </View>
              <View style={[styles.ledgerItem, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <ThemedText style={styles.ledgerVal}>
                  ₹{((expenseBreakdown.vendor || 0) + (expenseBreakdown.other || 0)).toLocaleString("en-IN")}
                </ThemedText>
                <ThemedText style={styles.ledgerLabel}>Other / Misc</ThemedText>
              </View>
            </View>

            <Pressable
              onPress={() => setShowExpenseModal(true)}
              style={[styles.addExpenseFAB, { backgroundColor: theme.primary }]}
            >
              <Feather name="plus" size={18} color="#FFFFFF" />
              <ThemedText style={styles.addExpenseText}>Log Ledger Expense</ThemedText>
            </Pressable>
          </View>
        )}

        {/* TAB 5: REPORTS & DOCUMENTS */}
        {activeTab === "reports" && (
          <View>
            <ThemedText style={styles.sectionHeaderTitle}>Automated Daily Report Preview</ThemedText>
            <View style={[styles.dailyReportCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <ThemedText style={styles.reportHeader}>Daily Supervisor Compilation</ThemedText>
              <ThemedText style={styles.reportDate}>Report Date: {new Date().toISOString().split("T")[0]}</ThemedText>
              
              <View style={styles.reportDivider} />
              
              <View style={styles.reportRow}>
                <ThemedText style={styles.reportLabel}>Project Progress</ThemedText>
                <ThemedText style={styles.reportValue}>{progressPercent}% stages completed</ThemedText>
              </View>
              <View style={styles.reportRow}>
                <ThemedText style={styles.reportLabel}>Labor Present</ThemedText>
                <ThemedText style={styles.reportValue}>{siteWorkers.length} active heads today</ThemedText>
              </View>
              <View style={styles.reportRow}>
                <ThemedText style={styles.reportLabel}>Delay status</ThemedText>
                <ThemedText style={[styles.reportValue, { color: delayDays > 0 ? "#DC2626" : theme.text }]}>
                  {delayDays > 0 ? `${delayDays} Days logged delay` : "On schedule"}
                </ThemedText>
              </View>
            </View>

            <ThemedText style={styles.sectionHeaderTitle}>Site Documents Library</ThemedText>
            {documents.map((doc) => (
              <View
                key={doc.id}
                style={[styles.documentCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
              >
                <Feather name="file-text" size={24} color={theme.primary} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.docName} numberOfLines={1}>{doc.name}</ThemedText>
                  <ThemedText style={styles.docMeta}>{doc.type} • Uploaded {doc.date}</ThemedText>
                </View>
                <Pressable
                  onPress={() => Alert.alert("Download Document", `Downloading ${doc.name}...`)}
                  style={styles.downloadIcon}
                >
                  <Feather name="download" size={16} color={theme.text} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* TAB 6: ANALYTICS */}
        {activeTab === "analytics" && (
          <View>
            <View style={[styles.analyticsCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <ThemedText style={styles.analyticsTitle}>Completion Curve Progress</ThemedText>
              <ThemedText style={styles.analyticsStat}>{progressPercent}%</ThemedText>
              <ThemedText style={styles.analyticsLabel}>Weighted physical progress completed.</ThemedText>
            </View>

            <View style={[styles.analyticsCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <ThemedText style={styles.analyticsTitle}>Labor Roll Attendance %</ThemedText>
              <ThemedText style={styles.analyticsStat}>88%</ThemedText>
              <ThemedText style={styles.analyticsLabel}>Average active ratio for assigned roster over past 30 days.</ThemedText>
            </View>

            <View style={[styles.analyticsCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <ThemedText style={styles.analyticsTitle}>Delayed Days Registered</ThemedText>
              <ThemedText style={[styles.analyticsStat, { color: delayDays > 0 ? "#DC2626" : theme.text }]}>
                {delayDays} Days
              </ThemedText>
              <ThemedText style={styles.analyticsLabel}>Days logged from weather issues, material deficits, or design changes.</ThemedText>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Worker Transfer Modal */}
      <Modal visible={showTransferModal} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowTransferModal(false)}>
          <View style={[styles.modalSheet, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.sheetHeader}>
              <ThemedText style={styles.sheetTitle}>Transfer Worker</ThemedText>
              <Pressable onPress={() => setShowTransferModal(false)}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ThemedText style={{ fontSize: 13, marginBottom: 12 }}>
              Select target construction site to relocate <ThemedText style={{ fontWeight: "700" }}>{selectedWorkerForTransfer?.name}</ThemedText>:
            </ThemedText>

            {allSitesForTransfer.length === 0 ? (
              <ThemedText style={styles.emptyText}>No other active sites available to transfer.</ThemedText>
            ) : (
              allSitesForTransfer.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => handleTransferWorker(p.id)}
                  style={[styles.siteOptionItem, { borderColor: theme.border }]}
                >
                  <ThemedText style={{ fontWeight: "700", fontSize: 13 }}>{p.name}</ThemedText>
                  <ThemedText style={{ fontSize: 11, color: "#6B7280" }}>{p.location || "N/A"}</ThemedText>
                </Pressable>
              ))
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Add Expense Modal */}
      <Modal visible={showExpenseModal} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowExpenseModal(false)}>
          <View style={[styles.modalSheet, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.sheetHeader}>
              <ThemedText style={styles.sheetTitle}>Log New Expense</ThemedText>
              <Pressable onPress={() => setShowExpenseModal(false)}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView>
              <ThemedText style={styles.inputLabel}>Expense Category</ThemedText>
              <View style={styles.filterGroup}>
                {([
                  { id: "material", label: "Material" },
                  { id: "labour", label: "Labor Wages" },
                  { id: "machinery", label: "Machinery" },
                  { id: "vendor", label: "Vendor" },
                  { id: "other", label: "Other" },
                ] as const).map((cat) => (
                  <Pressable
                    key={cat.id}
                    onPress={() => setExpType(cat.id)}
                    style={[
                      styles.filterItem,
                      {
                        backgroundColor: expType === cat.id ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <ThemedText style={{ color: expType === cat.id ? "#FFFFFF" : theme.text, fontSize: 11, fontWeight: "700" }}>
                      {cat.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <ThemedText style={styles.inputLabel}>Amount (₹) *</ThemedText>
              <TextInput
                placeholder="e.g. 15,000"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={expAmount}
                onChangeText={setExpAmount}
                style={[styles.formInput, { color: theme.text, borderColor: theme.border }]}
              />

              <ThemedText style={styles.inputLabel}>Vendor Name</ThemedText>
              <TextInput
                placeholder="e.g. UltraTech Dealer"
                placeholderTextColor="#9CA3AF"
                value={expVendor}
                onChangeText={setExpVendor}
                style={[styles.formInput, { color: theme.text, borderColor: theme.border }]}
              />

              <ThemedText style={styles.inputLabel}>Notes / Specifications</ThemedText>
              <TextInput
                placeholder="e.g. 50 bags purchased"
                placeholderTextColor="#9CA3AF"
                value={expDesc}
                onChangeText={setExpDesc}
                style={[styles.formInput, { color: theme.text, borderColor: theme.border }]}
              />

              <Pressable
                onPress={handleLogExpenseSubmit}
                style={[styles.submitButton, { backgroundColor: theme.primary }]}
              >
                <ThemedText style={styles.submitButtonText}>Log Expense Entry</ThemedText>
              </Pressable>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === "ios" ? 56 : 36,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1.5,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },
  tabsScrollContainer: {
    borderBottomWidth: 1.5,
    height: 48,
  },
  tabsRow: {
    paddingHorizontal: Spacing.md,
  },
  tabItem: {
    paddingHorizontal: 16,
    justifyContent: "center",
    borderBottomWidth: 2,
    height: "100%",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 80,
  },
  infoCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  emptyText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
    textAlign: "center",
    paddingVertical: 12,
  },
  stageCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  stageCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stageName: {
    fontSize: 13,
    fontWeight: "700",
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  stageControllerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: Spacing.sm,
  },
  stageButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  stageControllerPercent: {
    fontSize: 12,
    fontWeight: "700",
  },
  headcountRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: Spacing.md,
  },
  headcountStat: {
    flex: 1,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderRadius: 12,
  },
  headcountVal: {
    fontSize: 20,
    fontWeight: "700",
  },
  headcountLabel: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "500",
    marginTop: 2,
  },
  skillsFilterContainer: {
    gap: 6,
    marginBottom: Spacing.md,
  },
  skillFilterItem: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  workerCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderWidth: 1.5,
    borderRadius: 12,
    marginBottom: 6,
  },
  workerName: {
    fontSize: 13,
    fontWeight: "700",
  },
  workerCategoryBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4B5563",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  workerRate: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },
  transferButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    height: 32,
  },
  transferText: {
    fontSize: 11,
    fontWeight: "700",
  },
  materialCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  materialHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  materialName: {
    fontSize: 13,
    fontWeight: "700",
  },
  lowStockBadge: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  lowStockText: {
    fontSize: 9,
    color: "#DC2626",
    fontWeight: "700",
  },
  materialMetricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  matMetricLabel: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "500",
  },
  matMetricVal: {
    fontSize: 12,
    fontWeight: "700",
  },
  logUsageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    borderRadius: 6,
    height: 32,
  },
  logUsageText: {
    fontSize: 11,
    fontWeight: "700",
  },
  budgetTracker: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  budgetTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  budgetStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  budgetText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },
  budgetVal: {
    fontSize: 15,
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
  budgetSubtext: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },
  ledgerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: Spacing.md,
  },
  ledgerItem: {
    flex: 1,
    minWidth: "46%",
    padding: Spacing.md,
    borderWidth: 1.5,
    borderRadius: 12,
  },
  ledgerVal: {
    fontSize: 15,
    fontWeight: "700",
  },
  ledgerLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
    marginTop: 2,
  },
  addExpenseFAB: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    height: 48,
    marginTop: Spacing.sm,
  },
  addExpenseText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  dailyReportCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  reportHeader: {
    fontSize: 13,
    fontWeight: "700",
  },
  reportDate: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
    marginTop: 2,
  },
  reportDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 12,
  },
  reportRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  reportLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  reportValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  documentCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderWidth: 1.5,
    borderRadius: 12,
    marginBottom: 6,
  },
  docName: {
    fontSize: 12,
    fontWeight: "700",
  },
  docMeta: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "500",
  },
  downloadIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  analyticsCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  analyticsTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  analyticsStat: {
    fontSize: 26,
    fontWeight: "700",
    marginTop: 4,
  },
  analyticsLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
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
  siteOptionItem: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
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
