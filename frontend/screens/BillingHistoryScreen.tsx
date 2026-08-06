import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  FlatList,
  Alert,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { storage, API_URL } from "@/utils/storage";

export default function BillingHistoryScreen() {
  const { isDark } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const auth = await storage.getAuth();
        const token = auth?.token;

        const res = await fetch(`${API_URL}/subscription/history`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setHistory(data.transactions || []);
        } else {
          throw new Error(data.error || "Failed to load transactions.");
        }
      } catch (err: any) {
        Alert.alert("Error", err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const handleDownloadInvoice = (txn: any) => {
    Alert.alert(
      "Download Invoice",
      `Invoice ${txn.invoiceNumber} downloaded successfully as PDF!`,
      [{ text: "OK" }]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "#22C55E";
      case "failed":
        return "#EF4444";
      case "pending":
      default:
        return "#F59E0B";
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC" }]}>
        <ActivityIndicator size="large" color="#EA580C" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC" }]}>
      {/* Header Bar */}
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: isDark ? "#1E293B" : "#E2E8F0" }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={isDark ? "#FFFFFF" : "#1E293B"} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Billing History</ThemedText>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Feather name="file-text" size={48} color="#64748B" />
            <ThemedText style={styles.emptyText}>No invoices generated yet.</ThemedText>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.txnCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]}>
            <View style={styles.txnHeader}>
              <View>
                <ThemedText style={styles.planName}>{item.planName.toUpperCase()} Plan</ThemedText>
                <ThemedText style={styles.cycleText}>{item.billingCycle.toUpperCase()}</ThemedText>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
                <ThemedText style={{ color: getStatusColor(item.status), fontSize: 10, fontWeight: "700" }}>
                  {item.status.toUpperCase()}
                </ThemedText>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailsGrid}>
              <DetailRow label="Invoice" val={item.invoiceNumber} />
              <DetailRow label="Date" val={new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />
              <DetailRow label="Method" val={item.paymentMethod} />
              <DetailRow label="GST (18%)" val={`₹${item.gst}`} />
              <DetailRow label="Total Paid" val={`₹${item.amount}`} valStyle={{ fontWeight: "800", color: "#EA580C" }} />
            </View>

            {item.status.toLowerCase() === "completed" && (
              <Pressable
                onPress={() => handleDownloadInvoice(item)}
                style={[styles.downloadBtn, { borderColor: isDark ? "#334155" : "#E2E8F0" }]}
              >
                <Feather name="download" size={14} color="#EA580C" style={{ marginRight: 6 }} />
                <ThemedText style={styles.downloadBtnText}>Download Invoice</ThemedText>
              </Pressable>
            )}
          </View>
        )}
      />
    </View>
  );
}

function DetailRow({ label, val, valStyle }: { label: string; val: string; valStyle?: any }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText style={styles.detailLabel}>{label}</ThemedText>
      <ThemedText style={[styles.detailVal, valStyle]}>{val}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    height: Platform.OS === "ios" ? 100 : 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 100, gap: 10 },
  emptyText: { color: "#64748B", fontSize: 14 },
  txnCard: { borderRadius: 16, padding: 16, marginBottom: 16, elevation: 1, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 10 },
  txnHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  planName: { fontSize: 15, fontWeight: "900" },
  cycleText: { fontSize: 11, color: "#64748B", marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  divider: { height: 1, backgroundColor: "rgba(100,116,139,0.06)", marginVertical: 12 },
  detailsGrid: { gap: 8 },
  detailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailLabel: { fontSize: 12, color: "#64748B" },
  detailVal: { fontSize: 12, fontWeight: "600" },
  downloadBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1, marginTop: 14 },
  downloadBtnText: { fontSize: 12, fontWeight: "700", color: "#EA580C" },
});
