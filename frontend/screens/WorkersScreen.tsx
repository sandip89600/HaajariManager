import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  FlatList,
  Platform,
  Modal,
  DeviceEventEmitter,
  ScrollView,
  Text,
  TextInput,
  ActivityIndicator,
  Image,
} from "react-native";
import { BlurView } from "expo-blur";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather, Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { translateWorkerName } from "@/utils/transliteration";
import { storage, Worker, WorkerCategory, AttendanceRecord } from "@/utils/storage";
import { appContextTracker } from "@/utils/appContextTracker";
import { Spacing, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/MainTabNavigator";
import { useAuth } from "@/hooks/useAuth";

import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchBar } from "@/components/ui/SearchBar";
import { Badge } from "@/components/ui/Badge";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useErrorFeedback } from "@/context/ErrorFeedbackContext";

const CATEGORY_OPTIONS: { key: WorkerCategory; label: string }[] = [
  { key: "labour", label: "Labour" },
  { key: "mistri", label: "Mistri / Mason" },
  { key: "bai", label: "Bai / Helper" },
  { key: "bandkam", label: "Bandkam" },
  { key: "plaster", label: "Plaster" },
  { key: "tiles", label: "Tiles" },
  { key: "sutar", label: "Sutar / Carpenter" },
];

interface WorkerCardProps {
  worker: Worker;
  onEdit: () => void;
  onDelete: () => void;
  isDark: boolean;
  t: any;
  index: number;
  role?: string;
}

const WorkerCard = React.memo(function WorkerCard({
  worker,
  onEdit,
  onDelete,
  isDark,
  t,
  index,
  role,
}: WorkerCardProps) {
  const status = (worker as any).status || "Active";
  const isActive = status === "Active";

  const photoUrl = worker.photoUri || (worker as any).avatar || (worker as any).image;
  const initial = worker.name ? worker.name.trim().charAt(0).toUpperCase() : "W";

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 50, 400)).springify()}>
      <View
        style={[
          styles.workerCard,
          {
            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
            borderColor: isDark ? "#334155" : "#E2E8F0",
          },
        ]}
      >
        {/* Worker Info Row with Circular Avatar on Left */}
        <View style={styles.cardHeader}>
          <View style={[styles.avatarCircle, { backgroundColor: isDark ? "#334155" : "#EFF6FF" }]}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarInitial, { color: isDark ? "#38BDF8" : "#2563EB" }]}>
                {initial}
              </Text>
            )}
          </View>

          <View style={styles.cardInfo}>
            <ThemedText style={[styles.workerName, { color: isDark ? "#FFFFFF" : "#0F172A" }]}>
              {worker.name}
            </ThemedText>
            <ThemedText style={[styles.workerRole, { color: isDark ? "#94A3B8" : "#64748B" }]}>
              {t.categories?.[worker.category] || worker.category.toUpperCase()}
            </ThemedText>
            <ThemedText style={[styles.workerWage, { color: isDark ? "#38BDF8" : "#2563EB" }]}>
              ₹{worker.dailyRate} / Day
            </ThemedText>
          </View>
        </View>

        {/* Status Row */}
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabelText, { color: isDark ? "#CBD5E1" : "#475569" }]}>
            Status:{" "}
            <Text style={{ color: isActive ? "#16A34A" : "#EF4444", fontWeight: "800" }}>
              {status}
            </Text>
          </Text>
        </View>

        {/* Actions Row */}
        {role !== "supervisor" && (
          <View style={[styles.cardActions, { borderTopColor: isDark ? "#334155" : "#F1F5F9" }]}>
            <Pressable style={[styles.actionBtn, styles.editBtn]} onPress={onEdit}>
              <Feather name="edit-2" size={14} color="#2563EB" />
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
            
            <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={onDelete}>
              <Feather name="trash-2" size={14} color="#EF4444" />
              <Text style={styles.deleteBtnText}>Delete</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Animated.View>
  );
});

