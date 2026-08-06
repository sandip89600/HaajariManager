import React from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";

export default function PaymentStatusScreen() {
  const { isDark } = useTheme();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const { status, planName, transactionId } = route.params || {
    status: "success",
    planName: "super",
    transactionId: "INV-SUB-000000",
  };

  const getStatusConfig = () => {
    switch (status) {
      case "completed":
      case "success":
        return {
          title: `🎉 Welcome to Haajari ${planName === "super" ? "Super" : "Premium"}`,
          desc: "Your subscription is now active.",
          workers: planName === "super" ? "100 Workers unlocked" : "Unlimited Workers unlocked",
          sites: planName === "super" ? "10 Sites unlocked" : "Unlimited Sites unlocked",
          extra: "Thank you for choosing Haajari Manager.",
          color: "#22C55E",
          icon: "checkmark-circle",
          btnText: "Go to Dashboard",
          action: () => navigation.navigate("Dashboard"),
        };
      case "failed":
        return {
          title: "Payment Failed",
          desc: "We couldn't process your transaction. Please check your bank status and try again.",
          workers: null,
          sites: null,
          extra: `Transaction reference: ${transactionId || "N/A"}`,
          color: "#EF4444",
          icon: "close-circle",
          btnText: "Try Again",
          action: () => navigation.goBack(),
        };
      case "pending":
      default:
        return {
          title: "Payment Pending",
          desc: "Your payment is currently processing. Your limits will update automatically once verified.",
          workers: null,
          sites: null,
          extra: `Invoice Reference: ${transactionId || "N/A"}`,
          color: "#F59E0B",
          icon: "time",
          btnText: "Check Billing History",
          action: () => navigation.navigate("BillingHistory"),
        };
    }
  };

  const config = getStatusConfig();

  return (
    <View style={[styles.root, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC", paddingTop: insets.top }]}>
      <View style={styles.container}>
        {/* Animated Icon */}
        <View style={[styles.iconWrap, { backgroundColor: `${config.color}15` }]}>
          <Ionicons name={config.icon as any} size={72} color={config.color} />
        </View>

        <ThemedText style={styles.title}>{config.title}</ThemedText>
        <ThemedText style={styles.desc}>{config.desc}</ThemedText>

        {(config.workers || config.sites) && (
          <View style={[styles.benefitsCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]}>
            {config.workers && (
              <View style={styles.benefitRow}>
                <Ionicons name="people" size={16} color="#EA580C" />
                <ThemedText style={styles.benefitText}>{config.workers}</ThemedText>
              </View>
            )}
            {config.sites && (
              <View style={styles.benefitRow}>
                <Ionicons name="business" size={16} color="#EA580C" />
                <ThemedText style={styles.benefitText}>{config.sites}</ThemedText>
              </View>
            )}
          </View>
        )}

        <ThemedText style={styles.extra}>{config.extra}</ThemedText>

        <Pressable onPress={config.action} style={[styles.btn, { backgroundColor: config.color }]}>
          <ThemedText style={styles.btnText}>{config.btnText}</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, justifyContent: "center" },
  container: { alignItems: "center", width: "100%" },
  iconWrap: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  title: { fontSize: 22, fontWeight: "900", textAlign: "center", marginBottom: 12 },
  desc: { fontSize: 14, color: "#64748B", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  benefitsCard: { width: "100%", padding: 16, borderRadius: 16, gap: 10, marginBottom: 24 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  benefitText: { fontSize: 13, fontWeight: "600" },
  extra: { fontSize: 12, color: "#94A3B8", marginBottom: 30 },
  btn: { width: "100%", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  btnText: { color: "#FFFFFF", fontWeight: "800", fontSize: 14 },
});
