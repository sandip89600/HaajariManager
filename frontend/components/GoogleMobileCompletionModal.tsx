import React, { useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { ThemedText } from "./ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { API_URL } from "@/utils/storage";

interface Props {
  visible: boolean;
  googleProfile: {
    googleId: string;
    email?: string;
    name?: string;
    picture?: string;
  } | null;
  onClose: () => void;
  onSuccess: (phone: string, otp: string) => Promise<void>;
}

export default function GoogleMobileCompletionModal({
  visible,
  googleProfile,
  onClose,
  onSuccess,
}: Props) {
  const { theme, isDark } = useTheme();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!visible || !googleProfile) return null;

  const handleSendOtp = async () => {
    const cleanedPhone = phone.trim().replace(/\s+/g, "");
    if (!/^\d{10}$/.test(cleanedPhone)) {
      setErrorMsg("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`${API_URL}/auth/send-phone-verification-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanedPhone }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        setOtpSent(true);
      } else {
        setErrorMsg(data?.message || "Failed to send OTP. Please try again.");
      }
    } catch (e: any) {
      setErrorMsg("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndComplete = async () => {
    const cleanedPhone = phone.trim().replace(/\s+/g, "");
    if (!otp || otp.length < 4) {
      setErrorMsg("Please enter the verification code sent to your mobile.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      await onSuccess(cleanedPhone, otp);
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
      animationType="slide"
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
              <Ionicons name="logo-google" size={20} color="#4285F4" />
            </View>
            <ThemedText type="h3" style={{ marginTop: 8 }}>
              Complete Account Setup
            </ThemedText>
            <ThemedText
              style={{
                color: theme.textSecondary,
                fontSize: 13,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              Signed in as <ThemedText style={{ fontWeight: "700" }}>{googleProfile.email || googleProfile.name}</ThemedText>. Haajari requires phone verification for site management.
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
            <ThemedText style={styles.label}>10-Digit Mobile Number</ThemedText>
            <View style={[styles.inputWrapper, { borderColor: theme.border }]}>
              <Feather name="phone" size={18} color={theme.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Enter 10-digit mobile number"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                maxLength={10}
                value={phone}
                onChangeText={(t) => { setPhone(t); setErrorMsg(""); }}
                editable={!otpSent && !loading}
              />
            </View>

            {otpSent && (
              <View style={{ marginTop: Spacing.md }}>
                <ThemedText style={styles.label}>Verification Code (OTP)</ThemedText>
                <View style={[styles.inputWrapper, { borderColor: theme.border }]}>
                  <Feather name="shield" size={18} color={theme.textSecondary} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="Enter OTP code"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otp}
                    onChangeText={(t) => { setOtp(t); setErrorMsg(""); }}
                    editable={!loading}
                  />
                </View>
              </View>
            )}

            {!otpSent ? (
              <Pressable
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                onPress={handleSendOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <ThemedText style={styles.buttonText}>Send OTP Code</ThemedText>
                )}
              </Pressable>
            ) : (
              <Pressable
                style={[styles.primaryButton, { backgroundColor: "#10B981" }]}
                onPress={handleVerifyAndComplete}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <ThemedText style={styles.buttonText}>Verify & Finish Registration</ThemedText>
                )}
              </Pressable>
            )}

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
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  container: {
    width: "100%",
    maxWidth: 400,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(66, 133, 244, 0.1)",
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
    marginTop: Spacing.lg,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