export default function WorkersScreen() {
  const { theme, isDark } = useTheme();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { reportError } = useErrorFeedback();
  const role = user?.role;

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const insets = useSafeAreaInsets();
  const rawHeaderHeight = useHeaderHeight();
  const headerHeight = rawHeaderHeight > 0 ? rawHeaderHeight : insets.top + Platform.select({ ios: 44, default: 56 });
  const tabBarHeight = insets.bottom + 60;

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpgradeLimitModal, setShowUpgradeLimitModal] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<"free" | "starter" | "professional" | "business" | "basic" | "super" | "premium">("free");

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Date Added");

  // Edit / Update Worker Sheet State
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<WorkerCategory>("labour");
  const [editDailyRate, setEditDailyRate] = useState("");
  const [editStatus, setEditStatus] = useState<"Active" | "Inactive">("Active");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Success Toast State
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const route = useRoute<any>();
  const voiceSearchQuery = route.params?.voiceSearchQuery || "";

  useEffect(() => {
    if (voiceSearchQuery) {
      setSearchQuery(voiceSearchQuery);
    }
  }, [voiceSearchQuery]);

  const showSuccessToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    setShowToast(true);
    toastTimerRef.current = setTimeout(() => {
      setShowToast(false);
      toastTimerRef.current = null;
    }, 3000);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    if (route.params?.voiceSearchQuery) {
      navigation.setParams({ voiceSearchQuery: undefined } as any);
    }
  };

  const filteredWorkers = workers.filter((w) => {
    const transName = translateWorkerName(w.name, language);
    const matchesSearch =
      searchQuery === "" ||
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const status = (w as any).status || "Active";
    let matchesFilter = true;
    if (filter === "Active") matchesFilter = status === "Active";
    else if (filter === "Inactive") matchesFilter = status === "Inactive";

    return matchesSearch && matchesFilter;
  });

  const assignedProjectsKey = user?.assignedProjects?.join(",") || "";

  const loadWorkers = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const today = new Date();
      const [rawWorkers, attendance, auth] = await Promise.all([
        storage.getWorkers(),
        storage.getAttendanceForMonth(today.getFullYear(), today.getMonth()).catch(() => []),
        storage.getAuth().catch(() => null),
      ]);

      let loadedWorkers = rawWorkers;
      if (role === "supervisor") {
        const assignedProjects = user?.assignedProjects || [];
        loadedWorkers = loadedWorkers.filter(
          (w) => w.projectId && assignedProjects.includes(w.projectId),
        );
      }

      setWorkers(loadedWorkers.sort((a, b) => b.createdAt - a.createdAt));
      setAttendanceRecords(attendance || []);
      setCurrentPlan(auth?.plan || "free");
    } catch (err) {
      console.error("Error loading workers:", err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [role, user?.id, assignedProjectsKey]);

  const handleAddWorker = useCallback(() => {
    if (role !== "supervisor") {
      const limit =
        currentPlan === "free"
          ? 15
          : currentPlan === "professional"
            ? 100
            : Infinity;
      if (workers.length >= limit) {
        setShowUpgradeLimitModal(true);
        return;
      }
    }
    navigation.navigate("AddWorker");
  }, [role, currentPlan, workers.length, navigation]);

  useFocusEffect(
    useCallback(() => {
      loadWorkers();
      appContextTracker.setContext({
        currentScreen: "Workers",
        selectedWorkerId: null,
        selectedWorkerName: null,
      });
    }, [loadWorkers]),
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("refreshData", () => {
      loadWorkers(true);
    });
    return () => sub.remove();
  }, [loadWorkers]);

  // Open Simple Edit Worker Sheet
  const handleOpenEditModal = (worker: Worker) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    appContextTracker.setContext({
      selectedWorkerId: worker.id,
      selectedWorkerName: worker.name,
    });
    setEditingWorker(worker);
    setEditName(worker.name);
    setEditCategory(worker.category || "labour");
    setEditDailyRate(worker.dailyRate ? String(worker.dailyRate) : "0");
    setEditStatus(((worker as any).status as "Active" | "Inactive") || "Active");
    setUpdateError(null);
  };

  // Submit Worker Update
  const handleSaveWorkerUpdate = async () => {
    if (!editingWorker) return;
    if (!editName.trim()) {
      setUpdateError("Please enter worker name.");
      return;
    }
    const rateNum = parseFloat(editDailyRate);
    if (isNaN(rateNum) || rateNum < 0) {
      setUpdateError("Please enter a valid daily wage.");
      return;
    }

    setIsUpdating(true);
    setUpdateError(null);

    try {
      const updated: Worker = {
        ...editingWorker,
        name: editName.trim(),
        category: editCategory,
        dailyRate: rateNum,
        status: editStatus,
      } as any;

      await storage.updateWorker(updated);

      // Close bottom sheet & reset states
      setEditingWorker(null);
      setIsUpdating(false);

      // Refresh list & show success message
      loadWorkers(true);
      showSuccessToast("Worker updated successfully");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setIsUpdating(false);
      setUpdateError(err?.message || "Failed to update worker. Please try again.");
    }
  };

  // Delete Worker Confirmation Dialog
  const handleDeleteWorker = (worker: Worker) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    appContextTracker.setContext({
      selectedWorkerId: worker.id,
      selectedWorkerName: worker.name,
    });

    if (Platform.OS === "web") {
      const confirmed = window.confirm(`Delete Worker?\n\nAre you sure you want to delete ${worker.name}?`);
      if (confirmed) {
        setWorkers((prev) => prev.filter((w) => w.id !== worker.id));
        storage.deleteWorker(worker.id).catch((err) => {
          console.error("Failed to delete worker:", err);
        });
      }
      return;
    }

    Alert.alert(
      "Delete Worker?",
      `Are you sure you want to delete ${worker.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setWorkers((prev) => prev.filter((w) => w.id !== worker.id));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await storage.deleteWorker(worker.id);
              showSuccessToast("Worker deleted successfully");
            } catch (err: any) {
              reportError({
                title: "Worker Deletion Failed",
                message: "Unable to delete worker right now.",
                category: "Worker Management",
                feature: "Delete Worker",
                errorMessage: err?.message || "Failed to delete worker",
                onRetry: () => handleDeleteWorker(worker),
              });
            }
          },
        },
      ]
    );
  };

  const renderFilterChips = () => {
    const filters = ["All", "Active", "Inactive"];
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContainer}>
        {filters.map((f) => {
          const isSelected = filter === f;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[
                styles.filterChip,
                { backgroundColor: isSelected ? theme.primary : (isDark ? "#1E293B" : "#F1F5F9") },
              ]}
            >
              <Text style={[styles.filterChipText, { color: isSelected ? "#FFFFFF" : (isDark ? "#FFFFFF" : "#475569") }]}>
                {f}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  };

  const renderStats = () => {
    const activeCount = workers.filter((w) => ((w as any).status || "Active") === "Active").length;
    const inactiveCount = workers.filter((w) => (w as any).status === "Inactive").length;
    
    // Calculate new workers added in the current calendar month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const newThisMonth = workers.filter((w) => w.createdAt && w.createdAt >= startOfMonth).length;

    return (
      <View style={styles.summaryGrid}>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
            <Text style={[styles.summaryNumber, { color: "#3B82F6" }]}>{workers.length}</Text>
            <Text style={[styles.summaryLabel, { color: isDark ? "#94A3B8" : "#64748B" }]}>Total Worker</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
            <Text style={[styles.summaryNumber, { color: "#16A34A" }]}>{activeCount}</Text>
            <Text style={[styles.summaryLabel, { color: isDark ? "#94A3B8" : "#64748B" }]}>Active</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
            <Text style={[styles.summaryNumber, { color: "#F59E0B" }]}>{inactiveCount}</Text>
            <Text style={[styles.summaryLabel, { color: isDark ? "#94A3B8" : "#64748B" }]}>On Leave</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
            <Text style={[styles.summaryNumber, { color: "#8B5CF6" }]}>{newThisMonth}</Text>
            <Text style={[styles.summaryLabel, { color: isDark ? "#94A3B8" : "#64748B" }]}>New This Month</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderHeader = () => {
    return (
      <View style={{ gap: Spacing.md, paddingBottom: Spacing.md }}>
        <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.xs }}>
          <ThemedText style={{ fontSize: 24, fontWeight: "800" }}>Workers</ThemedText>
        </View>

        {renderStats()}

        <View style={{ paddingHorizontal: Spacing.lg }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ThemedText style={{ fontSize: 16, fontWeight: "700" }}>All Workers</ThemedText>
              <Badge label={workers.length.toString()} variant="info" />
            </View>
            <Pressable
              style={styles.sortButton}
              onPress={() => {
                setSortBy(sortBy === "Name A-Z" ? "Date Added" : "Name A-Z");
                setWorkers((prev) =>
                  [...prev].sort((a, b) =>
                    sortBy === "Date Added" ? a.name.localeCompare(b.name) : b.createdAt - a.createdAt
                  )
                );
              }}
            >
              <Feather name="bar-chart-2" size={16} color={theme.primary} style={{ transform: [{ rotate: "90deg" }] }} />
              <Text style={{ color: theme.primary, fontWeight: "600", fontSize: 12 }}>Sort</Text>
            </Pressable>
          </View>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search workers by name..."
            onClear={handleClearSearch}
          />
        </View>
        {renderFilterChips()}
      </View>
    );
  };

  const renderWorker = ({ item, index }: { item: Worker; index: number }) => {
    return (
      <WorkerCard
        worker={item}
        onEdit={() => handleOpenEditModal(item)}
        onDelete={() => handleDeleteWorker(item)}
        isDark={isDark}
        t={t}
        index={index}
        role={role}
      />
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={{ paddingHorizontal: Spacing.lg, gap: Spacing.md }}>
          <SkeletonLoader width="100%" height={110} borderRadius={16} />
          <SkeletonLoader width="100%" height={110} borderRadius={16} />
          <SkeletonLoader width="100%" height={110} borderRadius={16} />
        </View>
      );
    }
    return (
      <EmptyState
        icon="users"
        title="No Workers Found"
        subtitle={role === "supervisor" ? "No workers assigned to your projects yet." : t.workers.addFirst}
        actionLabel={role !== "supervisor" ? "Add First Worker" : undefined}
        onAction={role !== "supervisor" ? handleAddWorker : undefined}
      />
    );
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={isLoading ? [] : filteredWorkers}
        renderItem={renderWorker}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: (headerHeight > 0 ? headerHeight : 20) + Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        refreshing={isLoading}
        onRefresh={loadWorkers}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
      />

      {role !== "supervisor" && (
        <Pressable
          style={[styles.fabContainer, { bottom: tabBarHeight + Spacing.md }]}
          onPress={handleAddWorker}
        >
          <LinearGradient colors={["#F97316", "#EA580C"]} style={styles.fabGradient}>
            <Feather name="plus" size={24} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      )}

      {/* Success Toast Notification Banner */}
      {showToast && (
        <Animated.View entering={FadeInUp.duration(300)} style={[styles.toastContainer, { backgroundColor: isDark ? "#1E293B" : "#0F172A" }]}>
          <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* UPDATE WORKER MODAL / BOTTOM SHEET */}
      <Modal
        visible={editingWorker !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (!isUpdating) setEditingWorker(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!isUpdating) setEditingWorker(null);
            }}
          />
          <View
            style={[
              styles.bottomSheetContainer,
              {
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
          >
            {/* Sheet Header */}
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: isDark ? "#FFFFFF" : "#0F172A" }]}>
                Update Worker
              </Text>
              <Pressable
                onPress={() => {
                  if (!isUpdating) setEditingWorker(null);
                }}
                hitSlop={10}
              >
                <Feather name="x" size={22} color={isDark ? "#94A3B8" : "#64748B"} />
              </Pressable>
            </View>

            {/* Error Message Banner */}
            {updateError && (
              <View style={styles.errorBanner}>
                <Feather name="alert-circle" size={16} color="#EF4444" />
                <Text style={styles.errorBannerText}>{updateError}</Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Field 1: Name */}
              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: isDark ? "#CBD5E1" : "#475569" }]}>
                  Name *
                </Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Worker Name"
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                      borderColor: isDark ? "#334155" : "#CBD5E1",
                      color: isDark ? "#FFFFFF" : "#0F172A",
                    },
                  ]}
                />
              </View>

              {/* Field 2: Role / Category */}
              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: isDark ? "#CBD5E1" : "#475569" }]}>
                  Role (Category)
                </Text>
                <View style={styles.categoryGrid}>
                  {CATEGORY_OPTIONS.map((cat) => {
                    const isSelected = editCategory === cat.key;
                    return (
                      <Pressable
                        key={cat.key}
                        onPress={() => setEditCategory(cat.key)}
                        style={[
                          styles.categoryOption,
                          {
                            backgroundColor: isSelected
                              ? (isDark ? "#2563EB" : "#3B82F6")
                              : (isDark ? "#0F172A" : "#F1F5F9"),
                            borderColor: isSelected ? "#3B82F6" : (isDark ? "#334155" : "#E2E8F0"),
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.categoryOptionText,
                            { color: isSelected ? "#FFFFFF" : (isDark ? "#CBD5E1" : "#475569") },
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Field 3: Daily Wage */}
              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: isDark ? "#CBD5E1" : "#475569" }]}>
                  Daily Wage (₹) *
                </Text>
                <TextInput
                  value={editDailyRate}
                  onChangeText={setEditDailyRate}
                  placeholder="e.g. 700"
                  keyboardType="numeric"
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                      borderColor: isDark ? "#334155" : "#CBD5E1",
                      color: isDark ? "#FFFFFF" : "#0F172A",
                    },
                  ]}
                />
              </View>

              {/* Field 4: Status */}
              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: isDark ? "#CBD5E1" : "#475569" }]}>
                  Status
                </Text>
                <View style={styles.statusToggleRow}>
                  <Pressable
                    onPress={() => setEditStatus("Active")}
                    style={[
                      styles.statusToggleBtn,
                      editStatus === "Active" && styles.statusToggleBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusToggleText,
                        editStatus === "Active" && styles.statusToggleTextActive,
                      ]}
                    >
                      Active
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setEditStatus("Inactive")}
                    style={[
                      styles.statusToggleBtn,
                      editStatus === "Inactive" && styles.statusToggleBtnInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusToggleText,
                        editStatus === "Inactive" && styles.statusToggleTextInactive,
                      ]}
                    >
                      Inactive
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>

            {/* Modal Buttons */}
            <View style={styles.sheetActions}>
              <Pressable
                disabled={isUpdating}
                onPress={() => setEditingWorker(null)}
                style={[
                  styles.cancelBtn,
                  { borderColor: isDark ? "#475569" : "#CBD5E1" },
                ]}
              >
                <Text style={[styles.cancelBtnText, { color: isDark ? "#CBD5E1" : "#475569" }]}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                disabled={isUpdating}
                onPress={handleSaveWorkerUpdate}
                style={[styles.updateBtn, isUpdating && { opacity: 0.7 }]}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.updateBtnText}>Update Worker</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upgrade Limit Modal */}
      <Modal
        visible={showUpgradeLimitModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowUpgradeLimitModal(false)}
      >
        <BlurView intensity={isDark ? 80 : 90} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill}>
          <View style={styles.modalCenteredView}>
            <ThemedView style={[styles.upgradeModalContent, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, borderWidth: 1 }]}>
              <View style={styles.modalIconContainer}>
                <ThemedText style={{ fontSize: 48 }}>🚀</ThemedText>
              </View>
              <ThemedText type="h2" style={styles.modalTitle}>🚀 Upgrade Required</ThemedText>
              <ThemedText type="body" style={[styles.modalMessage, { color: theme.textSecondary }]}>
                You have reached the maximum worker limit for your current plan.
                {"\n\n"}
                {currentPlan === "free" ? "Free Plan allows up to 15 workers." : "Professional Plan allows up to 100 workers."}
                {"\n\n"}
                Upgrade to Pro or Business to add more workers and unlock advanced features.
              </ThemedText>
              <View style={styles.modalBtnContainer}>
                <PrimaryButton
                  label="Upgrade Now"
                  onPress={() => {
                    setShowUpgradeLimitModal(false);
                    navigation.navigate("MainTabs" as any, { screen: "SettingsTab", params: { openUpgrade: true } } as any);
                  }}
                />
                <Pressable onPress={() => setShowUpgradeLimitModal(false)} style={[styles.maybeLaterBtn, { borderColor: theme.border, borderWidth: 1 }]}>
                  <ThemedText style={[styles.maybeLaterText, { color: theme.text }]}>Maybe Later</ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          </View>
        </BlurView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: Spacing.xl },

  /* 2x2 Top Summary Grid */
  summaryGrid: {
    paddingHorizontal: Spacing.lg,
    gap: 10,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },

  filterContainer: { gap: 8, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  filterChipText: { fontSize: 13, fontWeight: "600" },
  sortButton: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(249,115,22,0.1)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },

  /* Clean Worker Card Styling */
  workerCard: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: Spacing.lg,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
  },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: "800",
  },
  cardInfo: { flex: 1 },
  workerName: { fontSize: 18, fontWeight: "800", marginBottom: 2 },
  workerRole: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", marginBottom: 4 },
  workerWage: { fontSize: 15, fontWeight: "800", marginTop: 2 },

  statusRow: { marginTop: 10 },
  statusLabelText: { fontSize: 14, fontWeight: "600" },

  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    minHeight: 44,
    flex: 0.48,
  },
  editBtn: { backgroundColor: "rgba(37,99,235,0.08)" },
  editBtnText: { fontSize: 14, fontWeight: "800", color: "#2563EB", marginLeft: 6 },
  deleteBtn: { backgroundColor: "rgba(239,68,68,0.08)" },
  deleteBtnText: { fontSize: 14, fontWeight: "800", color: "#EF4444", marginLeft: 6 },

  separator: { height: 12 },
  fabContainer: { position: "absolute", right: Spacing.lg, zIndex: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  fabGradient: { width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center" },

  /* Update Worker Bottom Sheet Styling */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  bottomSheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: "85%",
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: "800" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "#EF4444",
    padding: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorBannerText: { color: "#EF4444", fontSize: 13, fontWeight: "600", flex: 1 },
  formGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  textInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: "600",
  },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  categoryOption: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  categoryOptionText: { fontSize: 12, fontWeight: "700" },
  statusToggleRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  statusToggleBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
  },
  statusToggleBtnActive: { backgroundColor: "#16A34A", borderColor: "#16A34A" },
  statusToggleBtnInactive: { backgroundColor: "#EF4444", borderColor: "#EF4444" },
  statusToggleText: { fontSize: 14, fontWeight: "700", color: "#475569" },
  statusToggleTextActive: { color: "#FFFFFF" },
  statusToggleTextInactive: { color: "#FFFFFF" },
  sheetActions: { flexDirection: "row", gap: 12, marginTop: 16, paddingTop: 12 },
  cancelBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  cancelBtnText: { fontSize: 15, fontWeight: "700" },
  updateBtn: { flex: 1, height: 48, borderRadius: 12, backgroundColor: "#2563EB", justifyContent: "center", alignItems: "center" },
  updateBtnText: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },

  /* Toast Notification */
  toastContainer: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 100,
  },
  toastText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  /* Upgrade Modal */
  modalCenteredView: { flex: 1, justifyContent: "center", alignItems: "center", padding: Spacing.xl },
  upgradeModalContent: { width: "100%", maxWidth: 340, borderRadius: 24, padding: Spacing.xl, alignItems: "center", ...Shadows.md },
  modalIconContainer: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center", marginBottom: Spacing.md },
  modalTitle: { fontWeight: "800", textAlign: "center", marginBottom: Spacing.md },
  modalMessage: { textAlign: "center", lineHeight: 22, marginBottom: Spacing.xl },
  modalBtnContainer: { width: "100%", gap: Spacing.md },
  maybeLaterBtn: { width: "100%", paddingVertical: Spacing.md, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  maybeLaterText: { fontWeight: "600", fontSize: 16 },
});
