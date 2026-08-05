import React, { useState, useEffect, useCallback } from "react";
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
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { translateWorkerName } from "@/utils/transliteration";
import { storage, Worker, WorkerCategory, AttendanceRecord, AttendanceValue } from "@/utils/storage";
import { appContextTracker } from "@/utils/appContextTracker";
import { Spacing, BorderRadius, Colors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/MainTabNavigator";
import { useAuth } from "@/hooks/useAuth";

import { SkeletonLoader } from "@/components/ui/SkeletonLoader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchBar } from "@/components/ui/SearchBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { KPICard } from "@/components/ui/KPICard";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface WorkerCardProps {
  worker: Worker;
  todayStatus: AttendanceValue | null;
  siteName: string;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMarkAttendance: () => void;
  theme: typeof Colors.light;
  isDark: boolean;
  t: any;
  index: number;
  role?: string;
}

const WorkerCard = React.memo(function WorkerCard({
  worker,
  todayStatus,
  siteName,
  onView,
  onEdit,
  onDelete,
  onMarkAttendance,
  theme,
  isDark,
  t,
  index,
  role,
}: WorkerCardProps) {
  const scale = useSharedValue(1);
  const { language } = useLanguage();
  const translatedName = translateWorkerName(worker.name, language);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  let badgeVariant: "success" | "warning" | "error" | "info" | "neutral" = "neutral";
  let statusLabel = "Unmarked";
  let borderHighlight = isDark ? "#475569" : "#CBD5E1";

  if (todayStatus === "P") {
    badgeVariant = "success";
    statusLabel = "Present";
    borderHighlight = "#22C55E";
  } else if (todayStatus === "A") {
    badgeVariant = "error";
    statusLabel = "Absent";
    borderHighlight = "#EF4444";
  } else if (todayStatus === "H") {
    badgeVariant = "warning";
    statusLabel = "Half Day";
    borderHighlight = "#F59E0B";
  } else if (todayStatus === "OT") {
    badgeVariant = "info";
    statusLabel = "Overtime";
    borderHighlight = "#A855F7";
  }

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 50, 500)).springify()}>
      <AnimatedPressable
        onPress={() => {
          if (role !== "supervisor") onView();
        }}
        onPressIn={() => {
          if (role !== "supervisor")
            scale.value = withSpring(0.97, { damping: 15 });
        }}
        onPressOut={() => {
          if (role !== "supervisor")
            scale.value = withSpring(1, { damping: 15 });
        }}
        style={[
          styles.workerCard,
          {
            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
            borderColor: isDark ? "#334155" : "#E2E8F0",
            borderWidth: 1,
          },
          animatedStyle,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.avatarBorder, { borderColor: borderHighlight }]}>
            <Avatar name={worker.name} imageUri={worker.photoUri} size="lg" />
          </View>
          
          <View style={styles.cardHeaderText}>
            <ThemedText style={styles.workerName}>
              {translatedName}
            </ThemedText>
            <ThemedText style={[styles.workerRole, { color: theme.textSecondary }]}>
              {t.categories[worker.category] || worker.category.toUpperCase()}
            </ThemedText>
            <View style={styles.siteIndicator}>
              <Feather name="map-pin" size={12} color={theme.textSecondary} style={{ marginRight: 4 }} />
              <ThemedText style={[styles.siteText, { color: theme.textSecondary }]} numberOfLines={1}>
                {siteName || "Unassigned"}
              </ThemedText>
            </View>
          </View>

          <View style={styles.statusSection}>
            <Badge label={statusLabel} variant={badgeVariant} />
            <ThemedText style={[styles.wageText, { color: theme.primary }]}>
              {t.common.currency}{worker.dailyRate}/day
            </ThemedText>
          </View>
        </View>

        {role !== "supervisor" && (
          <View style={[styles.cardActions, { borderTopColor: isDark ? '#334155' : '#E2E8F0' }]}>
            <Pressable style={styles.actionBtn} onPress={onEdit}>
              <Feather name="edit-2" size={14} color={theme.textSecondary} />
              <Text style={[styles.actionText, { color: theme.textSecondary, marginLeft: 6 }]}>Edit</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={onDelete}>
              <Feather name="trash-2" size={14} color="#EF4444" />
              <Text style={[styles.actionText, { color: "#EF4444", marginLeft: 6 }]}>Delete</Text>
            </Pressable>
            <Pressable style={[styles.actionBtnPrimary, { backgroundColor: theme.primary + "15" }]} onPress={onMarkAttendance}>
              <Feather name="calendar" size={14} color={theme.primary} />
              <Text style={[styles.actionText, { color: theme.primary, marginLeft: 6 }]}>Mark Attendance</Text>
            </Pressable>
          </View>
        )}
      </AnimatedPressable>
    </Animated.View>
  );
});

