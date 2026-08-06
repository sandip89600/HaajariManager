import React from "react";
import { View, StyleSheet, Modal, Pressable, Platform, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface LimitReachedModalProps {
  visible: boolean;
  onClose: () => void;
  resourceType: "workers" | "sites";
}

export default function LimitReachedModal({ visible, onClose, resourceType }: LimitReachedModalProps) {
  const { isDark } = useTheme();
  const navigation = useNavigation<any>();

  const handleUpgrade = () => {
    onClose();
    navigation.navigate("Subscription");
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.closeArea} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]}>
          {/* Accent Handle */}
          <View style={[styles.handle, { backgroundColor: isDark ? "#334155" : "#E2E8F0" }]} />

          {/* Icon Badge */}
          <View style={styles.alertIconWrap}>
            <Ionicons name="warning" size={32} color="#EA580C" />
          </View>

          {/* Heading */}
          <ThemedText style={styles.title}>You've reached your plan limit</ThemedText>
          <ThemedText style={styles.subtitle}>
            Upgrade to continue growing your business. Tap upgrade below to see subscription options.
          </ThemedText>

          {/* Unlocked Benefits list */}
          <View style={[styles.benefitsBox, { backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "#F8FAFC" }]}>
            <ThemedText style={styles.unlockTitle}>Upgrade to unlock:</ThemedText>
            
            <View style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
              <ThemedText style={styles.featureText}>More Workers (Up to unlimited)</ThemedText>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
              <ThemedText style={styles.featureText}>More Sites (Manage unlimited projects)</ThemedText>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
              <ThemedText style={styles.featureText}>Advanced PDF & Excel Reports</ThemedText>
            </View>
            <View style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
              <ThemedText style={styles.featureText}>Salary, Payments & Expenses tracking</ThemedText>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.actionRow}>
            <Pressable onPress={onClose} style={[styles.btn, styles.cancelBtn]}>
              <ThemedText style={styles.cancelText}>Maybe Later</ThemedText>
            </Pressable>
            
            <Pressable onPress={handleUpgrade} style={[styles.btn, styles.upgradeBtn]}>
              <ThemedText style={styles.upgradeText}>Upgrade Now</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  closeArea: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    alignItems: "center",
  },
  handle: { width: 40, height: 4, borderRadius: 2, marginBottom: 20 },
  alertIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(234, 88, 12, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: "900", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 13, color: "#64748B", textAlign: "center", lineHeight: 18, marginBottom: 20, paddingHorizontal: 10 },
  benefitsBox: { width: "100%", padding: 16, borderRadius: 16, gap: 10, marginBottom: 24 },
  unlockTitle: { fontSize: 12, fontWeight: "700", color: "#64748B", marginBottom: 4 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 12, fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 12, width: "100%" },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cancelBtn: { backgroundColor: "rgba(100, 116, 139, 0.1)" },
  cancelText: { color: "#64748B", fontWeight: "700", fontSize: 13 },
  upgradeBtn: { backgroundColor: "#EA580C" },
  upgradeText: { color: "#FFFFFF", fontWeight: "800", fontSize: 13 },
});
