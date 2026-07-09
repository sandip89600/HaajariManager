import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  FlatList,
  Image,
  ActivityIndicator,
  Platform,
  Modal,
  DeviceEventEmitter,
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
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
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
import { storage, Worker, WorkerCategory } from "@/utils/storage";
import { appContextTracker } from "@/utils/appContextTracker";
import { Spacing, BorderRadius, Colors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/MainTabNavigator";
import { useAuth } from "@/hooks/useAuth";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface WorkerCardProps {
  worker: Worker;
  onEdit: () => void;
  onDelete: () => void;
  theme: typeof Colors.light;
  isDark: boolean;
  t: any;
  index: number;
  role?: string;
}

function WorkerCard({
  worker,
  onEdit,
  onDelete,
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

  const getCategoryColor = (category: WorkerCategory) => {
    const colors: Record<WorkerCategory, string> = {
      labour: "#10B981", // Emerald
      bai: "#EC4899", // Pink
      mistri: "#6366F1", // Indigo
      bandkam: "#8B5CF6", // Violet
      plaster: "#06B6D4", // Cyan
      tiles: "#3B82F6", // Blue
      sutar: "#F59E0B", // Amber
    };
    return colors[category] || theme.primary;
  };

  const initials =
    translatedName
      .split(" ")
      .filter((w) => w.length > 0)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  const catColor = getCategoryColor(worker.category);

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <AnimatedPressable
        onPress={() => {
          if (role !== "supervisor") onEdit();
        }}
        onPressIn={() => {
          if (role !== "supervisor")
            scale.value = withSpring(0.96, { damping: 15 });
        }}
        onPressOut={() => {
          if (role !== "supervisor")
            scale.value = withSpring(1, { damping: 15 });
        }}
        style={[
          styles.workerCard,
          {
            backgroundColor: isDark
              ? "rgba(30, 41, 59, 0.45)"
              : "rgba(255, 255, 255, 0.9)",
            borderColor: isDark
              ? "rgba(255, 255, 255, 0.06)"
              : "rgba(0, 0, 0, 0.05)",
            borderWidth: 1,
          },
          animatedStyle,
        ]}
      >
        {/* Avatar */}
        {worker.photoUri ? (
          <Image
            source={{ uri: worker.photoUri }}
            style={styles.workerAvatar}
          />
        ) : (
          <LinearGradient
            colors={[catColor, catColor + "cc"]}
            style={styles.workerAvatarPlaceholder}
          >
            <ThemedText style={styles.workerAvatarInitials}>
              {initials}
            </ThemedText>
          </LinearGradient>
        )}

        <View style={styles.workerInfo}>
          <ThemedText type="h3" style={{ fontWeight: "700" }}>
            {translatedName}
          </ThemedText>
          <View style={styles.workerDetails}>
            <View
              style={[
                styles.categoryBadge,
                {
                  backgroundColor: catColor + "12",
                  borderColor: catColor + "25",
                  borderWidth: 1,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={[styles.categoryText, { color: catColor }]}
              >
                {t.categories[worker.category]}
              </ThemedText>
            </View>
            <ThemedText
              type="body"
              style={[
                styles.rateText,
                { color: theme.textSecondary, fontWeight: "600" },
              ]}
            >
              {t.common.currency}
              {worker.dailyRate}
              {t.workers.perDay}
            </ThemedText>
          </View>
          {worker.phone ? (
            <View style={styles.phoneRow}>
              <Feather name="phone" size={11} color={theme.textSecondary} />
              <ThemedText
                type="small"
                style={[styles.phoneText, { color: theme.textSecondary }]}
              >
                {worker.phone}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {role !== "supervisor" && (
          <View style={styles.workerActions}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onEdit();
              }}
              style={[
                styles.actionButton,
                {
                  backgroundColor: theme.primary + "12",
                  borderColor: theme.primary + "25",
                  borderWidth: 1,
                },
              ]}
            >
              <Feather name="edit-3" size={16} color={theme.primary} />
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onDelete();
              }}
              style={[
                styles.actionButton,
                {
                  backgroundColor: theme.error + "12",
                  borderColor: theme.error + "25",
                  borderWidth: 1,
                },
              ]}
            >
              <Feather name="trash-2" size={16} color={theme.error} />
            </Pressable>
          </View>
        )}
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function WorkersScreen() {
  const { theme, isDark } = useTheme();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const role = user?.role; // contractor, builder, supervisor

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const insets = useSafeAreaInsets();
  const rawHeaderHeight = useHeaderHeight();
  const headerHeight = rawHeaderHeight > 0 ? rawHeaderHeight : insets.top + Platform.select({ ios: 44, default: 56 });
  const tabBarHeight = insets.bottom + 60;

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpgradeLimitModal, setShowUpgradeLimitModal] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<
    "free" | "professional" | "business"
  >("free");

  const route = useRoute<any>();
  const voiceSearchQuery = route.params?.voiceSearchQuery || "";

  const handleClearSearch = () => {
    navigation.setParams({ voiceSearchQuery: undefined } as any);
  };

  const filteredWorkers =
    voiceSearchQuery.trim() !== ""
      ? workers.filter((w) => {
          const transName = translateWorkerName(w.name, language);
          return (
            w.name.toLowerCase().includes(voiceSearchQuery.toLowerCase()) ||
            transName.toLowerCase().includes(voiceSearchQuery.toLowerCase())
          );
        })
      : workers;

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

      // Fetch user's active subscription plan from storage
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

  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        role !== "supervisor" ? (
          <Pressable
            onPress={handleAddWorker}
            style={{ marginRight: Spacing.md, padding: 4 }}
          >
            <Feather name="plus" size={24} color={theme.primary} />
          </Pressable>
        ) : null,
    });
  }, [navigation, role, theme.primary, handleAddWorker]);

  const handleEditWorker = (worker: Worker) => {
    appContextTracker.setContext({
      selectedWorkerId: worker.id,
      selectedWorkerName: worker.name,
    });
    navigation.navigate("AddWorker", { workerId: worker.id });
  };

  const handleDeleteWorker = (worker: Worker) => {
    appContextTracker.setContext({
      selectedWorkerId: worker.id,
      selectedWorkerName: worker.name,
    });
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        `${t.workers.delete}? ${t.workers.deleteConfirm}`,
      );
      if (confirmed) {
        // Immediately remove from local state so UI updates instantly
        setWorkers((prev) => prev.filter((w) => w.id !== worker.id));
        // Then call backend delete in background
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
          // Immediately remove from local state so UI updates instantly
          setWorkers((prev) => prev.filter((w) => w.id !== worker.id));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // Then call backend delete in background
          await storage.deleteWorker(worker.id);
        },
      },
    ]);
  };

  const getWarningText = () => {
    const count = workers.length;
    if (currentPlan === "free") {
      if (count === 10) {
        return "⚠️ You have used 10 of 15 worker slots.";
      }
      if (count === 14) {
        return "🚨 Only 1 worker slot remaining.\nUpgrade now to avoid interruption.";
      }
    } else if (currentPlan === "professional") {
      if (count === 95) {
        return "🚨 You are close to your worker limit.\nCurrent Usage: 95 / 100";
      }
    }
    return null;
  };

  const renderHeader = () => {
    const text = getWarningText();
    return (
      <View style={{ gap: Spacing.sm }}>
        {text ? (
          <View
            style={[
              styles.warningBanner,
              {
                backgroundColor: text.includes("🚨")
                  ? "rgba(239, 68, 68, 0.1)"
                  : "rgba(245, 158, 11, 0.1)",
                borderColor: text.includes("🚨")
                  ? "rgba(239, 68, 68, 0.2)"
                  : "rgba(245, 158, 11, 0.2)",
              },
            ]}
          >
            <ThemedText
              style={[
                styles.warningText,
                { color: text.includes("🚨") ? theme.error : "#D97706" },
              ]}
            >
              {text}
            </ThemedText>
          </View>
        ) : null}

        {voiceSearchQuery.trim() !== "" ? (
          <View
            style={[
              styles.warningBanner,
              {
                backgroundColor: theme.primary + "12",
                borderColor: theme.primary + "30",
                borderWidth: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: Spacing.xs + 2,
                borderRadius: BorderRadius.md,
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Feather
                name="search"
                size={14}
                color={theme.primary}
                style={{ marginRight: 6 }}
              />
              <ThemedText
                style={{
                  color: theme.primary,
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                Search: {"\""}{voiceSearchQuery}{"\""}
              </ThemedText>
            </View>
            <Pressable onPress={handleClearSearch} style={{ padding: 4 }}>
              <Feather name="x-circle" size={16} color={theme.primary} />
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  const renderWorker = ({ item, index }: { item: Worker; index: number }) => (
    <WorkerCard
      worker={item}
      onEdit={() => handleEditWorker(item)}
      onDelete={() => handleDeleteWorker(item)}
      theme={theme}
      isDark={isDark}
      t={t}
      index={index}
      role={role}
    />
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Feather
          name="users"
          size={64}
          color={theme.textSecondary}
          style={styles.emptyIcon}
        />
        <ThemedText type="h3" style={styles.emptyTitle}>
          {t.workers.noWorkers}
        </ThemedText>
        <ThemedText
          type="body"
          style={[styles.emptySubtitle, { color: theme.textSecondary }]}
        >
          {role === "supervisor"
            ? "No workers assigned to your projects yet."
            : t.workers.addFirst}
        </ThemedText>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      {isLoading ? (
        <View
          style={[
            styles.loadingContainer,
            { paddingTop: headerHeight + Spacing.xl },
          ]}
        >
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : null}
      <FlatList
        data={isLoading ? [] : filteredWorkers}
        renderItem={renderWorker}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        refreshing={false}
        onRefresh={loadWorkers}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Professional Upgrade Modal */}
      <Modal
        visible={showUpgradeLimitModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowUpgradeLimitModal(false)}
      >
        <BlurView
          intensity={isDark ? 80 : 90}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        >
          <View style={styles.modalCenteredView}>
            <ThemedView
              style={[
                styles.upgradeModalContent,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                  borderWidth: 1,
                },
              ]}
            >
              <View style={styles.modalIconContainer}>
                <ThemedText style={{ fontSize: 48 }}>🚀</ThemedText>
              </View>

              <ThemedText type="h2" style={styles.modalTitle}>
                🚀 Upgrade Required
              </ThemedText>

              <ThemedText
                type="body"
                style={[styles.modalMessage, { color: theme.textSecondary }]}
              >
                You have reached the maximum worker limit for your current plan.
                {"\n\n"}
                {currentPlan === "free"
                  ? "Free Plan allows up to 15 workers."
                  : "Professional Plan allows up to 100 workers."}
                {"\n\n"}
                Upgrade to Pro or Business to add more workers and unlock
                advanced features.
              </ThemedText>

              <View style={styles.modalBtnContainer}>
                <Pressable
                  onPress={() => {
                    setShowUpgradeLimitModal(false);
                    navigation.navigate(
                      "MainTabs" as any,
                      {
                        screen: "SettingsTab",
                        params: { openUpgrade: true },
                      } as any,
                    );
                  }}
                  style={styles.upgradeNowBtn}
                >
                  <LinearGradient
                    colors={[theme.primary, "#FF8C35"]}
                    style={styles.gradientBtn}
                  >
                    <ThemedText style={styles.upgradeNowText}>
                      Upgrade Now
                    </ThemedText>
                  </LinearGradient>
                </Pressable>

                <Pressable
                  onPress={() => setShowUpgradeLimitModal(false)}
                  style={[
                    styles.maybeLaterBtn,
                    { borderColor: theme.border, borderWidth: 1 },
                  ]}
                >
                  <ThemedText
                    style={[styles.maybeLaterText, { color: theme.text }]}
                  >
                    Maybe Later
                  </ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          </View>
        </BlurView>
      </Modal>
    </ThemedView>
  );
}

const CARD_RADIUS = 20;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  workerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: CARD_RADIUS,
    gap: Spacing.md,
  },
  workerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  workerAvatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  workerAvatarInitials: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  workerInfo: {
    flex: 1,
  },
  workerName: {
    marginBottom: Spacing.xs,
  },
  workerDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 2,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  phoneText: {
    fontSize: 12,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  categoryText: {
    fontWeight: "700",
    fontSize: 10,
    textTransform: "uppercase",
  },
  rateText: {
    fontSize: 13.5,
  },
  workerActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  separator: {
    height: Spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: Spacing["5xl"],
  },
  emptyIcon: {
    marginBottom: Spacing.lg,
    opacity: 0.5,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    textAlign: "center",
  },
  fabContainer: {
    position: "absolute",
    right: Spacing.lg,
  },
  fab: {
    width: Spacing.fabSize,
    height: Spacing.fabSize,
    borderRadius: Spacing.fabSize / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  warningBanner: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  warningText: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 20,
  },
  modalCenteredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  upgradeModalContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 24,
    padding: Spacing.xl,
    alignItems: "center",
    ...Shadows.md,
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontWeight: "800",
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  modalMessage: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  modalBtnContainer: {
    width: "100%",
    gap: Spacing.md,
  },
  upgradeNowBtn: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
  },
  gradientBtn: {
    paddingVertical: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  upgradeNowText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  maybeLaterBtn: {
    width: "100%",
    paddingVertical: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  maybeLaterText: {
    fontWeight: "600",
    fontSize: 16,
  },
});
