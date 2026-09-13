import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { authenticatedFetch, API_URL } from "@/utils/storage";
import { Spacing, BorderRadius } from "@/constants/theme";

interface ConnectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultRole?: "supervisor" | "worker";
}

export default function ConnectionModal({
  visible,
  onClose,
  onSuccess,
  defaultRole = "worker",
}: ConnectionModalProps) {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();

  const [role, setRole] = useState<"supervisor" | "worker">(defaultRole);
  const [step, setStep] = useState<"search" | "preview" | "verify">("search");
  const [uniqueIdInput, setUniqueIdInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<any>(null);

  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const resetModal = () => {
    setStep("search");
    setUniqueIdInput("");
    setFoundUser(null);
    setVerificationCode("");
    setIsSearching(false);
    setIsSendingRequest(false);
    setIsVerifying(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  // Step 1: Lookup User by Unique ID / Phone
  const handleLookup = async () => {
    const q = uniqueIdInput.trim();
    if (!q) {
      Alert.alert(
        t("common.required", "आवश्यक"),
        t(
          "connection.enterUniqueIdError",
          "कृपया यूनिक आईडी या मोबाइल नंबर दर्ज करें।",
        ),
      );
      return;
    }

    setIsSearching(true);
    try {
      const res = await authenticatedFetch(
        `${API_URL}/connections/lookup?uniqueId=${encodeURIComponent(q)}`,
      );
      const data = await res.json();

      if (res.ok && data.success && data.user) {
        setFoundUser(data.user);
        setStep("preview");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert(
          t("common.notFound", "नहीं मिला"),
          data.message ||
            t(
              "connection.userNotFound",
              "इस आईडी के साथ कोई उपयोगकर्ता नहीं मिला।",
            ),
        );
      }
    } catch (error: any) {
      Alert.alert(
        t("common.error", "त्रुटि"),
        error.message || "Failed to search.",
      );
    } finally {
      setIsSearching(false);
    }
  };

  // Step 2: Send Connection Request & Generate 6-Digit Code
  const handleSendRequest = async () => {
    if (!foundUser) return;
    setIsSendingRequest(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/connections/request`, {
        method: "POST",
        body: JSON.stringify({
          targetUniqueId: foundUser.uniqueId,
          targetUserId: foundUser.id,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setStep("verify");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert(
          t("common.error", "त्रुटि"),
          data.message ||
            t("connection.requestFailed", "कनेक्शन अनुरोध भेजने में विफल।"),
        );
      }
    } catch (error: any) {
      Alert.alert(t("common.error", "त्रुटि"), error.message);
    } finally {
      setIsSendingRequest(false);
    }
  };

  // Step 3: Enter & Verify 6-Digit Code
  const handleVerifyCode = async () => {
    const cleanCode = verificationCode.trim();
    if (cleanCode.length !== 6) {
      Alert.alert(
        t("common.invalid", "अमान्य"),
        t(
          "connection.enterSixDigitCode",
          "कृपया 6-अंकों का सत्यापन कोड दर्ज करें।",
        ),
      );
      return;
    }

    setIsVerifying(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/connections/verify`, {
        method: "POST",
        body: JSON.stringify({
          targetUniqueId: foundUser.uniqueId,
          targetUserId: foundUser.id,
          code: cleanCode,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          t("common.success", "सफल"),
          `${foundUser.name} ${t("connection.connectedSuccess", "सफलतापूर्वक कनेक्ट हो गए हैं!")}`,
          [
            {
              text: t("common.ok", "ठीक है"),
              onPress: () => {
                handleClose();
                onSuccess?.();
              },
            },
          ],
        );
      } else {
        Alert.alert(
          t("common.verificationFailed", "सत्यापन विफल"),
          data.message ||
            t(
              "connection.invalidCode",
              "अमान्य या समाप्त हो चुका कोड। कृपया पुनः प्रयास करें।",
            ),
        );
      }
    } catch (error: any) {
      Alert.alert(t("common.error", "त्रुटि"), error.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const cardBg = isDark ? "#1E293B" : "#F8FAFC";
  const borderCol = isDark ? "#334155" : "#E2E8F0";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.backgroundRoot, borderColor: borderCol },
          ]}
        >
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: borderCol }]}>
            <View style={styles.modalHeaderLeft}>
              <MaterialCommunityIcons
                name="account-switch"
                size={24}
                color={theme.primary}
              />
              <Text
                style={[
                  styles.modalTitle,
                  { color: theme.text, marginLeft: 8 },
                ]}
              >
                {t(
                  "connection.connectUserTitle",
                  "नया व्यक्ति जोड़ें (Connect Account)",
                )}
              </Text>
            </View>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalBody}
            showsVerticalScrollIndicator={false}
          >
            {/* Step 1: Role & Unique ID Search */}
            {step === "search" && (
              <View>
                <Text
                  style={[styles.fieldLabel, { color: theme.textSecondary }]}
                >
                  {t(
                    "connection.selectRoleToConnect",
                    "खाता प्रकार चुनें (Role to Connect)",
                  )}
                </Text>
                <View style={styles.roleToggleRow}>
                  <Pressable
                    onPress={() => {
                      setRole("worker");
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[
                      styles.roleToggleBtn,
                      role === "worker" && {
                        backgroundColor: "#10B981",
                        borderColor: "#10B981",
                      },
                      { borderColor: borderCol },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="account-hard-hat"
                      size={20}
                      color={role === "worker" ? "#FFFFFF" : theme.text}
                    />
                    <Text
                      style={[
                        styles.roleToggleText,
                        { color: role === "worker" ? "#FFFFFF" : theme.text },
                      ]}
                    >
                      {t("roles.worker", "वर्कर / लेबर (HM-W)")}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setRole("supervisor");
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[
                      styles.roleToggleBtn,
                      role === "supervisor" && {
                        backgroundColor: "#3B82F6",
                        borderColor: "#3B82F6",
                      },
                      { borderColor: borderCol },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="shield-account"
                      size={20}
                      color={role === "supervisor" ? "#FFFFFF" : theme.text}
                    />
                    <Text
                      style={[
                        styles.roleToggleText,
                        {
                          color: role === "supervisor" ? "#FFFFFF" : theme.text,
                        },
                      ]}
                    >
                      {t("roles.supervisor", "सुपरवाइजर (HM-S)")}
                    </Text>
                  </Pressable>
                </View>

                <Text
                  style={[
                    styles.fieldLabel,
                    { color: theme.textSecondary, marginTop: 16 },
                  ]}
                >
                  {role === "worker"
                    ? t(
                        "connection.workerIdPrompt",
                        "वर्कर की यूनिक आईडी दर्ज करें (e.g. HM-W-123456)",
                      )
                    : t(
                        "connection.supervisorIdPrompt",
                        "सुपरवाइजर की यूनिक आईडी दर्ज करें (e.g. HM-S-123456)",
                      )}
                </Text>

                <View
                  style={[
                    styles.searchBox,
                    { borderColor: borderCol, backgroundColor: cardBg },
                  ]}
                >
                  <Feather
                    name="search"
                    size={20}
                    color={theme.textSecondary}
                  />
                  <TextInput
                    style={[styles.searchInput, { color: theme.text }]}
                    placeholder={
                      role === "worker"
                        ? "HM-W-XXXXXX या मोबाइल नंबर"
                        : "HM-S-XXXXXX या मोबाइल नंबर"
                    }
                    placeholderTextColor={theme.textSecondary}
                    value={uniqueIdInput}
                    onChangeText={(val) => setUniqueIdInput(val.toUpperCase())}
                    autoCapitalize="characters"
                    returnKeyType="search"
                    onSubmitEditing={handleLookup}
                  />
                  {uniqueIdInput.length > 0 && (
                    <Pressable onPress={() => setUniqueIdInput("")}>
                      <Feather
                        name="x-circle"
                        size={18}
                        color={theme.textSecondary}
                      />
                    </Pressable>
                  )}
                </View>

                <Text
                  style={[styles.helperGuide, { color: theme.textSecondary }]}
                >
                  {t(
                    "connection.uniqueIdInstruction",
                    "💡 सुपरवाइजर या वर्कर के ऐप में ऊपर दिख रही यूनिक आईडी (HM-...) यहां डालें।",
                  )}
                </Text>

                <Pressable
                  onPress={handleLookup}
                  disabled={isSearching}
                  style={[
                    styles.actionBtn,
                    { backgroundColor: theme.primary, marginTop: 20 },
                  ]}
                >
                  {isSearching ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="search" size={18} color="#FFFFFF" />
                      <Text style={styles.actionBtnText}>
                        {t("connection.findAccount", "खाता खोजें (Search)")}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}

            {/* Step 2: Account Safe Preview */}
            {step === "preview" && foundUser && (
              <View>
                <View
                  style={[
                    styles.previewCard,
                    { backgroundColor: cardBg, borderColor: borderCol },
                  ]}
                >
                  <View style={styles.previewAvatar}>
                    <Text style={styles.previewAvatarText}>
                      {(foundUser.name || "U")[0].toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.previewName, { color: theme.text }]}>
                    {foundUser.name}
                  </Text>
                  <View style={styles.previewIdPill}>
                    <Text style={styles.previewIdText}>
                      {foundUser.uniqueId}
                    </Text>
                  </View>

                  <View style={styles.previewDetailGrid}>
                    <View style={styles.previewDetailItem}>
                      <Text
                        style={[
                          styles.previewDetailLbl,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {t("auth.role", "भूमिका (Role)")}
                      </Text>
                      <Text
                        style={[styles.previewDetailVal, { color: theme.text }]}
                      >
                        {foundUser.workerCategory || foundUser.role}
                      </Text>
                    </View>
                    {foundUser.dailyWage > 0 && (
                      <View style={styles.previewDetailItem}>
                        <Text
                          style={[
                            styles.previewDetailLbl,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {t("workers.dailyWage", "दैनिक दर (Daily Rate)")}
                        </Text>
                        <Text
                          style={[
                            styles.previewDetailVal,
                            { color: "#10B981", fontWeight: "700" },
                          ]}
                        >
                          ₹{foundUser.dailyWage} / {t("common.day", "दिन")}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <Text style={[styles.confirmPrompt, { color: theme.text }]}>
                  {t(
                    "connection.confirmPrompt",
                    "क्या आप इस व्यक्ति से जुड़ना चाहते हैं?",
                  )}
                </Text>
                <Text
                  style={[
                    styles.confirmSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  {t(
                    "connection.confirmSubtext",
                    "अनुरोध भेजने पर उनके फोन पर एक 6-अंकों का कोड जाएगा, जिसे आपको यहां दर्ज करना होगा।",
                  )}
                </Text>

                <View style={styles.btnRow}>
                  <Pressable
                    onPress={() => setStep("search")}
                    style={[styles.backBtn, { borderColor: borderCol }]}
                  >
                    <Text style={[styles.backBtnText, { color: theme.text }]}>
                      {t("common.back", "वापस")}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleSendRequest}
                    disabled={isSendingRequest}
                    style={[
                      styles.actionBtn,
                      {
                        flex: 1,
                        backgroundColor: theme.primary,
                        marginLeft: 10,
                      },
                    ]}
                  >
                    {isSendingRequest ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Feather name="send" size={18} color="#FFFFFF" />
                        <Text style={styles.actionBtnText}>
                          {t(
                            "connection.sendRequestBtn",
                            "कोड भेजें (Send Request)",
                          )}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            )}

            {/* Step 3: Enter 6-Digit Code */}
            {step === "verify" && foundUser && (
              <View>
                <View
                  style={[
                    styles.verifyHeaderBox,
                    { backgroundColor: isDark ? "#1E1B4B" : "#EEF2FF" },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="cellphone-key"
                    size={32}
                    color="#6366F1"
                  />
                  <Text style={styles.verifyPromptTitle}>
                    {t(
                      "connection.enterReceivedCodeTitle",
                      "6-अंकों का कोड दर्ज करें",
                    )}
                  </Text>
                  <Text
                    style={[
                      styles.verifyPromptDesc,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {foundUser.name}{" "}
                    {t(
                      "connection.askUserForCode",
                      "के स्क्रीन पर दिख रहा 6-अंकों का कोड पूछकर यहां डालें:",
                    )}
                  </Text>
                </View>

                <TextInput
                  style={[
                    styles.pinInput,
                    {
                      color: theme.text,
                      backgroundColor: cardBg,
                      borderColor:
                        verificationCode.length === 6 ? "#10B981" : borderCol,
                    },
                  ]}
                  placeholder="• • • • • •"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  autoFocus
                />

                <Text style={[styles.codeTimerNote, { color: "#6366F1" }]}>
                  {t(
                    "connection.codeValidTenMin",
                    "⏱️ यह कोड 10 मिनट के लिए मान्य है।",
                  )}
                </Text>

                <View style={styles.btnRow}>
                  <Pressable
                    onPress={() => setStep("preview")}
                    style={[styles.backBtn, { borderColor: borderCol }]}
                  >
                    <Text style={[styles.backBtnText, { color: theme.text }]}>
                      {t("common.back", "वापस")}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleVerifyCode}
                    disabled={isVerifying || verificationCode.length !== 6}
                    style={[
                      styles.actionBtn,
                      {
                        flex: 1,
                        backgroundColor:
                          verificationCode.length === 6
                            ? "#10B981"
                            : theme.primary,
                        opacity: verificationCode.length === 6 ? 1 : 0.6,
                        marginLeft: 10,
                      },
                    ]}
                  >
                    {isVerifying ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Feather name="check" size={18} color="#FFFFFF" />
                        <Text style={styles.actionBtnText}>
                          {t(
                            "connection.verifyAndConnectBtn",
                            "सत्यापित करें (Verify & Connect)",
                          )}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
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
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 6,
  },
  modalBody: {
    padding: Spacing.lg,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  roleToggleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  roleToggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    gap: 6,
  },
  roleToggleText: {
    fontSize: 12,
    fontWeight: "700",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 10,
  },
  helperGuide: {
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    gap: 8,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  previewCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    alignItems: "center",
    marginBottom: 16,
  },
  previewAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  previewAvatarText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  previewName: {
    fontSize: 18,
    fontWeight: "700",
  },
  previewIdPill: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    marginTop: 4,
    marginBottom: 12,
  },
  previewIdText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB",
    letterSpacing: 1,
  },
  previewDetailGrid: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(148, 163, 184, 0.3)",
    paddingTop: 12,
    marginTop: 4,
  },
  previewDetailItem: {
    alignItems: "center",
  },
  previewDetailLbl: {
    fontSize: 11,
  },
  previewDetailVal: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2,
  },
  confirmPrompt: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  confirmSubtext: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  btnRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  verifyHeaderBox: {
    borderRadius: BorderRadius.lg,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  verifyPromptTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4F46E5",
    marginTop: 8,
  },
  verifyPromptDesc: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  pinInput: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 12,
    textAlign: "center",
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    paddingVertical: 14,
    marginBottom: 10,
  },
  codeTimerNote: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 16,
  },
});
