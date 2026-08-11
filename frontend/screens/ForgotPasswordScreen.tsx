import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootNavigatorParamList } from "@/navigation/RootNavigator";
import { API_URL } from "@/utils/storage";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ForgotPasswordNavigationProp = NativeStackNavigationProp<
  RootNavigatorParamList,
  "ForgotPassword"
>;

type RecoveryStep = "PHONE_INPUT" | "OTP_INPUT" | "NEW_PASSWORD";

export default function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<ForgotPasswordNavigationProp>();
  const insets = useSafeAreaInsets();

  // Recovery Step Flow
  const [step, setStep] = useState<RecoveryStep>("PHONE_INPUT");

  // Phone & OTP state
  const [phone, setPhone] = useState("");
  const [otpArray, setOtpArray] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<Array<TextInput | null>>([]);
  const [cooldown, setCooldown] = useState(0);

  // Scoped Recovery Session
  const [recoverySessionToken, setRecoverySessionToken] = useState<string | null>(null);
  const [requiresEmailConfirmation, setRequiresEmailConfirmation] = useState(false);

  // New Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Cooldown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // Live password validation
  const isMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const isPasswordStrong =
    isMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
  const isMatching = newPassword === confirmPassword && confirmPassword.length > 0;

  const triggerHaptic = (type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(type);
    }
  };

  /**
   * STEP 1: Find Account & Send Recovery OTP
   */
  const handleSendRecoveryCode = async () => {
    const trimmed = phone.trim();
    if (!trimmed || trimmed.length < 8) {
      setError("Please enter a valid mobile number.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${API_URL}/recovery/check-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: trimmed }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || (data && data.success === false)) {
        if (res.status === 429) {
          throw new Error("Please wait 60 seconds before requesting another code.");
        } else if (res.status === 403) {
          throw new Error(data?.message || "Please contact your organization administrator or support to recover this account.");
        }
        throw new Error(data?.message || data?.error || "Unable to send recovery code. Please try again.");
      }

      triggerHaptic();
      setCooldown(60);
      setStep("OTP_INPUT");
    } catch (err: any) {
      if (err.name === "AbortError") {
        setError("Server took too long to respond. Please check your connection and try again.");
      } else {
        setError(err.message || "Failed to send verification code. Please try again.");
      }
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  /**
   * Resend OTP Handler
   */
  const handleResendCode = async () => {
    if (cooldown > 0) return;
    await handleSendRecoveryCode();
  };

  /**
   * OTP Box Input Handling
   */
  const handleOtpBoxChange = (text: string, index: number) => {
    const newArr = [...otpArray];
    newArr[index] = text;
    setOtpArray(newArr);
    setError(null);

    if (text !== "" && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && otpArray[index] === "" && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  /**
   * STEP 2: Verify OTP & Obtain Scoped Recovery Session
   */
  const handleVerifyOtp = async () => {
    const otpCode = otpArray.join("");
    if (otpCode.length < 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${API_URL}/recovery/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          otp: otpCode,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || (data && data.success === false)) {
        throw new Error(data?.message || data?.error || "Invalid verification code.");
      }

      const token = data?.recoverySessionToken;
      if (!token) {
        throw new Error("Unable to establish recovery session. Please try again.");
      }

      setRecoverySessionToken(token);
      setRequiresEmailConfirmation(!!data?.requiresEmailConfirmation);
      triggerHaptic();

      if (data?.requiresEmailConfirmation) {
        Alert.alert(
          "Secondary Confirmation Required 🛡️",
          "A security confirmation link has been sent to your registered email. Please click the link to confirm before saving your new password."
        );
      }

      setStep("NEW_PASSWORD");
    } catch (err: any) {
      if (err.name === "AbortError") {
        setError("Server took too long to respond. Please check your connection and try again.");
      } else {
        setError(err.message || "Invalid verification code.");
      }
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  /**
   * STEP 3: Reset Password with Scoped Session
   */
  const handleResetPassword = async () => {
    if (!recoverySessionToken) {
      setError("Your recovery session has expired. Please start again.");
      setStep("PHONE_INPUT");
      return;
    }

    if (!isPasswordStrong) {
      setError("Password does not meet the required security requirements.");
      return;
    }

    if (!isMatching) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(`${API_URL}/recovery/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recoverySessionToken,
          newPassword,
          confirmPassword,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || (data && data.success === false)) {
        throw new Error(data?.message || data?.error || "Failed to update password.");
      }

      triggerHaptic();
      Alert.alert(
        "Password updated successfully.",
        "Please log in using your new password.",
        [
          {
            text: "Go to Login",
            onPress: () => navigation.navigate("Login"),
          },
        ]
      );
    } catch (err: any) {
      if (err.name === "AbortError") {
        setError("Server took too long to respond. Please check your connection and try again.");
      } else {
        setError(err.message || "Failed to reset password.");
      }
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  const ScrollContainer = Platform.OS === "web" ? ScrollView : KeyboardAwareScrollView;

  return (
    <ThemedView style={styles.container}>
      <ScrollContainer
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (step === "NEW_PASSWORD") setStep("OTP_INPUT");
              else if (step === "OTP_INPUT") setStep("PHONE_INPUT");
              else navigation.goBack();
            }}
            style={[styles.backButton, { backgroundColor: theme.backgroundSecondary }]}
          >
            <Feather name="arrow-left" size={22} color={theme.text} />
          </Pressable>

          <View style={styles.iconCircle}>
            <Feather
              name={step === "NEW_PASSWORD" ? "lock" : step === "OTP_INPUT" ? "shield" : "smartphone"}
              size={28}
              color={theme.primary}
            />
          </View>

          <ThemedText style={styles.title}>
            {step === "PHONE_INPUT"
              ? "Find Your Account"
              : step === "OTP_INPUT"
              ? "Enter 6-Digit Code"
              : "Choose a New Password"}
          </ThemedText>

          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            {step === "PHONE_INPUT"
              ? "Enter your mobile number linked to your Haajari account to receive a 6-digit recovery code."
              : step === "OTP_INPUT"
              ? `We sent a 6-digit verification code to +91 ${phone}.`
              : "Create a new password that is at least 8 characters long with numbers and special symbols."}
          </ThemedText>
        </View>

        {/* Error Box */}
        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={16} color="#EF4444" />
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        ) : null}

        {/* STEP 1: PHONE INPUT */}
        {step === "PHONE_INPUT" && (
          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>Registered Mobile Number</ThemedText>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.countryCodeBadge}>
                  <ThemedText style={[styles.countryCodeText, { color: theme.text }]}>+91</ThemedText>
                </View>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Enter 10-digit mobile number"
                  placeholderTextColor={theme.textSecondary}
                  value={phone}
                  onChangeText={(t) => {
                    setPhone(t.replace(/[^0-9]/g, ""));
                    setError(null);
                  }}
                  keyboardType="phone-pad"
                  maxLength={10}
                  autoFocus
                />
              </View>
            </View>

            <AnimatedPressable
              onPress={handleSendRecoveryCode}
              onPressIn={() => (buttonScale.value = withSpring(0.96))}
              onPressOut={() => (buttonScale.value = withSpring(1))}
              disabled={isLoading || phone.trim().length < 10}
              style={[
                styles.submitButton,
                { backgroundColor: phone.trim().length >= 10 ? theme.primary : theme.border },
                animatedButtonStyle,
              ]}
            >
              {isLoading ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <ThemedText style={styles.submitButtonText}>Searching Account...</ThemedText>
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ThemedText style={styles.submitButtonText}>Send Recovery Code</ThemedText>
                  <Feather name="arrow-right" size={18} color="#FFFFFF" />
                </View>
              )}
            </AnimatedPressable>
          </View>
        )}

        {/* STEP 2: OTP INPUT */}
        {step === "OTP_INPUT" && (
          <View style={styles.formContainer}>
            <View style={styles.otpGrid}>
              {otpArray.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    otpRefs.current[index] = ref;
                  }}
                  style={[
                    styles.otpBox,
                    {
                      backgroundColor: theme.backgroundDefault,
                      borderColor: digit ? theme.primary : theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={digit}
                  onChangeText={(text) => handleOtpBoxChange(text, index)}
                  onKeyPress={(e) => handleOtpKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  autoFocus={index === 0}
                />
              ))}
            </View>

            {/* Resend Cooldown Timer */}
            <View style={styles.resendRow}>
              {cooldown > 0 ? (
                <ThemedText style={[styles.cooldownText, { color: theme.textSecondary }]}>
                  Resend code in <ThemedText style={{ color: theme.primary, fontWeight: "700" }}>{cooldown}s</ThemedText>
                </ThemedText>
              ) : (
                <Pressable onPress={handleResendCode} disabled={isLoading}>
                  <ThemedText style={[styles.resendLink, { color: theme.primary }]}>
                    Resend Code
                  </ThemedText>
                </Pressable>
              )}
            </View>

            <AnimatedPressable
              onPress={handleVerifyOtp}
              onPressIn={() => (buttonScale.value = withSpring(0.96))}
              onPressOut={() => (buttonScale.value = withSpring(1))}
              disabled={isLoading || otpArray.join("").length < 6}
              style={[
                styles.submitButton,
                { backgroundColor: otpArray.join("").length === 6 ? theme.primary : theme.border },
                animatedButtonStyle,
              ]}
            >
              {isLoading ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <ThemedText style={styles.submitButtonText}>Verifying Code...</ThemedText>
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ThemedText style={styles.submitButtonText}>Continue</ThemedText>
                  <Feather name="check" size={18} color="#FFFFFF" />
                </View>
              )}
            </AnimatedPressable>
          </View>
        )}

        {/* STEP 3: NEW PASSWORD */}
        {step === "NEW_PASSWORD" && (
          <View style={styles.formContainer}>
            {requiresEmailConfirmation && (
              <View style={styles.infoBadge}>
                <Feather name="mail" size={16} color="#3B82F6" />
                <ThemedText style={styles.infoBadgeText}>
                  Secondary email confirmation link sent. Please confirm before submitting.
                </ThemedText>
              </View>
            )}

            {/* New Password */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>New Password</ThemedText>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Feather name="lock" size={18} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Enter new password"
                  placeholderTextColor={theme.textSecondary}
                  value={newPassword}
                  onChangeText={(t) => {
                    setNewPassword(t);
                    setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Feather name={showPassword ? "eye" : "eye-off"} size={18} color={theme.textSecondary} />
                </Pressable>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>Confirm New Password</ThemedText>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Feather name="check-circle" size={18} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Re-enter new password"
                  placeholderTextColor={theme.textSecondary}
                  value={confirmPassword}
                  onChangeText={(t) => {
                    setConfirmPassword(t);
                    setError(null);
                  }}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                  <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={18} color={theme.textSecondary} />
                </Pressable>
              </View>
            </View>

            {/* Password Strength Checklist */}
            <View style={[styles.reqCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <View style={styles.reqItem}>
                <Feather name={isMinLength ? "check-circle" : "circle"} size={14} color={isMinLength ? "#22C55E" : theme.textSecondary} />
                <ThemedText style={[styles.reqText, { color: isMinLength ? "#22C55E" : theme.textSecondary }]}>
                  Minimum 8 characters
                </ThemedText>
              </View>
              <View style={styles.reqItem}>
                <Feather name={hasUppercase ? "check-circle" : "circle"} size={14} color={hasUppercase ? "#22C55E" : theme.textSecondary} />
                <ThemedText style={[styles.reqText, { color: hasUppercase ? "#22C55E" : theme.textSecondary }]}>
                  At least one uppercase letter (A-Z)
                </ThemedText>
              </View>
              <View style={styles.reqItem}>
                <Feather name={hasLowercase ? "check-circle" : "circle"} size={14} color={hasLowercase ? "#22C55E" : theme.textSecondary} />
                <ThemedText style={[styles.reqText, { color: hasLowercase ? "#22C55E" : theme.textSecondary }]}>
                  At least one lowercase letter (a-z)
                </ThemedText>
              </View>
              <View style={styles.reqItem}>
                <Feather name={hasNumber ? "check-circle" : "circle"} size={14} color={hasNumber ? "#22C55E" : theme.textSecondary} />
                <ThemedText style={[styles.reqText, { color: hasNumber ? "#22C55E" : theme.textSecondary }]}>
                  At least one number (0-9)
                </ThemedText>
              </View>
              <View style={styles.reqItem}>
                <Feather name={hasSpecial ? "check-circle" : "circle"} size={14} color={hasSpecial ? "#22C55E" : theme.textSecondary} />
                <ThemedText style={[styles.reqText, { color: hasSpecial ? "#22C55E" : theme.textSecondary }]}>
                  At least one special character (!@#$%)
                </ThemedText>
              </View>
              <View style={styles.reqItem}>
                <Feather name={isMatching ? "check-circle" : "circle"} size={14} color={isMatching ? "#22C55E" : theme.textSecondary} />
                <ThemedText style={[styles.reqText, { color: isMatching ? "#22C55E" : theme.textSecondary }]}>
                  Passwords match
                </ThemedText>
              </View>
            </View>

            <AnimatedPressable
              onPress={handleResetPassword}
              onPressIn={() => (buttonScale.value = withSpring(0.96))}
              onPressOut={() => (buttonScale.value = withSpring(1))}
              disabled={isLoading || !isPasswordStrong || !isMatching}
              style={[
                styles.submitButton,
                { backgroundColor: isPasswordStrong && isMatching ? theme.primary : theme.border },
                animatedButtonStyle,
              ]}
            >
              {isLoading ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <ThemedText style={styles.submitButtonText}>Saving Password...</ThemedText>
                </View>
              ) : (
                <ThemedText style={styles.submitButtonText}>Save New Password</ThemedText>
              )}
            </AnimatedPressable>
          </View>
        )}

        {/* Back to Login link */}
        <Pressable
          onPress={() => navigation.navigate("Login")}
          style={styles.backToLoginBtn}
        >
          <ThemedText style={[styles.backToLoginText, { color: theme.textSecondary }]}>
            Remembered your password?{" "}
            <ThemedText style={{ color: theme.primary, fontWeight: "700" }}>Log In</ThemedText>
          </ThemedText>
        </Pressable>
      </ScrollContainer>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
  },
  header: {
    marginBottom: Spacing.xl,
    alignItems: "center",
  },
  backButton: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255, 107, 53, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    marginTop: Spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: Spacing.xs,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: Spacing.md,
  },
  formContainer: {
    marginTop: Spacing.md,
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: Spacing.xs,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  countryCodeBadge: {
    paddingRight: Spacing.sm,
    borderRightWidth: 1,
    borderRightColor: "rgba(148, 163, 184, 0.3)",
    marginRight: Spacing.sm,
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: "700",
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    height: "100%",
  },
  eyeIcon: {
    padding: Spacing.xs,
  },
  otpGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
    gap: 8,
  },
  otpBox: {
    flex: 1,
    height: 56,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
  },
  resendRow: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  cooldownText: {
    fontSize: 14,
    fontWeight: "500",
  },
  resendLink: {
    fontSize: 14,
    fontWeight: "700",
  },
  reqCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    gap: 8,
  },
  reqItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reqText: {
    fontSize: 12,
    fontWeight: "600",
  },
  infoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
    marginBottom: Spacing.lg,
  },
  infoBadgeText: {
    flex: 1,
    color: "#93C5FD",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  submitButton: {
    height: 52,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
    boxShadow: "0 4px 14px rgba(255, 107, 53, 0.3)",
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    marginBottom: Spacing.md,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
    fontWeight: "600",
  },
  backToLoginBtn: {
    marginTop: Spacing["2xl"],
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  backToLoginText: {
    fontSize: 14,
  },
});
