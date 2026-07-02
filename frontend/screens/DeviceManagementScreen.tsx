import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useTheme } from "@/hooks/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spacing, BorderRadius } from "@/constants/theme";
import { authenticatedFetch, API_URL } from "@/utils/storage";
import { useLanguage } from "@/hooks/useLanguage";
import { appContextTracker } from "@/utils/appContextTracker";

interface Device {
  deviceId: string;
  deviceName: string;
  deviceOs: string;
  deviceBrowser: string;
  ipAddress: string;
  location: string;
  lastActiveAt: string;
  isSuspicious: boolean;
}

interface LoginHistoryItem {
  loginTime: string;
  logoutTime?: string;
  deviceId: string;
  deviceName: string;
  deviceOs: string;
  deviceBrowser: string;
  ipAddress: string;
  location: string;
}

export default function DeviceManagementScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = insets.bottom + 60;

  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [trustedDevices, setTrustedDevices] = useState<Device[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      appContextTracker.setContext({
        currentScreen: "DeviceManagement",
      });
    });
    return unsubscribe;
  }, [navigation]);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/auth/security/sessions`);
      if (res.ok) {
        const data = await res.json();
        setTrustedDevices(data.trustedDevices || []);
        setLoginHistory(data.loginHistory || []);
      }
    } catch (e) {
      console.warn("Failed to load security sessions", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoutDevice = async (deviceId: string, deviceName: string) => {
    Alert.alert(
      t.device.revokeSession,
      t.device.revokeConfirm.replace("{deviceName}", deviceName),
      [
        { text: t.common.cancel || "Cancel", style: "cancel" },
        {
          text: t.device.logoutDevice,
          style: "destructive",
          onPress: async () => {
            setIsActionLoading(true);
            try {
              const res = await authenticatedFetch(
                `${API_URL}/auth/security/logout-device`,
                {
                  method: "POST",
                  body: JSON.stringify({ deviceId }),
                },
              );
              if (res.ok) {
                Alert.alert(t.common.success || "Success", t.device.successRevoke);
                loadSessions();
              } else {
                Alert.alert(t.common.error || "Error", t.device.errorRevoke);
              }
            } catch (e) {
              Alert.alert(t.common.error || "Error", t.device.errorLogoutAll);
            } finally {
              setIsActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleLogoutAllDevices = async () => {
    Alert.alert(
      t.device.logoutAllTitle,
      t.device.logoutAllConfirm,
      [
        { text: t.common.cancel || "Cancel", style: "cancel" },
        {
          text: t.device.logoutAllButton,
          style: "destructive",
          onPress: async () => {
            setIsActionLoading(true);
            try {
              const res = await authenticatedFetch(
                `${API_URL}/auth/security/logout-all`,
                {
                  method: "POST",
                },
              );
              if (res.ok) {
                Alert.alert(
                  t.common.success || "Success",
                  t.device.successLogoutAll,
                );
                loadSessions();
              } else {
                Alert.alert(t.common.error || "Error", t.device.errorLogoutAll);
              }
            } catch (e) {
              Alert.alert(t.common.error || "Error", t.device.errorLogoutAll);
            } finally {
              setIsActionLoading(false);
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          { backgroundColor: theme.backgroundRoot },
        ]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.backgroundDefault,
            borderBottomColor: theme.border,
            paddingTop: insets.top || Spacing.md,
          },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="chevron-left" size={28} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">{t.device.title}</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScreenScrollView
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
        }}
      >
        {/* Trusted Devices Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              {t.device.trustedDevices}
            </ThemedText>
            {trustedDevices.length > 1 && (
              <Pressable
                onPress={handleLogoutAllDevices}
                disabled={isActionLoading}
              >
                <ThemedText
                  style={{
                    color: theme.error,
                    fontWeight: "700",
                    fontSize: 13,
                  }}
                >
                  {t.device.logoutAll}
                </ThemedText>
              </Pressable>
            )}
          </View>

          {trustedDevices.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
              ]}
            >
              <ThemedText style={{ color: theme.textSecondary }}>
                {t.device.noActiveSessions}
              </ThemedText>
            </View>
          ) : (
            trustedDevices.map((device, idx) => (
              <View
                key={device.deviceId || idx}
                style={[
                  styles.deviceCard,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                    marginBottom: Spacing.md,
                  },
                ]}
              >
                <View style={styles.deviceIconWrapper}>
                  <Feather
                    name={
                      device.deviceOs.toLowerCase() === "ios" ||
                      device.deviceOs.toLowerCase() === "android"
                        ? "smartphone"
                        : "monitor"
                    }
                    size={24}
                    color={theme.primary}
                  />
                </View>
                <View style={styles.deviceInfo}>
                  <ThemedText style={{ fontWeight: "700", fontSize: 16 }}>
                    {device.deviceName}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, marginTop: 2 }}
                  >
                    {device.deviceOs} | Browser: {device.deviceBrowser}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, marginTop: 2 }}
                  >
                    📍 {device.location} (IP: {device.ipAddress})
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{
                      color: theme.primary,
                      fontWeight: "600",
                      marginTop: 4,
                    }}
                  >
                    {t.device.lastActive}: {new Date(device.lastActiveAt).toLocaleString()}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() =>
                    handleLogoutDevice(device.deviceId, device.deviceName)
                  }
                  style={[
                    styles.revokeBtn,
                    { backgroundColor: theme.error + "15" },
                  ]}
                >
                  <Feather name="log-out" size={16} color={theme.error} />
                </Pressable>
              </View>
            ))
          )}
        </View>

        {/* Login History Section */}
        <View style={styles.section}>
          <ThemedText
            type="h4"
            style={[styles.sectionTitle, { marginBottom: Spacing.md }]}
          >
            {t.device.recentLoginHistory}
          </ThemedText>

          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
              },
            ]}
          >
            {loginHistory.length === 0 ? (
              <View style={{ padding: Spacing.lg, alignItems: "center" }}>
                <ThemedText style={{ color: theme.textSecondary }}>
                  {t.device.noHistory}
                </ThemedText>
              </View>
            ) : (
              loginHistory.map((history, idx) => (
                <View key={idx}>
                  <View style={styles.historyRow}>
                    <View style={styles.historyDotContainer}>
                      <View
                        style={[
                          styles.historyDot,
                          { backgroundColor: theme.primary },
                        ]}
                      />
                      {idx < loginHistory.length - 1 && (
                        <View
                          style={[
                            styles.historyLine,
                            { backgroundColor: theme.border },
                          ]}
                        />
                      )}
                    </View>
                    <View style={styles.historyContent}>
                      <ThemedText style={{ fontWeight: "700", fontSize: 14 }}>
                        {history.deviceName} ({history.deviceOs})
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{ color: theme.textSecondary, marginTop: 1 }}
                      >
                        📍 {history.location} | IP: {history.ipAddress}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{ color: theme.textSecondary, marginTop: 2 }}
                      >
                        🔑 {t.device.loggedIn}:{" "}
                        {new Date(history.loginTime).toLocaleString()}
                      </ThemedText>
                      {history.logoutTime && (
                        <ThemedText
                          type="small"
                          style={{ color: theme.textSecondary, marginTop: 1 }}
                        >
                          🚪 {t.device.loggedOut}:{" "}
                          {new Date(history.logoutTime).toLocaleString()}
                        </ThemedText>
                      )}
                    </View>
                  </View>
                  {idx < loginHistory.length - 1 && (
                    <View
                      style={[
                        styles.divider,
                        { backgroundColor: theme.border },
                      ]}
                    />
                  )}
                </View>
              ))
            )}
          </View>
        </View>
      </ScreenScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  headerSpacer: {
    width: 28,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontWeight: "700",
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  deviceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  deviceIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(79, 70, 229, 0.08)",
    marginRight: Spacing.md,
  },
  deviceInfo: {
    flex: 1,
  },
  revokeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm,
  },
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  historyRow: {
    flexDirection: "row",
    padding: Spacing.lg,
  },
  historyDotContainer: {
    alignItems: "center",
    marginRight: Spacing.md,
    paddingTop: 4,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  historyLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
  },
  historyContent: {
    flex: 1,
  },
  divider: {
    height: 1,
  },
});
