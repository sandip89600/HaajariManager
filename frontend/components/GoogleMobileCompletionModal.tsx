import React, { useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface Props {
  visible: boolean;
  googleProfile: {
    googleId: string;
    email?: string;
    name?: string;
    picture?: string;
  } | null;
  onClose: () => void;
  onSuccess: (phone: string, otp?: string) => Promise<void>;
}

export default function GoogleMobileCompletionModal({
  visible,
  googleProfile,
  onClose,
  onSuccess,
}: Props) {
  const { theme, isDark } = useTheme();

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!visible || !googleProfile) return null;

  const handleContinue = async () => {
    const cleanedPhone = phone.trim().replace(/\s+/g, "");
    if (!/^\d{10}$/.test(cleanedPhone)) {
      setErrorMsg("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      await onSuccess(cleanedPhone, undefined);
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to complete account setup.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.googleBadge}>
              <Ionicons name="logo-google" size={22} color="#4285F4" />
            </View>
            <ThemedText type="h2" style={styles.titleText}>
              Complete Your Profile
            </ThemedText>
            <ThemedText style={[styles.subtitleText, { color: theme.textSecondary }]}>
              Just a few details before you continue.
            </ThemedText>
          </View>

          {errorMsg ? (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={16} color="#EF4444" />
              <ThemedText style={styles.errorText}>{errorMsg}</ThemedText>
            </View>
          ) : null}

          {/* Form */}
          <View style={styles.formGroup}>
            {/* Read-Only Google Name */}
            {googleProfile.name ? (
              <View style={{ marginBottom: Spacing.sm }}>
                <ThemedText style={styles.label}>Name</ThemedText>
                <View
                  style={[
                    styles.readOnlyWrapper,
                    {
                      borderColor: theme.border,
                      backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                    },
                  ]}
                >
                  <Feather name="user" size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
                  <ThemedText style={[styles.readOnlyText, { color: theme.text }]}>
                    {googleProfile.name}
                  </ThemedText>
                  <Feather name="lock" size={14} color={theme.textSecondary} />
                </View>
              </View>
            ) : null}

            {/* Read-Only Google Email */}
            {googleProfile.email ? (
              <View style={{ marginBottom: Spacing.sm }}>
                <ThemedText style={styles.label}>Email</ThemedText>
                <View
                  style={[
                    styles.readOnlyWrapper,
                    {
                      borderColor: theme.border,
                      backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
                    },
                  ]}
                >
                  <Feather name="mail" size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
                  <ThemedText style={[styles.readOnlyText, { color: theme.text }]}>
                    {googleProfile.email}
                  </ThemedText>
                  <Feather name="lock" size={14} color={theme.textSecondary} />
                </View>
              </View>
            ) : null}

            {/* Mobile Number Input */}
            <View style={{ marginBottom: Spacing.sm }}>
              <ThemedText style={styles.label}>Mobile Number</ThemedText>
              <View style={[styles.inputWrapper, { borderColor: theme.border }]}>
                <Feather name="phone" size={18} color={theme.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Enter 10-digit mobile number"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={(t) => {
                    setPhone(t);
                    setErrorMsg("");
                  }}
                  editable={!loading}
                />
              </View>
            </View>

            {/* Primary Action Button */}
            <Pressable
              style={[styles.primaryButton, { backgroundColor: theme.primary }]}
              onPress={handleContinue}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <ThemedText style={styles.buttonText}>Creating account...</ThemedText>
                </View>
              ) : (
                <ThemedText style={styles.buttonText}>Continue</ThemedText>
              )}
            </Pressable>

            <Pressable
              onPress={onClose}
              style={{ marginTop: Spacing.md, alignItems: "center" }}
              disabled={loading}
            >
              <ThemedText style={{ color: theme.textSecondary, fontSize: 13 }}>
                Cancel
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  container: {
    width: "100%",
    maxWidth: 420,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    elevation: 8,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  googleBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(66, 133, 244, 0.1)",
    marginBottom: Spacing.xs,
  },
  titleText: {
    fontWeight: "800",
    fontSize: 20,
    textAlign: "center",
  },
  subtitleText: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
    gap: 8,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    flex: 1,
  },
  formGroup: {
    width: "100%",
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  readOnlyWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 46,
  },
  readOnlyText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: "100%",
  },
  primaryButton: {
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
