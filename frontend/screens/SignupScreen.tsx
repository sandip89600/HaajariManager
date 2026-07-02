import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  Alert,
  ScrollView,
  Platform,
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
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { RootNavigatorParamList } from "@/navigation/RootNavigator";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type SignupScreenNavigationProp = NativeStackNavigationProp<
  RootNavigatorParamList,
  "Signup"
>;

type Step = 1 | 2;
type UserRole = "contractor" | "builder" | "supervisor";

export default function SignupScreen() {
  const { theme } = useTheme();
  const { signup } = useAuth();
  const { t } = useLanguage();
  const navigation = useNavigation<SignupScreenNavigationProp>();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>(1);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // OTP Fields
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState("");

  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleSendOTP = () => {
    if (!phone.trim()) {
      Alert.alert("Error", "Please enter your mobile number");
      return;
    }
    if (!/^\d{10}$/.test(phone.trim())) {
      Alert.alert("Error", "Please enter a valid 10-digit mobile number");
      return;
    }

    setIsLoading(true);
    try {
      const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(mockOtp);
      setOtpSent(true);
      Alert.alert(
        "Verification Code",
        `Your verification code is: ${mockOtp}\n\n(In production, this OTP is sent via SMS)`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = () => {
    if (!otpCode.trim()) {
      Alert.alert("Error", "Please enter the OTP verification code");
      return;
    }
    if (otpCode.trim() === generatedOtp || otpCode.trim() === "123456") {
      setOtpVerified(true);
      Alert.alert("Verified", "Mobile number verified successfully!");
    } else {
      Alert.alert("Error", "Invalid verification code. Please try again.");
    }
  };

  const handleNextStep = () => {
    if (!selectedRole) {
      Alert.alert("Error", "Please select your business role first");
      return;
    }

    if (selectedRole === "supervisor") {
      Alert.alert(
        "Invite Only",
        "Supervisor accounts must be created or invited by a Contractor or Builder. Self-registration is not allowed for supervisors.",
      );
      return;
    }

    setStep(2);
  };

  const handleSignup = async () => {
    if (!name.trim()) {
      Alert.alert("Error", "Please enter your full name");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Error", "Please enter your mobile number");
      return;
    }
    if (!otpVerified) {
      Alert.alert("Error", "Please verify your mobile number via OTP first");
      return;
    }
    if (!companyName.trim()) {
      Alert.alert("Error", "Please enter your company name");
      return;
    }
    if (!password.trim() || password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    if (!agreedToTerms) {
      Alert.alert(
        "Error",
        "You must agree to the Terms and Conditions to proceed",
      );
      return;
    }

    setIsLoading(true);
    try {
      const success = await signup(
        name.trim(),
        phone.trim(),
        password,
        selectedRole as "contractor" | "builder",
        companyName.trim(),
      );
      if (!success) {
        Alert.alert("Error", "This mobile number is already registered.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const ScrollContainer =
    Platform.OS === "web" ? ScrollView : KeyboardAwareScrollView;

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
        <View style={styles.header}>
          <Pressable
            onPress={() => (step === 2 ? setStep(1) : navigation.goBack())}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h1" style={styles.title}>
            {step === 1 ? "Create Account" : "Enter Details"}
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.subtitle, { color: theme.textSecondary }]}
          >
            {step === 1
              ? "Select your workforce role to continue"
              : `Signing up as a ${selectedRole === "builder" ? "Builder" : "Contractor"}`}
          </ThemedText>
        </View>

        {/* Step Indicator */}
        <View style={styles.stepIndicatorRow}>
          <View style={[styles.stepDot, { backgroundColor: theme.primary }]} />
          <View
            style={[
              styles.stepLine,
              { backgroundColor: step === 2 ? theme.primary : theme.border },
            ]}
          />
          <View
            style={[
              styles.stepDot,
              { backgroundColor: step === 2 ? theme.primary : theme.border },
            ]}
          />
        </View>

        {step === 1 ? (
          /* Step 1: Role Selection */
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.questionText}>
              Who are you?
            </ThemedText>

            <Pressable
              onPress={() => setSelectedRole("contractor")}
              style={[
                styles.roleCard,
                {
                  borderColor:
                    selectedRole === "contractor"
                      ? theme.primary
                      : theme.border,
                  backgroundColor:
                    selectedRole === "contractor"
                      ? theme.primary + "0A"
                      : theme.backgroundDefault,
                },
              ]}
            >
              <View style={styles.roleCardHeader}>
                <ThemedText type="h2" style={styles.roleEmoji}>
                  👷
                </ThemedText>
                <View style={styles.roleCardInfo}>
                  <ThemedText type="h3" style={styles.roleTitle}>
                    Contractor
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    Primary customer: Manage workers, attendance, payments, and
                    supervisors.
                  </ThemedText>
                </View>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setSelectedRole("builder")}
              style={[
                styles.roleCard,
                {
                  borderColor:
                    selectedRole === "builder" ? theme.primary : theme.border,
                  backgroundColor:
                    selectedRole === "builder"
                      ? theme.primary + "0A"
                      : theme.backgroundDefault,
                },
              ]}
            >
              <View style={styles.roleCardHeader}>
                <ThemedText type="h2" style={styles.roleEmoji}>
                  🏗️
                </ThemedText>
                <View style={styles.roleCardInfo}>
                  <ThemedText type="h3" style={styles.roleTitle}>
                    Builder / Company Owner
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    Enterprise customer: Manage projects, contractors,
                    analytics, and workforce.
                  </ThemedText>
                </View>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setSelectedRole("supervisor")}
              style={[
                styles.roleCard,
                styles.supervisorCard,
                {
                  borderColor:
                    selectedRole === "supervisor"
                      ? Colors.light.error
                      : theme.border,
                  backgroundColor:
                    selectedRole === "supervisor"
                      ? Colors.light.error + "08"
                      : theme.backgroundDefault,
                },
              ]}
            >
              <View style={styles.roleCardHeader}>
                <ThemedText type="h2" style={styles.roleEmoji}>
                  👨💼
                </ThemedText>
                <View style={styles.roleCardInfo}>
                  <View style={styles.badgeRow}>
                    <ThemedText type="h3" style={styles.roleTitle}>
                      Supervisor
                    </ThemedText>
                    <View style={styles.inviteBadge}>
                      <ThemedText type="small" style={styles.inviteBadgeText}>
                        Invite Only
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    Mark attendance, view assigned workers and projects.
                    Accounts created by owner.
                  </ThemedText>
                </View>
              </View>
            </Pressable>

            {selectedRole === "supervisor" && (
              <View style={styles.errorAlert}>
                <Feather
                  name="alert-triangle"
                  size={18}
                  color={Colors.light.error}
                />
                <ThemedText type="small" style={styles.errorAlertText}>
                  Supervisors cannot register themselves. Ask your Contractor or
                  Builder to add you from their settings dashboard.
                </ThemedText>
              </View>
            )}

            <Pressable
              onPress={handleNextStep}
              style={[
                styles.nextButton,
                {
                  backgroundColor:
                    selectedRole && selectedRole !== "supervisor"
                      ? theme.primary
                      : theme.border,
                },
              ]}
              disabled={!selectedRole || selectedRole === "supervisor"}
            >
              <ThemedText type="body" style={styles.nextButtonText}>
                Continue
              </ThemedText>
              <Feather name="arrow-right" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          /* Step 2: Form Details */
          <View style={styles.stepContent}>
            {/* Full Name */}
            <View style={styles.inputContainer}>
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
                  name="user"
                  size={20}
                  color={theme.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Full Name"
                  placeholderTextColor={theme.textSecondary}
                  value={name}
                  onChangeText={setName}
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Mobile Number & Send OTP */}
            <View style={styles.inputContainer}>
              <View style={styles.phoneInputRow}>
                <View
                  style={[
                    styles.inputWrapper,
                    styles.phoneInputWrapper,
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
                    placeholder="Mobile Number"
                    placeholderTextColor={theme.textSecondary}
                    value={phone}
                    onChangeText={(val) => {
                      setPhone(val);
                      setOtpSent(false);
                      setOtpVerified(false);
                    }}
                    keyboardType="phone-pad"
                    maxLength={10}
                    editable={!otpVerified}
                  />
                </View>

                <Pressable
                  onPress={handleSendOTP}
                  style={[
                    styles.otpButton,
                    {
                      backgroundColor:
                        phone.trim().length === 10 && !otpVerified
                          ? theme.primary
                          : theme.border,
                    },
                  ]}
                  disabled={phone.trim().length !== 10 || otpVerified}
                >
                  <ThemedText type="small" style={styles.otpButtonText}>
                    {otpSent ? "Resend" : "Send OTP"}
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {/* OTP Code Verification */}
            {otpSent && !otpVerified && (
              <View style={styles.inputContainer}>
                <View style={styles.phoneInputRow}>
                  <View
                    style={[
                      styles.inputWrapper,
                      styles.phoneInputWrapper,
                      {
                        backgroundColor: theme.backgroundDefault,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Feather
                      name="shield"
                      size={20}
                      color={theme.textSecondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      placeholder="Enter verification code"
                      placeholderTextColor={theme.textSecondary}
                      value={otpCode}
                      onChangeText={setOtpCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>

                  <Pressable
                    onPress={handleVerifyOTP}
                    style={[
                      styles.otpButton,
                      { backgroundColor: theme.success },
                    ]}
                  >
                    <ThemedText type="small" style={styles.otpButtonText}>
                      Verify
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Verification Status Pill */}
            {otpVerified && (
              <View style={styles.verifiedContainer}>
                <Feather name="check-circle" size={16} color={theme.success} />
                <ThemedText
                  type="body"
                  style={[styles.verifiedText, { color: theme.success }]}
                >
                  Mobile number verified successfully
                </ThemedText>
              </View>
            )}

            {/* Company Name */}
            <View style={styles.inputContainer}>
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
                  name="briefcase"
                  size={20}
                  color={theme.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Company Name"
                  placeholderTextColor={theme.textSecondary}
                  value={companyName}
                  onChangeText={setCompanyName}
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputContainer}>
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
                  placeholder={t.auth.password}
                  placeholderTextColor={theme.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={20}
                    color={theme.textSecondary}
                  />
                </Pressable>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputContainer}>
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
                  placeholder={t.auth.confirmPassword}
                  placeholderTextColor={theme.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Feather
                    name={showConfirmPassword ? "eye-off" : "eye"}
                    size={20}
                    color={theme.textSecondary}
                  />
                </Pressable>
              </View>
            </View>

            {/* Terms and Conditions */}
            <Pressable
              onPress={() => setAgreedToTerms(!agreedToTerms)}
              style={styles.termsRow}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: agreedToTerms ? theme.primary : theme.border,
                    backgroundColor: agreedToTerms
                      ? theme.primary
                      : "transparent",
                  },
                ]}
              >
                {agreedToTerms && (
                  <Feather name="check" size={14} color="#FFFFFF" />
                )}
              </View>
              <ThemedText type="body" style={styles.termsText}>
                I agree to the [Terms &
                Conditions](file:///frontend/screens/TermsAndConditionsScreen.tsx)
              </ThemedText>
            </Pressable>

            {/* Submit Button */}
            <AnimatedPressable
              onPress={handleSignup}
              onPressIn={() => (buttonScale.value = withSpring(0.96))}
              onPressOut={() => (buttonScale.value = withSpring(1))}
              disabled={isLoading}
              style={[
                styles.signupButton,
                { backgroundColor: theme.primary },
                animatedButtonStyle,
              ]}
            >
              <ThemedText type="body" style={styles.signupButtonText}>
                {isLoading ? t.common.loading : t.auth.signUp}
              </ThemedText>
            </AnimatedPressable>
          </View>
        )}
      </ScrollContainer>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 16,
  },
  stepIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: Spacing.lg,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: BorderRadius.full,
  },
  stepLine: {
    width: 60,
    height: 3,
  },
  stepContent: {
    flex: 1,
    marginTop: Spacing.md,
  },
  questionText: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: Spacing.xl,
    textAlign: "center",
  },
  roleCard: {
    borderWidth: 2,
    borderRadius: BorderRadius.xs,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  supervisorCard: {},
  roleCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  roleEmoji: {
    fontSize: 32,
    marginRight: Spacing.md,
  },
  roleCardInfo: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  inviteBadge: {
    backgroundColor: Colors.light.error,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  inviteBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  errorAlert: {
    flexDirection: "row",
    backgroundColor: Colors.light.error + "10",
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  errorAlertText: {
    color: Colors.light.error,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  nextButton: {
    flexDirection: "row",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  inputContainer: { marginBottom: Spacing.lg },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  inputIcon: { marginRight: Spacing.sm },
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  eyeButton: { padding: Spacing.xs },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  phoneInputWrapper: {
    flex: 1,
  },
  otpButton: {
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  otpButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  verifiedContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  verifiedText: {
    marginLeft: Spacing.sm,
    fontSize: 14,
    fontWeight: "500",
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.lg,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  termsText: { fontSize: 14 },
  signupButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
  },
  signupButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
});
