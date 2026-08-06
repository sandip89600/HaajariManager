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
  KeyboardAvoidingView
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { storage, API_URL, authenticatedFetch } from "@/utils/storage";
import LimitReachedModal from "@/components/ui/LimitReachedModal";
import ContextualTooltip from "@/components/ContextualTooltip";

interface Supervisor {
  _id: string;
  name: string;
  phone: string;
  role: string;
}

export default function CreateSiteScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();

  // Form States
  const [name, setName] = useState("");
  const [projectType, setProjectType] = useState("");
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]); // YYYY-MM-DD format
  const [description, setDescription] = useState("");
  
  // Supervisor Selection
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState<Supervisor | null>(null);
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  const [isLoadingSupervisors, setIsLoadingSupervisors] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [limitModalVisible, setLimitModalVisible] = useState(false);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

    // Validation
    if (!name.trim()) {
      Alert.alert("Validation Error", "Site Name is required");
      return;
    }
    if (!projectType.trim()) {
      Alert.alert("Validation Error", "Project Type is required");
      return;
    }
    if (!address.trim()) {
      Alert.alert("Validation Error", "Site Address is required");
      return;
    }
    if (!startDate.trim() || isNaN(Date.parse(startDate))) {
      Alert.alert("Validation Error", "A valid Start Date is required (YYYY-MM-DD)");
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
        status: "Planning"
      };

      const result = await storage.createSite(payload);
      if (result) {
        Alert.alert("Success", "Site created successfully", [
          { text: "OK", onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert("Error", "Failed to create site");
      }
    } catch (e: any) {
      if (e.message?.includes("LIMIT_EXCEEDED_PROJECTS") || e.message?.toLowerCase().includes("limit reached")) {
        setLimitModalVisible(true);
      } else {
        Alert.alert("Error", e.message || "Failed to create site due to duplicate name or database issue.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        {/* Header bar */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Create Site</ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.formScroll}>
          <ContextualTooltip
            tooltipKey="create_site"
            title="Create Site"
            description="Setup supervisor assignment, address data, and name details. This registers the site on the system."
          />
          {/* Site Name Input */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Site Name *</ThemedText>
            <TextInput
              placeholder="e.g. Metro Heights Phase II"
              placeholderTextColor={theme.textSecondary}
              value={name}
              onChangeText={setName}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
            />
          </View>

          {/* Project Type Input */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Project Type *</ThemedText>
            <TextInput
              placeholder="e.g. Residential, Infrastructure, Commercial"
              placeholderTextColor={theme.textSecondary}
              value={projectType}
              onChangeText={setProjectType}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
            />
          </View>

          {/* Client Name Input */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Client Name</ThemedText>
            <TextInput
              placeholder="e.g. DLF Builders Pvt. Ltd. (optional)"
              placeholderTextColor={theme.textSecondary}
              value={clientName}
              onChangeText={setClientName}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
            />
          </View>

          {/* Site Address Input */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Site Address *</ThemedText>
            <TextInput
              placeholder="e.g. Sector 62, Gurgaon, Haryana"
              placeholderTextColor={theme.textSecondary}
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={3}
              style={[styles.input, styles.textArea, { color: theme.text, backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
            />
          </View>

          {/* Start Date Input */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Start Date * (YYYY-MM-DD)</ThemedText>
            <TextInput
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.textSecondary}
              value={startDate}
              onChangeText={setStartDate}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
            />
          </View>

          {/* Supervisor Picker Selection */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Site Supervisor</ThemedText>
            <Pressable
              onPress={() => {
                triggerHaptic();
                setShowSupervisorModal(true);
              }}
              style={[styles.pickerBtn, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
            >
              <ThemedText style={{ color: selectedSupervisor ? theme.text : theme.textSecondary }}>
                {selectedSupervisor ? selectedSupervisor.name : "Select Supervisor (optional)"}
              </ThemedText>
              <Feather name="chevron-down" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>

          {/* Description Input */}
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Description</ThemedText>
            <TextInput
              placeholder="Additional site notes or scope description..."
              placeholderTextColor={theme.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              style={[styles.input, styles.textArea, { color: theme.text, backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
            />
          </View>

          {/* Save Button */}
          <Pressable
            onPress={handleSave}
            disabled={isSubmitting}
            style={[styles.saveBtn, { backgroundColor: theme.primary }]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <ThemedText style={styles.saveBtnText}>Create Site</ThemedText>
            )}
          </Pressable>
        </ScrollView>

        {/* Supervisor Selection Modal */}
        <Modal visible={showSupervisorModal} transparent animationType="slide" onRequestClose={() => setShowSupervisorModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Choose Supervisor</ThemedText>
                <Pressable onPress={() => setShowSupervisorModal(false)}>
                  <Feather name="x" size={20} color={theme.text} />
                </Pressable>
              </View>
              
              {isLoadingSupervisors ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 40 }} />
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
                        { borderBottomColor: theme.border },
                        selectedSupervisor?._id === item._id && { backgroundColor: theme.backgroundSecondary }
                      ]}
                    >
                      <ThemedText style={{ fontSize: 15, fontWeight: "700" }}>{item.name}</ThemedText>
                      <ThemedText style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Phone: {item.phone}</ThemedText>
                    </Pressable>
                  )}
                  ListEmptyComponent={() => (
                    <View style={{ paddingVertical: 40, alignItems: "center" }}>
                      <ThemedText style={{ opacity: 0.6 }}>No Supervisors Registered</ThemedText>
                    </View>
                  )}
                />
              )}
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
    flex: 1
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 54 : 16,
    paddingBottom: 12
  },
  backBtn: {
    padding: 6,
    marginRight: 8
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800"
  },
  formScroll: {
    padding: 16,
    gap: 16,
    paddingBottom: 60
  },
  inputGroup: {
    gap: 6
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    opacity: 0.8
  },
  input: {
    height: 48,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
    paddingVertical: 12
  },
  pickerBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 48,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    paddingHorizontal: 14
  },
  saveBtn: {
    height: 50,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end"
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800"
  },
  supervisorItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderRadius: 8
  }
});
