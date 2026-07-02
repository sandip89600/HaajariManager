import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  FlatList,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { storage, Project, API_URL, authenticatedFetch } from "@/utils/storage";

interface SupervisorUser {
  _id: string;
  name: string;
  phone: string;
  role: string;
  isActive: boolean;
  assignedProjects: Project[];
}

export default function SupervisorManagementScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [supervisors, setSupervisors] = useState<SupervisorUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form Fields
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [editingSupervisor, setEditingSupervisor] =
    useState<SupervisorUser | null>(null);

  // Upgrade Modal State
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch projects
      const projs = await storage.getProjects();
      setProjects(projs);

      // 2. Fetch supervisors from backend
      const res = await authenticatedFetch(`${API_URL}/supervisors`);
      if (res.ok) {
        const data = await res.json();
        setSupervisors(data);
      }
    } catch {
      Alert.alert("Error", "Failed to fetch supervisors or projects");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddModal = async () => {
    // Client-side plan checks
    const auth = await storage.getAuth();
    const plan = auth?.plan || "free";
    const count = supervisors.length;

    if (plan === "free") {
      setUpgradeMessage(
        "Supervisor accounts are not available on the Free Plan. Upgrade to a Professional or Business Plan to invite supervisors.",
      );
      setUpgradeModalVisible(true);
      return;
    } else if (plan === "professional" && count >= 2) {
      setUpgradeMessage(
        "You have reached the limit of 2 supervisor accounts on the Professional Plan. Upgrade to the Business Plan to unlock unlimited supervisors.",
      );
      setUpgradeModalVisible(true);
      return;
    }

    setEditingSupervisor(null);
    setName("");
    setPhone("");
    setPassword("");
    setSelectedProjectIds([]);
    setModalVisible(true);
  };

  const handleOpenEditModal = (supervisor: SupervisorUser) => {
    setEditingSupervisor(supervisor);
    setName(supervisor.name);
    setPhone(supervisor.phone);
    setPassword("");
    setSelectedProjectIds(
      supervisor.assignedProjects.map((p) => (p as any)._id || p.id),
    );
    setModalVisible(true);
  };

  const handleToggleProjectSelect = (projectId: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId],
    );
  };

  const handleSaveSupervisor = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Name is required");
      return;
    }
    if (!phone.trim() || !/^\d{10}$/.test(phone.trim())) {
      Alert.alert("Error", "Please enter a valid 10-digit mobile number");
      return;
    }
    if (!editingSupervisor && !password.trim()) {
      Alert.alert("Error", "Password is required for new supervisors");
      return;
    }

    setIsLoading(true);
    try {
      if (editingSupervisor) {
        // Edit existing supervisor
        const res = await authenticatedFetch(
          `${API_URL}/supervisors/${editingSupervisor._id}`,
          {
            method: "PUT",
            body: JSON.stringify({
              name: name.trim(),
              phone: phone.trim(),
              password: password.trim() || undefined,
              assignedProjects: selectedProjectIds,
            }),
          },
        );

        if (res.ok) {
          const updated = await res.json();
          setSupervisors((prev) =>
            prev.map((s) => (s._id === editingSupervisor._id ? updated : s)),
          );
          setModalVisible(false);
        } else {
          const err = await res.json();
          Alert.alert("Error", err.error || "Failed to update supervisor");
        }
      } else {
        // Create new supervisor
        const res = await authenticatedFetch(`${API_URL}/supervisors`, {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim(),
            password: password.trim(),
            assignedProjects: selectedProjectIds,
          }),
        });

        if (res.ok) {
          const saved = await res.json();
          setSupervisors((prev) => [...prev, saved]);
          setModalVisible(false);
        } else if (res.status === 403) {
          const err = await res.json();
          setModalVisible(false);
          setUpgradeMessage(err.error || "Plan limit exceeded.");
          setUpgradeModalVisible(true);
        } else {
          const err = await res.json();
          Alert.alert("Error", err.error || "Failed to create supervisor");
        }
      }
    } catch {
      Alert.alert("Error", "Could not connect to server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSupervisor = async (supervisorId: string) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this supervisor account? They will lose access to mark attendance immediately.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await authenticatedFetch(
                `${API_URL}/supervisors/${supervisorId}`,
                {
                  method: "DELETE",
                },
              );
              if (res.ok) {
                setSupervisors((prev) =>
                  prev.filter((s) => s._id !== supervisorId),
                );
              } else {
                Alert.alert("Error", "Failed to delete supervisor account");
              }
            } catch {
              Alert.alert("Error", "Server unreachable");
            }
          },
        },
      ],
    );
  };

  const handleToggleStatus = async (supervisor: SupervisorUser) => {
    const nextStatus = !supervisor.isActive;
    try {
      const res = await authenticatedFetch(
        `${API_URL}/supervisors/${supervisor._id}`,
        {
          method: "PUT",
          body: JSON.stringify({ isActive: nextStatus }),
        },
      );
      if (res.ok) {
        setSupervisors((prev) =>
          prev.map((s) =>
            s._id === supervisor._id ? { ...s, isActive: nextStatus } : s,
          ),
        );
      } else {
        Alert.alert("Error", "Failed to update supervisor status");
      }
    } catch {
      Alert.alert("Error", "Server unreachable");
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.headerRow}>
        <ThemedText type="h2">Supervisors</ThemedText>
        <Pressable
          onPress={handleOpenAddModal}
          style={[styles.addBtn, { backgroundColor: theme.primary }]}
        >
          <Feather name="user-plus" size={18} color="#FFFFFF" />
          <ThemedText
            type="body"
            style={{
              color: "#FFFFFF",
              fontWeight: "600",
              marginLeft: Spacing.sm,
            }}
          >
            Add Supervisor
          </ThemedText>
        </Pressable>
      </View>

      {isLoading && supervisors.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : supervisors.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="users" size={48} color={theme.textSecondary} />
          <ThemedText
            type="body"
            style={{
              color: theme.textSecondary,
              marginTop: Spacing.md,
              textAlign: "center",
            }}
          >
            No supervisor accounts added. Create supervisors to delegate
            attendance marking.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={supervisors}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View
              style={[
                styles.supervisorCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View>
                  <ThemedText type="h3">{item.name}</ThemedText>
                  <ThemedText
                    type="small"
                    style={{
                      color: theme.textSecondary,
                      marginTop: Spacing.xs,
                    }}
                  >
                    📱 {item.phone}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => handleToggleStatus(item)}
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: item.isActive
                        ? theme.success + "20"
                        : theme.border,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: item.isActive
                        ? theme.success
                        : theme.textSecondary,
                      fontWeight: "600",
                    }}
                  >
                    {item.isActive ? "ACTIVE" : "DISABLED"}
                  </ThemedText>
                </Pressable>
              </View>

              {/* Assigned Projects display */}
              <View style={styles.projectsContainer}>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, fontWeight: "700" }}
                >
                  Assigned Projects:
                </ThemedText>
                <View style={styles.badgeRow}>
                  {item.assignedProjects && item.assignedProjects.length > 0 ? (
                    item.assignedProjects.map((p, idx) => (
                      <View
                        key={(p as any)._id || p.id || idx}
                        style={[
                          styles.projBadge,
                          { backgroundColor: theme.primary + "1A" },
                        ]}
                      >
                        <ThemedText
                          type="small"
                          style={{ color: theme.primary }}
                        >
                          {p.name}
                        </ThemedText>
                      </View>
                    ))
                  ) : (
                    <ThemedText
                      type="small"
                      style={{ color: Colors.light.error }}
                    >
                      No projects assigned
                    </ThemedText>
                  )}
                </View>
              </View>

              <View
                style={[styles.divider, { backgroundColor: theme.border }]}
              />

              <View style={styles.cardActions}>
                <Pressable
                  onPress={() => handleOpenEditModal(item)}
                  style={[
                    styles.actionBtn,
                    { backgroundColor: theme.primary + "10" },
                  ]}
                >
                  <Feather name="edit-2" size={16} color={theme.primary} />
                  <ThemedText
                    type="small"
                    style={{ color: theme.primary, marginLeft: Spacing.sm }}
                  >
                    Edit
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => handleDeleteSupervisor(item._id)}
                  style={[
                    styles.actionBtn,
                    { backgroundColor: Colors.light.error + "10" },
                  ]}
                >
                  <Feather
                    name="trash-2"
                    size={16}
                    color={Colors.light.error}
                  />
                  <ThemedText
                    type="small"
                    style={{
                      color: Colors.light.error,
                      marginLeft: Spacing.sm,
                    }}
                  >
                    Delete
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      {/* Add / Edit Supervisor Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <ThemedView
            style={[
              styles.modalContent,
              { backgroundColor: theme.backgroundRoot },
            ]}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Spacing["2xl"] }}
            >
              <ThemedText type="h2" style={styles.modalTitle}>
                {editingSupervisor ? "Edit Supervisor" : "Invite Supervisor"}
              </ThemedText>

              <View style={styles.inputContainer}>
                <ThemedText type="body" style={styles.label}>
                  Supervisor Name
                </ThemedText>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      color: theme.text,
                      borderColor: theme.border,
                      backgroundColor: theme.backgroundDefault,
                    },
                  ]}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Ramesh Kumar"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.inputContainer}>
                <ThemedText type="body" style={styles.label}>
                  Mobile Number
                </ThemedText>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      color: theme.text,
                      borderColor: theme.border,
                      backgroundColor: theme.backgroundDefault,
                    },
                  ]}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                  placeholder="e.g. 9876543210"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.inputContainer}>
                <ThemedText type="body" style={styles.label}>
                  {editingSupervisor ? "New Password (Optional)" : "Password"}
                </ThemedText>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      color: theme.text,
                      borderColor: theme.border,
                      backgroundColor: theme.backgroundDefault,
                    },
                  ]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder={
                    editingSupervisor
                      ? "Leave blank to keep current"
                      : "e.g. 123456"
                  }
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.projectsSelectSection}>
                <ThemedText type="body" style={styles.label}>
                  Assign to Construction Sites
                </ThemedText>
                {projects.length === 0 ? (
                  <ThemedText
                    type="small"
                    style={{
                      color: Colors.light.error,
                      marginVertical: Spacing.sm,
                    }}
                  >
                    Please create a project site first.
                  </ThemedText>
                ) : (
                  projects.map((proj) => {
                    const isSelected = selectedProjectIds.includes(proj.id);
                    return (
                      <Pressable
                        key={proj.id}
                        onPress={() => handleToggleProjectSelect(proj.id)}
                        style={styles.selectRow}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            {
                              borderColor: isSelected
                                ? theme.primary
                                : theme.border,
                              backgroundColor: isSelected
                                ? theme.primary
                                : "transparent",
                            },
                          ]}
                        >
                          {isSelected && (
                            <Feather name="check" size={14} color="#FFFFFF" />
                          )}
                        </View>
                        <ThemedText type="body" style={{ color: theme.text }}>
                          {proj.name}{" "}
                          {proj.location ? `(${proj.location})` : ""}
                        </ThemedText>
                      </Pressable>
                    );
                  })
                )}
              </View>

              <View style={styles.modalBtns}>
                <Pressable
                  onPress={() => setModalVisible(false)}
                  style={[
                    styles.modalBtn,
                    { borderColor: theme.border, borderWidth: 1 },
                  ]}
                >
                  <ThemedText type="body">Cancel</ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleSaveSupervisor}
                  style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                >
                  <ThemedText
                    type="body"
                    style={{ color: "#FFFFFF", fontWeight: "600" }}
                  >
                    Save
                  </ThemedText>
                </Pressable>
              </View>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      {/* Upgrade Subscription Modal */}
      <Modal
        visible={upgradeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUpgradeModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <ThemedView
            style={[
              styles.upgradeContent,
              { backgroundColor: theme.backgroundRoot },
            ]}
          >
            <Feather
              name="shield"
              size={48}
              color={theme.primary}
              style={{ alignSelf: "center", marginBottom: Spacing.md }}
            />
            <ThemedText
              type="h2"
              style={{ textAlign: "center", marginBottom: Spacing.sm }}
            >
              Upgrade Subscription
            </ThemedText>
            <ThemedText
              type="body"
              style={{
                textAlign: "center",
                color: theme.textSecondary,
                marginBottom: Spacing.xl,
              }}
            >
              {upgradeMessage}
            </ThemedText>

            <Pressable
              onPress={() => {
                setUpgradeModalVisible(false);
                navigation.navigate("SettingsTab" as any);
              }}
              style={[
                styles.upgradeActionBtn,
                { backgroundColor: theme.primary },
              ]}
            >
              <ThemedText
                type="body"
                style={{ color: "#FFFFFF", fontWeight: "700" }}
              >
                View Pricing Plans
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setUpgradeModalVisible(false)}
              style={[
                styles.upgradeCancelBtn,
                { borderColor: theme.border, borderWidth: 1 },
              ]}
            >
              <ThemedText type="body">Not Now</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.xl,
  },
  addBtn: {
    flexDirection: "row",
    height: 40,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing["3xl"],
  },
  supervisorCard: {
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  projectsContainer: {
    marginTop: Spacing.md,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  projBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    height: 36,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxHeight: "85%",
    borderRadius: BorderRadius.xs,
    padding: Spacing.xl,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: Spacing.xl,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  modalInput: {
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  projectsSelectSection: {
    marginVertical: Spacing.md,
  },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  modalBtns: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  modalBtn: {
    flex: 1,
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  upgradeContent: {
    width: "100%",
    borderRadius: BorderRadius.xs,
    padding: Spacing.xl,
    elevation: 5,
  },
  upgradeActionBtn: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  upgradeCancelBtn: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
});
