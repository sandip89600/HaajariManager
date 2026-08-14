import React, { useState, useEffect, useCallback } from "react";
import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL, authenticatedFetch } from "@/utils/storage";
import { Spacing, BorderRadius } from "@/constants/theme";

interface SecurityEvent {
  type: string;
  timestamp: string;
  details?: string;
  deviceId?: string;
  deviceName?: string;
  platform?: string;
  browser?: string;
  location?: string;
  category: string;
  trusted: boolean;
  alertStatus?: "pending" | "confirmed" | "suspicious";
}

function groupByDate(events: SecurityEvent[]) {
  const groups: Record<string, SecurityEvent[]> = {};
  events.forEach((ev) => {
    const date = new Date(ev.timestamp).toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(ev);
  });
  return Object.entries(groups);
}

function getEventIcon(type: string): { name: any; color: string } {
  switch (type) {
    case "NEW_DEVICE_LOGIN": return { name: "alert-circle", color: "#F59E0B" };
    case "TRUST_DEVICE": return { name: "check-circle", color: "#10B981" };
    case "SECURITY_ALERT_SUSPICIOUS": return { name: "alert-triangle", color: "#EF4444" };
    case "DEVICE_REVOKED": return { name: "log-out", color: "#6B7280" };
    case "LOGOUT_ALL_DEVICES": return { name: "shield-off", color: "#6B7280" };
    case "LOGIN": return { name: "log-in", color: "#3B82F6" };
    default: return { name: "activity", color: "#6B7280" };
  }
}

function getEventLabel(type: string): string {
  switch (type) {
    case "NEW_DEVICE_LOGIN": return "New Device Login";
    case "TRUST_DEVICE": return "Device Trusted";
    case "SECURITY_ALERT_SUSPICIOUS": return "Suspicious Login Reported";
    case "DEVICE_REVOKED": return "Device Logged Out";
    case "LOGOUT_ALL_DEVICES": return "All Devices Logged Out";
    case "LOGIN": return "Login";
    default: return type.replace(/_/g, " ");
  }
}

export default function LoginActivityScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`${API_URL}/auth/security/events`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (e) {
      console.warn("[LoginActivity] Failed to load events:", e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = groupByDate(events);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#0B0F17" : "#F1F5F9" }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: isDark ? "#111827" : "#FFFFFF", borderBottomColor: isDark ? "#1E293B" : "#E2E8F0" }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={theme.text} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: theme.text }]}>Login Activity</ThemedText>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#FF6B35" />
        </View>
      ) : events.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="activity" size={40} color={isDark ? "#334155" : "#CBD5E1"} />
          <ThemedText style={[styles.emptyText, { color: isDark ? "#64748B" : "#9CA3AF" }]}>No activity yet</ThemedText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {groups.map(([date, dayEvents]) => (
            <View key={date}>
              <ThemedText style={[styles.dateLabel, { color: isDark ? "#64748B" : "#94A3B8" }]}>{date}</ThemedText>
              {dayEvents.map((ev, i) => {
                const iconInfo = getEventIcon(ev.type);
                const label = getEventLabel(ev.type);
                const timeStr = new Date(ev.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
                return (
                  <View
                    key={i}
                    style={[styles.eventCard, { backgroundColor: isDark ? "#111827" : "#FFFFFF", borderColor: isDark ? "#1E293B" : "#E2E8F0" }]}
                  >
                    <View style={[styles.eventIcon, { backgroundColor: iconInfo.color + "20" }]}>
                      <Feather name={iconInfo.name} size={16} color={iconInfo.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.eventHeader}>
                        <ThemedText style={[styles.eventLabel, { color: theme.text }]}>{label}</ThemedText>
                        <ThemedText style={[styles.eventTime, { color: isDark ? "#64748B" : "#9CA3AF" }]}>{timeStr}</ThemedText>
                      </View>
                      {(ev.deviceName || ev.details) && (
                        <ThemedText style={[styles.eventDetail, { color: isDark ? "#94A3B8" : "#64748B" }]} numberOfLines={2}>
                          {ev.deviceName ? `${ev.deviceName}${ev.platform ? " • " + ev.platform : ""}${ev.location ? " • " + ev.location : ""}` : ev.details}
                        </ThemedText>
                      )}
                      {ev.alertStatus && ev.alertStatus !== "pending" && (
                        <View style={[styles.statusBadge, { backgroundColor: ev.alertStatus === "confirmed" ? "#10B98120" : "#EF444420" }]}>
                          <ThemedText style={[styles.statusText, { color: ev.alertStatus === "confirmed" ? "#10B981" : "#EF4444" }]}>
                            {ev.alertStatus === "confirmed" ? "Confirmed by you" : "Marked as suspicious"}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.md, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 14 },
  dateLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  eventCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderWidth: 1, borderRadius: BorderRadius.md, padding: 12, marginBottom: 8 },
  eventIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 2 },
  eventHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  eventLabel: { fontSize: 14, fontWeight: "600", flex: 1 },
  eventTime: { fontSize: 11, marginLeft: 8 },
  eventDetail: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  statusBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginTop: 6 },
  statusText: { fontSize: 11, fontWeight: "600" },
});
