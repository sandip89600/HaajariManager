import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { siteActivityStorage, SiteActivityProof } from "@/utils/storage";

type FilterType = "all" | "instructions" | "work" | "issues";

export default function WorkerSiteLogsScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [filter, setFilter] = useState<FilterType>("all");
  const [logs, setLogs] = useState<SiteActivityProof[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fullscreen photo modal
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await siteActivityStorage.getWorkerSiteLogs(filter);
      if (data.activities) {
        setLogs(data.activities);
      }
    } catch (e) {
      console.warn("Failed to fetch worker site logs:", e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    setIsLoading(true);
    fetchLogs();
  }, [fetchLogs]);

  const onRefresh = () => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchLogs();
  };

  const cardBg = isDark ? "#1E293B" : "#FFFFFF";
  const borderCol = isDark ? "#334155" : "#E2E8F0";

  const renderBadge = (item: SiteActivityProof) => {
    switch (item.type) {
      case "MORNING_WORK":
        return {
          label: t("camera.morning", "🌅 Morning Work"),
          color: "#F59E0B",
          bg: "#FEF3C7",
          icon: "weather-sunny",
        };
      case "EVENING_WORK":
        return {
          label: t("camera.evening", "🌆 Evening Work"),
          color: "#3B82F6",
          bg: "#DBEAFE",
          icon: "weather-sunset",
        };
      case "INSTRUCTION":
        return {
          label: t("site.instruction", "📋 Contractor Instruction"),
          color: "#8B5CF6",
          bg: "#EDE9FE",
          icon: "bullhorn",
        };
      case "ISSUE":
        return {
          label: t("site.issue", "⚠️ Site Issue"),
          color: item.status === "RESOLVED" ? "#10B981" : "#EF4444",
          bg: item.status === "RESOLVED" ? "#DCFCE7" : "#FEE2E2",
          icon: "alert-circle",
        };
      default:
        return {
          label: "Update",
          color: "#64748B",
          bg: "#F1F5F9",
          icon: "information",
        };
    }
  };

  const renderItem = ({ item }: { item: SiteActivityProof }) => {
    const badge = renderBadge(item);

    return (
      <View
        style={[
          styles.logCard,
          { backgroundColor: cardBg, borderColor: borderCol },
        ]}
      >
        {/* Card Header */}
        <View style={styles.cardHeaderRow}>
          <View style={[styles.typeBadge, { backgroundColor: badge.bg }]}>
            <MaterialCommunityIcons
              name={badge.icon as any}
              size={14}
              color={badge.color}
            />
            <Text style={[styles.typeBadgeText, { color: badge.color }]}>
              {badge.label}
            </Text>
          </View>

          <View style={styles.timeTag}>
            <Feather
              name="clock"
              size={12}
              color={isDark ? "#94A3B8" : "#64748B"}
            />
            <Text
              style={[
                styles.timeText,
                { color: isDark ? "#94A3B8" : "#64748B" },
              ]}
            >
              {item.dateStr} • {item.timeStr}
            </Text>
          </View>
        </View>

        {/* Site Location Tag */}
        {item.site?.name && (
          <View style={styles.siteInfoRow}>
            <Feather name="map-pin" size={13} color={theme.primary} />
            <Text
              style={[
                styles.siteNameText,
                { color: isDark ? "#CBD5E1" : "#475569" },
              ]}
            >
              {item.site.name}
            </Text>
            {item.location?.isVerifiedSiteLocation && (
              <View style={styles.verifiedLocationBadge}>
                <Feather name="check-circle" size={10} color="#10B981" />
                <Text style={styles.verifiedLocationText}>
                  {t("site.verifiedLocation", "Verified On-Site")}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Description / Content */}
        {item.description ? (
          <Text
            style={[
              styles.descriptionText,
              { color: isDark ? "#F8FAFC" : "#0F172A" },
            ]}
          >
            {item.description}
          </Text>
        ) : null}

        {/* Photo Preview */}
        {item.photo?.url ? (
          <Pressable
            onPress={() => setSelectedImage(item.photo?.url || null)}
            style={styles.imageThumbnailContainer}
          >
            <Image
              source={{ uri: item.photo.url }}
              style={styles.imageThumbnail}
              resizeMode="cover"
            />
            <View style={styles.zoomOverlayBadge}>
              <Feather name="maximize-2" size={12} color="#FFFFFF" />
              <Text style={styles.zoomText}>
                {t("common.tapToView", "View Full")}
              </Text>
            </View>
          </Pressable>
        ) : null}

        {/* Status footer for issues */}
        {item.type === "ISSUE" && (
          <View style={styles.issueFooterRow}>
            <Text
              style={[
                styles.issueStatusText,
                { color: item.status === "RESOLVED" ? "#10B981" : "#EF4444" },
              ]}
            >
              {item.status === "RESOLVED"
                ? `✅ ${t("issue.resolved", "Resolved")}`
                : `⏳ ${t("issue.open", "Under Review")}`}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
          paddingTop: insets.top + 12,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text
          style={[
            styles.headerTitle,
            { color: isDark ? "#F8FAFC" : "#0F172A" },
          ]}
        >
          {t("nav.siteLogs", "📋 Site Timeline & Logs")}
        </Text>
        <Text
          style={[
            styles.headerSubtitle,
            { color: isDark ? "#94A3B8" : "#64748B" },
          ]}
        >
          {t(
            "site.logsSubtitle",
            "Daily work proofs, photos and contractor instructions",
          )}
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(
          [
            { id: "all", label: t("common.all", "All") },
            { id: "work", label: t("camera.work", "📸 Work") },
            {
              id: "instructions",
              label: t("site.instructions", "📋 Instructions"),
            },
            { id: "issues", label: t("site.issues", "⚠️ Issues") },
          ] as { id: FilterType; label: string }[]
        ).map((tab) => {
          const isActive = filter === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => {
                Haptics.selectionAsync();
                setFilter(tab.id);
              }}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive
                    ? theme.primary
                    : isDark
                      ? "#1E293B"
                      : "#FFFFFF",
                  borderColor: isActive ? theme.primary : borderCol,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color: isActive
                      ? "#FFFFFF"
                      : isDark
                        ? "#94A3B8"
                        : "#64748B",
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* List / Timeline */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: insets.bottom + 40 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View
                style={[
                  styles.emptyIconCircle,
                  { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" },
                ]}
              >
                <Feather
                  name="file-text"
                  size={36}
                  color={isDark ? "#64748B" : "#94A3B8"}
                />
              </View>
              <Text
                style={[
                  styles.emptyTitle,
                  { color: isDark ? "#F8FAFC" : "#0F172A" },
                ]}
              >
                {t("site.noLogsFound", "No Activity Logs Yet")}
              </Text>
              <Text
                style={[
                  styles.emptySubtitle,
                  { color: isDark ? "#94A3B8" : "#64748B" },
                ]}
              >
                {t(
                  "site.noLogsSubtitle",
                  "Use the Camera tab to submit morning and evening work updates.",
                )}
              </Text>
            </View>
          }
        />
      )}

      {/* Photo Fullscreen Modal */}
      <Modal
        visible={!!selectedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            onPress={() => setSelectedImage(null)}
            style={styles.modalCloseBtn}
          >
            <Feather name="x" size={24} color="#FFFFFF" />
          </Pressable>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    gap: 12,
  },
  logCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 5,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  timeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    fontWeight: "500",
  },
  siteInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  siteNameText: {
    fontSize: 12,
    fontWeight: "600",
  },
  verifiedLocationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    gap: 3,
  },
  verifiedLocationText: {
    color: "#10B981",
    fontSize: 10,
    fontWeight: "700",
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  imageThumbnailContainer: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    marginTop: 4,
  },
  imageThumbnail: {
    width: "100%",
    height: "100%",
  },
  zoomOverlayBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
  },
  zoomText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  issueFooterRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148, 163, 184, 0.2)",
  },
  issueStatusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenImage: {
    width: "95%",
    height: "80%",
  },
});
