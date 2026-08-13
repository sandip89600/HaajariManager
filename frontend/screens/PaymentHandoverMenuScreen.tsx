import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  FlatList,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { Spacing, BorderRadius } from "@/constants/theme";
import { authenticatedFetch, API_URL } from "@/utils/storage";

interface HandoverRecord {
  _id: string;
  amount: number;
  recipientName: string;
  notes?: string;
  handoverDate: string;
}

interface ProofRecord {
  _id: string;
  proofUri: string;
  notes?: string;
  uploadedAt: string;
}

export default function PaymentHandoverMenuScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { getFeatureStatus } = useFeatureAccess();

  const handoverStatus = getFeatureStatus("paymentHandover");
  const proofStatus = getFeatureStatus("paymentProof");

  // Active section inside the screen
  const [activeView, setActiveView] = useState<"menu" | "handover_list" | "proof_list" | "generic_mock">("menu");
  const [mockTitle, setMockTitle] = useState("");

  // Records state
  const [handovers, setHandovers] = useState<HandoverRecord[]>([]);
  const [proofs, setProofs] = useState<ProofRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [notes, setNotes] = useState("");
  const [proofUri, setProofUri] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch handover records
  const fetchHandovers = async () => {
    setIsLoading(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/payment-handover/handover`);
      if (res.ok) {
        const data = await res.json();
        setHandovers(data);
      } else if (res.status === 403) {
        // Safe check if blocked by backend
        const errData = await res.json();
        Alert.alert("Access Denied", errData.message || "This action is restricted.");
        setActiveView("menu");
      }
    } catch (err) {
      console.warn("Failed to fetch handovers:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch proof records
  const fetchProofs = async () => {
    setIsLoading(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/payment-handover/proof`);
      if (res.ok) {
        const data = await res.json();
        setProofs(data);
      } else if (res.status === 403) {
        const errData = await res.json();
        Alert.alert("Access Denied", errData.message || "This action is restricted.");
        setActiveView("menu");
      }
    } catch (err) {
      console.warn("Failed to fetch proofs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddHandover = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert("Validation Error", "Please enter a valid amount.");
      return;
    }
    if (!recipient.trim()) {
      Alert.alert("Validation Error", "Please enter the recipient's name.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/payment-handover/handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          recipientName: recipient.trim(),
          notes: notes.trim()
        })
      });

      if (res.ok) {
        Alert.alert("Success", "Payment handover logged successfully.");
        setShowAddModal(false);
        setAmount("");
        setRecipient("");
        setNotes("");
        fetchHandovers();
      } else {
        const data = await res.json();
        Alert.alert("Error", data.message || "Failed to log handover.");
      }
    } catch (err) {
      Alert.alert("Error", "Network request failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddProof = async () => {
    if (!proofUri.trim()) {
      Alert.alert("Validation Error", "Please enter a proof reference or document URL.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/payment-handover/proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proofUri: proofUri.trim(),
          notes: notes.trim()
        })
      });

      if (res.ok) {
        Alert.alert("Success", "Payment proof uploaded successfully.");
        setShowAddModal(false);
        setProofUri("");
        setNotes("");
        fetchProofs();
      } else {
        const data = await res.json();
        Alert.alert("Error", data.message || "Failed to log payment proof.");
      }
    } catch (err) {
      Alert.alert("Error", "Network request failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMenuPress = (option: string) => {
    if (option === "Payment Settings") {
      setMockTitle("Payment Settings");
      setActiveView("generic_mock");
    } else if (option === "Payment Handover") {
      setActiveView("handover_list");
      fetchHandovers();
    } else if (option === "Payment Receipt Settings") {
      setMockTitle("Payment Receipt Settings");
      setActiveView("generic_mock");
    } else if (option === "Signature & Verification") {
      setMockTitle("Signature & Verification");
      setActiveView("generic_mock");
    } else if (option === "Authorized Representative") {
      setMockTitle("Authorized Representative");
      setActiveView("generic_mock");
    } else if (option === "Payment Proof") {
      // Direct access check for premium requirement
      if (proofStatus.showUpgradeUI) {
        Alert.alert(
          "Premium Feature",
          `Payment Proof is available on the Haajari ${proofStatus.minPlan.toUpperCase()} plan.`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "View Plans", onPress: () => navigation.navigate("Subscription") }
          ]
        );
        return;
      }
      setActiveView("proof_list");
      fetchProofs();
    }
  };

  // 1. Lock screen if Parent Payment Handover is restricted
  if (handoverStatus.showUpgradeUI) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Payment Handover</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.upgradeContent}>
          <Feather name="lock" size={60} color={theme.primary} />
          <ThemedText style={styles.upgradeTitle}>Unlock Payment Handover</ThemedText>
          <ThemedText style={[styles.upgradeSub, { color: theme.textSecondary }]}>
            Enforce digital handovers, signature verification, receipts, and proof tracking by upgrading to Haajari Premium.
          </ThemedText>

          <Pressable
            onPress={() => navigation.navigate("Subscription")}
            style={[styles.upgradeBtn, { backgroundColor: theme.primary }]}
          >
            <ThemedText style={styles.upgradeBtnText}>View Premium Plans</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  // Back action helper depending on screen view state
  const handleBack = () => {
    if (activeView === "menu") {
      navigation.goBack();
    } else {
      setActiveView("menu");
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* HEADER */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={handleBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={theme.text} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>
          {activeView === "menu" ? "Payment Handover" : activeView === "handover_list" ? "Handover Logs" : activeView === "proof_list" ? "Payment Proofs" : mockTitle}
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {/* CONTENT SWITCH */}
      {activeView === "menu" && (
        <ScrollView contentContainerStyle={styles.scrollBody}>
          <View style={[styles.infoBanner, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
            <Feather name="info" size={16} color={theme.primary} />
            <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
              Configure and record payments transferred to supervisors or site representatives.
            </ThemedText>
          </View>

          <View style={styles.menuGroup}>
            <MenuRow title="Payment Settings" desc="Setup payment methods and rules" onPress={() => handleMenuPress("Payment Settings")} theme={theme} />
            <MenuRow title="Payment Handover" desc="Log transfers to representatives" onPress={() => handleMenuPress("Payment Handover")} theme={theme} />
            <MenuRow title="Payment Receipt Settings" desc="Custom template configuration" onPress={() => handleMenuPress("Payment Receipt Settings")} theme={theme} />
            <MenuRow title="Signature & Verification" desc="Supervisor digital validation" onPress={() => handleMenuPress("Signature & Verification")} theme={theme} />
            <MenuRow title="Authorized Representative" desc="Manage representative rules" onPress={() => handleMenuPress("Authorized Representative")} theme={theme} />
            
            {/* Show Payment Proof submenu conditionally based on getFeatureStatus */}
            {proofStatus.enabled && (
              <MenuRow
                title="Payment Proof"
                desc="Upload verification receipts"
                onPress={() => handleMenuPress("Payment Proof")}
                isLocked={proofStatus.showUpgradeUI}
                theme={theme}
              />
            )}
          </View>
        </ScrollView>
      )}

      {/* HANDOVER LIST VIEW */}
      {activeView === "handover_list" && (
        <View style={{ flex: 1 }}>
          {isLoading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={handovers}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.listPadding}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Feather name="dollar-sign" size={32} color={theme.textSecondary} />
                  <ThemedText style={{ color: theme.textSecondary, marginTop: 10 }}>No payment handovers logged yet.</ThemedText>
                </View>
              }
              renderItem={({ item }) => (
                <View style={[styles.recordCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                  <View style={styles.recordHeader}>
                    <ThemedText style={styles.recordAmount}>₹{item.amount.toLocaleString()}</ThemedText>
                    <ThemedText style={[styles.recordDate, { color: theme.textSecondary }]}>
                      {new Date(item.handoverDate).toLocaleDateString()}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.recordLabel}>Recipient: {item.recipientName}</ThemedText>
                  {item.notes ? <ThemedText style={[styles.recordNotes, { color: theme.textSecondary }]}>{item.notes}</ThemedText> : null}
                </View>
              )}
            />
          )}
          <Pressable
            onPress={() => setShowAddModal(true)}
            style={[styles.floatingActionBtn, { backgroundColor: theme.primary }]}
          >
            <Feather name="plus" size={24} color="#FFF" />
          </Pressable>
        </View>
      )}

      {/* PROOF LIST VIEW */}
      {activeView === "proof_list" && (
        <View style={{ flex: 1 }}>
          {isLoading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={proofs}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.listPadding}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Feather name="file-text" size={32} color={theme.textSecondary} />
                  <ThemedText style={{ color: theme.textSecondary, marginTop: 10 }}>No payment proofs registered yet.</ThemedText>
                </View>
              }
              renderItem={({ item }) => (
                <View style={[styles.recordCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                  <View style={styles.recordHeader}>
                    <ThemedText style={styles.recordAmount} numberOfLines={1}>Doc Ref: {item.proofUri}</ThemedText>
                    <ThemedText style={[styles.recordDate, { color: theme.textSecondary }]}>
                      {new Date(item.uploadedAt).toLocaleDateString()}
                    </ThemedText>
                  </View>
                  {item.notes ? <ThemedText style={[styles.recordNotes, { color: theme.textSecondary }]}>{item.notes}</ThemedText> : null}
                </View>
              )}
            />
          )}
          <Pressable
            onPress={() => setShowAddModal(true)}
            style={[styles.floatingActionBtn, { backgroundColor: theme.primary }]}
          >
            <Feather name="plus" size={24} color="#FFF" />
          </Pressable>
        </View>
      )}

      {/* MOCK SUBFEATURES PREVIEW */}
      {activeView === "generic_mock" && (
        <View style={styles.mockContent}>
          <Feather name="sliders" size={40} color={theme.primary} />
          <ThemedText style={styles.mockTitleText}>{mockTitle} Configuration</ThemedText>
          <ThemedText style={[styles.mockSub, { color: theme.textSecondary }]}>
            This control parameters and rules panel is fully loaded. Configure limits and representatives updates.
          </ThemedText>
          <Pressable onPress={() => setActiveView("menu")} style={[styles.mockBtn, { borderColor: theme.primary }]}>
            <ThemedText style={{ color: theme.primary, fontWeight: "700" }}>Back to Menu</ThemedText>
          </Pressable>
        </View>
      )}

      {/* ADD DIALOG MODAL */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h2">{activeView === "handover_list" ? "Log Handover" : "Add Payment Proof"}</ThemedText>
              <Pressable onPress={() => setShowAddModal(false)}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
              {activeView === "handover_list" ? (
                <>
                  <ThemedText style={styles.inputLabel}>Amount (₹)</ThemedText>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="Enter amount"
                    placeholderTextColor="#888"
                    keyboardType="numeric"
                    style={[styles.inputField, { borderColor: theme.border, color: theme.text }]}
                  />

                  <ThemedText style={styles.inputLabel}>Recipient Name</ThemedText>
                  <TextInput
                    value={recipient}
                    onChangeText={setRecipient}
                    placeholder="e.g. Supervisor Hari"
                    placeholderTextColor="#888"
                    style={[styles.inputField, { borderColor: theme.border, color: theme.text }]}
                  />
                </>
              ) : (
                <>
                  <ThemedText style={styles.inputLabel}>Proof Reference / Image URI</ThemedText>
                  <TextInput
                    value={proofUri}
                    onChangeText={setProofUri}
                    placeholder="e.g. https://s3.aws.com/proof.jpg"
                    placeholderTextColor="#888"
                    style={[styles.inputField, { borderColor: theme.border, color: theme.text }]}
                  />
                </>
              )}

              <ThemedText style={styles.inputLabel}>Additional Notes</ThemedText>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional description"
                placeholderTextColor="#888"
                multiline
                numberOfLines={3}
                style={[styles.textAreaField, { borderColor: theme.border, color: theme.text }]}
              />

              <Pressable
                onPress={activeView === "handover_list" ? handleAddHandover : handleAddProof}
                disabled={isSubmitting}
                style={[styles.submitBtn, { backgroundColor: theme.primary }]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <ThemedText style={styles.submitBtnText}>Save Record</ThemedText>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </ThemedView>
  );
}

// Submenu List Item Row Component
function MenuRow({ title, desc, onPress, isLocked, theme }: { title: string; desc: string; onPress: () => void; isLocked?: boolean; theme: any }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        { borderBottomColor: theme.border, opacity: pressed ? 0.7 : 1 }
      ]}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <ThemedText style={styles.menuRowTitle}>{title}</ThemedText>
          {isLocked && (
            <View style={styles.lockBadge}>
              <Feather name="lock" size={10} color="#FF9800" />
              <ThemedText style={styles.lockBadgeText}>PREMIUM</ThemedText>
            </View>
          )}
        </View>
        <ThemedText style={[styles.menuRowDesc, { color: theme.textSecondary }]}>{desc}</ThemedText>
      </View>
      <Feather name="chevron-right" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  scrollBody: {
    padding: 15,
  },
  infoBanner: {
    flexDirection: "row",
    padding: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    marginBottom: 20,
  },
  infoText: {
    fontSize: 12,
    marginLeft: 10,
    flex: 1,
  },
  menuGroup: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  menuRowTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  menuRowDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  lockBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 152, 0, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    gap: 3,
  },
  lockBadgeText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#FF9800",
  },
  upgradeContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  upgradeTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: 20,
    textAlign: "center",
  },
  upgradeSub: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 20,
  },
  upgradeBtn: {
    marginTop: 30,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: BorderRadius.sm,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  upgradeBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 15,
  },
  listPadding: {
    padding: 15,
    paddingBottom: 90,
  },
  recordCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: 14,
    marginBottom: 12,
  },
  recordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  recordAmount: {
    fontSize: 16,
    fontWeight: "800",
  },
  recordDate: {
    fontSize: 11,
  },
  recordLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  recordNotes: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: "italic",
  },
  emptyContainer: {
    paddingTop: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  floatingActionBtn: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  mockContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  mockTitleText: {
    fontSize: 20,
    fontWeight: "800",
    marginTop: 15,
    textAlign: "center",
  },
  mockSub: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
    marginBottom: 20,
  },
  mockBtn: {
    borderWidth: 1.5,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#CCC",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 10,
  },
  inputField: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textAreaField: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    textAlignVertical: "top",
  },
  submitBtn: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  submitBtnText: {
    color: "#FFF",
    fontWeight: "700",
  }
});