export default function WorkersScreen() {
  const { theme, isDark } = useTheme();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const role = user?.role;

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const insets = useSafeAreaInsets();
  const rawHeaderHeight = useHeaderHeight();
  const headerHeight = rawHeaderHeight > 0 ? rawHeaderHeight : insets.top + Platform.select({ ios: 44, default: 56 });
  const tabBarHeight = insets.bottom + 60;

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpgradeLimitModal, setShowUpgradeLimitModal] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<"free" | "starter" | "professional" | "business">("free");

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Date Added");

  const route = useRoute<any>();
  const voiceSearchQuery = route.params?.voiceSearchQuery || "";

  useEffect(() => {
    if (voiceSearchQuery) {
      setSearchQuery(voiceSearchQuery);
    }
  }, [voiceSearchQuery]);

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
    
    const today = new Date();
    const todayRec = attendanceRecords.find(
      (r) =>
        r.workerId === w.id &&
        r.year === today.getFullYear() &&
        r.month === today.getMonth() &&
        r.day === today.getDate()
    );
    const todayStatus = todayRec?.value ?? null;

    let matchesFilter = true;
    if (filter === "Present") matchesFilter = todayStatus === "P";
    else if (filter === "Absent") matchesFilter = todayStatus === "A";
    else if (filter === "Half Day") matchesFilter = todayStatus === "H";
    else if (filter === "On Leave") matchesFilter = todayStatus === "OT"; // OT maps to On Leave in this UI context

    return matchesSearch && matchesFilter;
  });

  const loadWorkers = useCallback(async () => {
    setIsLoading(true);
    try {
      let loadedWorkers = await storage.getWorkers();

      if (role === "supervisor") {
        const assignedProjects = user?.assignedProjects || [];
        loadedWorkers = loadedWorkers.filter(
          (w) => w.projectId && assignedProjects.includes(w.projectId),
        );
      }

      setWorkers(loadedWorkers.sort((a, b) => b.createdAt - a.createdAt));

      const today = new Date();
      try {
        const attendance = await storage.getAttendanceForMonth(today.getFullYear(), today.getMonth());
        setAttendanceRecords(attendance);
      } catch (e) {
        console.warn("Failed loading attendance for workers summary:", e);
      }

      try {
        const sitesResult = await storage.getSites();
        const rawSites = sitesResult.sites || [];
        setProjects(rawSites);
      } catch (e) {
        console.warn("Failed loading sites for workers summary:", e);
      }

      const auth = await storage.getAuth();
      setCurrentPlan(auth?.plan || "free");
    } finally {
      setIsLoading(false);
    }
  }, [role, user]);

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
      loadWorkers();
    });
    return () => sub.remove();
  }, [loadWorkers]);

  const handleEditWorker = (worker: Worker) => {
    appContextTracker.setContext({
      selectedWorkerId: worker.id,
      selectedWorkerName: worker.name,
    });
    navigation.navigate("AddWorker", { workerId: worker.id });
  };

  const handleViewWorker = (worker: Worker) => {
    handleEditWorker(worker);
  };

  const handleMarkAttendance = (worker: Worker) => {
    navigation.navigate("AttendanceDetail", { siteId: worker.projectId });
  };

  const handleDeleteWorker = (worker: Worker) => {
    appContextTracker.setContext({
      selectedWorkerId: worker.id,
      selectedWorkerName: worker.name,
    });
    if (Platform.OS === "web") {
      const confirmed = window.confirm(`${t.workers.delete}? ${t.workers.deleteConfirm}`);
      if (confirmed) {
        setWorkers((prev) => prev.filter((w) => w.id !== worker.id));
        storage.deleteWorker(worker.id).catch((err) => {
          console.error("Failed to delete worker:", err);
        });
      }
      return;
    }

    Alert.alert(t.workers.delete, t.workers.deleteConfirm, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.common.delete,
        style: "destructive",
        onPress: async () => {
          setWorkers((prev) => prev.filter((w) => w.id !== worker.id));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await storage.deleteWorker(worker.id);
        },
      },
    ]);
  };

  const renderFilterChips = () => {
    const filters = ["All", "Present", "Absent", "Half Day", "On Leave"];
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
                { backgroundColor: isSelected ? theme.primary : (isDark ? '#1E293B' : '#F1F5F9') },
              ]}
            >
              <Text style={[styles.filterChipText, { color: isSelected ? '#FFFFFF' : (isDark ? '#94A3B8' : '#64748B') }]}>
                {f}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  };

  const renderStats = () => {
    const presentCount = workers.filter(w => {
      const today = new Date();
      const rec = attendanceRecords.find(r => r.workerId === w.id && r.year === today.getFullYear() && r.month === today.getMonth() && r.day === today.getDate());
      return rec?.value === "P";
    }).length;

    const onLeaveCount = workers.filter(w => {
      const today = new Date();
      const rec = attendanceRecords.find(r => r.workerId === w.id && r.year === today.getFullYear() && r.month === today.getMonth() && r.day === today.getDate());
      return rec?.value === "OT";
    }).length;

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsContainer}>
        <View style={{ width: 140 }}>
          <KPICard title="Total Workers" value={workers.length} icon="users" color="#3B82F6" />
        </View>
        <View style={{ width: 140 }}>
          <KPICard title="Active" value={presentCount} icon="check-circle" color="#10B981" />
        </View>
        <View style={{ width: 140 }}>
          <KPICard title="On Leave" value={onLeaveCount} icon="clock" color="#F59E0B" />
        </View>
        <View style={{ width: 140 }}>
          <KPICard title="New This Month" value={workers.length} icon="user-plus" color="#8B5CF6" />
        </View>
      </ScrollView>
    );
  };

  const renderHeader = () => {
    return (
      <View style={{ gap: Spacing.md, paddingBottom: Spacing.md }}>
        {renderStats()}
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ThemedText style={{ fontSize: 20, fontWeight: "800" }}>Workers</ThemedText>
              <Badge label={workers.length.toString()} variant="info" />
            </View>
            <Pressable style={styles.sortButton} onPress={() => setSortBy(sortBy === "Name A-Z" ? "Date Added" : "Name A-Z")}>
              <Feather name="bar-chart-2" size={16} color={theme.primary} style={{ transform: [{ rotate: '90deg' }] }} />
              <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 12 }}>Sort</Text>
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
    const today = new Date();
    const todayRec = attendanceRecords.find(
      (r) =>
        r.workerId === item.id &&
        r.year === today.getFullYear() &&
        r.month === today.getMonth() &&
        r.day === today.getDate()
    );
    const todayStatus = todayRec?.value ?? null;
    const project = projects.find((p) => p.id === item.projectId);
    const siteName = project?.name || "";

    return (
      <WorkerCard
        worker={item}
        todayStatus={todayStatus}
        siteName={siteName}
        onView={() => handleViewWorker(item)}
        onEdit={() => handleEditWorker(item)}
        onDelete={() => handleDeleteWorker(item)}
        onMarkAttendance={() => handleMarkAttendance(item)}
        theme={theme}
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
          <SkeletonLoader width="100%" height={120} borderRadius={16} />
          <SkeletonLoader width="100%" height={120} borderRadius={16} />
          <SkeletonLoader width="100%" height={120} borderRadius={16} />
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
            paddingTop: headerHeight,
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
        <AnimatedPressable
          entering={FadeInDown.springify()}
          style={[styles.fabContainer, { bottom: tabBarHeight + Spacing.md }]}
          onPress={handleAddWorker}
        >
          <LinearGradient colors={['#F97316', '#EA580C']} style={styles.fabGradient}>
            <Feather name="plus" size={24} color="#FFFFFF" />
          </LinearGradient>
        </AnimatedPressable>
      )}

      {/* Professional Upgrade Modal */}
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
  statsContainer: { gap: 12, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  filterContainer: { gap: 8, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  filterChipText: { fontSize: 13, fontWeight: "600" },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(249,115,22,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  
  workerCard: {
    borderRadius: 20,
    padding: 16,
    marginHorizontal: Spacing.lg,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatarBorder: {
    padding: 2,
    borderWidth: 2,
    borderRadius: 1000,
  },
  cardHeaderText: { flex: 1, marginLeft: 12 },
  workerName: { fontSize: 16, fontWeight: "800", marginBottom: 2 },
  workerRole: { fontSize: 11, fontWeight: "600", textTransform: 'uppercase' },
  siteIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  siteText: { fontSize: 11, fontWeight: "500", flex: 1 },
  
  statusSection: { alignItems: 'flex-end', gap: 4 },
  wageText: { fontSize: 12, fontWeight: "700" },
  
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderWidth: 0,
    borderTopWidth: 1,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10 },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  actionText: { fontSize: 12, fontWeight: "700" },
  
  separator: { height: 12 },
  fabContainer: { position: "absolute", right: Spacing.lg, zIndex: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  fabGradient: { width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center" },
  modalCenteredView: { flex: 1, justifyContent: "center", alignItems: "center", padding: Spacing.xl },
  upgradeModalContent: { width: "100%", maxWidth: 340, borderRadius: 24, padding: Spacing.xl, alignItems: "center", ...Shadows.md },
  modalIconContainer: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center", marginBottom: Spacing.md },
  modalTitle: { fontWeight: "800", textAlign: "center", marginBottom: Spacing.md },
  modalMessage: { textAlign: "center", lineHeight: 22, marginBottom: Spacing.xl },
  modalBtnContainer: { width: "100%", gap: Spacing.md },
  maybeLaterBtn: { width: "100%", paddingVertical: Spacing.md, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  maybeLaterText: { fontWeight: "600", fontSize: 16 },
});
