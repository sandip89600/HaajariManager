import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Share,
  Platform,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { QrCodeView } from "./QrCodeView";
import { buildConnectPayload } from "@/utils/qrCodeGenerator";
import { Spacing, BorderRadius } from "@/constants/theme";

interface MyQrCodeModalProps {
  visible: boolean;
  onClose: () => void;
}

export const MyQrCodeModal: React.FC<MyQrCodeModalProps> = ({
  visible,
  onClose,
}) => {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const { user, uniqueId } = useAuth();
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const role =
    user?.role === "labor" || user?.role === "worker"
      ? "worker"
      : user?.role === "supervisor"
        ? "supervisor"
        : "contractor";

  const roleLabel =
    role === "worker"
      ? "Worker / Labour"
      : role === "supervisor"
        ? "Site Supervisor"
        : "Contractor / Builder";

  const roleColor =
    role === "worker" ? "#10B981" : role === "supervisor" ? "#3B82F6" : "#8B5CF6";

  const displayId = uniqueId || user?.uniqueId || "HJR-ID";
  const displayName = user?.name || "Haajari User";

  const qrPayload = buildConnectPayload(displayId, role, displayName);

  const handleCopyId = async () => {
    await Clipboard.setStringAsync(displayId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedType("id");
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(qrPayload);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopiedType("link");
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleShare = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await Share.share({
        message: `Connect with me on Haajari App!\nName: ${displayName}\nRole: ${roleLabel}\nUnique ID: ${displayId}\nDeep Link: ${qrPayload}`,
        title: `Haajari QR Code - ${displayName}`,
      });
    } catch (e) {
      console.warn("Share error:", e);
    }
  };

  const cardBg = isDark ? "#1E293B" : "#FFFFFF";
  const textCol = isDark ? "#F8FAFC" : "#0F172A";
  const subTextCol = isDark ? "#94A3B8" : "#64748B";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          {/* Top Close Button */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons
                name="qrcode-scan"
                size={22}
                color={theme.primary}
              />
              <Text style={[styles.headerTitle, { color: textCol }]}>
                My QR Code
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.closeBtn}
            >
              <Feather name="x" size={20} color={subTextCol} />
            </Pressable>
          </View>

          {/* User Preview */}
          <View style={styles.userSection}>
            <Text style={[styles.userName, { color: textCol }]}>
              {displayName}
            </Text>
            <View
              style={[
                styles.roleBadge,
                { backgroundColor: `${roleColor}18`, borderColor: `${roleColor}40` },
              ]}
            >
              <Text style={[styles.roleText, { color: roleColor }]}>
                {roleLabel}
              </Text>
            </View>
          </View>

          {/* QR Code Container */}
          <View style={styles.qrWrapper}>
            <View style={styles.qrInner}>
              <QrCodeView
                value={qrPayload}
                size={200}
                backgroundColor="#FFFFFF"
                foregroundColor="#0F172A"
              />
            </View>
          </View>

          {/* Unique ID Box */}
          <Pressable
            onPress={handleCopyId}
            style={[
              styles.idBox,
              {
                backgroundColor: isDark ? "#0F172A" : "#F1F5F9",
                borderColor: isDark ? "#334155" : "#CBD5E1",
              },
            ]}
          >
            <View>
              <Text style={[styles.idSublabel, { color: subTextCol }]}>
                Unique ID
              </Text>
              <Text style={[styles.idValue, { color: theme.primary }]}>
                {displayId}
              </Text>
            </View>
            <View
              style={[
                styles.copyBtn,
                {
                  backgroundColor:
                    copiedType === "id"
                      ? "#10B981"
                      : isDark
                        ? "#1E293B"
                        : "#E2E8F0",
                },
              ]}
            >
              <Feather
                name={copiedType === "id" ? "check" : "copy"}
                size={14}
                color={copiedType === "id" ? "#FFFFFF" : textCol}
              />
              <Text
                style={[
                  styles.copyBtnText,
                  {
                    color: copiedType === "id" ? "#FFFFFF" : textCol,
                  },
                ]}
              >
                {copiedType === "id" ? "Copied" : "Copy"}
              </Text>
            </View>
          </Pressable>

          {/* Instructions */}
          <Text style={[styles.instructions, { color: subTextCol }]}>
            {role === "worker"
              ? "Show this QR code to your contractor or supervisor to connect instantly."
              : "Let your team members scan this code to link with your account."}
          </Text>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <Pressable
              onPress={handleCopyLink}
              style={[
                styles.secondaryBtn,
                {
                  borderColor: isDark ? "#334155" : "#E2E8F0",
                  backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                },
              ]}
            >
              <Feather
                name={copiedType === "link" ? "check" : "link"}
                size={16}
                color={theme.primary}
              />
              <Text style={[styles.actionBtnText, { color: textCol }]}>
                {copiedType === "link" ? "Link Copied" : "Copy Link"}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleShare}
              style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
            >
              <Feather name="share-2" size={16} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Share QR</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.md,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    padding: Spacing.lg,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  headerRow: {
    width: "100%",
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
  userSection: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  userName: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
    textAlign: "center",
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  roleText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  qrWrapper: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: Spacing.md,
  },
  qrInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  idBox: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  idSublabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  idValue: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  instructions: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
    marginBottom: Spacing.md,
    paddingHorizontal: 8,
  },
  actionsRow: {
    width: "100%",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
