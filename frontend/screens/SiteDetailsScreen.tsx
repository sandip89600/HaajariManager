import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { storage, Site } from "@/utils/storage";

export default function SiteDetailsScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { siteId } = route.params;

  const [site, setSite] = useState<Site | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const loadDetails = async () => {
    setIsLoading(true);
    try {
      const result = await storage.getSiteById(siteId);
      if (result) {
        setSite(result);
      } else {
        Alert.alert("Error", "Site details could not be found");
        navigation.goBack();
      }
    } catch (e) {
      console.warn("Failed to load site details", e);
      Alert.alert("Error", "Failed to retrieve site configuration.");
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDetails();
    }, [siteId])
  );

  const handleArchive = async () => {
    triggerHaptic();
    Alert.alert(
      "Archive Site",
      "Are you sure you want to archive this site? It will hide it from normal active dashboards.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          onPress: async () => {
            const success = await storage.archiveSite(siteId);
            if (success) {
              loadDetails();
            } else {
              Alert.alert("Error", "Failed to archive site");
            }
          }
        }
      ]
    );
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

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.loadingCenter, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  if (!site) return null;

  const statusColors = getStatusColor(site.status);
  const startDateStr = site.startDate ? new Date(site.startDate).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }) : "N/A";

  const createdAtStr = site.createdAt ? new Date(site.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }) : "N/A";

  const updatedAtStr = site.updatedAt ? new Date(site.updatedAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }) : "N/A";

  const supervisor = typeof site.supervisor === "object" ? site.supervisor : null;

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Header bar */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Site Details</ThemedText>
        <Pressable
          onPress={() => {
            triggerHaptic();
            navigation.navigate("EditSite", { siteId: site.id });
          }}
          style={[styles.editBtn, { backgroundColor: theme.primary }]}
        >
          <Feather name="edit-2" size={18} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Title Card */}
        <View style={[styles.sectionCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <ThemedText style={styles.siteName}>{site.name}</ThemedText>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColors.text }]} />
              <ThemedText style={[styles.statusText, { color: statusColors.text }]}>{site.status}</ThemedText>
            </View>
          </View>
          <ThemedText style={styles.projectType}>{site.projectType}</ThemedText>
          {site.clientName ? (
            <ThemedText style={styles.clientLabel}>Client: {site.clientName}</ThemedText>
          ) : null}
        </View>

        {/* Address Card */}
        <View style={[styles.sectionCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <ThemedText style={styles.sectionTitle}>Address</ThemedText>
          <View style={{ flexDirection: "row", alignItems: "flex-start", marginTop: 8 }}>
            <Feather name="map-pin" size={16} color={theme.textSecondary} style={{ marginRight: 8, marginTop: 2 }} />
            <ThemedText style={styles.sectionValue}>{site.address}</ThemedText>
          </View>
        </View>

        {/* Supervisor Card */}
        <View style={[styles.sectionCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <ThemedText style={styles.sectionTitle}>Supervisor Information</ThemedText>
          {supervisor ? (
            <View style={{ marginTop: 10, gap: 8 }}>
              <View style={styles.infoRow}>
                <Feather name="user" size={15} color={theme.textSecondary} style={styles.infoIcon} />
                <ThemedText style={styles.infoValue}>{supervisor.name}</ThemedText>
              </View>
              {supervisor.phone ? (
                <View style={styles.infoRow}>
                  <Feather name="phone" size={15} color={theme.textSecondary} style={styles.infoIcon} />
                  <ThemedText style={styles.infoValue}>{supervisor.phone}</ThemedText>
                </View>
              ) : null}
              {supervisor.email ? (
                <View style={styles.infoRow}>
                  <Feather name="mail" size={15} color={theme.textSecondary} style={styles.infoIcon} />
                  <ThemedText style={styles.infoValue}>{supervisor.email}</ThemedText>
                </View>
              ) : null}
            </View>
          ) : (
            <ThemedText style={[styles.sectionValue, { marginTop: 8, opacity: 0.6 }]}>
              No supervisor assigned to this site yet.
            </ThemedText>
          )}
        </View>

        {/* Description Card */}
        <View style={[styles.sectionCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <ThemedText style={styles.sectionTitle}>Description / Notes</ThemedText>
          <ThemedText style={[styles.sectionValue, { marginTop: 8, lineHeight: 20 }]}>
            {site.description || "No description or special instructions provided."}
          </ThemedText>
        </View>

        {/* Metadata Details Card */}
        <View style={[styles.sectionCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <ThemedText style={styles.sectionTitle}>Site Schedule</ThemedText>
          <View style={{ marginTop: 10, gap: 8 }}>
            <View style={styles.metaRow}>
              <ThemedText style={styles.metaLabel}>Start Date</ThemedText>
              <ThemedText style={styles.metaVal}>{startDateStr}</ThemedText>
            </View>
            <View style={styles.metaRow}>
              <ThemedText style={styles.metaLabel}>Created At</ThemedText>
              <ThemedText style={styles.metaVal}>{createdAtStr}</ThemedText>
            </View>
            <View style={styles.metaRow}>
              <ThemedText style={styles.metaLabel}>Last Configured</ThemedText>
              <ThemedText style={styles.metaVal}>{updatedAtStr}</ThemedText>
            </View>
          </View>
        </View>

        {/* Quick Actions (e.g. Archive) */}
        {!site.isArchived && site.status !== "Completed" && (
          <Pressable
            onPress={handleArchive}
            style={[styles.archiveBtn, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
          >
            <Feather name="archive" size={16} color={theme.text} style={{ marginRight: 8 }} />
            <ThemedText style={{ fontWeight: "700" }}>Archive Site</ThemedText>
          </Pressable>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  loadingCenter: {
    justifyContent: "center",
    alignItems: "center"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 54 : 16,
    paddingBottom: 12
  },
  backBtn: {
    padding: 6
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800"
  },
  editBtn: {
    padding: 10,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center"
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 60
  },
  sectionCard: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    padding: 16
  },
  siteName: {
    fontSize: 18,
    fontWeight: "800",
    flex: 1
  },
  projectType: {
    fontSize: 14,
    opacity: 0.7
  },
  clientLabel: {
    fontSize: 13,
    fontWeight: "700",
    opacity: 0.8,
    marginTop: 8
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    opacity: 0.9,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  sectionValue: {
    fontSize: 14,
    opacity: 0.85
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  infoIcon: {
    marginRight: 10,
    width: 16,
    opacity: 0.7
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "700"
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#FFFFFF10",
    paddingVertical: 4
  },
  metaLabel: {
    fontSize: 13,
    opacity: 0.7
  },
  metaVal: {
    fontSize: 13,
    fontWeight: "700"
  },
  archiveBtn: {
    flexDirection: "row",
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    marginTop: 10
  }
});
