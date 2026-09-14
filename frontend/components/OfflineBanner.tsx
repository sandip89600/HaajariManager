import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useLanguage } from "@/hooks/useLanguage";

export default function OfflineBanner() {
  const { isOnline, checkConnectivity } = useNetworkStatus();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  if (isOnline) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: Math.max(insets.top, 6) },
      ]}
    >
      <Pressable
        onPress={() => checkConnectivity()}
        style={styles.contentRow}
      >
        <Feather
          name="wifi-off"
          size={14}
          color="#FFFFFF"
          style={{ marginRight: 6 }}
        />
        <Text style={styles.messageText}>
          {t("common.noInternet", "No Internet Connection — Reconnecting...")}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#EF4444",
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
    color: "#FFFFFF",
    textAlign: "center",
  },
});
