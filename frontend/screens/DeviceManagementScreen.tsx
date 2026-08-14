import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
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
import { getOrCreateDeviceId } from "@/utils/device";

interface Device {
  deviceId: string;
  deviceName: string;
  deviceOs: string;
  deviceBrowser: string;
  ipAddress: string;
  location: string;
  lastActiveAt: string;
  firstSeenAt?: string;
  trusted?: boolean;
  isSuspicious?: boolean;
  isRevoked?: boolean;
}

interface SecurityEventItem {
  _id: string;
  eventType: string;
  deviceName?: string;
  platform?: string;
  browser?: string;
  ipAddress?: string;
  approximateLocation?: string;
  status: string;
  timestamp: string;
}

export default function DeviceManagementScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tabBarHeight = insets.bottom + 60;

  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>("");
  const [trustedDevices, setTrustedDevices] = useState<Device[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEventItem[]>([]);

  useEffect(() => {
    getOrCreateDeviceId().then((id) => setCurrentDeviceId(id));
    loadSessions();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      appContextTracker.setContext({
        currentScreen: "DeviceManagement",
      });
      loadSessions();
    });
    return unsubscribe;
  }, [navigation]);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const [sessionsRes, eventsRes] = await Promise.all([
        authenticatedFetch(`${API_URL}/auth/security/sessions`),
        authenticatedFetch(`${API_URL}/auth/security/events`),
      ]);

      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        setTrustedDevices(data.trustedDevices || []);
      }
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setSecurityEvents(eventsData.events || []);
      }
    } catch (e) {
      console.warn("Failed to load security sessions", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoutDevice = async (deviceId: string, deviceName: string) => {
    Alert.alert(
      t.device?.revokeSession || "Logout Device",
      `Are you sure you want to log out ${deviceName}?`,
      [
        { text: t.common?.cancel || "Cancel", style: "cancel" },
        {
          text: "Logout Device",
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
                Alert.alert("Success", "Device logged out successfully.");
                loadSessions();
              } else {
                Alert.alert("Error", "Failed to logout device.");
              }
            } catch (e) {
              Alert.alert("Error", "Failed to process logout.");
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
      "Logout All Other Devices",
      "Are you sure you want to log out all other devices? Your current session will remain active.",
      [
        { text: t.common?.cancel || "Cancel", style: "cancel" },
        {
          text: "Logout All Other Devices",
          style: "destructive",
          onPress: async () => {
            setIsActionLoading(true);
            try {
              const res = await authenticatedFetch(
                `${API_URL}/auth/security/logout-all`,
                {
                  method: "POST",
                  body: JSON.stringify({ currentDeviceId }),
                },
              );
              if (res.ok) {
                Alert.alert("Success", "All other devices have been logged out.");
                loadSessions();
              } else {
                Alert.alert("Error", "Failed to logout other devices.");
              }
            } catch (e) {
              Alert.alert("Error", "Failed to process logout.");
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

  // Filter out revoked devices
  const activeDevices = trustedDevices.filter((d) => !d.isRevoked);

  const currentDevice = activeDevices.find((d) => d.deviceId === currentDeviceId) || activeDevices[0];
  const otherDevices = activeDevices.filter((d) => d.deviceId !== currentDevice?.deviceId);

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
        <ThemedText type="h3">Devices & Sessions</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScreenScrollView
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
        }}
      >
        {/* CURRENT DEVICE SECTION */}
        {currentDevice && (
          <View style={styles.section}>
            <ThemedText type="h4" style={[styles.sectionTitle, { marginBottom: Spacing.sm }]}>
              Current Device
            </ThemedText>
            <View
              style={[
                styles.deviceCard,
                {
                  backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                  borderColor: theme.primary,
                  borderWidth: 1.5,
                },
              ]}
            >
              <View style={styles.deviceIconWrapper}>
                <Feather
                  name={
                    currentDevice.deviceOs?.toLowerCase() === "ios" ||
                    currentDevice.deviceOs?.toLowerCase() === "android"
                      ? "smartphone"
                      : "monitor"
                  }
                  size={24}
                  color={theme.primary}
                />
              </View>
              <View style={styles.deviceInfo}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <ThemedText style={{ fontWeight: "700", fontSize: 16 }}>
                    {currentDevice.deviceName}
                  </ThemedText>
                  <View style={styles.thisDeviceBadge}>
                    <ThemedText style={styles.thisDeviceBadgeText}>THIS DEVICE</ThemedText>
                  </View>
                </View>

                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: 2 }}
                >
                  {currentDevice.deviceOs || "Mobile"} | {currentDevice.deviceBrowser || "Haajari App"}
                </ThemedText>

                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: 2 }}
                >
                  📍 {currentDevice.location || "Location unavailable"}
                </ThemedText>

                <ThemedText
                  type="small"
                  style={{ color: "#10B981", fontWeight: "700", marginTop: 4 }}
                >
                  ● Active now
                </ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* OTHER DEVICES SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Other Active Devices ({otherDevices.length})
            </ThemedText>
            {otherDevices.length > 0 && (
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
                  Logout All Other Devices
                </ThemedText>
              </Pressable>
            )}
          </View>

          {otherDevices.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
              ]}
            >
              <Feather name="shield" size={28} color="#10B981" style={{ marginBottom: 6 }} />
              <ThemedText style={{ color: theme.textSecondary, fontSize: 13, textAlign: "center" }}>
                No other devices are currently signed in.
              </ThemedText>
            </View>
          ) : (
            otherDevices.map((device, idx) => (
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
                      device.deviceOs?.toLowerCase() === "ios" ||
                      device.deviceOs?.toLowerCase() === "android"
                        ? "smartphone"
                        : "monitor"
                    }
                    size={24}
                    color={theme.primary}
                  />
                </View>
                <View style={styles.deviceInfo}>
                  <ThemedText style={{ fontWeight: "700", fontSize: 15 }}>
                    {device.deviceName}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, marginTop: 2 }}
                  >
                    {device.deviceOs || "Unknown OS"} | {device.deviceBrowser || "Browser"}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, marginTop: 2 }}
                  >
                    📍 {device.location || "Location unavailable"}
                  </ThemedText>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary }}
                    >
                      Last active: {new Date(device.lastActiveAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                    </ThemedText>
                    {device.trusted ? (
                      <View style={styles.trustedBadge}>
                        <Feather name="check" size={10} color="#10B981" />
                        <ThemedText style={styles.trustedBadgeText}>Trusted</ThemedText>
                      </View>
                    ) : (
                      <View style={styles.untrustedBadge}>
                        <ThemedText style={styles.untrustedBadgeText}>Unverified</ThemedText>
                      </View>
                    )}
                  </View>
                </View>
                <Pressable
                  onPress={() => handleLogoutDevice(device.deviceId, device.deviceName)}
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

        {/* SECURITY ACTIVITY HISTORY SECTION */}
        <View style={styles.section}>
          <ThemedText
            type="h4"
            style={[styles.sectionTitle, { marginBottom: Spacing.md }]}
          >
            Security Activity History
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
            {securityEvents.length === 0 ? (
              <View style={{ padding: Spacing.lg, alignItems: "center" }}>
                <ThemedText style={{ color: theme.textSecondary, fontSize: 13 }}>
                  No security alerts recorded yet.
                </ThemedText>
              </View>
            ) : (
              securityEvents.slice(0, 15).map((evt, idx) => {
                const isConfirmed = evt.status === "confirmed_by_user";
                const isSuspicious = evt.status === "marked_suspicious";

                return (
                  <View key={evt._id || idx}>
                    <View style={styles.historyRow}>
                      <View style={styles.historyDotContainer}>
                        <View
                          style={[
                            styles.historyDot,
                            {
                              backgroundColor: isSuspicious
                                ? "#EF4444"
                                : isConfirmed
                                ? "#10B981"
                                : theme.primary,
                            },
                          ]}
                        />
                        {idx < Math.min(securityEvents.length, 15) - 1 && (
                          <View
                            style={[
                              styles.historyLine,
                              { backgroundColor: theme.border },
                            ]}
                          />
                        )}
                      </View>
                      <View style={styles.historyContent}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <ThemedText style={{ fontWeight: "700", fontSize: 14 }}>
                            {evt.eventType === "NEW_DEVICE_LOGIN"
                              ? "🔐 New Login Detected"
                              : evt.eventType === "TRUST_DEVICE"
                              ? "✅ Device Trusted"
                              : evt.eventType === "SECURITY_ALERT"
                              ? "⚠️ Security Alert"
                              : evt.eventType}
                          </ThemedText>
                          <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11 }}>
                            {new Date(evt.timestamp).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                          </ThemedText>
                        </View>

                        <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                          {evt.deviceName || "Device"} ({evt.platform || "Platform"}) &bull; 📍 {evt.approximateLocation || "Location unavailable"}
                        </ThemedText>

                        <View style={{ marginTop: 4 }}>
                          {isConfirmed ? (
                            <ThemedText type="small" style={{ color: "#10B981", fontWeight: "700" }}>
                              Status: Confirmed by you
                            </ThemedText>
                          ) : isSuspicious ? (
                            <ThemedText type="small" style={{ color: "#EF4444", fontWeight: "700" }}>
                              Status: Marked as suspicious
                            </ThemedText>
                          ) : (
                            <ThemedText type="small" style={{ color: theme.textSecondary }}>
                              Status: Unverified new login
                            </ThemedText>
                          )}
                        </View>
                      </View>
                    </View>
                    {idx < Math.min(securityEvents.length, 15) - 1 && (
                      <View style={[styles.divider, { backgroundColor: theme.border }]} />
                    )}
                  </View>
                );
              })
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
  thisDeviceBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  thisDeviceBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#10B981",
  },
  trustedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  trustedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#10B981",
  },
  untrustedBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  untrustedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#F59E0B",
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
