import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useNotifications, NotificationItem } from "@/hooks/useNotifications";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

export default function NotificationScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [activeFilter, setActiveFilter] = useState<
    "all" | "unread" | "reminders" | "system"
  >("all");

  const {
    notifications,
    unreadCount,
    isLoading,
    isRefetching,
    refetch,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  // Filter notifications according to active tab
  const filteredNotifications = notifications.filter((item) => {
    if (activeFilter === "unread") return !item.isRead;
    if (activeFilter === "reminders")
      return item.type.includes("reminder");
    if (activeFilter === "system")
      return item.type === "system" || item.type === "announcement";
    return true;
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "attendance_reminder":
        return <Feather name="calendar" size={18} color="#FF6B35" />;
      case "subscription_reminder":
        return <MaterialCommunityIcons name="crown-outline" size={20} color="#F59E0B" />;
      case "payment_reminder":
        return <Feather name="dollar-sign" size={18} color="#10B981" />;
      case "worker_reminder":
        return <Feather name="users" size={18} color="#3B82F6" />;
      case "site_reminder":
        return <Feather name="map-pin" size={18} color="#8B5CF6" />;
      case "announcement":
        return <Ionicons name="megaphone-outline" size={18} color="#EC4899" />;
      default:
        return <Feather name="bell" size={18} color={theme.primary} />;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch (e) {
      return "";
    }
  };

  const handleNotificationPress = async (item: NotificationItem) => {
    if (!item.isRead) {
      markAsRead(item._id).catch(() => {});
    }

    const screen = item.data?.screen;
    const params = item.data?.params;

    if (screen) {
      try {
        if (screen === "Attendance") {
          navigation.navigate("MainTabs", {
            screen: "AttendanceTab",
            params: { screen: "Dashboard", ...params },
          });
        } else if (screen === "Settings") {
          navigation.navigate("MainTabs", {
            screen: "SettingsTab",
            params,
          });
        } else if (screen === "Workers") {
          navigation.navigate("MainTabs", {
            screen: "WorkersTab",
            params,
          });
        } else if (screen === "Payments") {
          navigation.navigate("MainTabs", {
            screen: "ReportsTab",
            params,
          });
        } else {
          navigation.navigate(screen as any, params);
        }
      } catch (e) {
        console.warn("Deep linking navigation error:", e);
      }
    }
  };

  const handleMarkAllRead = () => {
    if (unreadCount === 0) return;
    markAllAsRead().catch(() =>
      Alert.alert("Error", "Failed to mark all notifications as read.")
    );
  };

  const renderItem = ({ item }: { item: NotificationItem }) => {
    return (
      <Pressable
        onPress={() => handleNotificationPress(item)}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: isDark
              ? item.isRead
                ? "rgba(255,255,255,0.03)"
                : "rgba(255, 107, 53, 0.08)"
              : item.isRead
              ? "#FFFFFF"
              : "#FFF5F0",
            borderColor: item.isRead
              ? theme.border
              : isDark
              ? "rgba(255, 107, 53, 0.3)"
              : "rgba(255, 107, 53, 0.2)",
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.04)",
              },
            ]}
          >
            {getNotificationIcon(item.type)}
          </View>
          <View style={{ flex: 1, marginHorizontal: Spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <ThemedText
                style={[
                  styles.titleText,
                  !item.isRead && { fontWeight: "800", color: theme.text },
                ]}
                numberOfLines={1}
              >
                {item.title}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11 }}>
                {formatTime(item.createdAt)}
              </ThemedText>
            </View>
            <ThemedText
              type="body"
              style={[
                styles.messageText,
                { color: item.isRead ? theme.textSecondary : theme.text },
              ]}
              numberOfLines={2}
            >
              {item.message}
            </ThemedText>
          </View>
          {!item.isRead && <View style={styles.unreadDot} />}
        </View>

        <View style={styles.cardActions}>
          {!item.isRead && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                markAsRead(item._id);
              }}
              style={styles.actionBtn}
            >
              <Feather name="check" size={13} color={theme.primary} />
              <ThemedText style={[styles.actionText, { color: theme.primary }]}>
                Mark Read
              </ThemedText>
            </Pressable>
          )}
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              deleteNotification(item._id);
            }}
            style={styles.actionBtn}
          >
            <Feather name="trash-2" size={13} color={theme.textSecondary} />
            <ThemedText style={[styles.actionText, { color: theme.textSecondary }]}>
              Delete
            </ThemedText>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      {/* Top Header */}
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: insets.top + Spacing.sm,
            backgroundColor: theme.backgroundDefault,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={theme.text} />
        </Pressable>
        <ThemedText type="h2" style={{ fontWeight: "800", flex: 1, marginLeft: 8 }}>
          Notifications
        </ThemedText>
        {unreadCount > 0 && (
          <Pressable onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Feather name="check-circle" size={14} color={theme.primary} />
            <ThemedText style={{ color: theme.primary, fontSize: 13, fontWeight: "700", marginLeft: 4 }}>
              Mark All Read
            </ThemedText>
          </Pressable>
        )}
      </View>

      {/* Filter Pills */}
      <View style={styles.filterRow}>
        {(["all", "unread", "reminders", "system"] as const).map((filter) => {
          const isActive = activeFilter === filter;
          const label =
            filter === "all"
              ? "All"
              : filter === "unread"
              ? `Unread (${unreadCount})`
              : filter === "reminders"
              ? "Reminders"
              : "System";

          return (
            <Pressable
              key={filter}
              onPress={() => setActiveFilter(filter)}
              style={[
                styles.pill,
                {
                  backgroundColor: isActive
                    ? theme.primary
                    : isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,0,0,0.04)",
                },
              ]}
            >
              <ThemedText
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? "700" : "500",
                  color: isActive ? "#FFFFFF" : theme.textSecondary,
                }}
              >
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* Notifications List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : filteredNotifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="bell-off" size={48} color={theme.textSecondary} style={{ marginBottom: 12 }} />
          <ThemedText type="h3" style={{ fontWeight: "700", color: theme.text }}>
            No Notifications
          </ThemedText>
          <ThemedText style={{ color: theme.textSecondary, textAlign: "center", marginTop: 4, fontSize: 13 }}>
            {activeFilter === "unread"
              ? "You're all caught up! No unread notifications."
              : "Notifications and automated reminders will appear here."}
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={{
            padding: Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
            gap: Spacing.md,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.primary}
            />
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  markAllBtn: { flexDirection: "row", alignItems: "center", padding: 4 },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  titleText: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  messageText: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF6B35",
    marginTop: 6,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.06)",
    gap: Spacing.lg,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
});
