import React, { useState } from "react";
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
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootNavigatorParamList } from "@/navigation/RootNavigator";
import { API_URL } from "@/utils/storage";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ResetPasswordNavigationProp = NativeStackNavigationProp<
  RootNavigatorParamList,
  "ResetPassword"
>;

type ResetPasswordRouteProp = RouteProp<
  RootNavigatorParamList,
  "ResetPassword"
>;

export default function ResetPasswordScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<ResetPasswordNavigationProp>();
  const route = useRoute<ResetPasswordRouteProp>();
  const insets = useSafeAreaInsets();

  const token = route.params?.token || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Real-time password validation
  const isMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isPasswordStrong =
    isMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;
  const isMatching = password === confirmPassword && confirmPassword.length > 0;

  const handleResetPassword = async () => {
    if (!token) {
      setError("Reset token is missing. Please request a new password reset email.");
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

    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password.");
      }

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert(
        "Password Reset Successful ✅",
        "Your password has been updated. Please log in with your new password.",
        [
          {
            text: "Go to Login",
            onPress: () => navigation.navigate("Login"),
          },
        ]
      );
    } catch (err: any) {
      setError(err.message || "Failed to reset password.");
    } finally {
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
          <ThemedText style={styles.title}>Reset Password</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Enter your new secure password below to regain account access
          </ThemedText>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={16} color="#EF4444" />
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        ) : null}

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
              placeholder="At least 8 characters"
              placeholderTextColor={theme.textSecondary}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setError(null);
              }}
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

          {/* Password Checklist */}
          {password.length > 0 && (
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
                  One uppercase letter
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
                  One lowercase letter
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
                  One number
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
                  One special character
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
              placeholder="Confirm your password"
              placeholderTextColor={theme.textSecondary}
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t);
                setError(null);
              }}
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
          onPress={handleResetPassword}
          onPressIn={() => (buttonScale.value = withSpring(0.96))}
          onPressOut={() => (buttonScale.value = withSpring(1))}
          disabled={isLoading || !isPasswordStrong || !isMatching}
          style={[
            styles.submitButton,
            {
              backgroundColor:
                isPasswordStrong && isMatching ? theme.primary : theme.border,
            },
            animatedButtonStyle,
          ]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <ThemedText style={styles.submitButtonText}>Set New Password</ThemedText>
          )}
        </AnimatedPressable>
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
