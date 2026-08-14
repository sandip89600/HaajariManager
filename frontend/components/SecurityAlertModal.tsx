import React, { useCallback } from "react";
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { API_URL, authenticatedFetch } from "@/utils/storage";
import { BorderRadius, Spacing } from "@/constants/theme";

interface Props {
  visible: boolean;
  deviceInfo: {
    deviceId: string;
    deviceName: string;
    platform: string;
    browser: string;
    location: string;
    loginTime: string;
  };
  onDismiss: () => void;
}

export default function SecurityAlertModal({ visible, deviceInfo, onDismiss }: Props) {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const { clearNewDeviceAlert } = useAuth();

  const formattedTime = (() => {
    try {
      return new Date(deviceInfo.loginTime).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return deviceInfo.loginTime;
    }
  })();

  const handleTrustDevice = useCallback(async () => {
    try {
      await authenticatedFetch(`${API_URL}/auth/security/trust-device`, {
        method: "POST",
        body: JSON.stringify({ deviceId: deviceInfo.deviceId }),
      });
    } catch (e) {
      console.warn("[SecurityAlert] Failed to trust device:", e);
    } finally {
      onDismiss();
      clearNewDeviceAlert();
    }
  }, [deviceInfo.deviceId, onDismiss, clearNewDeviceAlert]);

  const handleSuspicious = useCallback(async () => {
    try {
      await authenticatedFetch(`${API_URL}/auth/security/report-suspicious`, {
        method: "POST",
        body: JSON.stringify({ deviceId: deviceInfo.deviceId }),
      });
    } catch (e) {
      console.warn("[SecurityAlert] Failed to report suspicious:", e);
    } finally {
      onDismiss();
      clearNewDeviceAlert();
      navigation.navigate("SecureAccount", { deviceInfo });
    }
  }, [deviceInfo, navigation, onDismiss, clearNewDeviceAlert]);

  const browserDisplay =
    deviceInfo.browser && deviceInfo.browser !== "Unknown Browser"
      ? deviceInfo.browser
      : deviceInfo.platform;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: isDark ? "#111827" : "#FFFFFF" }]}>
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: isDark ? "#1E293B" : "#FFF7ED" }]}>
              <Feather name="shield" size={26} color="#FF6B35" />
            </View>
            <ThemedText style={[styles.title, { color: theme.text }]}>
              New Login Detected
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: isDark ? "#94A3B8" : "#64748B" }]}>
              Your Haajari account was just signed in from a new device.
            </ThemedText>
          </View>

          <View style={[styles.infoCard, { backgroundColor: isDark ? "#1E293B" : "#F8FAFC", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
            {[
              { label: "Device", value: deviceInfo.deviceName },
              { label: "Platform", value: deviceInfo.platform },
              { label: "Browser", value: browserDisplay },
              { label: "Location", value: deviceInfo.location || "Unknown Location" },
              { label: "Time", value: formattedTime },
            ].map(({ label, value }) => (
              <View key={label} style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: isDark ? "#94A3B8" : "#64748B" }]}>{label}</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.text }]} numberOfLines={1}>{value}</ThemedText>
              </View>
            ))}
          </View>

          <ThemedText style={[styles.question, { color: isDark ? "#CBD5E1" : "#374151" }]}>
            Was this you?
          </ThemedText>

          <Pressable
            onPress={handleTrustDevice}
            style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}
          >
            <Feather name="check-circle" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <ThemedText style={styles.btnPrimaryText}>Yes, It Was Me</ThemedText>
          </Pressable>

          <Pressable
            onPress={handleSuspicious}
            style={({ pressed }) => [
              styles.btnSecondary,
              { borderColor: isDark ? "#475569" : "#E2E8F0", backgroundColor: isDark ? "#1E293B" : "#F8FAFC" },
              pressed && { opacity: 0.75 }
            ]}
          >
            <Feather name="alert-triangle" size={16} color="#EF4444" style={{ marginRight: 8 }} />
            <ThemedText style={[styles.btnSecondaryText, { color: "#EF4444" }]}>No, It Was Not Me</ThemedText>
          </Pressable>

          <ThemedText style={[styles.note, { color: isDark ? "#64748B" : "#9CA3AF" }]}>
            Haajari will never ask for your password via email or SMS.
          </ThemedText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, paddingBottom: Platform.OS === "ios" ? 40 : Spacing.lg },
  header: { alignItems: "center", marginBottom: 20 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 6, textAlign: "center" },
  subtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  infoCard: { borderRadius: BorderRadius.md, borderWidth: 1, padding: 14, marginBottom: 16, gap: 8 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  infoLabel: { fontSize: 13, width: 80 },
  infoValue: { fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right" },
  question: { fontSize: 15, fontWeight: "600", textAlign: "center", marginBottom: 14 },
  btnPrimary: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#FF6B35", borderRadius: BorderRadius.md, paddingVertical: 14, marginBottom: 10 },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  btnSecondary: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: BorderRadius.md, borderWidth: 1, paddingVertical: 14, marginBottom: 16 },
  btnSecondaryText: { fontSize: 15, fontWeight: "700" },
  note: { fontSize: 11, textAlign: "center", lineHeight: 16 },
});
