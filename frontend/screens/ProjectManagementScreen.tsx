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
import { useLanguage } from "@/hooks/useLanguage";
import { appContextTracker } from "@/utils/appContextTracker";

export default function ProjectManagementScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
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

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      appContextTracker.setContext({
        currentScreen: "ProjectManagement",
      });
    });
    return unsubscribe;
  }, [navigation]);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const data = await storage.getProjects();
      setProjects(data);
    } catch {
      Alert.alert(t.common.error || "Error", t.project.errorLoad);
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
      Alert.alert(t.common.error || "Error", t.project.projectNameRequired);
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
        Alert.alert(t.common.error || "Error", t.project.errorSave);
      }
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        `${t.project.confirmDeleteTitle}\n\n${t.project.confirmDeleteMessage}`,
      );
      if (confirmed) {
        try {
          await storage.deleteProject(projectId);
          setProjects((prev) => prev.filter((p) => p.id !== projectId));
        } catch {
          alert(`${t.common.error || "Error"}: ${t.project.errorDelete}`);
        }
      }
      return;
    }

    Alert.alert(
      t.project.confirmDeleteTitle,
      t.project.confirmDeleteMessage,
      [
        { text: t.common.cancel || "Cancel", style: "cancel" },
        {
          text: t.project.deleteProject,
          style: "destructive",
          onPress: async () => {
            try {
              await storage.deleteProject(projectId);
              setProjects((prev) => prev.filter((p) => p.id !== projectId));
            } catch {
              Alert.alert(t.common.error || "Error", t.project.errorDelete);
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
      Alert.alert(t.common.error || "Error", t.project.errorStatus);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.headerRow}>
        <ThemedText type="h2">{t.project.title}</ThemedText>
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
            {t.project.addProject}
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
            {t.project.noProjects}
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
                    {item.status === "active" ? t.project.active.toUpperCase() : t.project.completed.toUpperCase()}
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
                    {t.common.edit || "Edit"}
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
                    {t.common.delete || "Delete"}
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
              {editingProject ? t.project.editProject : t.project.addProject}
            </ThemedText>

            <View style={styles.inputContainer}>
              <ThemedText type="body" style={styles.label}>
                {t.project.projectName}
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
                placeholder={t.project.projectNamePlaceholder}
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputContainer}>
              <ThemedText type="body" style={styles.label}>
                {t.project.location}
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
                placeholder={t.project.locationPlaceholder}
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
                <ThemedText type="body">{t.common.cancel || "Cancel"}</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleSaveProject}
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
              >
                <ThemedText
                  type="body"
                  style={{ color: "#FFFFFF", fontWeight: "600" }}
                >
                  {t.common.save || "Save"}
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
              {t.project.professionalTitle}
            </ThemedText>
            <ThemedText
              type="body"
              style={{
                textAlign: "center",
                color: theme.textSecondary,
                marginBottom: Spacing.xl,
              }}
            >
              {t.project.professionalDesc}
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
                {t.project.viewUpgradePlans}
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setUpgradeModalVisible(false)}
              style={[
                styles.upgradeCancelBtn,
                { borderColor: theme.border, borderWidth: 1 },
              ]}
            >
              <ThemedText type="body">{t.project.notNow}</ThemedText>
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
