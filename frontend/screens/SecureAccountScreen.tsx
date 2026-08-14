import React, { useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, Alert } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL, authenticatedFetch } from "@/utils/storage";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function SecureAccountScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState<string | null>(null);

  const handleLogoutOtherDevices = async () => {
    setLoading("logout");
    try {
      const res = await authenticatedFetch(`${API_URL}/auth/security/logout-all`, { method: "POST" });
      if (res.ok) {
        Alert.alert("Done", "All other devices have been logged out.");
      }
    } catch {
      Alert.alert("Error", "Failed to logout other devices. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const actions = [
    {
      id: "logout",
      icon: "log-out" as const,
      color: "#EF4444",
      title: "Logout Other Devices",
      subtitle: "Remove all other active sessions immediately.",
      onPress: handleLogoutOtherDevices,
    },
    {
      id: "password",
      icon: "lock" as const,
      color: "#F59E0B",
      title: "Change Password",
      subtitle: "Update your password to prevent unauthorized access.",
      onPress: () => navigation.navigate("UserProfile"),
    },
    {
      id: "devices",
      icon: "monitor" as const,
      color: "#3B82F6",
      title: "Review Active Devices",
      subtitle: "View and manage all recognized devices.",
      onPress: () => navigation.navigate("DeviceManagement"),
    },
    {
      id: "support",
      icon: "message-circle" as const,
      color: "#8B5CF6",
      title: "Contact Support",
      subtitle: "Get help from the Haajari support team.",
      onPress: () => navigation.navigate("Support"),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#0B0F17" : "#F1F5F9" }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: isDark ? "#111827" : "#FFFFFF", borderBottomColor: isDark ? "#1E293B" : "#E2E8F0" }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={theme.text} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: theme.text }]}>Secure My Account</ThemedText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 24 }}>
        {/* Alert Banner */}
        <View style={[styles.alertBanner, { backgroundColor: isDark ? "#2D1515" : "#FEF2F2", borderColor: "#EF4444" }]}>
          <Feather name="alert-triangle" size={20} color="#EF4444" />
          <ThemedText style={[styles.alertText, { color: "#EF4444" }]}>
            We detected a suspicious login attempt. Take action to secure your account.
          </ThemedText>
        </View>

        <ThemedText style={[styles.sectionTitle, { color: isDark ? "#94A3B8" : "#64748B" }]}>
          RECOMMENDED ACTIONS
        </ThemedText>

        {actions.map((action) => (
          <Pressable
            key={action.id}
            onPress={action.onPress}
            disabled={loading === action.id}
            style={({ pressed }) => [
              styles.actionCard,
              { backgroundColor: isDark ? "#111827" : "#FFFFFF", borderColor: isDark ? "#1E293B" : "#E2E8F0" },
              pressed && { opacity: 0.85 }
            ]}
          >
            <View style={[styles.actionIcon, { backgroundColor: action.color + "22" }]}>
              <Feather name={action.icon} size={20} color={action.color} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.actionTitle, { color: theme.text }]}>{action.title}</ThemedText>
              <ThemedText style={[styles.actionSubtitle, { color: isDark ? "#64748B" : "#94A3B8" }]}>{action.subtitle}</ThemedText>
            </View>
            <Feather name="chevron-right" size={18} color={isDark ? "#475569" : "#CBD5E1"} />
          </Pressable>
        ))}

        <ThemedText style={[styles.note, { color: isDark ? "#64748B" : "#9CA3AF" }]}>
          If you believe your account has been compromised, change your password immediately and logout all other devices.
        </ThemedText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.md, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  alertBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: BorderRadius.md, padding: 14, marginBottom: 20 },
  alertText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "600" },
  sectionTitle: { fontSize: 11, fontWeight: "600", letterSpacing: 1, marginBottom: 12 },
  actionCard: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderRadius: BorderRadius.md, padding: 16, marginBottom: 10 },
  actionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  actionSubtitle: { fontSize: 12, lineHeight: 16 },
  note: { fontSize: 12, textAlign: "center", lineHeight: 17, marginTop: 16 },
});
