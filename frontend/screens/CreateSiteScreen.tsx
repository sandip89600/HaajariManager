import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  Platform,
  KeyboardAvoidingView,
  Text,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useLanguage } from "@/hooks/useLanguage";
import { storage, API_URL, authenticatedFetch, Site } from "@/utils/storage";
import LimitReachedModal from "@/components/ui/LimitReachedModal";
import ContextualTooltip from "@/components/ContextualTooltip";

// ── Strict Design Tokens (Phase 9) ──
const TOKENS = {
  bg: "#101828",
  surface: "#1D2939",
  surfaceLight: "#29384D",
  primary: "#F97316",
  primaryHover: "#EA580C",
  text: "#F9FAFB",
  textSecondary: "#D0D5DD",
  textMuted: "#98A2B3",
  border: "#344054",
  borderLight: "#475467",
  success: "#12B76A",
  successLight: "rgba(18, 183, 106, 0.15)",
  error: "#F04438",
  errorLight: "rgba(240, 68, 56, 0.15)",
};

interface Supervisor {
  _id: string;
  name: string;
  phone: string;
  role: string;
}

export default function CreateSiteScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<any>();

  // Form States
  const [name, setName] = useState("");
  const [projectType, setProjectType] = useState("");
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0],
  ); // YYYY-MM-DD format
  const [description, setDescription] = useState("");

  // Supervisor Selection
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] =
    useState<Supervisor | null>(null);
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  const [isLoadingSupervisors, setIsLoadingSupervisors] = useState(false);

  // Submission States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [limitModalVisible, setLimitModalVisible] = useState(false);

  // Post-Creation Action Modal State (Phase 8)
  const [createdSite, setCreatedSite] = useState<Site | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
  };

  useEffect(() => {
    fetchSupervisors();
  }, []);

  const fetchSupervisors = async () => {
    setIsLoadingSupervisors(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/supervisors`);
      if (res.ok) {
        const data = await res.json();
        setSupervisors(data);
      }
    } catch (e) {
      console.warn("Failed to load supervisors", e);
    } finally {
      setIsLoadingSupervisors(false);
    }
  };

  const handleSave = async () => {
    triggerHaptic();

    // Prevent duplicate submissions
    if (isSubmitting) return;

    // Validation
    if (!name.trim()) {
      Alert.alert(
        t("common.error", "Validation Error"),
        t("sites.nameRequired", "Site Name is required"),
      );
      return;
    }
    if (!projectType.trim()) {
      Alert.alert(
        t("common.error", "Validation Error"),
        t("sites.projectTypeRequired", "Project Type is required"),
      );
      return;
    }
    if (!address.trim()) {
      Alert.alert(
        t("common.error", "Validation Error"),
        t("sites.addressRequired", "Site Address is required"),
      );
      return;
    }
    if (!startDate.trim() || isNaN(Date.parse(startDate))) {
      Alert.alert(
        t("common.error", "Validation Error"),
        t(
          "sites.startDateRequired",
          "A valid Start Date is required (YYYY-MM-DD)",
        ),
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        projectType: projectType.trim(),
        clientName: clientName.trim() || undefined,
        address: address.trim(),
        startDate: new Date(startDate).toISOString(),
        description: description.trim() || undefined,
        supervisor: selectedSupervisor?._id || undefined,
        status: "Active",
      };

      const result = await storage.createSite(payload);
      if (result && result.id) {
        setCreatedSite(result);
        setShowSuccessModal(true);
      } else {
        Alert.alert(
          t("common.error", "Error"),
          t("sites.createError", "Failed to create site"),
        );
      }
    } catch (e: any) {
      if (
        e.message?.includes("LIMIT_EXCEEDED_PROJECTS") ||
        e.message?.toLowerCase().includes("limit reached")
      ) {
        setLimitModalVisible(true);
      } else {
        Alert.alert(
          t("common.error", "Error"),
          t.translateError?.(e.message) ||
            e.message ||
            t("sites.createError", "Failed to create site"),
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: TOKENS.bg }}
    >
      <ThemedView style={[styles.container, { backgroundColor: TOKENS.bg }]}>
        {/* Header bar */}
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={12}
          >
            <Feather name="arrow-left" size={24} color={TOKENS.text} />
          </Pressable>
          <View>
            <ThemedText style={styles.headerTitle}>
              {t("sites.addSite", "Add New Site")}
            </ThemedText>
            <Text style={styles.headerSubtitle}>
              Register project location, client & supervisor
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.formScroll}
          keyboardShouldPersistTaps="handled"
        >
          <ContextualTooltip
            tooltipKey="create_site"
            title={t("sites.addSite", "Create Site")}
            description="Setup supervisor assignment, address data, and name details. This registers the site on the system."
          />

          {/* Site Name Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {t("sites.siteName", "Site Name")} <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              placeholder="e.g. Metro Heights Phase II"
              placeholderTextColor={TOKENS.textMuted}
              value={name}
              onChangeText={setName}
              style={styles.input}
            />
          </View>

          {/* Project Type Input & Quick Selector Pills (Wireframe 2) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Project type <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              placeholder="e.g. Row house, Residential, Commercial"
              placeholderTextColor={TOKENS.textMuted}
              value={projectType}
              onChangeText={setProjectType}
              style={styles.input}
            />
            {/* Quick Type Pills */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {["Row house", "Residential", "Commercial", "Infrastructure", "Industrial", "Villa"].map((pt) => (
                <Pressable
                  key={pt}
                  onPress={() => {
                    triggerHaptic();
                    setProjectType(pt);
                  }}
                  style={[
                    styles.quickTypePill,
                    projectType === pt && { backgroundColor: TOKENS.primary, borderColor: TOKENS.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.quickTypePillText,
                      projectType === pt && { color: "#FFFFFF", fontWeight: "700" },
                    ]}
                  >
                    {pt}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Client / Construction company Name Input (Wireframe 2) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Client / Construction company Name
            </Text>
            <TextInput
              placeholder="e.g. DLF Builders Pvt. Ltd."
              placeholderTextColor={TOKENS.textMuted}
              value={clientName}
              onChangeText={setClientName}
              style={styles.input}
            />
          </View>

          {/* Address / Landmark Input (Wireframe 2) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Address / Landmark <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              placeholder="e.g. Kewal Park, Sector 62, Gurgaon"
              placeholderTextColor={TOKENS.textMuted}
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={3}
              style={[styles.input, styles.textArea]}
            />
          </View>

          {/* Start Date Input (Wireframe 2) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Start date <Text style={styles.requiredStar}>*</Text> (YYYY-MM-DD)
            </Text>
            <TextInput
              placeholder="YYYY-MM-DD"
              placeholderTextColor={TOKENS.textMuted}
              value={startDate}
              onChangeText={setStartDate}
              style={styles.input}
            />
          </View>

          {/* Supervisor Picker Selection (Wireframe 2) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Supervisor
            </Text>
            <Pressable
              onPress={() => {
                triggerHaptic();
                setShowSupervisorModal(true);
              }}
              style={styles.pickerBtn}
            >
              <Text
                style={{
                  color: selectedSupervisor ? TOKENS.text : TOKENS.textMuted,
                  fontSize: 14,
                  fontWeight: selectedSupervisor ? "600" : "400",
                }}
              >
                {selectedSupervisor
                  ? `${selectedSupervisor.name} • ${selectedSupervisor.phone}`
                  : t("sites.selectSupervisor", "Select Supervisor (optional)")}
              </Text>
              <Feather
                name="chevron-down"
                size={18}
                color={TOKENS.textSecondary}
              />
            </Pressable>
          </View>

          {/* Description Input (Wireframe 2) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Description
            </Text>
            <TextInput
              placeholder="e.g. G+4 RCC frame structure with brick bond and vitrified tile flooring..."
              placeholderTextColor={TOKENS.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              style={[styles.input, styles.textAreaDesc]}
            />
          </View>

          {/* Save Button (Wireframe 2: Add site) */}
          <Pressable
            onPress={handleSave}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.saveBtn,
              { opacity: isSubmitting || pressed ? 0.85 : 1 },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.saveBtnContent}>
                <Feather name="check-circle" size={18} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>Add site</Text>
              </View>
            )}
          </Pressable>

        </ScrollView>

        {/* Supervisor Selection Modal */}
        <Modal
          visible={showSupervisorModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSupervisorModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Choose Supervisor</Text>
                <Pressable
                  onPress={() => setShowSupervisorModal(false)}
                  hitSlop={12}
                >
                  <Feather name="x" size={20} color={TOKENS.textSecondary} />
                </Pressable>
              </View>

              {isLoadingSupervisors ? (
                <ActivityIndicator
                  size="large"
                  color={TOKENS.primary}
                  style={{ marginVertical: 40 }}
                />
              ) : (
                <FlatList
                  data={supervisors}
                  keyExtractor={(item) => item._id}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => {
                        triggerHaptic();
                        setSelectedSupervisor(item);
                        setShowSupervisorModal(false);
                      }}
                      style={[
                        styles.supervisorItem,
                        selectedSupervisor?._id === item._id && {
                          backgroundColor: TOKENS.surfaceLight,
                          borderColor: TOKENS.primary,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.supervisorName}>{item.name}</Text>
                        <Text style={styles.supervisorSub}>
                          Phone: {item.phone}
                        </Text>
                      </View>
                      {selectedSupervisor?._id === item._id && (
                        <Feather name="check" size={18} color={TOKENS.primary} />
                      )}
                    </Pressable>
                  )}
                  ListEmptyComponent={() => (
                    <View style={{ paddingVertical: 40, alignItems: "center" }}>
                      <Text style={{ color: TOKENS.textMuted, fontSize: 14 }}>
                        No Supervisors Registered
                      </Text>
                    </View>
                  )}
                />
              )}
            </View>
          </View>
        </Modal>

        {/* Post-Creation Action Modal (Phase 8 Requirement) */}
        <Modal
          visible={showSuccessModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowSuccessModal(false);
            navigation.goBack();
          }}
        >
          <View style={styles.modalOverlayCenter}>
            <View style={styles.successModalCard}>
              <View style={styles.successIconCircle}>
                <Feather name="check" size={32} color={TOKENS.success} />
              </View>

              <Text style={styles.successTitle}>Site Created!</Text>
              <Text style={styles.successSub}>
                <Text style={{ fontWeight: "700", color: TOKENS.text }}>
                  {createdSite?.name}
                </Text>{" "}
                has been registered successfully. Choose what to do next:
              </Text>

              {/* Action 1: Manage Site */}
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setShowSuccessModal(false);
                  navigation.replace("SiteDetailControl", {
                    siteId: createdSite?.id,
                    siteName: createdSite?.name,
                  });
                }}
                style={styles.actionBtnPrimary}
              >
                <MaterialCommunityIcons
                  name="view-dashboard-outline"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.actionBtnPrimaryText}>Manage Site</Text>
              </Pressable>

              {/* Action 2: Assign Workers */}
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setShowSuccessModal(false);
                  navigation.replace("SiteDetailControl", {
                    siteId: createdSite?.id,
                    siteName: createdSite?.name,
                    initialTab: "Workforce",
                  });
                }}
                style={styles.actionBtnSecondary}
              >
                <Feather name="users" size={18} color={TOKENS.primary} />
                <Text style={styles.actionBtnSecondaryText}>Assign Workers</Text>
              </Pressable>

              {/* Action 3: Back to Site Control */}
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setShowSuccessModal(false);
                  navigation.goBack();
                }}
                style={styles.actionBtnGhost}
              >
                <Text style={styles.actionBtnGhostText}>
                  Back to Site Control
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <LimitReachedModal
          visible={limitModalVisible}
          onClose={() => setLimitModalVisible(false)}
          resourceType="sites"
        />
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 54 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
    backgroundColor: TOKENS.bg,
  },
  backBtn: {
    padding: 8,
    marginRight: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: TOKENS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: TOKENS.textMuted,
    marginTop: 2,
  },
  formScroll: {
    padding: 16,
    gap: 18,
    paddingBottom: 60,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: TOKENS.textSecondary,
    letterSpacing: 0.2,
  },
  requiredStar: {
    color: TOKENS.primary,
  },
  input: {
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TOKENS.border,
    backgroundColor: TOKENS.surface,
    paddingHorizontal: 14,
    fontSize: 14,
    color: TOKENS.text,
  },
  quickTypePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: TOKENS.border,
    backgroundColor: TOKENS.surface,
  },
  quickTypePillText: {
    fontSize: 11,
    color: TOKENS.textSecondary,
    fontWeight: "600",
  },

  textArea: {
    height: 80,
    textAlignVertical: "top",
    paddingVertical: 12,
  },
  textAreaDesc: {
    height: 100,
    textAlignVertical: "top",
    paddingVertical: 12,
  },
  pickerBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TOKENS.border,
    backgroundColor: TOKENS.surface,
    paddingHorizontal: 14,
  },
  saveBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: TOKENS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    backgroundColor: TOKENS.surface,
    borderTopWidth: 1,
    borderTopColor: TOKENS.border,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: TOKENS.text,
  },
  supervisorItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: TOKENS.border,
    backgroundColor: TOKENS.bg,
    borderRadius: 10,
    marginBottom: 10,
  },
  supervisorName: {
    fontSize: 15,
    fontWeight: "700",
    color: TOKENS.text,
  },
  supervisorSub: {
    fontSize: 12,
    color: TOKENS.textMuted,
    marginTop: 3,
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  successModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: TOKENS.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: TOKENS.successLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: TOKENS.success,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: TOKENS.text,
    marginBottom: 8,
  },
  successSub: {
    fontSize: 14,
    color: TOKENS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  actionBtnPrimary: {
    width: "100%",
    height: 50,
    borderRadius: 12,
    backgroundColor: TOKENS.primary,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  actionBtnPrimaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  actionBtnSecondary: {
    width: "100%",
    height: 50,
    borderRadius: 12,
    backgroundColor: TOKENS.surfaceLight,
    borderWidth: 1,
    borderColor: TOKENS.borderLight,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  actionBtnSecondaryText: {
    color: TOKENS.primary,
    fontSize: 15,
    fontWeight: "700",
  },
  actionBtnGhost: {
    width: "100%",
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  actionBtnGhostText: {
    color: TOKENS.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
});
