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
  Linking,
  TouchableOpacity,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { storage, Project, API_URL, authenticatedFetch } from "@/utils/storage";
import { useLanguage } from "@/hooks/useLanguage";

interface SupervisorUser {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  isActive: boolean;
  notes?: string;
  assignedProjects: Project[];
}

export default function SupervisorManagementScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user } = useAuth();

  const [supervisors, setSupervisors] = useState<SupervisorUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form Fields for Create / Edit
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [editingSupervisor, setEditingSupervisor] = useState<SupervisorUser | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (route.params?.action === "create" && isDataLoaded) {
      handleOpenAddModal();
      navigation.setParams({ action: undefined });
    }
  }, [route.params?.action, isDataLoaded]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch sites/projects
      const sitesResult = await storage.getSites();
      let projs = (sitesResult.sites || []).map((s: any) => ({
        id: s.id || s._id,
        name: s.name,
      })) as any[];

      if (!projs || projs.length === 0) {
        const allProjects = await storage.getProjects();
        projs = allProjects.map((p: any) => ({
          id: p.id || p._id,
          name: p.name,
        }));
      }
      setProjects(projs);

      // 2. Fetch supervisors from backend
      const res = await authenticatedFetch(`${API_URL}/supervisors`);
      if (res.ok) {
        const data = await res.json();
        setSupervisors(data);
      }
    } catch {
      Alert.alert(t.common.error || "Error", t.supervisor.errorFetch || "Failed to load supervisors");
    } finally {
      setIsLoading(false);
      setIsDataLoaded(true);
    }
  };

  const handleOpenAddModal = () => {
    setEditingSupervisor(null);
    setName("");
    setPhone("");
    setEmail("");
    setPassword("");
    setNotes("");
    setShowAdditionalInfo(false);
    setSelectedProjectIds([]);
    setModalVisible(true);
  };

  const handleOpenEditModal = (supervisor: SupervisorUser) => {
    setEditingSupervisor(supervisor);
    setName(supervisor.name || "");
    setPhone(supervisor.phone || "");
    setEmail(supervisor.email || "");
    setPassword("");
    setNotes(supervisor.notes || "");
    setShowAdditionalInfo(!!supervisor.notes);
    setSelectedProjectIds(
      (supervisor.assignedProjects || []).map((p) => (p as any)._id || p.id)
    );
    setModalVisible(true);
  };

  const handleToggleProjectSelect = (projectId: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleSaveSupervisor = async () => {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    if (!cleanName) {
      Alert.alert("Required Field", "Please enter supervisor's full name.");
      return;
    }
    if (!cleanPhone || !/^\d{10}$/.test(cleanPhone)) {
      Alert.alert("Invalid Phone", "Please enter a valid 10-digit mobile number.");
      return;
    }

    setIsLoading(true);
    try {
      const passToUse = password.trim() || cleanPhone; // Fallback to phone number if password left blank

      if (editingSupervisor) {
        // Edit existing supervisor
        const res = await authenticatedFetch(
          `${API_URL}/supervisors/${editingSupervisor._id}`,
          {
            method: "PUT",
            body: JSON.stringify({
              name: cleanName,
              phone: cleanPhone,
              email: email.trim() || undefined,
              password: password.trim() || undefined,
              notes: notes.trim() || undefined,
              assignedProjects: selectedProjectIds,
            }),
          }
        );

        if (res.ok) {
          const updated = await res.json();
          setSupervisors((prev) =>
            prev.map((s) => (s._id === editingSupervisor._id ? updated : s))
          );
          setModalVisible(false);
        } else {
          const err = await res.json();
          Alert.alert("Error", err.error || "Failed to update supervisor.");
        }
      } else {
        // Create new supervisor - ZERO plan/subscription restrictions
        const res = await authenticatedFetch(`${API_URL}/supervisors`, {
          method: "POST",
          body: JSON.stringify({
            name: cleanName,
            phone: cleanPhone,
            email: email.trim() || undefined,
            password: passToUse,
            notes: notes.trim() || undefined,
            assignedProjects: selectedProjectIds,
          }),
        });

        if (res.ok) {
          const saved = await res.json();
          setSupervisors((prev) => [...prev, saved]);
          setModalVisible(false);
        } else {
          const err = await res.json();
          Alert.alert("Error", err.error || "Failed to create supervisor.");
        }
      }
    } catch {
      Alert.alert("Error", "Network connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSupervisor = async (supervisorId: string) => {
    Alert.alert(
      "Delete Supervisor",
      "Are you sure you want to delete this supervisor? Access to assigned sites will be revoked.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await authenticatedFetch(
                `${API_URL}/supervisors/${supervisorId}`,
                { method: "DELETE" }
              );
              if (res.ok) {
                setSupervisors((prev) =>
                  prev.filter((s) => s._id !== supervisorId)
                );
              } else {
                Alert.alert("Error", "Failed to delete supervisor.");
              }
            } catch {
              Alert.alert("Error", "Server error. Please try again.");
            }
          },
        },
      ]
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
        }
      );
      if (res.ok) {
        setSupervisors((prev) =>
          prev.map((s) =>
            s._id === supervisor._id ? { ...s, isActive: nextStatus } : s
          )
        );
      } else {
        Alert.alert("Error", "Failed to update supervisor status.");
      }
    } catch {
      Alert.alert("Error", "Server error. Please try again.");
    }
  };

  const handleCall = (phoneNumber: string) => {
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`).catch(() => {
        Alert.alert("Error", "Unable to place phone call.");
      });
    }
  };

  const filteredSupervisors = supervisors.filter((s) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      s.name.toLowerCase().includes(query) || s.phone.toLowerCase().includes(query)
    );
  });

  const getInitials = (fullName: string) => {
    if (!fullName) return "S";
    const parts = fullName.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.headerRow,
          { paddingTop: (headerHeight > 0 ? headerHeight : insets.top) + Spacing.sm },
        ]}
      >
        <View>
          <ThemedText type="h2" style={{ fontWeight: "700" }}>Supervisors</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
            {supervisors.length} Total Supervisor{supervisors.length !== 1 ? "s" : ""}
          </ThemedText>
        </View>

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
              marginLeft: Spacing.xs,
            }}
          >
            Create Supervisor
          </ThemedText>
        </Pressable>
      </View>

      {/* Search Input */}
      {supervisors.length > 0 && (
        <View style={styles.searchContainer}>
          <View
            style={[
              styles.searchInputWrapper,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
            ]}
          >
            <Feather name="search" size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search supervisors by name or phone..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")}>
                <Feather name="x" size={16} color={theme.textSecondary} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Main List / Content */}
      {isLoading && supervisors.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : supervisors.length === 0 ? (
        <View style={styles.centered}>
          <View style={[styles.emptyIconContainer, { backgroundColor: theme.primary + "15" }]}>
            <Feather name="users" size={42} color={theme.primary} />
          </View>
          <ThemedText
            type="h3"
            style={{
              fontWeight: "700",
              marginTop: Spacing.lg,
              textAlign: "center",
            }}
          >
            No Supervisors Yet
          </ThemedText>
          <ThemedText
            type="body"
            style={{
              color: theme.textSecondary,
              marginTop: Spacing.xs,
              textAlign: "center",
              maxWidth: 280,
              lineHeight: 20,
            }}
          >
            Create a supervisor to help manage your construction sites, attendance, and worker activity.
          </ThemedText>

          <Pressable
            onPress={handleOpenAddModal}
            style={[
              styles.emptyActionBtn,
              { backgroundColor: theme.primary },
            ]}
          >
            <Feather name="plus-circle" size={18} color="#FFFFFF" />
            <ThemedText
              type="body"
              style={{ color: "#FFFFFF", fontWeight: "700", marginLeft: Spacing.xs }}
            >
              + Create Supervisor
            </ThemedText>
          </Pressable>
        </View>
      ) : filteredSupervisors.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="search" size={36} color={theme.textSecondary} />
          <ThemedText
            type="body"
            style={{ color: theme.textSecondary, marginTop: Spacing.md }}
          >
            No supervisors found matching "{searchQuery}"
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={filteredSupervisors}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 100 }}
          renderItem={({ item }) => {
            const initials = getInitials(item.name);
            const assignedCount = item.assignedProjects?.length || 0;

            return (
              <View
                style={[
                  styles.supervisorCard,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                  },
                ]}
              >
                {/* Header Row: Avatar, Name, Role Tag, Status */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardLeft}>
                    <View
                      style={[
                        styles.avatarCircle,
                        { backgroundColor: theme.primary + "20" },
                      ]}
                    >
                      <ThemedText
                        type="body"
                        style={{ color: theme.primary, fontWeight: "700", fontSize: 16 }}
                      >
                        {initials}
                      </ThemedText>
                    </View>

                    <View style={styles.cardTitleInfo}>
                      <View style={styles.nameRoleRow}>
                        <ThemedText type="h3" style={{ fontWeight: "700", fontSize: 16 }}>
                          {item.name}
                        </ThemedText>
                        <View style={[styles.roleTag, { backgroundColor: theme.primary + "15" }]}>
                          <ThemedText
                            type="small"
                            style={{ color: theme.primary, fontWeight: "600", fontSize: 11 }}
                          >
                            Site Supervisor
                          </ThemedText>
                        </View>
                      </View>

                      {/* Phone with Call Action */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleCall(item.phone)}
                        style={styles.phoneRow}
                      >
                        <Feather name="phone-call" size={12} color={theme.primary} />
                        <ThemedText
                          type="small"
                          style={{
                            color: theme.primary,
                            fontWeight: "600",
                            marginLeft: 4,
                          }}
                        >
                          +91 {item.phone}
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Status Toggle Badge */}
                  <Pressable
                    onPress={() => handleToggleStatus(item)}
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: item.isActive
                          ? "#E6F4EA"
                          : "#F1F3F4",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: item.isActive ? "#137333" : "#70757A" },
                      ]}
                    />
                    <ThemedText
                      type="small"
                      style={{
                        color: item.isActive ? "#137333" : "#70757A",
                        fontWeight: "700",
                        fontSize: 11,
                      }}
                    >
                      {item.isActive ? "Active" : "Inactive"}
                    </ThemedText>
                  </Pressable>
                </View>

                {/* Assigned Site / Project Info */}
                <View style={styles.assignedSection}>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, fontWeight: "600" }}
                  >
                    Assigned Site:
                  </ThemedText>
                  <View style={styles.siteBadgeRow}>
                    {assignedCount > 0 ? (
                      item.assignedProjects.map((p, idx) => (
                        <View
                          key={(p as any)._id || p.id || idx}
                          style={[
                            styles.siteChip,
                            { backgroundColor: theme.primary + "12", borderColor: theme.primary + "30" },
                          ]}
                        >
                          <Feather name="map-pin" size={12} color={theme.primary} />
                          <ThemedText
                            type="small"
                            style={{
                              color: theme.primary,
                              fontWeight: "600",
                              marginLeft: 4,
                            }}
                          >
                            {p.name}
                          </ThemedText>
                        </View>
                      ))
                    ) : (
                      <View style={[styles.siteChip, { backgroundColor: "#FFF4E5", borderColor: "#FFE0B2" }]}>
                        <Feather name="alert-circle" size={12} color="#E65100" />
                        <ThemedText
                          type="small"
                          style={{ color: "#E65100", fontWeight: "600", marginLeft: 4 }}
                        >
                          No Site Assigned
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </View>

                {/* Card Action Buttons */}
                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                <View style={styles.cardActions}>
                  <Pressable
                    onPress={() => handleCall(item.phone)}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: theme.primary + "12" },
                    ]}
                  >
                    <Feather name="phone" size={14} color={theme.primary} />
                    <ThemedText
                      type="small"
                      style={{ color: theme.primary, marginLeft: 6, fontWeight: "600" }}
                    >
                      Call
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => handleOpenEditModal(item)}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: theme.border + "40" },
                    ]}
                  >
                    <Feather name="edit-2" size={14} color={theme.text} />
                    <ThemedText
                      type="small"
                      style={{ color: theme.text, marginLeft: 6, fontWeight: "600" }}
                    >
                      Edit
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => handleDeleteSupervisor(item._id)}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: Colors.light.error + "15" },
                    ]}
                  >
                    <Feather name="trash-2" size={14} color={Colors.light.error} />
                    <ThemedText
                      type="small"
                      style={{ color: Colors.light.error, marginLeft: 6, fontWeight: "600" }}
                    >
                      Delete
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* CREATE / EDIT SUPERVISOR MODAL */}
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
            <View style={styles.modalHeader}>
              <View>
                <ThemedText type="h2" style={{ fontWeight: "700" }}>
                  {editingSupervisor ? "Edit Supervisor" : "Create Supervisor"}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: 2 }}
                >
                  Add supervisor to manage attendance, sites, and workers.
                </ThemedText>
              </View>

              <Pressable
                onPress={() => setModalVisible(false)}
                style={styles.closeBtn}
              >
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Spacing.xl }}
            >
              {/* Optional Profile Photo Avatar Header */}
              <View style={styles.avatarPickerSection}>
                <View
                  style={[
                    styles.avatarPickerCircle,
                    { backgroundColor: theme.primary + "15", borderColor: theme.primary + "30" },
                  ]}
                >
                  <ThemedText
                    type="h2"
                    style={{ color: theme.primary, fontWeight: "700" }}
                  >
                    {getInitials(name || "Supervisor")}
                  </ThemedText>
                </View>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
                >
                  Supervisor Profile Initials
                </ThemedText>
              </View>

              {/* Basic Information Section */}
              <ThemedText type="body" style={styles.sectionHeader}>
                Basic Information
              </ThemedText>

              {/* Full Name */}
              <View style={styles.inputContainer}>
                <ThemedText type="small" style={styles.label}>
                  Full Name <ThemedText style={{ color: Colors.light.error }}>*</ThemedText>
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
                  placeholder="e.g. Ramesh Patel"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              {/* Mobile Number */}
              <View style={styles.inputContainer}>
                <ThemedText type="small" style={styles.label}>
                  Mobile Number <ThemedText style={{ color: Colors.light.error }}>*</ThemedText>
                </ThemedText>
                <View style={styles.phoneInputRow}>
                  <View
                    style={[
                      styles.countryCodeBadge,
                      { backgroundColor: theme.border + "30", borderColor: theme.border },
                    ]}
                  >
                    <ThemedText type="body" style={{ fontWeight: "600", color: theme.text }}>
                      +91
                    </ThemedText>
                  </View>
                  <TextInput
                    style={[
                      styles.modalInput,
                      styles.phoneInput,
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
                    placeholder="10-digit mobile number"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              </View>

              {/* Email Address (Optional) */}
              <View style={styles.inputContainer}>
                <ThemedText type="small" style={styles.label}>
                  Email Address (Optional)
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
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="supervisor@example.com"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              {/* Work Information Section */}
              <ThemedText type="body" style={styles.sectionHeader}>
                Work Information
              </ThemedText>

              {/* Role Dropdown / Readonly */}
              <View style={styles.inputContainer}>
                <ThemedText type="small" style={styles.label}>
                  Role
                </ThemedText>
                <View
                  style={[
                    styles.roleReadonlyBox,
                    { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                  ]}
                >
                  <Feather name="shield" size={16} color={theme.primary} />
                  <ThemedText
                    type="body"
                    style={{ color: theme.text, fontWeight: "600", marginLeft: 8 }}
                  >
                    Supervisor (Default)
                  </ThemedText>
                </View>
              </View>

              {/* Site Assignment Picker */}
              <View style={styles.inputContainer}>
                <ThemedText type="small" style={styles.label}>
                  Assign Construction Site
                </ThemedText>
                {projects.length === 0 ? (
                  <ThemedText
                    type="small"
                    style={{ color: Colors.light.error, marginVertical: Spacing.xs }}
                  >
                    No sites available. Please create a project site first.
                  </ThemedText>
                ) : (
                  <View style={styles.sitePickerContainer}>
                    {projects.map((proj) => {
                      const isSelected = selectedProjectIds.includes(proj.id);
                      return (
                        <Pressable
                          key={proj.id}
                          onPress={() => handleToggleProjectSelect(proj.id)}
                          style={[
                            styles.siteSelectItem,
                            {
                              backgroundColor: isSelected
                                ? theme.primary + "10"
                                : theme.backgroundDefault,
                              borderColor: isSelected
                                ? theme.primary
                                : theme.border,
                            },
                          ]}
                        >
                          <View style={styles.siteSelectLeft}>
                            <Feather
                              name="map-pin"
                              size={14}
                              color={isSelected ? theme.primary : theme.textSecondary}
                            />
                            <ThemedText
                              type="body"
                              style={{
                                color: isSelected ? theme.primary : theme.text,
                                fontWeight: isSelected ? "600" : "400",
                                marginLeft: 8,
                              }}
                            >
                              {proj.name}
                            </ThemedText>
                          </View>
                          <View
                            style={[
                              styles.checkboxCircle,
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
                              <Feather name="check" size={12} color="#FFFFFF" />
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Login Info Callout Box */}
              <View style={[styles.infoBox, { backgroundColor: theme.primary + "0F", borderColor: theme.primary + "30" }]}>
                <Feather name="info" size={16} color={theme.primary} />
                <ThemedText
                  type="small"
                  style={{ color: theme.text, marginLeft: 8, flex: 1, lineHeight: 18 }}
                >
                  Supervisor will log in using this mobile number.
                </ThemedText>
              </View>

              {/* Optional Collapsible Additional Info */}
              <Pressable
                onPress={() => setShowAdditionalInfo(!showAdditionalInfo)}
                style={styles.accordionHeader}
              >
                <ThemedText type="body" style={{ color: theme.primary, fontWeight: "600" }}>
                  {showAdditionalInfo ? "- Hide Additional Information" : "+ Additional Information"}
                </ThemedText>
              </Pressable>

              {showAdditionalInfo && (
                <View style={styles.inputContainer}>
                  <ThemedText type="small" style={styles.label}>
                    Notes / Remarks
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.modalInput,
                      styles.textAreaInput,
                      {
                        color: theme.text,
                        borderColor: theme.border,
                        backgroundColor: theme.backgroundDefault,
                      },
                    ]}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={3}
                    placeholder="Enter any additional notes or address..."
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              )}

              {/* Save / Submit Button */}
              <Pressable
                onPress={handleSaveSupervisor}
                disabled={isLoading}
                style={[
                  styles.saveBtn,
                  { backgroundColor: theme.primary, opacity: isLoading ? 0.7 : 1 },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText
                    type="body"
                    style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16 }}
                  >
                    {editingSupervisor ? "Save Changes" : "Create Supervisor"}
                  </ThemedText>
                )}
              </Pressable>
            </ScrollView>
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  addBtn: {
    flexDirection: "row",
    height: 42,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    marginLeft: Spacing.sm,
    fontSize: 14,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing["2xl"],
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyActionBtn: {
    flexDirection: "row",
    height: 46,
    paddingHorizontal: Spacing.xl,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xl,
  },
  supervisorCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitleInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  nameRoleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  roleTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  assignedSection: {
    marginTop: Spacing.md,
  },
  siteBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  siteChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  cardActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Modal Styles */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    marginBottom: Spacing.md,
  },
  closeBtn: {
    padding: 4,
  },
  avatarPickerSection: {
    alignItems: "center",
    marginVertical: Spacing.md,
  },
  avatarPickerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeader: {
    fontWeight: "700",
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    marginBottom: Spacing.md,
  },
  label: {
    fontWeight: "600",
    marginBottom: 6,
  },
  modalInput: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
  },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  countryCodeBadge: {
    height: 48,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  phoneInput: {
    flex: 1,
  },
  roleReadonlyBox: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
  },
  sitePickerContainer: {
    gap: Spacing.xs,
  },
  siteSelectItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  siteSelectLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkboxCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  accordionHeader: {
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.md,
  },
  textAreaInput: {
    height: 80,
    paddingTop: Spacing.sm,
    textAlignVertical: "top",
  },
  saveBtn: {
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.md,
  },
});
