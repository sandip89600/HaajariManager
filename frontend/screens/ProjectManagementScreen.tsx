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
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { storage, Project, generateId } from "@/utils/storage";

export default function ProjectManagementScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Upgrade Modal State
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const data = await storage.getProjects();
      setProjects(data);
    } catch {
      Alert.alert("Error", "Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingProject(null);
    setProjectName("");
    setProjectLocation("");
    setModalVisible(true);
  };

  const handleOpenEditModal = (project: Project) => {
    setEditingProject(project);
    setProjectName(project.name);
    setProjectLocation(project.location || "");
    setModalVisible(true);
  };

  const handleSaveProject = async () => {
    if (!projectName.trim()) {
      Alert.alert("Error", "Please enter project name");
      return;
    }

    try {
      if (editingProject) {
        // Edit existing project
        const updated = {
          ...editingProject,
          name: projectName.trim(),
          location: projectLocation.trim(),
        };
        await storage.updateProject(updated);
        setProjects((prev) =>
          prev.map((p) => (p.id === editingProject.id ? updated : p)),
        );
      } else {
        // Add new project
        const newProj: Project = {
          id: generateId(),
          name: projectName.trim(),
          location: projectLocation.trim(),
          status: "active",
          createdAt: Date.now(),
        };
        await storage.addProject(newProj);
        setProjects((prev) => [newProj, ...prev]);
      }
      setModalVisible(false);
    } catch (error: any) {
      if (error.message === "LIMIT_EXCEEDED_PROJECTS") {
        setModalVisible(false);
        setUpgradeModalVisible(true);
      } else {
        Alert.alert("Error", "Failed to save project");
      }
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Confirm Delete\n\nAre you sure you want to delete this project? Associated workers will be unassigned.",
      );
      if (confirmed) {
        try {
          await storage.deleteProject(projectId);
          setProjects((prev) => prev.filter((p) => p.id !== projectId));
        } catch {
          alert("Error: Failed to delete project");
        }
      }
      return;
    }

    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this project? Associated workers will be unassigned.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Project",
          style: "destructive",
          onPress: async () => {
            try {
              await storage.deleteProject(projectId);
              setProjects((prev) => prev.filter((p) => p.id !== projectId));
            } catch {
              Alert.alert("Error", "Failed to delete project");
            }
          },
        },
      ],
    );
  };

  const handleToggleStatus = async (project: Project) => {
    const nextStatus = project.status === "active" ? "inactive" : "active";
    const updated = { ...project, status: nextStatus as "active" | "inactive" };
    try {
      await storage.updateProject(updated);
      setProjects((prev) =>
        prev.map((p) => (p.id === project.id ? updated : p)),
      );
    } catch {
      Alert.alert("Error", "Failed to update project status");
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.headerRow}>
        <ThemedText type="h2">Project List</ThemedText>
        <Pressable
          onPress={handleOpenAddModal}
          style={[styles.addBtn, { backgroundColor: theme.primary }]}
        >
          <Feather name="plus" size={18} color="#FFFFFF" />
          <ThemedText
            type="body"
            style={{
              color: "#FFFFFF",
              fontWeight: "600",
              marginLeft: Spacing.sm,
            }}
          >
            Add Project
          </ThemedText>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : projects.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="folder" size={48} color={theme.textSecondary} />
          <ThemedText
            type="body"
            style={{ color: theme.textSecondary, marginTop: Spacing.md }}
          >
            No projects created yet. Add your first construction site.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View
              style={[
                styles.projectCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View>
                  <ThemedText type="h3">{item.name}</ThemedText>
                  {item.location ? (
                    <ThemedText
                      type="small"
                      style={{
                        color: theme.textSecondary,
                        marginTop: Spacing.xs,
                      }}
                    >
                      📍 {item.location}
                    </ThemedText>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => handleToggleStatus(item)}
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        item.status === "active"
                          ? theme.success + "20"
                          : theme.border,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color:
                        item.status === "active"
                          ? theme.success
                          : theme.textSecondary,
                      fontWeight: "600",
                    }}
                  >
                    {item.status.toUpperCase()}
                  </ThemedText>
                </Pressable>
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
                  onPress={() => handleDeleteProject(item.id)}
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

      {/* Add / Edit Modal */}
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
            <ThemedText type="h2" style={styles.modalTitle}>
              {editingProject ? "Edit Project" : "Add New Project"}
            </ThemedText>

            <View style={styles.inputContainer}>
              <ThemedText type="body" style={styles.label}>
                Project/Site Name
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
                value={projectName}
                onChangeText={setProjectName}
                placeholder="e.g. Metro Heights Phase 1"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputContainer}>
              <ThemedText type="body" style={styles.label}>
                Location / Address
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
                value={projectLocation}
                onChangeText={setProjectLocation}
                placeholder="e.g. Sector 62, Noida"
                placeholderTextColor={theme.textSecondary}
              />
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
                onPress={handleSaveProject}
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
          </ThemedView>
        </View>
      </Modal>

      {/* Subscription Upgrade Modal */}
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
              name="trending-up"
              size={48}
              color={theme.primary}
              style={{ alignSelf: "center", marginBottom: Spacing.md }}
            />
            <ThemedText
              type="h2"
              style={{ textAlign: "center", marginBottom: Spacing.sm }}
            >
              Upgrade to Professional Plan
            </ThemedText>
            <ThemedText
              type="body"
              style={{
                textAlign: "center",
                color: theme.textSecondary,
                marginBottom: Spacing.xl,
              }}
            >
              The Free plan is limited to 1 active project. Upgrade to create
              multiple projects, assign unlimited workers, and access GPS
              features.
            </ThemedText>

            <Pressable
              onPress={() => {
                setUpgradeModalVisible(false);
                navigation.navigate("SettingsTab" as any); // Redirect to Settings to trigger upgrade comparisons
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
                View Upgrade Plans
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
  projectCard: {
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
