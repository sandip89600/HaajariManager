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

export default function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<ForgotPasswordNavigationProp>();
  const insets = useSafeAreaInsets();

  const [method, setMethod] = useState<"email" | "otp">("email");

  // Email flow state
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  // OTP flow state
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpArray, setOtpArray] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<Array<TextInput | null>>([]);
  const [cooldown, setCooldown] = useState(0);

  // New Password state (for OTP reset)
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

  const handleSendEmailReset = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    // 60-second timeout to accommodate cold starts on server
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const targetUrl = `${API_URL}/auth/forgot-password`;
    console.log(`[Forgot Password API] URL: ${targetUrl}, Method: POST`);

    try {
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, method: "email" }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log(`[Forgot Password API] Status: ${res.status}`);

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || (data && data.success === false)) {
        if (res.status === 404) {
          throw new Error("This email address is not registered.");
        } else if (res.status === 429) {
          throw new Error("Please wait before requesting another reset email.");
        } else if (res.status >= 500) {
          throw new Error("Unable to send email right now. Please try again later.");
        }
        throw new Error(data?.message || data?.error || "Unable to send email right now. Please try again later.");
      }

      triggerHaptic();
      setEmailSent(true);
      setSuccessMsg(
        data?.message || `Password reset link sent to ${trimmed}. Please check your inbox.`
      );
      setCooldown(60);
    } catch (err: any) {
      console.warn(`[Forgot Password API Error]`, err?.message || err);
      if (err.name === "AbortError") {
        setError("Server took too long to respond. Please check your connection and try again.");
      } else {
        const msg = err.message || "";
        if (
          msg.includes("Network request failed") ||
          msg.includes("Failed to fetch")
        ) {
          setError("Unable to reach the server. Please check your connection and try again.");
        } else if (
          msg.includes("JSON") ||
          msg.includes("Unexpected") ||
          msg.includes("<!DOCTYPE")
        ) {
          setError("Unable to send email right now. Please try again later.");
        } else {
          setError(msg || "Unable to send email right now. Please try again later.");
        }
      }
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  const handleSendOtpReset = async () => {
    const trimmed = phone.trim();
    if (!trimmed || trimmed.length < 8) {
      setError("Please enter a valid mobile number.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const targetUrl = `${API_URL}/auth/forgot-password`;
    console.log(`[Forgot Password OTP] URL: ${targetUrl}, Method: POST`);

    try {
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: trimmed, method: "otp" }),
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
        if (res.status === 404) {
          throw new Error("This mobile number is not registered.");
        } else if (res.status === 429) {
          throw new Error("Please wait 60 seconds before requesting a new OTP.");
        }
        throw new Error(data?.message || data?.error || "Unable to send verification code. Please try again.");
      }

      triggerHaptic();
      setOtpSent(true);
      setCooldown(60);
      Alert.alert(
        "Verification Code Sent",
        "A 6-digit OTP code has been sent to your registered mobile number."
      );
    } catch (err: any) {
      if (err.name === "AbortError") {
        setError("Server took too long to respond. Please check your connection and try again.");
      } else {
        setError(err.message || "Failed to send OTP. Please try again.");
      }
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

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

  const handleResetWithOtp = async () => {
    const otpCode = otpArray.join("");
    if (otpCode.length < 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    if (!isPasswordStrong) {
      setError("Please satisfy all password strength requirements.");
      return;
    }

    if (!isMatching) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          otp: otpCode,
          password: newPassword,
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
        throw new Error(data?.message || data?.error || "Password reset failed.");
      }

      triggerHaptic();
      Alert.alert(
        "Password Reset Successful ✅",
        "Your password has been updated. You can now log in with your new password.",
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
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: theme.backgroundSecondary }]}
          >
            <Feather name="arrow-left" size={22} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.title}>Forgot Password</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Select your preferred recovery method to reset your account password
          </ThemedText>
        </View>

        {/* Method Selector Tabs */}
        {!emailSent && !otpSent && (
          <View style={[styles.tabRow, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
            <Pressable
              style={[
                styles.tabBtn,
                method === "email" && { backgroundColor: theme.primary },
              ]}
              onPress={() => {
                setMethod("email");
                setError(null);
              }}
            >
              <Feather
                name="mail"
                size={16}
                color={method === "email" ? "#FFFFFF" : theme.textSecondary}
              />
              <ThemedText
                style={[
                  styles.tabBtnText,
                  { color: method === "email" ? "#FFFFFF" : theme.textSecondary },
                ]}
              >
                Reset via Email
              </ThemedText>
            </Pressable>

            <Pressable
              style={[
                styles.tabBtn,
                method === "otp" && { backgroundColor: theme.primary },
              ]}
              onPress={() => {
                setMethod("otp");
                setError(null);
              }}
            >
              <Feather
                name="smartphone"
                size={16}
                color={method === "otp" ? "#FFFFFF" : theme.textSecondary}
              />
              <ThemedText
                style={[
                  styles.tabBtnText,
                  { color: method === "otp" ? "#FFFFFF" : theme.textSecondary },
                ]}
              >
                Reset via Mobile OTP
              </ThemedText>
            </Pressable>
          </View>
        )}

        {/* Error Alert Box */}
        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={16} color="#EF4444" />
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        ) : null}

        {/* Success Alert Box */}
        {successMsg ? (
          <View style={styles.successBox}>
            <Feather name="check-circle" size={16} color="#22C55E" />
            <ThemedText style={styles.successText}>{successMsg}</ThemedText>
          </View>
        ) : null}

        {/* 1. EMAIL FLOW */}
        {method === "email" && (
          <View style={styles.formContainer}>
            {!emailSent ? (
              <>
                <View style={styles.inputContainer}>
                  <ThemedText style={styles.inputLabel}>Registered Email Address</ThemedText>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: theme.backgroundDefault,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Feather
                      name="mail"
                      size={20}
                      color={theme.textSecondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      placeholder="Enter your registered email"
                      placeholderTextColor={theme.textSecondary}
                      value={email}
                      onChangeText={(t) => {
                        setEmail(t);
                        setError(null);
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <AnimatedPressable
                  onPress={handleSendEmailReset}
                  onPressIn={() => (buttonScale.value = withSpring(0.96))}
                  onPressOut={() => (buttonScale.value = withSpring(1))}
                  disabled={isLoading || !email.trim()}
                  style={[
                    styles.submitButton,
                    { backgroundColor: email.trim() ? theme.primary : theme.border },
                    animatedButtonStyle,
                  ]}
                >
                  {isLoading ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <ThemedText style={styles.submitButtonText}>Sending Link...</ThemedText>
                    </View>
                  ) : (
                    <>
                      <ThemedText style={styles.submitButtonText}>Send Reset Link</ThemedText>
                      <Feather name="send" size={16} color="#FFFFFF" style={{ marginLeft: 8 }} />
                    </>
                  )}
                </AnimatedPressable>
              </>
            ) : (
              <View style={styles.emailSentCard}>
                <View style={styles.emailSentIcon}>
                  <Feather name="mail" size={32} color={theme.primary} />
                </View>
                <ThemedText style={styles.emailSentTitle}>Check Your Inbox</ThemedText>
                <ThemedText style={[styles.emailSentDesc, { color: theme.textSecondary }]}>
                  We sent a password reset link to <ThemedText style={{ fontWeight: "700" }}>{email}</ThemedText>.
                  Please click the link in the email to set your new password.
                </ThemedText>

                <View style={styles.infoPill}>
                  <Feather name="clock" size={14} color="#E2E8F0" />
                  <ThemedText style={styles.infoPillText}>Link valid for 30 minutes</ThemedText>
                </View>

                <Pressable
                  onPress={handleSendEmailReset}
                  disabled={cooldown > 0 || isLoading}
                  style={[
                    styles.resendBtn,
                    { borderColor: cooldown > 0 ? theme.border : theme.primary },
                  ]}
                >
                  <ThemedText
                    style={{
                      color: cooldown > 0 ? theme.textSecondary : theme.primary,
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                  >
                    {cooldown > 0 ? `Resend Link in ${cooldown}s` : "Resend Reset Link"}
                  </ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => navigation.navigate("Login")}
                  style={{ marginTop: 24 }}
                >
                  <ThemedText style={{ color: theme.textSecondary, fontSize: 14 }}>
                    Back to <ThemedText style={{ color: theme.primary, fontWeight: "700" }}>Login</ThemedText>
                  </ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* 2. OTP FLOW */}
        {method === "otp" && (
          <View style={styles.formContainer}>
            {!otpSent ? (
              <>
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
                    <Feather
                      name="phone"
                      size={20}
                      color={theme.textSecondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      placeholder="e.g. 9876543210"
                      placeholderTextColor={theme.textSecondary}
                      value={phone}
                      onChangeText={(t) => {
                        setPhone(t);
                        setError(null);
                      }}
                      keyboardType="phone-pad"
                      maxLength={15}
                    />
                  </View>
                </View>

                <AnimatedPressable
                  onPress={handleSendOtpReset}
                  onPressIn={() => (buttonScale.value = withSpring(0.96))}
                  onPressOut={() => (buttonScale.value = withSpring(1))}
                  disabled={isLoading || !phone.trim()}
                  style={[
                    styles.submitButton,
                    { backgroundColor: phone.trim() ? theme.primary : theme.border },
                    animatedButtonStyle,
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <ThemedText style={styles.submitButtonText}>Send OTP Code</ThemedText>
                      <Feather name="arrow-right" size={16} color="#FFFFFF" style={{ marginLeft: 8 }} />
                    </>
                  )}
                </AnimatedPressable>
              </>
            ) : (
              <>
                {/* OTP Input Boxes */}
                <View style={styles.inputContainer}>
                  <ThemedText style={styles.inputLabel}>
                    Enter 6-Digit OTP Code sent to {phone}
                  </ThemedText>
                  <View style={styles.otpBoxesRow}>
                    {otpArray.map((digit, i) => (
                      <TextInput
                        key={i}
                        ref={(ref) => {
                          otpRefs.current[i] = ref;
                        }}
                        style={[
                          styles.otpBox,
                          {
                            borderColor: digit ? theme.primary : theme.border,
                            backgroundColor: theme.backgroundDefault,
                            color: theme.text,
                          },
                        ]}
                        keyboardType="number-pad"
                        maxLength={1}
                        value={digit}
                        onChangeText={(t) => handleOtpBoxChange(t, i)}
                        onKeyPress={(e) => handleOtpKeyPress(e, i)}
                      />
                    ))}
                  </View>
                  <View style={styles.resendRow}>
                    <Pressable
                      onPress={handleSendOtpReset}
                      disabled={cooldown > 0 || isLoading}
                    >
                      <ThemedText
                        style={{
                          color: cooldown > 0 ? theme.textSecondary : theme.primary,
                          fontSize: 13,
                          fontWeight: "600",
                        }}
                      >
                        {cooldown > 0 ? `Resend Code in ${cooldown}s` : "Resend OTP Code"}
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>

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
                    <Feather
                      name="lock"
                      size={20}
                      color={theme.textSecondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      placeholder="Enter new password"
                      placeholderTextColor={theme.textSecondary}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    <Pressable
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeBtn}
                    >
                      <Feather
                        name={showPassword ? "eye-off" : "eye"}
                        size={18}
                        color={theme.textSecondary}
                      />
                    </Pressable>
                  </View>

                  {/* Password Strength Checklist */}
                  {newPassword.length > 0 && (
                    <View style={styles.rulesCard}>
                      <View style={styles.ruleItem}>
                        <Feather
                          name={isMinLength ? "check-circle" : "circle"}
                          size={13}
                          color={isMinLength ? "#22C55E" : theme.textSecondary}
                        />
                        <ThemedText
                          style={[
                            styles.ruleText,
                            { color: isMinLength ? "#22C55E" : theme.textSecondary },
                          ]}
                        >
                          Minimum 8 characters
                        </ThemedText>
                      </View>

                      <View style={styles.ruleItem}>
                        <Feather
                          name={hasUppercase ? "check-circle" : "circle"}
                          size={13}
                          color={hasUppercase ? "#22C55E" : theme.textSecondary}
                        />
                        <ThemedText
                          style={[
                            styles.ruleText,
                            { color: hasUppercase ? "#22C55E" : theme.textSecondary },
                          ]}
                        >
                          At least one uppercase letter
                        </ThemedText>
                      </View>

                      <View style={styles.ruleItem}>
                        <Feather
                          name={hasLowercase ? "check-circle" : "circle"}
                          size={13}
                          color={hasLowercase ? "#22C55E" : theme.textSecondary}
                        />
                        <ThemedText
                          style={[
                            styles.ruleText,
                            { color: hasLowercase ? "#22C55E" : theme.textSecondary },
                          ]}
                        >
                          At least one lowercase letter
                        </ThemedText>
                      </View>

                      <View style={styles.ruleItem}>
                        <Feather
                          name={hasNumber ? "check-circle" : "circle"}
                          size={13}
                          color={hasNumber ? "#22C55E" : theme.textSecondary}
                        />
                        <ThemedText
                          style={[
                            styles.ruleText,
                            { color: hasNumber ? "#22C55E" : theme.textSecondary },
                          ]}
                        >
                          At least one number
                        </ThemedText>
                      </View>

                      <View style={styles.ruleItem}>
                        <Feather
                          name={hasSpecial ? "check-circle" : "circle"}
                          size={13}
                          color={hasSpecial ? "#22C55E" : theme.textSecondary}
                        />
                        <ThemedText
                          style={[
                            styles.ruleText,
                            { color: hasSpecial ? "#22C55E" : theme.textSecondary },
                          ]}
                        >
                          At least one special character
                        </ThemedText>
                      </View>
                    </View>
                  )}
                </View>

                {/* Confirm Password */}
                <View style={styles.inputContainer}>
                  <ThemedText style={styles.inputLabel}>Confirm New Password</ThemedText>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: theme.backgroundDefault,
                        borderColor:
                          confirmPassword && !isMatching ? "#EF4444" : theme.border,
                      },
                    ]}
                  >
                    <Feather
                      name="lock"
                      size={20}
                      color={theme.textSecondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      placeholder="Confirm new password"
                      placeholderTextColor={theme.textSecondary}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                    />
                    <Pressable
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeBtn}
                    >
                      <Feather
                        name={showConfirmPassword ? "eye-off" : "eye"}
                        size={18}
                        color={theme.textSecondary}
                      />
                    </Pressable>
                  </View>
                  {confirmPassword.length > 0 && !isMatching && (
                    <ThemedText style={{ color: "#EF4444", fontSize: 12, marginTop: 4 }}>
                      Passwords do not match
                    </ThemedText>
                  )}
                </View>

                <AnimatedPressable
                  onPress={handleResetWithOtp}
                  onPressIn={() => (buttonScale.value = withSpring(0.96))}
                  onPressOut={() => (buttonScale.value = withSpring(1))}
                  disabled={isLoading || !isPasswordStrong || !isMatching || otpArray.join("").length < 6}
                  style={[
                    styles.submitButton,
                    {
                      backgroundColor:
                        isPasswordStrong && isMatching && otpArray.join("").length === 6
                          ? theme.primary
                          : theme.border,
                    },
                    animatedButtonStyle,
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedText style={styles.submitButtonText}>Reset Password</ThemedText>
                  )}
                </AnimatedPressable>
              </>
            )}
          </View>
        )}
      </ScrollContainer>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.xl },
  header: { marginBottom: Spacing.lg },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: Spacing.xs },
  subtitle: { fontSize: 14, lineHeight: 20 },
  tabRow: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    padding: 4,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
  },
  tabBtnText: { fontSize: 13, fontWeight: "600" },
  formContainer: { flex: 1 },
  inputContainer: { marginBottom: Spacing.lg },
  inputLabel: { fontSize: 13, fontWeight: "600", marginBottom: Spacing.xs },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, fontSize: 15 },
  eyeBtn: { padding: 4 },
  submitButton: {
    flexDirection: "row",
    height: 54,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
  },
  submitButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: { color: "#FCA5A5", fontSize: 13, flex: 1 },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderColor: "rgba(34, 197, 94, 0.2)",
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  successText: { color: "#86EFAC", fontSize: 13, flex: 1 },
  emailSentCard: {
    alignItems: "center",
    padding: 24,
    borderRadius: 16,
    marginTop: 12,
  },
  emailSentIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255, 107, 53, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emailSentTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  emailSentDesc: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 16 },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1E293B",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 24,
  },
  infoPillText: { color: "#E2E8F0", fontSize: 12, fontWeight: "500" },
  resendBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
  },
  otpBoxesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 12,
  },
  otpBox: {
    width: 46,
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
  },
  resendRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4 },
  rulesCard: {
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    gap: 6,
  },
  ruleItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  ruleText: { fontSize: 12 },
});
