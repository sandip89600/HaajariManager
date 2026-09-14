import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { authenticatedFetch, API_URL } from "@/utils/storage";
import { parseConnectPayload } from "@/utils/qrCodeGenerator";
import { Spacing, BorderRadius } from "@/constants/theme";

interface QrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();

  const [inputCode, setInputCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundAccount, setFoundAccount] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetState = () => {
    setInputCode("");
    setIsSearching(false);
    setSearchError(null);
    setFoundAccount(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Perform lookup by parsed uniqueId or direct ID
  const handleLookup = async (codeToLookup?: string) => {
    const raw = codeToLookup || inputCode;
    if (!raw.trim()) {
      setSearchError("Please enter or scan a valid QR code or Unique ID.");
      return;
    }

    const parsed = parseConnectPayload(raw);
    const targetId = parsed?.uniqueId || raw.trim().toUpperCase();

    setIsSearching(true);
    setSearchError(null);
    setFoundAccount(null);

    try {
      const res = await authenticatedFetch(
        `${API_URL}/connections/lookup?uniqueId=${encodeURIComponent(targetId)}`,
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        setSearchError(
          data.message || "No account found with this QR code / ID.",
        );
      } else {
        const account = data.user || data.worker;
        setFoundAccount(account);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: any) {
      setSearchError(
        e.message || "Failed to search account. Please check internet.",
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setInputCode(text);
        handleLookup(text);
      }
    } catch (e) {
      console.warn("Paste error:", e);
    }
  };

  const handleSendConnectionRequest = async () => {
    if (!foundAccount) return;

    setIsSubmitting(true);
    try {
      const isTargetWorker =
        foundAccount.role === "worker" || foundAccount.role === "labor";
      const targetType = isTargetWorker ? "worker" : "supervisor";

      const res = await authenticatedFetch(`${API_URL}/connections/requests`, {
        method: "POST",
        body: JSON.stringify({
          targetUniqueId: foundAccount.uniqueId,
          targetType,
          note: `Connection request from ${user?.name || "Contractor"}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        Alert.alert(
          "Connection Failed",
          data.message || "Unable to send connection request.",
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Request Sent!",
          data.message ||
            `Connection request sent to ${foundAccount.name}. They will be connected once approved.`,
          [
            {
              text: "OK",
              onPress: () => {
                handleClose();
                onSuccess?.();
              },
            },
          ],
        );
      }
    } catch (e: any) {
      Alert.alert(
        "Error",
        e.message || "Failed to send connection request. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const cardBg = isDark ? "#1E293B" : "#FFFFFF";
  const textCol = isDark ? "#F8FAFC" : "#0F172A";
  const subTextCol = isDark ? "#94A3B8" : "#64748B";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons
                name="qrcode-scan"
                size={22}
                color={theme.primary}
              />
              <Text style={[styles.headerTitle, { color: textCol }]}>
                Scan / Connect QR
              </Text>
            </View>
            <Pressable
              onPress={handleClose}
              hitSlop={10}
              style={styles.closeBtn}
            >
              <Feather name="x" size={20} color={subTextCol} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Input / Scanner Area */}
            <View style={styles.scannerBox}>
              <View style={styles.scannerIconWrapper}>
                <MaterialCommunityIcons
                  name="camera-metering-spot"
                  size={42}
                  color={theme.primary}
                />
              </View>
              <Text style={[styles.scannerHint, { color: textCol }]}>
                Scan QR or Paste Deep Link
              </Text>
              <Text style={[styles.scannerSubhint, { color: subTextCol }]}>
                Point camera at the QR code, or paste their Unique ID / Link below.
              </Text>
            </View>

            {/* Input Row */}
            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                  borderColor: isDark ? "#334155" : "#CBD5E1",
                },
              ]}
            >
              <TextInput
                value={inputCode}
                onChangeText={(text) => {
                  setInputCode(text);
                  setSearchError(null);
                }}
                placeholder="Paste QR link or ID (e.g. HJR-W-1049)"
                placeholderTextColor={subTextCol}
                style={[styles.textInput, { color: textCol }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                onPress={handlePasteFromClipboard}
                hitSlop={8}
                style={styles.pasteBtn}
              >
                <Feather name="clipboard" size={16} color={theme.primary} />
                <Text style={[styles.pasteBtnText, { color: theme.primary }]}>
                  Paste
                </Text>
              </Pressable>
            </View>

            {/* Search / Lookup Button */}
            <Pressable
              onPress={() => handleLookup()}
              disabled={isSearching || !inputCode.trim()}
              style={[
                styles.lookupBtn,
                {
                  backgroundColor: theme.primary,
                  opacity: isSearching || !inputCode.trim() ? 0.6 : 1,
                },
              ]}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="search" size={16} color="#FFFFFF" />
                  <Text style={styles.lookupBtnText}>Verify & Lookup</Text>
                </>
              )}
            </Pressable>

            {/* Search Error Notice */}
            {searchError && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={16} color="#EF4444" />
                <Text style={styles.errorText}>{searchError}</Text>
              </View>
            )}

            {/* Account Found Preview Card */}
            {foundAccount && (
              <View
                style={[
                  styles.previewCard,
                  {
                    backgroundColor: isDark ? "#0F172A" : "#F1F5F9",
                    borderColor: isDark ? "#334155" : "#E2E8F0",
                  },
                ]}
              >
                <View style={styles.previewHeader}>
                  <View
                    style={[
                      styles.avatarBox,
                      {
                        backgroundColor:
                          foundAccount.avatarColor || theme.primary,
                      },
                    ]}
                  >
                    <Text style={styles.avatarInitials}>
                      {(foundAccount.name || "U").slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.previewDetails}>
                    <Text style={[styles.previewName, { color: textCol }]}>
                      {foundAccount.name}
                    </Text>
                    <Text style={[styles.previewId, { color: theme.primary }]}>
                      ID: {foundAccount.uniqueId}
                    </Text>
                    <View style={styles.previewTags}>
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>
                          {foundAccount.role === "labor" ||
                          foundAccount.role === "worker"
                            ? "Worker"
                            : foundAccount.role === "supervisor"
                              ? "Supervisor"
                              : "Contractor"}
                        </Text>
                      </View>
                      {foundAccount.workerCategory && (
                        <View style={[styles.tag, { backgroundColor: "#E0E7FF" }]}>
                          <Text style={[styles.tagText, { color: "#3730A3" }]}>
                            {foundAccount.workerCategory}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Submit Request Button */}
                <Pressable
                  onPress={handleSendConnectionRequest}
                  disabled={isSubmitting}
                  style={[
                    styles.connectBtn,
                    {
                      backgroundColor: "#10B981",
                      opacity: isSubmitting ? 0.7 : 1,
                    },
                  ]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="user-check" size={16} color="#FFFFFF" />
                      <Text style={styles.connectBtnText}>
                        Send Connection Request
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: "100%",
    maxHeight: "85%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  scannerBox: {
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
    marginBottom: Spacing.md,
  },
  scannerIconWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  scannerHint: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  scannerSubhint: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 4,
    marginBottom: Spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  pasteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  pasteBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  lookupBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: Spacing.md,
  },
  lookupBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: 12,
    marginBottom: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: "#B91C1C",
    fontWeight: "600",
  },
  previewCard: {
    padding: Spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  previewHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  previewDetails: {
    flex: 1,
  },
  previewName: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 2,
  },
  previewId: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  previewTags: {
    flexDirection: "row",
    gap: 6,
  },
  tag: {
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#065F46",
    textTransform: "uppercase",
  },
  connectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  connectBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
