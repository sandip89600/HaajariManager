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
  Modal,
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
type UserRole = "contractor" | "labor" | "supervisor";

const WORKER_CATEGORIES = [
  {
    id: "labour",
    label: "Labour",
    hiLabel: "मजदूर (Labour)",
    icon: "👷‍♂️",
  },
  {
    id: "bai",
    label: "Bai",
    hiLabel: "महिला मजदूर (Bai)",
    icon: "👩",
  },
  {
    id: "mistri",
    label: "Mistri",
    hiLabel: "मिस्त्री / मास्टर (Mistri)",
    icon: "📐",
  },
  {
    id: "bandkam",
    label: "Bandkam",
    hiLabel: "बांधकाम मिस्त्री (Bandkam)",
    icon: "🧱",
  },
  {
    id: "plaster",
    label: "Plaster",
    hiLabel: "प्लास्टर कारीगर (Plaster)",
    icon: "🌫️",
  },
  {
    id: "tiles",
    label: "Tiles",
    hiLabel: "टाइल्स कारीगर (Tiles)",
    icon: "🔲",
  },
  {
    id: "sutar",
    label: "Sutar",
    hiLabel: "सुथार / कारपेंटर (Sutar)",
    icon: "🪚",
  },
];

export default function SignupScreen() {
  const { theme, isDark } = useTheme();
  const { signup, loginWithGoogle } = useAuth();
  const { t } = useLanguage();
  const navigation = useNavigation<SignupScreenNavigationProp>();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>(1);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contractorName, setContractorName] = useState("");
  const [contractorCompany, setContractorCompany] = useState("");
  const [workerCategory, setWorkerCategory] = useState("labour");
  const [customWorkerCategory, setCustomWorkerCategory] = useState("");
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Google completion modal state
  const [showMobileCompletionModal, setShowMobileCompletionModal] =
    useState(false);
  const [pendingGoogleProfile, setPendingGoogleProfile] = useState<any>(null);

  // Password validation criteria
  const isMinLength = password.length >= 6;
  const isPasswordMatching =
    password.length > 0 && password === confirmPassword;

  // Worker category selection helpers
  const selectedCategoryObj = WORKER_CATEGORIES.find(
    (c) => c.id === workerCategory,
  ) || {
    id: workerCategory,
    label: workerCategory,
    hiLabel: workerCategory,
    icon: "👷",
  };

  const filteredCategories = WORKER_CATEGORIES.filter((cat) => {
    if (!categorySearch.trim()) return true;
    const q = categorySearch.toLowerCase().trim();
    return (
      cat.label.toLowerCase().includes(q) ||
      cat.hiLabel.toLowerCase().includes(q) ||
      cat.id.toLowerCase().includes(q)
    );
  });

  // Validation States
  const [usernameState, setUsernameState] = useState<
    "idle" | "checking" | "available" | "error"
  >("idle");
  const [usernameMsg, setUsernameMsg] = useState("");

  const [emailState, setEmailState] = useState<
    "idle" | "checking" | "available" | "error"
  >("idle");
  const [emailMsg, setEmailMsg] = useState("");

  const [phoneState, setPhoneState] = useState<
    "idle" | "checking" | "available" | "error"
  >("idle");
  const [phoneMsg, setPhoneMsg] = useState("");

  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const runFieldValidation = async (
    field: "username" | "email" | "phone",
    val: string,
  ) => {
    const trimmed = val.trim();
    if (!trimmed) {
      if (field === "username") {
        setUsernameState("idle");
        setUsernameMsg("");
      }
      if (field === "email") {
        setEmailState("idle");
        setEmailMsg("");
      }
      if (field === "phone") {
        setPhoneState("idle");
        setPhoneMsg("");
      }
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
        setUsernameMsg(
          "Only letters, numbers, underscores, hyphens, and dots allowed.",
        );
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
          setUsernameMsg(data.message || "Username is already in use.");
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
        setUsernameState("idle");
        setUsernameMsg("");
      }
      if (field === "email") {
        setEmailState("idle");
        setEmailMsg("");
      }
      if (field === "phone") {
        setPhoneState("idle");
        setPhoneMsg("");
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
    if (phoneState !== "available" || phone.trim().length !== 10) {
      Alert.alert(
        "Error",
        phoneMsg || "Please enter a valid, unregistered 10-digit mobile number",
      );
      return;
    }

    setIsLoading(true);
    try {
      const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(mockOtp);
      setOtpSent(true);
      Alert.alert(
        "Verification Code",
        `Your verification code is: ${mockOtp}\n\n(SMS simulation)`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = () => {
    if (!otpCode.trim()) {
      Alert.alert("Error", "Please enter the verification code");
      return;
    }
    if (otpCode.trim() === generatedOtp || otpCode.trim() === "123456") {
      setOtpVerified(true);
      Alert.alert("Verified", "Mobile number verified successfully!");
    } else {
      Alert.alert("Error", "Invalid verification code. Please try again.");
    }
  };

  const selectRoleAndNext = (role: UserRole) => {
    setSelectedRole(role);
    setStep(2);
  };

  const handleSignup = async () => {
    if (isLoading) return;

    if (!name.trim()) {
      Alert.alert("Error", "Full Name is required.");
      return;
    }
    if (!username.trim()) {
      Alert.alert("Error", "Username is required.");
      return;
    }
    if (usernameState === "error") {
      Alert.alert("Error", usernameMsg || "Username is already in use.");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Error", "Mobile Number is required.");
      return;
    }
    if (phoneState === "error") {
      Alert.alert("Error", phoneMsg || "Mobile number is already registered.");
      return;
    }
    if (emailState === "error") {
      Alert.alert("Error", emailMsg || "Email is already registered.");
      return;
    }
    if (selectedRole === "contractor" && !companyName.trim()) {
      Alert.alert(
        "Error",
        "Company Name is required for Contractor registration.",
      );
      return;
    }
    if (!isMinLength) {
      Alert.alert("Error", "Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const finalWorkerCategory =
        workerCategory === "Other" && customWorkerCategory.trim()
          ? customWorkerCategory.trim()
          : workerCategory;

      const result = await signup(
        name.trim(),
        phone.trim(),
        password,
        selectedRole as UserRole,
        companyName.trim(),
        email.trim(),
        username.trim(),
        contractorName.trim(),
        contractorCompany.trim(),
        selectedRole === "labor" ? finalWorkerCategory : undefined,
        selectedRole === "labor" ? 0 : undefined,
      );

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const roleLabel =
          selectedRole === "contractor"
            ? "Contractor"
            : selectedRole === "supervisor"
              ? "Supervisor"
              : "Labour";

        Alert.alert(
          "Success",
          `${roleLabel} account created successfully! Welcome to Haajari Manager.`,
          [
            {
              text: "Get Started",
              onPress: () => {
                try {
                  navigation.navigate("Main");
                } catch (e) {}
              },
            },
          ],
        );
        if (Platform.OS === "web") {
          setTimeout(() => {
            try {
              navigation.navigate("Main");
            } catch (e) {}
          }, 500);
        }
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
        Alert.alert(
          "Registration Error",
          result.message || "Failed to create account.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getValidationColor = (
    state: "idle" | "checking" | "available" | "error",
  ) => {
    if (state === "error") return "#EF4444";
    if (state === "available") return "#22C55E";
    if (state === "checking") return "#F59E0B";
    return theme.textSecondary;
  };

  const getValidationBorderColor = (
    state: "idle" | "checking" | "available" | "error",
  ) => {
    if (state === "error") return "#EF4444";
    if (state === "available") return "#22C55E";
    if (state === "checking") return "#F59E0B";
    return theme.border;
  };

  const isSubmitDisabled =
    isLoading ||
    !name.trim() ||
    !username.trim() ||
    !phone.trim() ||
    !password ||
    password !== confirmPassword ||
    (selectedRole === "contractor" && !companyName.trim()) ||
    usernameState === "error" ||
    phoneState === "error" ||
    emailState === "error";

  const ScrollContainer =
    Platform.OS === "web" ? ScrollView : KeyboardAwareScrollView;

  return (
    <ThemedView style={styles.container}>
      <ScrollContainer
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header navigation & title */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (step === 2) {
                setStep(1);
              } else {
                navigation.goBack();
              }
            }}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>

          <ThemedText style={styles.title}>
            {step === 1
              ? t("auth.createAccount", "Create Your Account")
              : selectedRole === "contractor"
                ? t("auth.createContractorAccount", "Create Contractor Account")
                : selectedRole === "supervisor"
                  ? t(
                      "auth.createSupervisorAccount",
                      "Create Supervisor Account",
                    )
                  : t("auth.createLabourAccount", "Create Labour Account")}
          </ThemedText>

          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            {step === 1
              ? t("auth.selectRoleSubtitle", "Choose your account type:")
              : t(
                  "auth.fillDetailsSubtitle",
                  "Fill in your details below to set up your profile",
                )}
          </ThemedText>
        </View>

        {/* ── STEP 1: ROLE SELECTION ── */}
        {step === 1 ? (
          <View style={styles.stepContent}>
            {/* 1. CONTRACTOR CARD */}
            <Pressable
              onPress={() => selectRoleAndNext("contractor")}
              style={({ pressed }) => [
                styles.roleCard,
                {
                  backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                  borderColor: theme.border,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View style={styles.roleCardHeader}>
                <View
                  style={[styles.roleIconBadge, { backgroundColor: "#FFF7ED" }]}
                >
                  <ThemedText style={styles.roleEmoji}>👷</ThemedText>
                </View>
                <View style={styles.roleCardInfo}>
                  <ThemedText style={styles.roleTitle}>
                    {t("auth.contractorRole", "Contractor")}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.roleSubtitle,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {t(
                      "auth.contractorDesc",
                      "Manage workers, sites and supervisors",
                    )}
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={22} color="#F97316" />
              </View>
            </Pressable>

            {/* 2. LABOUR CARD */}
            <Pressable
              onPress={() => selectRoleAndNext("labor")}
              style={({ pressed }) => [
                styles.roleCard,
                {
                  backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                  borderColor: theme.border,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View style={styles.roleCardHeader}>
                <View
                  style={[styles.roleIconBadge, { backgroundColor: "#F0FDF4" }]}
                >
                  <ThemedText style={styles.roleEmoji}>🧑‍🔧</ThemedText>
                </View>
                <View style={styles.roleCardInfo}>
                  <ThemedText style={styles.roleTitle}>
                    {t("auth.workerRole", "Labour / Worker")}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.roleSubtitle,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {t(
                      "auth.workerDesc",
                      "Track attendance, wages & daily work",
                    )}
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={22} color="#10B981" />
              </View>
            </Pressable>

            {/* 3. SUPERVISOR CARD */}
            <Pressable
              onPress={() => selectRoleAndNext("supervisor")}
              style={({ pressed }) => [
                styles.roleCard,
                {
                  backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                  borderColor: theme.border,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View style={styles.roleCardHeader}>
                <View
                  style={[styles.roleIconBadge, { backgroundColor: "#EFF6FF" }]}
                >
                  <ThemedText style={styles.roleEmoji}>👨‍💼</ThemedText>
                </View>
                <View style={styles.roleCardInfo}>
                  <ThemedText style={styles.roleTitle}>
                    {t("auth.supervisorRole", "Supervisor")}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.roleSubtitle,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {t("auth.supervisorDesc", "Manage assigned site work")}
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={22} color="#3B82F6" />
              </View>
            </Pressable>

            {/* Existing User Login Prompt */}
            <View style={styles.loginPromptContainer}>
              <ThemedText style={{ color: theme.textSecondary, fontSize: 14 }}>
                {t("auth.alreadyHaveAccount", "Already have an account?")}{" "}
              </ThemedText>
              <Pressable onPress={() => navigation.navigate("Login")}>
                <ThemedText
                  style={{ color: "#F97316", fontWeight: "700", fontSize: 14 }}
                >
                  {t("auth.login", "Log In")}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : (
          /* ── STEP 2: ROLE-SPECIFIC REGISTRATION FORM ── */
          <View style={styles.stepContent}>
            {/* Section Header: PERSONAL INFORMATION */}
            <ThemedText style={styles.sectionHeaderTitle}>
              {t("auth.personalInfo", "PERSONAL INFORMATION")}
            </ThemedText>

            {/* Full Name */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>
                {t("auth.fullName", "Full Name")}{" "}
                <Text style={{ color: "red" }}>*</Text>
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
                  size={18}
                  color={theme.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder={t("auth.enterFullName", "Enter full name")}
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
                {t("auth.username", "Username")}{" "}
                <Text style={{ color: "red" }}>*</Text>
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
                  size={18}
                  color={theme.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder={t("auth.chooseUsername", "Choose username")}
                  placeholderTextColor={theme.textSecondary}
                  value={username}
                  onChangeText={handleUsernameChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {usernameState === "checking" && (
                  <ActivityIndicator size="small" color="#F97316" />
                )}
              </View>
              {usernameMsg !== "" && (
                <Text
                  style={[
                    styles.validationMsg,
                    { color: getValidationColor(usernameState) },
                  ]}
                >
                  {usernameMsg}
                </Text>
              )}
            </View>

            {/* Email */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>
                {t("auth.email", "Email")}
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
                  size={18}
                  color={theme.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder={t("auth.enterEmail", "Enter email")}
                  placeholderTextColor={theme.textSecondary}
                  value={email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {emailState === "checking" && (
                  <ActivityIndicator size="small" color="#F97316" />
                )}
              </View>
              {emailMsg !== "" && (
                <Text
                  style={[
                    styles.validationMsg,
                    { color: getValidationColor(emailState) },
                  ]}
                >
                  {emailMsg}
                </Text>
              )}
            </View>

            {/* Mobile Number & Optional OTP Verification */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>
                {t("auth.mobileNumber", "Mobile Number")}{" "}
                <Text style={{ color: "red" }}>*</Text>
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
                    size={18}
                    color={theme.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder={t(
                      "auth.enterMobileNumber",
                      "Enter mobile number",
                    )}
                    placeholderTextColor={theme.textSecondary}
                    value={phone}
                    onChangeText={handlePhoneChange}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                  {phoneState === "checking" && (
                    <ActivityIndicator size="small" color="#F97316" />
                  )}
                </View>

                <Pressable
                  onPress={handleSendOTP}
                  style={[
                    styles.otpButton,
                    {
                      backgroundColor:
                        phone.trim().length === 10 && !otpVerified
                          ? "#F97316"
                          : theme.border,
                    },
                  ]}
                  disabled={phone.trim().length !== 10 || otpVerified}
                >
                  <ThemedText style={styles.otpButtonText}>
                    {otpSent
                      ? t("auth.resendOtp", "Resend")
                      : t("auth.sendOtp", "Send OTP")}
                  </ThemedText>
                </Pressable>
              </View>
              {phoneMsg !== "" && (
                <Text
                  style={[
                    styles.validationMsg,
                    { color: getValidationColor(phoneState) },
                  ]}
                >
                  {phoneMsg}
                </Text>
              )}
            </View>

            {/* OTP Code Box */}
            {otpSent && !otpVerified && (
              <View style={styles.inputContainer}>
                <ThemedText style={styles.inputLabel}>
                  {t("auth.enterOtp", "OTP Code")}
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
                      size={18}
                      color={theme.textSecondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      placeholder={t("auth.enterOtpPlaceholder", "Enter OTP")}
                      placeholderTextColor={theme.textSecondary}
                      value={otpCode}
                      onChangeText={setOtpCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                  <Pressable
                    onPress={handleVerifyOTP}
                    style={[styles.otpButton, { backgroundColor: "#10B981" }]}
                  >
                    <ThemedText style={styles.otpButtonText}>
                      {t("auth.verifyOtp", "Verify")}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            )}

            {/* OTP Verified badge */}
            {otpVerified && (
              <View style={styles.verifiedContainer}>
                <Feather name="check-circle" size={16} color="#10B981" />
                <ThemedText style={[styles.verifiedText, { color: "#10B981" }]}>
                  {t("auth.mobileVerified", "Mobile number verified")}
                </ThemedText>
              </View>
            )}

            {/* ── ROLE SPECIFIC SECTIONS ── */}

            {/* CONTRACTOR SPECIFIC: COMPANY INFORMATION */}
            {selectedRole === "contractor" && (
              <>
                <ThemedText
                  style={[styles.sectionHeaderTitle, { marginTop: 12 }]}
                >
                  {t("auth.companyDetails", "COMPANY INFORMATION")}
                </ThemedText>
                <View style={styles.inputContainer}>
                  <ThemedText style={styles.inputLabel}>
                    {t("auth.companyName", "Company Name")}{" "}
                    <Text style={{ color: "red" }}>*</Text>
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
                      size={18}
                      color={theme.textSecondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      placeholder={t(
                        "auth.enterCompanyName",
                        "Enter company name",
                      )}
                      placeholderTextColor={theme.textSecondary}
                      value={companyName}
                      onChangeText={setCompanyName}
                      autoCorrect={false}
                    />
                  </View>
                </View>
              </>
            )}

            {/* SUPERVISOR SPECIFIC: CONTRACTOR INFORMATION */}
            {selectedRole === "supervisor" && (
              <>
                <ThemedText
                  style={[styles.sectionHeaderTitle, { marginTop: 12 }]}
                >
                  {t("auth.contractorDetails", "CONTRACTOR INFORMATION")}
                </ThemedText>

                <View style={styles.inputContainer}>
                  <ThemedText style={styles.inputLabel}>
                    {t("auth.contractorName", "Contractor Name")}
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
                      name="user-check"
                      size={18}
                      color={theme.textSecondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      placeholder={t(
                        "auth.enterContractorName",
                        "Enter contractor name (optional)",
                      )}
                      placeholderTextColor={theme.textSecondary}
                      value={contractorName}
                      onChangeText={setContractorName}
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <ThemedText style={styles.inputLabel}>
                    {t("auth.contractorCompany", "Contractor Company")}
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
                      size={18}
                      color={theme.textSecondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      placeholder={t(
                        "auth.enterContractorCompany",
                        "Enter contractor company (optional)",
                      )}
                      placeholderTextColor={theme.textSecondary}
                      value={contractorCompany}
                      onChangeText={setContractorCompany}
                      autoCorrect={false}
                    />
                  </View>
                </View>
              </>
            )}

            {/* WORKER / LABOUR SPECIFIC FIELDS */}
            {selectedRole === "labor" && (
              <>
                <ThemedText
                  style={[styles.sectionHeaderTitle, { marginTop: 12 }]}
                >
                  {t(
                    "auth.workerTradeDetails",
                    "WORKER DETAILS & TRADE (काम का प्रकार)",
                  )}
                </ThemedText>

                {/* Worker Category / Trade Dropdown Trigger */}
                <View style={styles.inputContainer}>
                  <ThemedText style={styles.inputLabel}>
                    {t(
                      "auth.selectTrade",
                      "Select Trade / Category (कारीगरी / काम का प्रकार)",
                    )}{" "}
                    <Text style={{ color: "red" }}>*</Text>
                  </ThemedText>

                  <Pressable
                    onPress={() => {
                      setShowCategoryModal(true);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[
                      styles.categoryDropdownTrigger,
                      {
                        backgroundColor: theme.backgroundDefault,
                        borderColor: showCategoryModal
                          ? "#10B981"
                          : theme.border,
                      },
                    ]}
                  >
                    <View style={styles.categoryDropdownLeft}>
                      <View
                        style={[
                          styles.categoryIconCircle,
                          { backgroundColor: isDark ? "#064E3B" : "#ECFDF5" },
                        ]}
                      >
                        <Text style={{ fontSize: 20 }}>
                          {selectedCategoryObj.icon}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.categoryDropdownTitle}>
                          {selectedCategoryObj.label}
                        </ThemedText>
                        <ThemedText
                          style={[
                            styles.categoryDropdownSubtitle,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {selectedCategoryObj.hiLabel}
                        </ThemedText>
                      </View>
                    </View>
                    <Feather
                      name="chevron-down"
                      size={20}
                      color={theme.textSecondary}
                    />
                  </Pressable>
                </View>

                {/* Trade / Category Dropdown Picker Modal */}
                <Modal
                  visible={showCategoryModal}
                  animationType="slide"
                  transparent={true}
                  onRequestClose={() => {
                    setShowCategoryModal(false);
                    setCategorySearch("");
                  }}
                >
                  <View style={styles.categoryModalOverlay}>
                    <Pressable
                      style={StyleSheet.absoluteFill}
                      onPress={() => {
                        setShowCategoryModal(false);
                        setCategorySearch("");
                      }}
                    />
                    <View
                      style={[
                        styles.categoryModalContainer,
                        {
                          backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      {/* Modal Header */}
                      <View style={styles.categoryModalHeader}>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.categoryModalTitle}>
                            {t("auth.selectTrade", "Select Category / Trade")}
                          </ThemedText>
                          <ThemedText
                            style={[
                              styles.categoryModalSubtitle,
                              { color: theme.textSecondary },
                            ]}
                          >
                            कारीगरी / काम का प्रकार चुनें
                          </ThemedText>
                        </View>
                        <Pressable
                          onPress={() => {
                            setShowCategoryModal(false);
                            setCategorySearch("");
                          }}
                          style={styles.categoryModalCloseBtn}
                        >
                          <Feather name="x" size={22} color={theme.text} />
                        </Pressable>
                      </View>

                      {/* Search Bar */}
                      <View
                        style={[
                          styles.categorySearchWrapper,
                          {
                            backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                            borderColor: theme.border,
                          },
                        ]}
                      >
                        <Feather
                          name="search"
                          size={18}
                          color={theme.textSecondary}
                          style={{ marginRight: 8 }}
                        />
                        <TextInput
                          style={[
                            styles.categorySearchInput,
                            { color: theme.text },
                          ]}
                          placeholder={t(
                            "auth.searchTradePlaceholder",
                            "Search trade / कारीगरी खोजें...",
                          )}
                          placeholderTextColor={theme.textSecondary}
                          value={categorySearch}
                          onChangeText={setCategorySearch}
                          autoCorrect={false}
                          autoCapitalize="none"
                        />
                        {categorySearch.length > 0 && (
                          <Pressable onPress={() => setCategorySearch("")}>
                            <Feather
                              name="x-circle"
                              size={18}
                              color={theme.textSecondary}
                            />
                          </Pressable>
                        )}
                      </View>

                      {/* Trade Options Scrollable List */}
                      <ScrollView
                        style={{ maxHeight: 380 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                      >
                        {filteredCategories.map((cat) => {
                          const isSelected = workerCategory === cat.id;
                          return (
                            <Pressable
                              key={cat.id}
                              onPress={() => {
                                setWorkerCategory(cat.id);
                                setShowCategoryModal(false);
                                setCategorySearch("");
                                Haptics.impactAsync(
                                  Haptics.ImpactFeedbackStyle.Light,
                                );
                              }}
                              style={[
                                styles.categoryOptionItem,
                                {
                                  backgroundColor: isSelected
                                    ? isDark
                                      ? "#064E3B"
                                      : "#ECFDF5"
                                    : "transparent",
                                  borderColor: isSelected
                                    ? "#10B981"
                                    : "transparent",
                                },
                              ]}
                            >
                              <Text style={{ fontSize: 24, marginRight: 12 }}>
                                {cat.icon}
                              </Text>
                              <View style={{ flex: 1 }}>
                                <ThemedText
                                  style={{
                                    fontSize: 15,
                                    fontWeight: isSelected ? "700" : "600",
                                    color: isSelected ? "#059669" : theme.text,
                                  }}
                                >
                                  {cat.label}
                                </ThemedText>
                                <ThemedText
                                  style={{
                                    fontSize: 12.5,
                                    color: isSelected
                                      ? "#10B981"
                                      : theme.textSecondary,
                                    marginTop: 2,
                                  }}
                                >
                                  {cat.hiLabel}
                                </ThemedText>
                              </View>
                              {isSelected && (
                                <Ionicons
                                  name="checkmark-circle"
                                  size={22}
                                  color="#10B981"
                                />
                              )}
                            </Pressable>
                          );
                        })}
                        {filteredCategories.length === 0 && (
                          <View
                            style={{
                              paddingVertical: 24,
                              alignItems: "center",
                            }}
                          >
                            <ThemedText
                              style={{
                                color: theme.textSecondary,
                                fontSize: 14,
                              }}
                            >
                              No category matching "{categorySearch}" found.
                            </ThemedText>
                          </View>
                        )}
                      </ScrollView>
                    </View>
                  </View>
                </Modal>

                {/* Custom Category Input if "Other" selected */}
                {workerCategory === "Other" && (
                  <View style={styles.inputContainer}>
                    <ThemedText style={styles.inputLabel}>
                      {t(
                        "auth.customTradePrompt",
                        "Specify Custom Trade / Skill (काम का नाम लिखें)",
                      )}{" "}
                      <Text style={{ color: "red" }}>*</Text>
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
                        name="edit-3"
                        size={18}
                        color={theme.textSecondary}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={[styles.input, { color: theme.text }]}
                        placeholder="उदा. बोरवेल ऑपरेटर, ग्लास फिटर, आदि"
                        placeholderTextColor={theme.textSecondary}
                        value={customWorkerCategory}
                        onChangeText={setCustomWorkerCategory}
                        autoCorrect={false}
                      />
                    </View>
                  </View>
                )}

                <View style={styles.laborInfoCard}>
                  <Feather name="info" size={16} color="#10B981" />
                  <ThemedText
                    style={{
                      color: theme.textSecondary,
                      fontSize: 12.5,
                      flex: 1,
                      marginLeft: 8,
                    }}
                  >
                    {t(
                      "auth.uniqueIdInfo",
                      "A permanent Unique ID (HM-W-XXXXXX) will be generated for your worker account.",
                    )}
                  </ThemedText>
                </View>
              </>
            )}

            {/* ── PASSWORD SECTION ── */}
            <ThemedText style={[styles.sectionHeaderTitle, { marginTop: 12 }]}>
              {t("auth.password", "PASSWORD")}
            </ThemedText>

            {/* Password */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>
                {t("auth.password", "Password")}{" "}
                <Text style={{ color: "red" }}>*</Text>
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
                  size={18}
                  color={theme.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder={t(
                    "auth.newPasswordPlaceholder",
                    "Create password",
                  )}
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
                    size={18}
                    color={theme.textSecondary}
                  />
                </Pressable>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>
                {t("auth.confirmPassword", "Confirm Password")}{" "}
                <Text style={{ color: "red" }}>*</Text>
              </ThemedText>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor:
                      confirmPassword.length > 0
                        ? isPasswordMatching
                          ? "#22C55E"
                          : "#EF4444"
                        : theme.border,
                  },
                ]}
              >
                <Feather
                  name="lock"
                  size={18}
                  color={theme.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder={t(
                    "auth.confirmPasswordPlaceholder",
                    "Confirm password",
                  )}
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
                    size={18}
                    color={theme.textSecondary}
                  />
                </Pressable>
              </View>
              {confirmPassword.length > 0 && !isPasswordMatching && (
                <Text style={[styles.validationMsg, { color: "#EF4444" }]}>
                  {t("auth.passwordsDoNotMatch", "Passwords do not match")}
                </Text>
              )}
            </View>

            {/* Primary Action Button */}
            <AnimatedPressable
              onPress={handleSignup}
              onPressIn={() => (buttonScale.value = withSpring(0.96))}
              onPressOut={() => (buttonScale.value = withSpring(1))}
              disabled={isSubmitDisabled}
              style={[
                styles.signupButton,
                {
                  backgroundColor: isSubmitDisabled ? theme.border : "#F97316",
                },
                animatedButtonStyle,
              ]}
            >
              <ThemedText style={styles.signupButtonText}>
                {isLoading
                  ? t("auth.creatingAccount", "Creating Account...")
                  : selectedRole === "contractor"
                    ? t(
                        "auth.createContractorAccount",
                        "Create Contractor Account",
                      )
                    : selectedRole === "supervisor"
                      ? t(
                          "auth.createSupervisorAccount",
                          "Create Supervisor Account",
                        )
                      : t("auth.createLabourAccount", "Create Labour Account")}
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
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  stepContent: {
    flex: 1,
  },
  roleCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  roleCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  roleIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  roleEmoji: {
    fontSize: 24,
  },
  roleCardInfo: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 2,
  },
  roleSubtitle: {
    fontSize: 13,
  },
  loginPromptContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#F97316",
    letterSpacing: 1,
    marginBottom: 12,
  },
  inputContainer: { marginBottom: 14 },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 15,
    height: "100%",
  },
  eyeButton: { padding: 4 },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  phoneInputWrapper: {
    flex: 1,
  },
  otpButton: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  otpButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  verifiedContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  verifiedText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: "600",
  },
  laborInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  signupButton: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  signupButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  validationMsg: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
    marginLeft: 4,
  },
  categoryDropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    minHeight: 56,
  },
  categoryDropdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  categoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  categoryDropdownTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  categoryDropdownSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  categoryModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  categoryModalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    maxHeight: "80%",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  categoryModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  categoryModalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  categoryModalSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  categoryModalCloseBtn: {
    padding: 6,
    borderRadius: 20,
  },
  categorySearchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  categorySearchInput: {
    flex: 1,
    fontSize: 14,
    height: "100%",
  },
  categoryOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
});
