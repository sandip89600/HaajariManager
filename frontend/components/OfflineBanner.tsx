import React from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useLanguage } from "@/hooks/useLanguage";

export default function OfflineBanner() {
  const { isOnline, isSyncing, pendingCount, showSyncedBanner, triggerSync } = useNetworkStatus();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  // If online, not syncing, no pending count, and not showing finished banner, don't render anything
  if (isOnline && !isSyncing && pendingCount === 0 && !showSyncedBanner) {
    return null;
  }

  let bannerBg = "#F59E0B"; // Amber for offline
  let textColor = "#78350F";
  let iconName: any = "cloud-off";
  let message = t("common.offlineNotice", "Offline — Changes will sync when online");

  if (showSyncedBanner && isOnline && !isSyncing) {
    bannerBg = "#10B981"; // Green for synced
    textColor = "#FFFFFF";
    iconName = "check-circle";
    message = t("common.allSynced", "All changes synced with server");
  } else if (isSyncing) {
    bannerBg = "#3B82F6"; // Blue for syncing
    textColor = "#FFFFFF";
    iconName = "refresh-cw";
    message = t("common.syncingNotice", "Back Online — Syncing changes...");
  } else if (!isOnline && pendingCount > 0) {
    message = `${t("common.offlineNotice", "Offline")} • ${pendingCount} ${t("common.changesPending", "pending changes")}`;
  }

  return (
    <View style={[styles.container, { backgroundColor: bannerBg, paddingTop: Math.max(insets.top, 6) }]}>
      <Pressable onPress={() => isOnline && triggerSync()} style={styles.contentRow}>
        {isSyncing ? (
          <ActivityIndicator size="small" color={textColor} style={{ marginRight: 8 }} />
        ) : (
          <Feather name={iconName} size={15} color={textColor} style={{ marginRight: 8 }} />
        )}
        <Text style={[styles.messageText, { color: textColor }]}>
          {message}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingBottom: 6,
    paddingHorizontal: 16,
    zIndex: 9999,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  messageText: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
});
