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
  Text,
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
  username?: string;
  role: string;
  isActive: boolean;
  notes?: string;
  connectionStatus?: string;
  assignedProjects: Project[];
}

export default function SupervisorManagementScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [supervisors, setSupervisors] = useState<SupervisorUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<"create" | "search_existing">("create");

  // Create Form Fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [editingSupervisor, setEditingSupervisor] = useState<SupervisorUser | null>(null);

  // Search Existing Supervisor Fields
  const [existingSearchInput, setExistingSearchInput] = useState("");
  const [isSearchingExisting, setIsSearchingExisting] = useState(false);
  const [existingSearchResults, setExistingSearchResults] = useState<any[]>([]);
  const [searchHasExecuted, setSearchHasExecuted] = useState(false);

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

      // 2. Fetch supervisors & pending requests from backend v2 API
      const res = await authenticatedFetch(`${API_URL}/contractor/supervisors`);
      if (res.ok) {
        const data = await res.json();
        setSupervisors(data.supervisors || []);
        setPendingRequests(data.pendingRequests || []);
      } else {
        // Fallback to legacy endpoint
        const legacyRes = await authenticatedFetch(`${API_URL}/supervisors`);
        if (legacyRes.ok) {
          const data = await legacyRes.json();
          setSupervisors(data);
        }
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
    setActiveTab("create");
    setName("");
    setPhone("");
    setEmail("");
    setPassword("");
    setNotes("");
    setShowAdditionalInfo(false);
    setSelectedProjectIds([]);
    setExistingSearchInput("");
    setExistingSearchResults([]);
    setSearchHasExecuted(false);
    setModalVisible(true);
  };

  const handleOpenEditModal = (supervisor: SupervisorUser) => {
    setEditingSupervisor(supervisor);
    setActiveTab("create");
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

  const handleSearchExistingSupervisor = async () => {
    const q = existingSearchInput.trim();
    if (!q) {
      Alert.alert("Required", "Please enter a username, mobile number, or email to search.");
      return;
    }

    setIsSearchingExisting(true);
    setSearchHasExecuted(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/supervisors/search?query=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setExistingSearchResults(data.supervisors || []);
      } else {
        setExistingSearchResults([]);
      }
    } catch {
      Alert.alert("Search Error", "Unable to search for existing supervisor.");
    } finally {
      setIsSearchingExisting(false);
    }
  };

  const handleSendConnectionRequest = async (supervisorId: string) => {
    setIsLoading(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/supervisors/connection-request`, {
        method: "POST",
        body: JSON.stringify({ supervisorId }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert("Request Sent", "Connection request sent to supervisor. They will be connected once they accept.");
        setModalVisible(false);
        loadData();
      } else {
        Alert.alert("Connection Error", data.message || "Failed to send connection request.");
      }
    } catch {
      Alert.alert("Error", "Network connection error.");
    } finally {
      setIsLoading(false);
    }
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
      const passToUse = password.trim() || cleanPhone;

      if (editingSupervisor) {
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
            {supervisors.length} Connected Supervisor{supervisors.length !== 1 ? "s" : ""}
          </ThemedText>
        </View>

        <Pressable
          onPress={handleOpenAddModal}
          style={[styles.addBtn, { backgroundColor: "#F97316" }]}
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
            Add Supervisor
          </ThemedText>
        </Pressable>
      </View>

      {/* Pending Connection Requests Banner */}
      {pendingRequests.length > 0 && (
        <View style={styles.pendingSection}>
          <ThemedText style={styles.pendingSectionTitle}>
            PENDING CONNECTION REQUESTS ({pendingRequests.length})
          </ThemedText>
          {pendingRequests.map((req) => (
            <View
              key={req.requestId}
              style={[
                styles.pendingCard,
                { backgroundColor: isDark ? "#1E293B" : "#FFF7ED", borderColor: "#FDBA74" },
              ]}
            >
              <View style={{ flex: 1 }}>
                <ThemedText style={{ fontWeight: "700", fontSize: 14 }}>
                  {req.supervisor?.name || "Supervisor"}
                </ThemedText>
                <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>
                  {req.supervisor?.phone || req.supervisor?.email}
                </ThemedText>
              </View>
              <View style={styles.pendingBadge}>
                <ThemedText style={styles.pendingBadgeText}>Pending Connection</ThemedText>
              </View>
            </View>
          ))}
        </View>
      )}

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

      {/* Main List */}
      {isLoading && supervisors.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#F97316" />
        </View>
      ) : supervisors.length === 0 ? (
        <View style={styles.centered}>
          <View style={[styles.emptyIconContainer, { backgroundColor: "#FFF7ED" }]}>
            <Feather name="users" size={42} color="#F97316" />
          </View>
          <ThemedText
            type="h3"
            style={{ fontWeight: "700", marginTop: Spacing.lg, textAlign: "center" }}
          >
            No Connected Supervisors
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
            Create a new supervisor or add an existing supervisor account to manage your sites.
          </ThemedText>

          <Pressable
            onPress={handleOpenAddModal}
            style={[styles.emptyActionBtn, { backgroundColor: "#F97316" }]}
          >
            <Feather name="plus-circle" size={18} color="#FFFFFF" />
            <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "700", marginLeft: Spacing.xs }}>
              + Add Supervisor
            </ThemedText>
          </Pressable>
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
                {/* Header Row */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardLeft}>
                    <View style={[styles.avatarCircle, { backgroundColor: "#FFF7ED" }]}>
                      <ThemedText type="body" style={{ color: "#F97316", fontWeight: "700", fontSize: 16 }}>
                        {initials}
                      </ThemedText>
                    </View>

                    <View style={styles.cardTitleInfo}>
                      <View style={styles.nameRoleRow}>
                        <ThemedText type="h3" style={{ fontWeight: "700", fontSize: 16 }}>
                          {item.name}
                        </ThemedText>
                        <View style={[styles.roleTag, { backgroundColor: "#FFF7ED" }]}>
                          <ThemedText type="small" style={{ color: "#F97316", fontWeight: "600", fontSize: 11 }}>
                            Supervisor
                          </ThemedText>
                        </View>
                      </View>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleCall(item.phone)}
                        style={styles.phoneRow}
                      >
                        <Feather name="phone-call" size={12} color="#F97316" />
                        <ThemedText type="small" style={{ color: "#F97316", fontWeight: "600", marginLeft: 4 }}>
                          +91 {item.phone}
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: "#E6F4EA" }]}>
                    <View style={[styles.statusDot, { backgroundColor: "#137333" }]} />
                    <ThemedText type="small" style={{ color: "#137333", fontWeight: "700", fontSize: 11 }}>
                      Connected
                    </ThemedText>
                  </View>
                </View>

                {/* Assigned Site / Project Info */}
                <View style={styles.assignedSection}>
                  <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600" }}>
                    Assigned Site:
                  </ThemedText>
                  <View style={styles.siteBadgeRow}>
                    {assignedCount > 0 ? (
                      item.assignedProjects.map((p, idx) => (
                        <View
                          key={(p as any)._id || p.id || idx}
                          style={[styles.siteChip, { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }]}
                        >
                          <Feather name="map-pin" size={12} color="#F97316" />
                          <ThemedText type="small" style={{ color: "#F97316", fontWeight: "600", marginLeft: 4 }}>
                            {p.name}
                          </ThemedText>
                        </View>
                      ))
                    ) : (
                      <View style={[styles.siteChip, { backgroundColor: "#FFF4E5", borderColor: "#FFE0B2" }]}>
                        <Feather name="alert-circle" size={12} color="#E65100" />
                        <ThemedText type="small" style={{ color: "#E65100", fontWeight: "600", marginLeft: 4 }}>
                          No Site Assigned
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                <View style={styles.cardActions}>
                  <Pressable
                    onPress={() => handleCall(item.phone)}
                    style={[styles.actionBtn, { backgroundColor: "#FFF7ED" }]}
                  >
                    <Feather name="phone" size={14} color="#F97316" />
                    <ThemedText type="small" style={{ color: "#F97316", marginLeft: 6, fontWeight: "600" }}>
                      Call
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => handleOpenEditModal(item)}
                    style={[styles.actionBtn, { backgroundColor: theme.border + "40" }]}
                  >
                    <Feather name="edit-2" size={14} color={theme.text} />
                    <ThemedText type="small" style={{ color: theme.text, marginLeft: 6, fontWeight: "600" }}>
                      Edit
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => handleDeleteSupervisor(item._id)}
                    style={[styles.actionBtn, { backgroundColor: Colors.light.error + "15" }]}
                  >
                    <Feather name="trash-2" size={14} color={Colors.light.error} />
                    <ThemedText type="small" style={{ color: Colors.light.error, marginLeft: 6, fontWeight: "600" }}>
                      Delete
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* ADD SUPERVISOR MODAL (2 TABS: Create New vs Add Existing) */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <ThemedView style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }]}>
            <View style={styles.modalHeader}>
              <View>
                <ThemedText type="h2" style={{ fontWeight: "700" }}>
                  {editingSupervisor ? "Edit Supervisor" : "Add Supervisor"}
                </ThemedText>
              </View>
              <Pressable onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            {/* Tab Bar (Create New vs Add Existing) */}
            {!editingSupervisor && (
              <View style={styles.tabBarRow}>
                <Pressable
                  onPress={() => setActiveTab("create")}
                  style={[
                    styles.tabItem,
                    activeTab === "create" && { borderBottomColor: "#F97316", borderBottomWidth: 2 },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.tabText,
                      { color: activeTab === "create" ? "#F97316" : theme.textSecondary },
                    ]}
                  >
                    Create New Supervisor
                  </ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => setActiveTab("search_existing")}
                  style={[
                    styles.tabItem,
                    activeTab === "search_existing" && { borderBottomColor: "#F97316", borderBottomWidth: 2 },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.tabText,
                      { color: activeTab === "search_existing" ? "#F97316" : theme.textSecondary },
                    ]}
                  >
                    Add Existing Supervisor
                  </ThemedText>
                </Pressable>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.xl }}>
              {activeTab === "create" ? (
                /* ── TAB A: CREATE NEW SUPERVISOR ── */
                <>
                  <View style={styles.inputContainer}>
                    <ThemedText type="small" style={styles.label}>
                      Full Name <ThemedText style={{ color: Colors.light.error }}>*</ThemedText>
                    </ThemedText>
                    <TextInput
                      style={[
                        styles.modalInput,
                        { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault },
                      ]}
                      value={name}
                      onChangeText={setName}
                      placeholder="e.g. Ramesh Patel"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <ThemedText type="small" style={styles.label}>
                      Mobile Number <ThemedText style={{ color: Colors.light.error }}>*</ThemedText>
                    </ThemedText>
                    <TextInput
                      style={[
                        styles.modalInput,
                        { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault },
                      ]}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <ThemedText type="small" style={styles.label}>Email Address (Optional)</ThemedText>
                    <TextInput
                      style={[
                        styles.modalInput,
                        { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault },
                      ]}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholder="supervisor@example.com"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <ThemedText type="small" style={styles.label}>Password (Optional)</ThemedText>
                    <TextInput
                      style={[
                        styles.modalInput,
                        { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault },
                      ]}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      placeholder="Default is phone number"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>

                  <Pressable
                    onPress={handleSaveSupervisor}
                    disabled={isLoading}
                    style={[styles.saveBtn, { backgroundColor: "#F97316", opacity: isLoading ? 0.7 : 1 }]}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16 }}>
                        {editingSupervisor ? "Save Changes" : "Create Supervisor"}
                      </ThemedText>
                    )}
                  </Pressable>
                </>
              ) : (
                /* ── TAB B: ADD EXISTING SUPERVISOR ── */
                <>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 12 }}>
                    Search for an existing Supervisor account using their Username, Mobile Number, or Email.
                  </ThemedText>

                  <View style={styles.searchExistingRow}>
                    <TextInput
                      style={[
                        styles.modalInput,
                        { flex: 1, color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault },
                      ]}
                      value={existingSearchInput}
                      onChangeText={setExistingSearchInput}
                      placeholder="Search Username / Mobile / Email"
                      placeholderTextColor={theme.textSecondary}
                    />
                    <Pressable
                      onPress={handleSearchExistingSupervisor}
                      disabled={isSearchingExisting}
                      style={styles.searchExistingBtn}
                    >
                      {isSearchingExisting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>Search</ThemedText>
                      )}
                    </Pressable>
                  </View>

                  {/* Search Results */}
                  {searchHasExecuted && (
                    <View style={{ marginTop: 16 }}>
                      {existingSearchResults.length === 0 ? (
                        <View style={{ alignItems: "center", padding: 24 }}>
                          <Feather name="user-x" size={32} color={theme.textSecondary} />
                          <ThemedText style={{ color: theme.textSecondary, marginTop: 8 }}>
                            No supervisor account found.
                          </ThemedText>
                        </View>
                      ) : (
                        existingSearchResults.map((sup) => (
                          <View
                            key={sup._id}
                            style={[
                              styles.resultCard,
                              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
                            ]}
                          >
                            <View style={{ flex: 1 }}>
                              <ThemedText style={{ fontWeight: "700", fontSize: 15 }}>{sup.name}</ThemedText>
                              <ThemedText style={{ color: theme.textSecondary, fontSize: 12.5 }}>
                                @{sup.username || "no-username"} • {sup.phone}
                              </ThemedText>
                              {sup.contractorCompany ? (
                                <ThemedText style={{ color: "#F97316", fontSize: 12, marginTop: 2 }}>
                                  Company: {sup.contractorCompany}
                                </ThemedText>
                              ) : null}
                            </View>

                            <Pressable
                              onPress={() => handleSendConnectionRequest(sup._id)}
                              style={styles.sendReqBtn}
                            >
                              <ThemedText style={styles.sendReqBtnText}>Send Request</ThemedText>
                            </Pressable>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  pendingSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  pendingSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#F97316",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  pendingCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  pendingBadge: {
    backgroundColor: "#FDBA74",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pendingBadgeText: {
    color: "#7C2D12",
    fontSize: 11,
    fontWeight: "700",
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
    alignItems: "center",
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  closeBtn: { padding: 4 },
  tabBarRow: {
    flexDirection: "row",
    marginVertical: 12,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
  },
  inputContainer: { marginBottom: Spacing.md },
  label: { fontWeight: "600", marginBottom: 6 },
  modalInput: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
  },
  saveBtn: {
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  searchExistingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchExistingBtn: {
    backgroundColor: "#F97316",
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  sendReqBtn: {
    backgroundColor: "#10B981",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sendReqBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});
