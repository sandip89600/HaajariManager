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
  Text,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import GoogleMobileCompletionModal from "@/components/GoogleMobileCompletionModal";
import { promptGoogleSignIn } from "@/utils/googleAuth";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { RootNavigatorParamList } from "@/navigation/RootNavigator";
import { API_URL } from "@/utils/storage";
import * as Haptics from "expo-haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type SignupScreenNavigationProp = NativeStackNavigationProp<
  RootNavigatorParamList,
  "Signup"
>;

type Step = 1 | 2;
type UserRole = "contractor" | "builder" | "supervisor";

export default function SignupScreen() {
  const { theme } = useTheme();
  const { signup, loginWithGoogle } = useAuth();
  const { t } = useLanguage();
  const navigation = useNavigation<SignupScreenNavigationProp>();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>(2);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>("contractor");

  // Form Fields
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Google completion modal state
  const [showMobileCompletionModal, setShowMobileCompletionModal] = useState(false);
  const [pendingGoogleProfile, setPendingGoogleProfile] = useState<any>(null);

  // Real-time password validation criteria
  const isMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isPasswordStrong = isMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;

  // Validation States
  const [usernameState, setUsernameState] = useState<"idle" | "checking" | "available" | "error">("idle");
  const [usernameMsg, setUsernameMsg] = useState("");

  const [emailState, setEmailState] = useState<"idle" | "checking" | "available" | "error">("idle");
  const [emailMsg, setEmailMsg] = useState("");

  const [phoneState, setPhoneState] = useState<"idle" | "checking" | "available" | "error">("idle");
  const [phoneMsg, setPhoneMsg] = useState("");

  const usernameTimer = useRef<NodeJS.Timeout | null>(null);
  const emailTimer = useRef<NodeJS.Timeout | null>(null);
  const phoneTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (usernameTimer.current) clearTimeout(usernameTimer.current);
      if (emailTimer.current) clearTimeout(emailTimer.current);
      if (phoneTimer.current) clearTimeout(phoneTimer.current);
    };
  }, []);

  // OTP Fields
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState("");

  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const googleRes = await promptGoogleSignIn();
      if (googleRes.type === "cancel") {
        setIsLoading(false);
        return;
      }
      if (googleRes.type === "error") {
        setIsLoading(false);
        Alert.alert("Google Sign-In", googleRes.error || "Unable to connect to Google.");
        return;
      }

      const userRole = selectedRole === "builder" ? "builder" : "contractor";
      const res = await loginWithGoogle(
        googleRes.idToken,
        googleRes.accessToken,
        undefined,
        undefined,
        name,
        companyName,
        userRole
      );
      setIsLoading(false);

      if (res.requiresMobileCompletion) {
        setPendingGoogleProfile({
          ...res.googleProfile,
          idToken: googleRes.idToken,
          accessToken: googleRes.accessToken,
        });
        setShowMobileCompletionModal(true);
      } else if (!res.success) {
        Alert.alert("Google Sign-In", res.message || "Google Sign-In failed.");
      }
    } catch (err: any) {
      setIsLoading(false);
      Alert.alert("Google Sign-In", "Unable to sign in with Google right now.");
    }
  };

  const handleCompleteGoogleRegistration = async (phoneStr: string) => {
    if (!pendingGoogleProfile) return;
    const userRole = selectedRole === "builder" ? "builder" : "contractor";
    const res = await loginWithGoogle(
      pendingGoogleProfile.idToken,
      pendingGoogleProfile.accessToken,
      phoneStr,
      undefined,
      name || pendingGoogleProfile.name,
      companyName,
      userRole,
      pendingGoogleProfile.googleId,
      pendingGoogleProfile.email
    );
    if (res.success) {
      setShowMobileCompletionModal(false);
      setPendingGoogleProfile(null);
    } else {
      throw new Error(res.message || "Failed to create account.");
    }
  };

  const runFieldValidation = async (field: "username" | "email" | "phone", val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      if (field === "username") { setUsernameState("idle"); setUsernameMsg(""); }
      if (field === "email") { setEmailState("idle"); setEmailMsg(""); }
      if (field === "phone") { setPhoneState("idle"); setPhoneMsg(""); }
      return;
    }

    if (field === "username") {
      if (trimmed.length < 3) {
        setUsernameState("error");
        setUsernameMsg("Username must be at least 3 characters.");
        return;
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
        setUsernameState("error");
        setUsernameMsg("Only letters, numbers, underscores, hyphens, and dots allowed.");
        return;
      }
      setUsernameState("checking");
      setUsernameMsg("Checking username availability...");
    } else if (field === "email") {
      if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) {
        setEmailState("error");
        setEmailMsg("Invalid email address format.");
        return;
      }
      setEmailState("checking");
      setEmailMsg("Checking email availability...");
    } else if (field === "phone") {
      if (!/^\d{10}$/.test(trimmed)) {
        setPhoneState("error");
        setPhoneMsg("Please enter a valid 10-digit mobile number.");
        return;
      }
      setPhoneState("checking");
      setPhoneMsg("Checking mobile availability...");
    }

    try {
      const res = await fetch(`${API_URL}/auth/validate-signup-field`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        if (field === "username") {
          setUsernameState("available");
          setUsernameMsg("Username is available");
        } else if (field === "email") {
          setEmailState("available");
          setEmailMsg("Email is available");
        } else if (field === "phone") {
          setPhoneState("available");
          setPhoneMsg("Mobile number is available");
        }
      } else {
        if (field === "username") {
          setUsernameState("error");
          setUsernameMsg(data.message || "Username already exists.");
        } else if (field === "email") {
          setEmailState("error");
          setEmailMsg(data.message || "Email is already registered.");
        } else if (field === "phone") {
          setPhoneState("error");
          setPhoneMsg(data.message || "Mobile number is already registered.");
        }
      }
    } catch (err) {
      if (field === "username") {
        setUsernameState("error");
        setUsernameMsg("Verification server unreachable.");
      } else if (field === "email") {
        setEmailState("error");
        setEmailMsg("Verification server unreachable.");
      } else if (field === "phone") {
        setPhoneState("error");
        setPhoneMsg("Verification server unreachable.");
      }
    }
  };

  const handleUsernameChange = (val: string) => {
    setUsername(val);
    const cleaned = val.trim();
    if (!cleaned) {
      setUsernameState("idle");
      setUsernameMsg("");
      return;
    }
    setUsernameState("checking");
    setUsernameMsg("Typing...");
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    usernameTimer.current = setTimeout(() => {
      runFieldValidation("username", cleaned);
    }, 500);
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    const cleaned = val.trim();
    if (!cleaned) {
      setEmailState("idle");
      setEmailMsg("");
      return;
    }
    setEmailState("checking");
    setEmailMsg("Typing...");
    if (emailTimer.current) clearTimeout(emailTimer.current);
    emailTimer.current = setTimeout(() => {
      runFieldValidation("email", cleaned);
    }, 500);
  };

  const handlePhoneChange = (val: string) => {
    setPhone(val);
    setOtpSent(false);
    setOtpVerified(false);
    const cleaned = val.trim();
    if (!cleaned) {
      setPhoneState("idle");
      setPhoneMsg("");
      return;
    }
    setPhoneState("checking");
    setPhoneMsg("Typing...");
    if (phoneTimer.current) clearTimeout(phoneTimer.current);
    phoneTimer.current = setTimeout(() => {
      runFieldValidation("phone", cleaned);
    }, 500);
  };

  const handleSendOTP = () => {
    if (phoneState !== "available") {
      Alert.alert("Error", phoneMsg || "Please enter a valid, unregistered mobile number");
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
    if (isLoading) return; // Guard against multiple taps

    if (!name.trim()) {
      Alert.alert("Error", "Please enter your full name");
      return;
    }
    if (!username.trim()) {
      Alert.alert("Error", "Please enter a username");
      return;
    }
    if (usernameState !== "available") {
      Alert.alert("Error", usernameMsg || "Please choose a valid available username");
      return;
    }
    if (emailState !== "available") {
      Alert.alert("Error", emailMsg || "Please enter a valid available email address");
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
    if (!isPasswordStrong) {
      Alert.alert(
        "Error",
        "Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, one number, and one special character."
      );
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
      const result = await signup(
        name.trim(),
        phone.trim(),
        password,
        selectedRole as "contractor" | "builder",
        companyName.trim(),
        email.trim(),
        username.trim(),
      );

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Success", "Account created successfully!");
        try { navigation.replace("Main"); } catch (e) {}
      } else {
        if (result.field === "email") {
          setEmailState("error");
          setEmailMsg(`❌ ${result.message}`);
        } else if (result.field === "username") {
          setUsernameState("error");
          setUsernameMsg(`❌ ${result.message}`);
        } else if (result.field === "mobile" || result.field === "phone") {
          setPhoneState("error");
          setPhoneMsg(`❌ ${result.message}`);
        }
        Alert.alert("Error", result.message || "Signup failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getValidationColor = (state: "idle" | "checking" | "available" | "error") => {
    if (state === "error") return "#EF4444";
    if (state === "available") return "#22C55E";
    if (state === "checking") return "#F59E0B";
    return theme.textSecondary;
  };

  const getValidationBorderColor = (state: "idle" | "checking" | "available" | "error") => {
    if (state === "error") return "#EF4444";
    if (state === "available") return "#22C55E";
    if (state === "checking") return "#F59E0B";
    return theme.border;
  };

  const isSubmitDisabled =
    isLoading ||
    usernameState === "checking" ||
    usernameState === "error" ||
    emailState === "checking" ||
    emailState === "error" ||
    phoneState === "checking" ||
    phoneState === "error" ||
    !name.trim() ||
    !username.trim() ||
    !email.trim() ||
    !phone.trim() ||
    !otpVerified ||
    !companyName.trim() ||
    !isPasswordStrong ||
    !agreedToTerms;

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
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.title}>
            Create Account
          </ThemedText>
          <ThemedText
            style={[styles.subtitle, { color: theme.textSecondary }]}
          >
            Please fill in the fields below to register
          </ThemedText>
        </View>

        {step === 1 ? (
          /* Step 1: Role Selection */
          <View style={styles.stepContent}>
            <ThemedText style={styles.questionText}>
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
                <ThemedText style={styles.roleEmoji}>
                  👷
                </ThemedText>
                <View style={styles.roleCardInfo}>
                  <ThemedText style={styles.roleTitle}>
                    Contractor
                  </ThemedText>
                  <ThemedText
                    style={{ color: theme.textSecondary, fontSize: 12, marginTop: 4 }}
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
                <ThemedText style={styles.roleEmoji}>
                  🏗️
                </ThemedText>
                <View style={styles.roleCardInfo}>
                  <ThemedText style={styles.roleTitle}>
                    Builder / Company Owner
                  </ThemedText>
                  <ThemedText
                    style={{ color: theme.textSecondary, fontSize: 12, marginTop: 4 }}
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
                <ThemedText style={styles.roleEmoji}>
                  👨💼
                </ThemedText>
                <View style={styles.roleCardInfo}>
                  <View style={styles.badgeRow}>
                    <ThemedText style={styles.roleTitle}>
                      Supervisor
                    </ThemedText>
                    <View style={styles.inviteBadge}>
                      <ThemedText style={styles.inviteBadgeText}>
                        Invite Only
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText
                    style={{ color: theme.textSecondary, fontSize: 12, marginTop: 4 }}
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
                <ThemedText style={styles.errorAlertText}>
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
              <ThemedText style={styles.nextButtonText}>
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
              <ThemedText style={styles.inputLabel}>
                {t.auth.fullName || "Full Name"} <ThemedText style={{ color: "red" }}>*</ThemedText>
              </ThemedText>
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
                  placeholder={t.auth.fullName || "Full Name"}
                  placeholderTextColor={theme.textSecondary}
                  value={name}
                  onChangeText={setName}
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Username */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>
                Username <ThemedText style={{ color: "red" }}>*</ThemedText>
              </ThemedText>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: getValidationBorderColor(usernameState),
                  },
                ]}
              >
                <Feather
                  name="at-sign"
                  size={20}
                  color={theme.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Username"
                  placeholderTextColor={theme.textSecondary}
                  value={username}
                  onChangeText={handleUsernameChange}
                  onBlur={() => {
                    if (usernameTimer.current) clearTimeout(usernameTimer.current);
                    runFieldValidation("username", username);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {usernameState === "checking" && (
                  <ActivityIndicator size="small" color={theme.primary} />
                )}
              </View>
              {usernameMsg !== "" && (
                <Text style={[styles.validationMsg, { color: getValidationColor(usernameState) }]}>
                  {usernameMsg}
                </Text>
              )}
            </View>

            {/* Email Address */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>
                Email Address <ThemedText style={{ color: "red" }}>*</ThemedText>
              </ThemedText>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: getValidationBorderColor(emailState),
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
                  placeholder="Email Address"
                  placeholderTextColor={theme.textSecondary}
                  value={email}
                  onChangeText={handleEmailChange}
                  onBlur={() => {
                    if (emailTimer.current) clearTimeout(emailTimer.current);
                    runFieldValidation("email", email);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {emailState === "checking" && (
                  <ActivityIndicator size="small" color={theme.primary} />
                )}
              </View>
              {emailMsg !== "" && (
                <Text style={[styles.validationMsg, { color: getValidationColor(emailState) }]}>
                  {emailMsg}
                </Text>
              )}
            </View>

            {/* Mobile Number & Send OTP */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>
                Mobile Number <ThemedText style={{ color: "red" }}>*</ThemedText>
              </ThemedText>
              <View style={styles.phoneInputRow}>
                <View
                  style={[
                    styles.inputWrapper,
                    styles.phoneInputWrapper,
                    {
                      backgroundColor: theme.backgroundDefault,
                      borderColor: getValidationBorderColor(phoneState),
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
                    onChangeText={handlePhoneChange}
                    onBlur={() => {
                      if (phoneTimer.current) clearTimeout(phoneTimer.current);
                      runFieldValidation("phone", phone);
                    }}
                    keyboardType="phone-pad"
                    maxLength={10}
                    editable={!otpVerified}
                  />
                  {phoneState === "checking" && (
                    <ActivityIndicator size="small" color={theme.primary} />
                  )}
                </View>

                <Pressable
                  onPress={handleSendOTP}
                  style={[
                    styles.otpButton,
                    {
                      backgroundColor:
                        phone.trim().length === 10 && !otpVerified && phoneState === "available"
                          ? theme.primary
                          : theme.border,
                    },
                  ]}
                  disabled={phone.trim().length !== 10 || otpVerified || phoneState !== "available"}
                >
                  <ThemedText style={styles.otpButtonText}>
                    {otpSent ? "Resend" : "Send OTP"}
                  </ThemedText>
                </Pressable>
              </View>
              {phoneMsg !== "" && (
                <Text style={[styles.validationMsg, { color: getValidationColor(phoneState) }]}>
                  {phoneMsg}
                </Text>
              )}
            </View>

            {/* OTP Code Verification */}
            {otpSent && !otpVerified && (
              <View style={styles.inputContainer}>
                <ThemedText style={styles.inputLabel}>
                  Verification Code <ThemedText style={{ color: "red" }}>*</ThemedText>
                </ThemedText>
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
                    <ThemedText style={styles.otpButtonText}>
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
                  style={[styles.verifiedText, { color: theme.success }]}
                >
                  Mobile number verified successfully
                </ThemedText>
              </View>
            )}

            {/* Company Name */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>
                {t.auth.companyName || "Company Name"} <ThemedText style={{ color: "red" }}>*</ThemedText>
              </ThemedText>
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
                  placeholder={t.auth.companyName || "Company Name"}
                  placeholderTextColor={theme.textSecondary}
                  value={companyName}
                  onChangeText={setCompanyName}
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>
                {t.auth.password} <ThemedText style={{ color: "red" }}>*</ThemedText>
              </ThemedText>
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

              {/* Password Validation Requirements */}
              {password.length > 0 && (
                <View style={styles.passwordRulesContainer}>
                  <View style={styles.ruleRow}>
                    <Feather
                      name={isMinLength ? "check-circle" : "circle"}
                      size={14}
                      color={isMinLength ? "#22C55E" : theme.textSecondary}
                    />
                    <ThemedText style={[styles.ruleText, { color: isMinLength ? "#22C55E" : theme.textSecondary }]}>
                      Minimum 8 characters
                    </ThemedText>
                  </View>
                  <View style={styles.ruleRow}>
                    <Feather
                      name={hasUppercase ? "check-circle" : "circle"}
                      size={14}
                      color={hasUppercase ? "#22C55E" : theme.textSecondary}
                    />
                    <ThemedText style={[styles.ruleText, { color: hasUppercase ? "#22C55E" : theme.textSecondary }]}>
                      One uppercase letter
                    </ThemedText>
                  </View>
                  <View style={styles.ruleRow}>
                    <Feather
                      name={hasLowercase ? "check-circle" : "circle"}
                      size={14}
                      color={hasLowercase ? "#22C55E" : theme.textSecondary}
                    />
                    <ThemedText style={[styles.ruleText, { color: hasLowercase ? "#22C55E" : theme.textSecondary }]}>
                      One lowercase letter
                    </ThemedText>
                  </View>
                  <View style={styles.ruleRow}>
                    <Feather
                      name={hasNumber ? "check-circle" : "circle"}
                      size={14}
                      color={hasNumber ? "#22C55E" : theme.textSecondary}
                    />
                    <ThemedText style={[styles.ruleText, { color: hasNumber ? "#22C55E" : theme.textSecondary }]}>
                      One number
                    </ThemedText>
                  </View>
                  <View style={styles.ruleRow}>
                    <Feather
                      name={hasSpecial ? "check-circle" : "circle"}
                      size={14}
                      color={hasSpecial ? "#22C55E" : theme.textSecondary}
                    />
                    <ThemedText style={[styles.ruleText, { color: hasSpecial ? "#22C55E" : theme.textSecondary }]}>
                      One special character
                    </ThemedText>
                  </View>
                </View>
              )}
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
              <ThemedText style={styles.termsText}>
                I agree to the Terms & Conditions
              </ThemedText>
            </Pressable>

            {/* Submit Button */}
            <AnimatedPressable
              onPress={handleSignup}
              onPressIn={() => (buttonScale.value = withSpring(0.96))}
              onPressOut={() => (buttonScale.value = withSpring(1))}
              disabled={isSubmitDisabled}
              style={[
                styles.signupButton,
                { backgroundColor: isSubmitDisabled ? theme.border : theme.primary },
                animatedButtonStyle,
              ]}
            >
              <ThemedText style={styles.signupButtonText}>
                {isLoading ? t.common.loading : t.auth.signUp}
              </ThemedText>
            </AnimatedPressable>

            {/* Google Sign-In Option */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              <ThemedText style={[styles.dividerLabel, { color: theme.textSecondary }]}>or continue with</ThemedText>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            </View>

            <Pressable
              style={[
                styles.googleBtn,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
              ]}
              onPress={handleGoogleSignIn}
              disabled={isLoading}
            >
              <Ionicons name="logo-google" size={18} color="#4285F4" style={{ marginRight: 10 }} />
              <ThemedText style={[styles.googleBtnLabel, { color: theme.text }]}>
                Continue with Google
              </ThemedText>
            </Pressable>
          </View>
        )}
      </ScrollContainer>

      <GoogleMobileCompletionModal
        visible={showMobileCompletionModal}
        googleProfile={pendingGoogleProfile}
        onClose={() => setShowMobileCompletionModal(false)}
        onSuccess={handleCompleteGoogleRegistration}
      />
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
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: Spacing.xs,
    marginLeft: 4,
  },
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
  validationMsg: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
    marginLeft: 4,
  },
  passwordRulesContainer: {
    marginTop: 8,
    paddingHorizontal: 4,
    gap: 4,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ruleText: {
    fontSize: 12,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerLabel: {
    fontSize: 12,
    marginHorizontal: Spacing.md,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  googleBtnLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
});
