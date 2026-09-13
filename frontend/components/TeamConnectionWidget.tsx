import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { authenticatedFetch, API_URL, storage } from "@/utils/storage";
import { Spacing, BorderRadius } from "@/constants/theme";

interface TeamConnectionWidgetProps {
  onRefreshParent?: () => void;
}

export default function TeamConnectionWidget({ onRefreshParent }: TeamConnectionWidgetProps) {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const { user, uniqueId, refreshUserProfile } = useAuth();

  const isContractor = user?.role === "contractor" || user?.role === "builder" || user?.role === "admin";
  const isSupervisor = user?.role === "supervisor";
  const isWorker = user?.role === "labor" || (user?.role as string) === "worker";

  // State
  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const [connectTab, setConnectTab] = useState<"mobile" | "id">("mobile");
  const [targetRole, setTargetRole] = useState<"worker" | "supervisor">("worker");

  // Mobile connect state
  const [mobileNumber, setMobileNumber] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [workerCategory, setWorkerCategory] = useState("labour");
  const [dailyWage, setDailyWage] = useState("500");
  const [isSubmittingMobile, setIsSubmittingMobile] = useState(false);

  // ID connect state
  const [accountIdInput, setAccountIdInput] = useState("");
  const [isSearchingId, setIsSearchingId] = useState(false);
  const [foundAccount, setFoundAccount] = useState<any>(null);
  const [isSendingIdRequest, setIsSendingIdRequest] = useState(false);

  // Pending requests and connected team state
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [connectedSupervisors, setConnectedSupervisors] = useState<any[]>([]);
  const [connectedWorkers, setConnectedWorkers] = useState<any[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const cardBg = isDark ? "#1E293B" : "#FFFFFF";
  const borderCol = isDark ? "#334155" : "#E2E8F0";

  // Helper to safely parse API responses without crashing on non-JSON/HTML bodies
  const safeParseResponse = async (res: Response) => {
    try {
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        return { success: false, message: text || `HTTP ${res.status} error` };
      }
    } catch (e: any) {
      return { success: false, message: e.message || "Failed to read response" };
    }
  };

  // Load connection data and pending requests
  const loadConnectionData = useCallback(async () => {
    try {
      // 1. Fetch pending requests for current user
      const res = await authenticatedFetch(`${API_URL}/connections/user/pending-requests`);
      if (res.ok) {
        const data = await safeParseResponse(res);
        if (data.success) {
          const reqs = Array.isArray(data.incoming)
            ? data.incoming
            : Array.isArray(data.requests)
            ? data.requests
            : [];
          setPendingRequests(reqs);
        }
      }

      // 2. If contractor, fetch connected members
      if (isContractor) {
        const teamRes = await authenticatedFetch(`${API_URL}/connections/contractor/connections`);
        if (teamRes.ok) {
          const teamData = await safeParseResponse(teamRes);
          if (teamData.success) {
            setConnectedSupervisors(teamData.supervisors || []);
            setConnectedWorkers(teamData.workers || []);
          }
        }
      }
    } catch (e) {
      console.warn("Error loading team connection data:", e);
    }
  }, [isContractor]);

  useEffect(() => {
    loadConnectionData();
  }, [loadConnectionData]);

  // Copy ID to clipboard
  const handleCopyId = async (idToCopy?: string) => {
    const text = idToCopy || uniqueId;
    if (text) {
      await Clipboard.setStringAsync(text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("common.copied", "Copied!"), `${text} copied to clipboard.`);
    }
  };

  // Share ID
  const handleShareId = async () => {
    if (uniqueId) {
      try {
        const roleTitle = isContractor ? "Contractor" : isSupervisor ? "Supervisor" : "Worker";
        await Share.share({
          message: `Haajari Manager ${roleTitle} ID: ${uniqueId}\nName: ${user?.name || ""}\nConnect with me on Haajari Manager!`,
        });
      } catch (err) {
        console.warn("Share error:", err);
      }
    }
  };

  // Method 1: Connect via Mobile
  const handleConnectByMobile = async () => {
    const cleanPhone = mobileNumber.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      Alert.alert(t("common.error", "Error"), t("connection.enter10DigitPhone", "Please enter a valid 10-digit mobile number."));
      return;
    }
    if (!workerName.trim()) {
      Alert.alert(t("common.error", "Error"), t("workers.enterName", "Please enter worker name."));
      return;
    }

    setIsSubmittingMobile(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/workers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workerName.trim(),
          category: workerCategory,
          dailyRate: parseFloat(dailyWage) || 500,
          phone: cleanPhone,
        }),
      });

      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          t("common.success", "Worker Added & Linked!"),
          t(
            "connection.mobileConnectSuccess",
            "Worker profile has been created. When the worker signs up with this phone number, their profile will be linked automatically!"
          )
        );
        setConnectModalVisible(false);
        setMobileNumber("");
        setWorkerName("");
        loadConnectionData();
        onRefreshParent?.();
      } else {
        const errData = await safeParseResponse(res);
        Alert.alert(t("common.error", "Error"), errData.error || errData.message || "Failed to add worker.");
      }
    } catch (err: any) {
      Alert.alert(t("common.error", "Error"), err.message || "Failed to connect worker.");
    } finally {
      setIsSubmittingMobile(false);
    }
  };

  // Method 2: Search ID
  const handleLookupId = async () => {
    const q = accountIdInput.trim();
    if (!q) {
      Alert.alert(t("common.required", "Required"), t("connection.enterUniqueIdError", "Please enter Unique ID or Mobile Number."));
      return;
    }

    setIsSearchingId(true);
    setFoundAccount(null);
    try {
      const res = await authenticatedFetch(`${API_URL}/connections/lookup?uniqueId=${encodeURIComponent(q)}`);
      const data = await safeParseResponse(res);

      if (res.ok && data.success) {
        setFoundAccount(data.user || data.worker);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert(
          t("common.notFound", "Account Not Found"),
          data.message || data.error || t("connection.userNotFound", "No account found with this ID or Mobile Number.")
        );
      }
    } catch (err: any) {
      Alert.alert(t("common.error", "Error"), err.message || "Failed to search account.");
    } finally {
      setIsSearchingId(false);
    }
  };

  // Method 2: Send Request to ID
  const handleSendIdRequest = async () => {
    if (!foundAccount) return;
    setIsSendingIdRequest(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/connections/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUniqueId: foundAccount.uniqueId,
          targetUserId: foundAccount.id || foundAccount._id,
        }),
      });
      const data = await safeParseResponse(res);

      if (res.ok && data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          t("common.success", "Request Sent!"),
          t("connection.requestSentMsg", "Connection request has been sent successfully.")
        );
        setConnectModalVisible(false);
        setAccountIdInput("");
        setFoundAccount(null);
        loadConnectionData();
      } else {
        Alert.alert(t("common.error", "Error"), data.message || data.error || "Failed to send connection request.");
      }
    } catch (err: any) {
      Alert.alert(t("common.error", "Error"), err.message || "Connection request failed.");
    } finally {
      setIsSendingIdRequest(false);
    }
  };

  // Accept incoming request
  const handleAcceptRequest = async (reqId: string) => {
    if (!reqId) return;
    setProcessingRequestId(reqId);
    try {
      const res = await authenticatedFetch(`${API_URL}/connections/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: reqId }),
      });
      const data = await safeParseResponse(res);
      if (res.ok && data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Immediately remove request from pending list locally for instantaneous UI update
        setPendingRequests((prev) => prev.filter((r) => (r.requestId || r._id || r.id) !== reqId));
        Alert.alert(t("common.success", "Connected!"), t("connection.connectedSuccess", "Connection accepted successfully!"));
        await refreshUserProfile();
        loadConnectionData();
        onRefreshParent?.();
      } else {
        Alert.alert(t("common.error", "Error"), data.message || data.error || "Failed to accept request.");
      }
    } catch (err: any) {
      Alert.alert(t("common.error", "Error"), err.message || "An unexpected error occurred while accepting request.");
    } finally {
      setProcessingRequestId(null);
    }
  };

  // Reject incoming request
  const handleRejectRequest = async (reqId: string) => {
    if (!reqId) return;
    setProcessingRequestId(reqId);
    try {
      const res = await authenticatedFetch(`${API_URL}/connections/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: reqId }),
      });
      const data = await safeParseResponse(res);
      if (res.ok && data.success) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPendingRequests((prev) => prev.filter((r) => (r.requestId || r._id || r.id) !== reqId));
        loadConnectionData();
      } else {
        Alert.alert(t("common.error", "Error"), data.message || data.error || "Failed to reject request.");
      }
    } catch (err: any) {
      Alert.alert(t("common.error", "Error"), err.message || "An unexpected error occurred while rejecting request.");
    } finally {
      setProcessingRequestId(null);
    }
  };

  // Render Inline Pending Requests List
  const renderInlineRequests = () => {
    if (pendingRequests.length === 0) return null;

    return (
      <View style={styles.inlineRequestsContainer}>
        <View style={styles.inlineRequestsHeader}>
          <View style={styles.pulsingDot} />
          <Text style={[styles.inlineRequestsTitle, { color: theme.text }]}>
            {t("connection.incomingRequests", "Incoming Requests")} ({pendingRequests.length})
          </Text>
        </View>

        {pendingRequests.map((req, index) => {
          const reqId = req.requestId || req._id || req.id;
          const senderName = req.senderName || req.contractorName || req.targetName || "User";
          const senderIdDisplay = req.senderUniqueId || req.contractorUniqueId || req.code || "";
          const roleLabel =
            req.senderRole === "labor" || req.senderRole === "worker"
              ? t("roles.worker", "Worker")
              : req.senderRole === "supervisor"
              ? t("roles.supervisor", "Supervisor")
              : t("roles.contractor", "Contractor");
          const isProcessing = processingRequestId === reqId;

          return (
            <View
              key={reqId || index}
              style={[
                styles.requestCard,
                {
                  backgroundColor: isDark ? "#1E1B4B" : "#F8FAFC",
                  borderColor: isDark ? "#4338CA" : "#E2E8F0",
                },
              ]}
            >
              <View style={styles.requestCardTop}>
                <View style={styles.requestAvatarCircle}>
                  <Text style={styles.requestAvatarText}>
                    {(senderName || "U")[0].toUpperCase()}
                  </Text>
                </View>

                <View style={styles.requestInfo}>
                  <View style={styles.requestNameRow}>
                    <Text style={[styles.requestSenderName, { color: theme.text }]} numberOfLines={1}>
                      {senderName}
                    </Text>
                    <View style={styles.roleTag}>
                      <Text style={styles.roleTagText}>{roleLabel}</Text>
                    </View>
                  </View>

                  {senderIdDisplay ? (
                    <Text style={[styles.requestSenderId, { color: "#EA580C" }]}>
                      {roleLabel} ID: {senderIdDisplay}
                    </Text>
                  ) : null}

                  <Text style={[styles.requestPromptText, { color: theme.textSecondary }]}>
                    {t("connection.wantsToJoin", "wants to join your team.")}
                  </Text>
                </View>
              </View>

              {/* Accept / Reject Action Buttons */}
              <View style={styles.requestActionsRow}>
                <Pressable
                  onPress={() => handleRejectRequest(reqId)}
                  disabled={isProcessing}
                  style={[
                    styles.requestRejectBtn,
                    { borderColor: borderCol, backgroundColor: isDark ? "#334155" : "#FFFFFF" },
                  ]}
                >
                  <Text style={[styles.requestRejectText, { color: theme.textSecondary }]}>
                    {t("common.reject", "Reject")}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => handleAcceptRequest(reqId)}
                  disabled={isProcessing}
                  style={[styles.requestAcceptBtn, { backgroundColor: "#10B981" }]}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="check" size={15} color="#FFFFFF" />
                      <Text style={styles.requestAcceptText}>
                        {t("common.accept", "Accept")}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── CONTRACTOR VIEW ────────────────────────────────────────── */}
      {isContractor && (
        <View style={[styles.mainCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
          {/* Card Header */}
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconCircle, { backgroundColor: "#FFEDD5" }]}>
                <MaterialCommunityIcons name="account-group" size={20} color="#EA580C" />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={[styles.title, { color: theme.text }]}>
                  {t("connection.teamConnections", "Team & Connections")}
                </Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  {t("connection.manageTeamSubtitle", "Connect workers & supervisors seamlessly")}
                </Text>
              </View>
            </View>
          </View>

          {/* Contractor ID Section */}
          <View style={[styles.idBanner, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC", borderColor: borderCol }]}>
            <View style={styles.idBannerLeft}>
              <Text style={[styles.idLabel, { color: theme.textSecondary }]}>
                {t("connection.contractorId", "CONTRACTOR ID")}
              </Text>
              <Text style={[styles.idValue, { color: "#EA580C" }]}>
                {uniqueId || "HM-C-PENDING"}
              </Text>
            </View>
            <View style={styles.idActions}>
              <Pressable onPress={() => handleCopyId()} style={[styles.iconBtn, { borderColor: borderCol }]}>
                <Feather name="copy" size={15} color={theme.text} />
              </Pressable>
              <Pressable onPress={handleShareId} style={[styles.iconBtn, { borderColor: borderCol, marginLeft: 6 }]}>
                <Feather name="share-2" size={15} color={theme.text} />
              </Pressable>
            </View>
          </View>

          {/* Action Buttons: [+ Connect Worker] & [+ Connect Supervisor] */}
          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => {
                setTargetRole("worker");
                setConnectTab("mobile");
                setConnectModalVisible(true);
              }}
              style={[styles.primaryActionBtn, { backgroundColor: "#EA580C" }]}
            >
              <Feather name="user-plus" size={16} color="#FFFFFF" />
              <Text style={styles.primaryActionBtnText}>
                {t("connection.connectWorker", "+ Connect Worker")}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setTargetRole("supervisor");
                setConnectTab("id");
                setConnectModalVisible(true);
              }}
              style={[styles.secondaryActionBtn, { borderColor: borderCol, backgroundColor: isDark ? "#334155" : "#F1F5F9" }]}
            >
              <MaterialCommunityIcons name="shield-account" size={16} color={theme.text} />
              <Text style={[styles.secondaryActionBtnText, { color: theme.text }]}>
                {t("connection.connectSupervisor", "+ Connect Supervisor")}
              </Text>
            </Pressable>
          </View>

          {/* Dynamic Inline Incoming Requests */}
          {renderInlineRequests()}
        </View>
      )}

      {/* ── WORKER / LABOUR VIEW ────────────────────────────────────── */}
      {isWorker && (
        <View style={[styles.mainCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
          {/* Card Header */}
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconCircle, { backgroundColor: user?.contractorName ? "#DCFCE7" : "#F1F5F9" }]}>
                <MaterialCommunityIcons
                  name={user?.contractorName ? "shield-check" : "account-question"}
                  size={20}
                  color={user?.contractorName ? "#10B981" : "#64748B"}
                />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={[styles.title, { color: theme.text }]}>
                  {t("connection.teamConnections", "Team & Connections")}
                </Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  {user?.contractorName
                    ? `${t("worker.connectedTo", "Connected to")} ${user.contractorName}`
                    : t("worker.notConnected", "Not Connected to Contractor")}
                </Text>
              </View>
            </View>
          </View>

          {/* Worker ID Section */}
          <View style={[styles.idBanner, { backgroundColor: isDark ? "#064E3B" : "#ECFDF5", borderColor: "#10B981" }]}>
            <View style={styles.idBannerLeft}>
              <Text style={[styles.idLabel, { color: "#047857" }]}>
                {t("worker.uniqueIdLabel", "WORKER ID")}
              </Text>
              <Text style={[styles.idValue, { color: "#065F46" }]}>
                {uniqueId || "HM-W-PENDING"}
              </Text>
            </View>
            <View style={styles.idActions}>
              <Pressable onPress={() => handleCopyId()} style={[styles.iconBtn, { borderColor: "#10B981" }]}>
                <Feather name="copy" size={15} color="#059669" />
              </Pressable>
              <Pressable onPress={handleShareId} style={[styles.iconBtn, { borderColor: "#10B981", marginLeft: 6 }]}>
                <Feather name="share-2" size={15} color="#059669" />
              </Pressable>
            </View>
          </View>

          {/* Connect / Join Contractor Button */}
          {!user?.contractorName && (
            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => {
                  setTargetRole("worker");
                  setConnectTab("id");
                  setConnectModalVisible(true);
                }}
                style={[styles.primaryActionBtn, { backgroundColor: "#10B981" }]}
              >
                <MaterialCommunityIcons name="link-variant" size={16} color="#FFFFFF" />
                <Text style={styles.primaryActionBtnText}>
                  {t("connection.enterContractorIdBtn", "+ Connect Contractor")}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Dynamic Inline Incoming Requests */}
          {renderInlineRequests()}
        </View>
      )}

      {/* ── SUPERVISOR VIEW ─────────────────────────────────────────── */}
      {isSupervisor && (
        <View style={[styles.mainCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
          {/* Card Header */}
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconCircle, { backgroundColor: "#DBEAFE" }]}>
                <MaterialCommunityIcons name="shield-account" size={20} color="#2563EB" />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={[styles.title, { color: theme.text }]}>
                  {t("connection.teamConnections", "Team & Connections")}
                </Text>
                <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                  {user?.contractorName
                    ? `${t("worker.connectedTo", "Connected to")} ${user.contractorName}`
                    : t("supervisor.notLinked", "Not linked to contractor")}
                </Text>
              </View>
            </View>
          </View>

          {/* Supervisor ID Banner */}
          <View style={[styles.idBanner, { backgroundColor: isDark ? "#1E1B4B" : "#EEF2FF", borderColor: "#6366F1" }]}>
            <View style={styles.idBannerLeft}>
              <Text style={[styles.idLabel, { color: "#4F46E5" }]}>
                {t("connection.supervisorId", "SUPERVISOR ID")}
              </Text>
              <Text style={[styles.idValue, { color: "#3730A3" }]}>
                {uniqueId || "HM-S-PENDING"}
              </Text>
            </View>
            <View style={styles.idActions}>
              <Pressable onPress={() => handleCopyId()} style={[styles.iconBtn, { borderColor: "#6366F1" }]}>
                <Feather name="copy" size={15} color="#4F46E5" />
              </Pressable>
              <Pressable onPress={handleShareId} style={[styles.iconBtn, { borderColor: "#6366F1", marginLeft: 6 }]}>
                <Feather name="share-2" size={15} color="#4F46E5" />
              </Pressable>
            </View>
          </View>

          {/* Action Buttons: [+ Connect Contractor] */}
          <View style={styles.actionsRow}>
            {!user?.contractorName && (
              <Pressable
                onPress={() => {
                  setTargetRole("supervisor");
                  setConnectTab("id");
                  setConnectModalVisible(true);
                }}
                style={[styles.primaryActionBtn, { backgroundColor: "#3B82F6" }]}
              >
                <MaterialCommunityIcons name="link-variant" size={16} color="#FFFFFF" />
                <Text style={styles.primaryActionBtnText}>
                  {t("connection.connectContractor", "+ Connect Contractor")}
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                setTargetRole("worker");
                setConnectTab("mobile");
                setConnectModalVisible(true);
              }}
              style={[
                styles.secondaryActionBtn,
                { borderColor: borderCol, backgroundColor: isDark ? "#334155" : "#F1F5F9", flex: user?.contractorName ? 1 : undefined },
              ]}
            >
              <Feather name="user-plus" size={16} color={theme.text} />
              <Text style={[styles.secondaryActionBtnText, { color: theme.text }]}>
                {t("connection.connectWorker", "+ Connect Worker")}
              </Text>
            </Pressable>
          </View>

          {/* Dynamic Inline Incoming Requests */}
          {renderInlineRequests()}
        </View>
      )}

      {/* ── MODAL: CONNECT USER (TABS: MOBILE / ID) ────────────────── */}
      <Modal
        visible={connectModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setConnectModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot, borderColor: borderCol }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: borderCol }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {isWorker ? t("connection.connectContractor", "Connect Contractor") : t("connection.connectTitle", "Add & Connect Team Member")}
              </Text>
              <Pressable onPress={() => setConnectModalVisible(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Method Switch Tabs (Only for Contractor connecting workers) */}
              {!isWorker && targetRole === "worker" && (
                <View style={styles.tabSwitchRow}>
                  <Pressable
                    onPress={() => setConnectTab("mobile")}
                    style={[
                      styles.tabBtn,
                      connectTab === "mobile" && { backgroundColor: theme.primary, borderColor: theme.primary },
                      { borderColor: borderCol },
                    ]}
                  >
                    <Feather
                      name="phone-call"
                      size={15}
                      color={connectTab === "mobile" ? "#FFFFFF" : theme.text}
                    />
                    <Text
                      style={[
                        styles.tabBtnText,
                        { color: connectTab === "mobile" ? "#FFFFFF" : theme.text },
                      ]}
                    >
                      {t("connection.tabMobile", "Mobile Number (Primary)")}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setConnectTab("id")}
                    style={[
                      styles.tabBtn,
                      connectTab === "id" && { backgroundColor: theme.primary, borderColor: theme.primary },
                      { borderColor: borderCol },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="card-account-details-outline"
                      size={17}
                      color={connectTab === "id" ? "#FFFFFF" : theme.text}
                    />
                    <Text
                      style={[
                        styles.tabBtnText,
                        { color: connectTab === "id" ? "#FFFFFF" : theme.text },
                      ]}
                    >
                      {t("connection.tabId", "Account ID (HM-W)")}
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* ── TAB 1: CONNECT VIA MOBILE ──────────────────────── */}
              {connectTab === "mobile" && (
                <View>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    {t("workers.phone", "Worker Mobile Number *")}
                  </Text>
                  <View style={[styles.inputBox, { borderColor: borderCol, backgroundColor: cardBg }]}>
                    <Feather name="phone" size={18} color={theme.textSecondary} />
                    <TextInput
                      style={[styles.inputField, { color: theme.text }]}
                      placeholder="10-digit mobile number"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="phone-pad"
                      maxLength={10}
                      value={mobileNumber}
                      onChangeText={setMobileNumber}
                    />
                  </View>

                  <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 12 }]}>
                    {t("workers.name", "Worker Full Name *")}
                  </Text>
                  <View style={[styles.inputBox, { borderColor: borderCol, backgroundColor: cardBg }]}>
                    <Feather name="user" size={18} color={theme.textSecondary} />
                    <TextInput
                      style={[styles.inputField, { color: theme.text }]}
                      placeholder="e.g. Ramesh Kumar"
                      placeholderTextColor={theme.textSecondary}
                      value={workerName}
                      onChangeText={setWorkerName}
                    />
                  </View>

                  <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 12 }]}>
                    {t("workers.dailyWage", "Daily Rate (₹)")}
                  </Text>
                  <View style={[styles.inputBox, { borderColor: borderCol, backgroundColor: cardBg }]}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: theme.textSecondary }}>₹</Text>
                    <TextInput
                      style={[styles.inputField, { color: theme.text }]}
                      placeholder="500"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                      value={dailyWage}
                      onChangeText={setDailyWage}
                    />
                  </View>

                  <View style={[styles.infoCallout, { backgroundColor: isDark ? "#064E3B" : "#ECFDF5" }]}>
                    <Feather name="check-circle" size={16} color="#059669" />
                    <Text style={[styles.infoCalloutText, { color: "#065F46" }]}>
                      {t(
                        "connection.seamlessClaimTip",
                        "The worker profile will be linked automatically when the worker signs up with this phone number."
                      )}
                    </Text>
                  </View>

                  <Pressable
                    onPress={handleConnectByMobile}
                    disabled={isSubmittingMobile}
                    style={[styles.submitBtn, { backgroundColor: theme.primary, marginTop: 16 }]}
                  >
                    {isSubmittingMobile ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Feather name="user-check" size={18} color="#FFFFFF" />
                        <Text style={styles.submitBtnText}>
                          {t("connection.createAndConnect", "Create & Connect Worker")}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}

              {/* ── TAB 2: CONNECT VIA ACCOUNT ID ──────────────────── */}
              {connectTab === "id" && (
                <View>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    {isWorker
                      ? t("connection.enterContractorIdPrompt", "Enter Contractor ID (e.g. HM-C-123456)")
                      : targetRole === "supervisor"
                      ? t("connection.enterSupervisorIdPrompt", "Enter Supervisor ID (e.g. HM-S-123456)")
                      : t("connection.enterWorkerIdPrompt", "Enter Worker ID (e.g. HM-W-123456)")}
                  </Text>

                  <View style={[styles.inputBox, { borderColor: borderCol, backgroundColor: cardBg }]}>
                    <Feather name="search" size={18} color={theme.textSecondary} />
                    <TextInput
                      style={[styles.inputField, { color: theme.text }]}
                      placeholder={isWorker ? "HM-C-XXXXXX" : targetRole === "supervisor" ? "HM-S-XXXXXX" : "HM-W-XXXXXX"}
                      placeholderTextColor={theme.textSecondary}
                      autoCapitalize="characters"
                      value={accountIdInput}
                      onChangeText={(v) => setAccountIdInput(v.toUpperCase())}
                      onSubmitEditing={handleLookupId}
                    />
                    <Pressable
                      onPress={handleLookupId}
                      disabled={isSearchingId}
                      style={[styles.searchInlineBtn, { backgroundColor: theme.primary }]}
                    >
                      {isSearchingId ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.searchInlineBtnText}>{t("common.search", "Search")}</Text>
                      )}
                    </Pressable>
                  </View>

                  {/* Found Account Preview Card */}
                  {foundAccount && (
                    <View style={[styles.previewCard, { backgroundColor: cardBg, borderColor: borderCol, marginTop: 16 }]}>
                      <View style={styles.previewAvatar}>
                        <Text style={styles.previewAvatarText}>
                          {(foundAccount.name || "U")[0].toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.previewName, { color: theme.text }]}>
                        {foundAccount.name}
                      </Text>
                      <View style={styles.previewIdTag}>
                        <Text style={styles.previewIdTagText}>{foundAccount.uniqueId}</Text>
                      </View>

                      <Text style={[styles.previewRole, { color: theme.textSecondary }]}>
                        {foundAccount.workerCategory || foundAccount.category || foundAccount.role}
                      </Text>

                      <Pressable
                        onPress={handleSendIdRequest}
                        disabled={isSendingIdRequest}
                        style={[styles.submitBtn, { backgroundColor: theme.primary, marginTop: 16, width: "100%" }]}
                      >
                        {isSendingIdRequest ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Feather name="send" size={16} color="#FFFFFF" />
                            <Text style={styles.submitBtnText}>
                              {t("connection.sendConnectionRequest", "Send Connection Request")}
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  mainCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  idBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginVertical: 6,
  },
  idBannerLeft: {
    flex: 1,
  },
  idLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  idValue: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 1,
  },
  idActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBtn: {
    padding: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  primaryActionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 4,
  },
  secondaryActionBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  inlineRequestsContainer: {
    marginTop: 14,
    gap: 8,
  },
  inlineRequestsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EA580C",
    marginRight: 6,
  },
  inlineRequestsTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  requestCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: 12,
  },
  requestCardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  requestAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EA580C",
    alignItems: "center",
    justifyContent: "center",
  },
  requestAvatarText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  requestInfo: {
    flex: 1,
    marginLeft: 10,
  },
  requestNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  requestSenderName: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  roleTag: {
    backgroundColor: "rgba(234, 88, 12, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginLeft: 6,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#EA580C",
    textTransform: "uppercase",
  },
  requestSenderId: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
  },
  requestPromptText: {
    fontSize: 11,
    marginTop: 2,
  },
  requestActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148, 163, 184, 0.2)",
  },
  requestRejectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  requestRejectText: {
    fontSize: 12,
    fontWeight: "600",
  },
  requestAcceptBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  requestAcceptText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderTopWidth: 1,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    padding: Spacing.lg,
  },
  tabSwitchRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    gap: 6,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 44,
  },
  inputField: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
  },
  searchInlineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  searchInlineBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  infoCallout: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: BorderRadius.md,
    marginTop: 12,
    gap: 8,
  },
  infoCalloutText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  previewCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
  },
  previewAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  previewAvatarText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  previewName: {
    fontSize: 16,
    fontWeight: "700",
  },
  previewIdTag: {
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginVertical: 4,
  },
  previewIdTagText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
  },
  previewRole: {
    fontSize: 12,
    fontWeight: "600",
  },
});
