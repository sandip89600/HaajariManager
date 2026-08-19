import React, { useState, useEffect, useRef } from "react";
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
  withTiming,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

import { ThemedText } from "@/components/ThemedText";
import { AppInfoModal } from "@/components/AppInfoModal";
import GoogleMobileCompletionModal from "@/components/GoogleMobileCompletionModal";
import { promptGoogleSignIn } from "@/utils/googleAuth";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { storage, API_URL } from "@/utils/storage";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootNavigatorParamList } from "@/navigation/RootNavigator";
import { designSystem } from "@/constants/designSystem";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type LoginScreenNavigationProp = NativeStackNavigationProp<
  RootNavigatorParamList,
  "Login"
>;

// Focus-aware input wrapper
const AnimatedInput = ({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  theme,
  isDark,
  hasError,
  rightIcon,
  onRightIconPress,
  maxLength,
}: any) => {
  const isFocused = useSharedValue(0);
  const [internalFocus, setInternalFocus] = useState(false);

  const animatedStyle = useAnimatedStyle(() => {
    const borderColor = hasError
      ? theme.error
      : isFocused.value
      ? theme.primary
      : isDark
      ? "rgba(255, 255, 255, 0.1)"
      : "rgba(0, 0, 0, 0.1)";

    return {
      borderColor: withTiming(borderColor, { duration: 200 }),
      borderWidth: 1.5,
      shadowColor: hasError ? theme.error : theme.primary,
      shadowOpacity: withTiming(isFocused.value ? 0.15 : 0),
      shadowRadius: withTiming(isFocused.value ? 8 : 0),
      shadowOffset: { width: 0, height: 0 },
    };
  });

  return (
    <Animated.View style={[styles.inputWrapper, { backgroundColor: isDark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.7)" }, animatedStyle]}>
      <Feather
        name={icon}
        size={20}
        color={hasError ? theme.error : internalFocus ? theme.primary : theme.textSecondary}
        style={styles.inputIcon}
      />
      <TextInput
        style={[styles.input, { color: theme.text }]}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        onFocus={() => {
          isFocused.value = 1;
          setInternalFocus(true);
        }}
        onBlur={() => {
          isFocused.value = 0;
          setInternalFocus(false);
        }}
        autoCorrect={false}
      />
      {rightIcon && (
        <Pressable onPress={onRightIconPress} style={styles.eyeButton} hitSlop={10}>
          <Feather name={rightIcon} size={20} color={theme.textSecondary} />
        </Pressable>
      )}
    </Animated.View>
  );
};

export default function LoginScreen() {
  const navigationProp = useNavigation<LoginScreenNavigationProp>();
  const themeContext = useTheme();
  const theme = themeContext.theme;
  const isDark = themeContext.isDark ?? false;
  
  const { login, loginAsGuest, loginWithBiometrics, loginWithGoogle } = useAuth();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loginMode, setLoginMode] = useState<"password" | "otp">("password");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAppInfo, setShowAppInfo] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState("Biometric Login");
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Google completion modal state
  const [showMobileCompletionModal, setShowMobileCompletionModal] = useState(false);
  const [pendingGoogleProfile, setPendingGoogleProfile] = useState<any>(null);

  // OTP Refs for 6 boxes
  const otpRefs = useRef<Array<TextInput | null>>([]);
  const [otpArray, setOtpArray] = useState(["", "", "", "", "", ""]);

  const buttonScale = useSharedValue(1);
  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleLoadingText, setGoogleLoadingText] = useState("");

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setGoogleLoadingText("Connecting to Google...");
    setError(null);
    try {
      const googleRes = await promptGoogleSignIn();
      if (googleRes.type === "cancel") {
        setIsGoogleLoading(false);
        setGoogleLoadingText("");
        return;
      }
      if (googleRes.type === "error") {
        setIsGoogleLoading(false);
        setGoogleLoadingText("");
        setError(googleRes.error || "Unable to connect to Google.");
        return;
      }

      setGoogleLoadingText("Setting up your Haajari account...");
      const res = await loginWithGoogle(googleRes.idToken, googleRes.accessToken);
      setIsGoogleLoading(false);
      setGoogleLoadingText("");

      if (res.requiresMobileCompletion) {
        setPendingGoogleProfile({
          ...res.googleProfile,
          idToken: googleRes.idToken,
          accessToken: googleRes.accessToken,
        });
        setShowMobileCompletionModal(true);
      } else if (!res.success) {
        setError(res.message || "Google Sign-In failed. Please try again.");
      }
    } catch (err: any) {
      setIsGoogleLoading(false);
      setGoogleLoadingText("");
      setError("Unable to sign in with Google right now.");
    }
  };

  const handleCompleteGoogleRegistration = async (phoneStr: string) => {
    if (!pendingGoogleProfile) return;
    const res = await loginWithGoogle(
      pendingGoogleProfile.idToken,
      pendingGoogleProfile.accessToken,
      phoneStr,
      undefined,
      pendingGoogleProfile.name,
      undefined,
      "contractor",
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

  const checkBiometricAvailability = async () => {
    if (Platform.OS === "web") return;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) return;

      const token = await SecureStore.getItemAsync("biometric_token");
      const savedPhone = await SecureStore.getItemAsync("biometric_phone");
      const savedCreds = await storage.getBiometricCredentials();

      if ((token && savedPhone) || savedCreds) {
        setHasBiometric(true);
        if (savedPhone) {
          setPhone(savedPhone);
        } else if (savedCreds) {
          setPhone(savedCreds.email);
        }

        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricLabel("Face ID");
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricLabel("Fingerprint");
        }
      }
    } catch {}
  };

  const handleBiometricLogin = async () => {
    if (Platform.OS === "web") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const token = await SecureStore.getItemAsync("biometric_token");
      const savedPhone = await SecureStore.getItemAsync("biometric_phone");
      const savedCreds = await storage.getBiometricCredentials();

      if (!token && !savedCreds) {
        Alert.alert(
          t.common?.error || "Error",
          "No saved biometric credentials. Please log in using your password first and enable Biometric Login in Settings."
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Sign in with Biometrics",
        fallbackLabel: "Use Password",
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsLoading(true);
        setError(null);
        let loginSuccess = false;
        
        if (savedCreds) {
          loginSuccess = await login(savedCreds.email, savedCreds.password);
        } else if (token && savedPhone) {
          loginSuccess = await loginWithBiometrics(savedPhone, token);
        }

        if (loginSuccess) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          try { navigationProp.replace("Main"); } catch (e) {}
        } else {
          setError("Biometric login failed. Please enter password.");
        }
      }
    } catch (err: any) {
      setError(err?.message || "Biometric Authentication failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // OTP Countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpCountdown > 0) {
      interval = setInterval(() => {
        setOtpCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpCountdown]);

  const handleSendOtp = async () => {
    if (!phone) {
      setError("Please enter a valid mobile number or username.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      let data: any = null;
      let isJson = false;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        try {
          data = await response.json();
          isJson = true;
        } catch {}
      }

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("This mobile number is not registered.");
        }
        throw new Error(isJson && data?.error ? data.error : "Failed to send OTP");
      }

      setShowOtpVerification(true);
      setOtpCountdown(60);
      Alert.alert("OTP Sent", "A verification code was sent to your registered mobile number");
    } catch (err: any) {
      setError(err.message || "Something went wrong sending OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const fullOtp = otpArray.join("");
    if (fullOtp.length < 6) {
      setError("Please enter full 6-digit verification code.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const success = await login(phone, "", fullOtp);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        try { navigationProp.replace("Main"); } catch (e) {}
      } else {
        setError("Invalid verification code.");
      }
    } catch (err: any) {
      setError(err.message || "Failed verifying verification code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (!phone || !password) {
      setError("Please fill in all credentials.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const success = await login(phone, password);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        if (rememberMe) {
          await SecureStore.setItemAsync("biometric_phone", phone);
        }

        try { navigationProp.replace("Main"); } catch (e) {}
      } else {
        setError("Invalid credentials.");
      }
    } catch (err: any) {
      const msg = err.message || "Invalid credentials.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpBoxChange = (text: string, index: number) => {
    const newOtpArray = [...otpArray];
    newOtpArray[index] = text;
    setOtpArray(newOtpArray);

    if (text !== "" && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && otpArray[index] === "" && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.container}>
      {/* Dynamic Linear Background gradient */}
      <LinearGradient
        colors={isDark ? ["#0F172A", "#1E293B"] : ["#F8FAFC", "#EFF6FF"]}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Hero Logo */}
        <Animated.View entering={FadeInUp.duration(600).springify()} style={styles.heroSection}>
          <LinearGradient colors={["#F97316", "#EA580C"]} style={styles.logoBadge}>
            <Feather name="shield" size={32} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText style={[styles.appName, { color: theme.text }]}>Haajari Manager</ThemedText>
          <ThemedText style={[styles.tagline, { color: theme.textSecondary }]}>Advance Haajari Mangament</ThemedText>
        </Animated.View>

        {/* glassmorphism Card container */}
        <Animated.View entering={FadeInDown.duration(800).springify()} style={[styles.formCard, { backgroundColor: isDark ? "rgba(30, 41, 59, 0.7)" : "#FFFFFF", borderColor: theme.border }]}>
          <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
            {showOtpVerification ? "Verify Code" : "Sign In"}
          </ThemedText>
          <ThemedText style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
            {showOtpVerification ? `Verification code sent to ${phone}` : "Enter credentials below to enter portal"}
          </ThemedText>

          {error && (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={16} color="#EF4444" />
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          )}

          {!showOtpVerification ? (
            <>
              {/* Fields inputs */}
              <AnimatedInput
                icon="phone"
                placeholder="Mobile number or username"
                value={phone}
                onChangeText={(t: string) => { setPhone(t); setError(null); }}
                keyboardType="default"
                autoCapitalize="none"
                theme={theme}
                isDark={isDark}
                hasError={!!error && !phone}
              />

              {loginMode === "password" ? (
                <View style={{ marginTop: 12 }}>
                  <AnimatedInput
                    icon="lock"
                    placeholder="Enter password"
                    value={password}
                    onChangeText={(t: string) => { setPassword(t); setError(null); }}
                    secureTextEntry={!showPassword}
                    rightIcon={showPassword ? "eye-off" : "eye"}
                    onRightIconPress={() => setShowPassword(!showPassword)}
                    theme={theme}
                    isDark={isDark}
                    hasError={!!error && !password}
                  />
                  
                  {/* Remember me & Forgot Password row */}
                  <View style={styles.optionsRow}>
                    <Pressable
                      style={styles.checkboxRow}
                      onPress={() => setRememberMe(!rememberMe)}
                    >
                      <Feather
                        name={rememberMe ? "check-square" : "square"}
                        size={18}
                        color={rememberMe ? theme.primary : theme.textSecondary}
                      />
                      <ThemedText style={[styles.optionsLabel, { color: theme.textSecondary, marginLeft: 8 }]}>
                        Remember me
                      </ThemedText>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        triggerHaptic();
                        navigationProp.navigate("ForgotPassword" as any);
                      }}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <ThemedText style={{ color: theme.primary, fontSize: 13, fontWeight: "600" }}>
                        Forgot Password?
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {/* Action Buttons */}
              <AnimatedPressable
                style={[styles.primaryBtn, { shadowColor: theme.primary }, animatedButtonStyle]}
                onPress={() => {
                  triggerHaptic();
                  if (loginMode === "password") handlePasswordLogin();
                  else handleSendOtp();
                }}
                disabled={isLoading}
              >
                <LinearGradient colors={["#F97316", "#EA580C"]} style={styles.btnGradient}>
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <ThemedText style={styles.btnLabel}>
                        {loginMode === "password" ? "Secure Login" : "Send OTP code"}
                      </ThemedText>
                      <Feather name="arrow-right" size={16} color="#FFFFFF" style={{ marginLeft: 8 }} />
                    </>
                  )}
                </LinearGradient>
              </AnimatedPressable>
            </>
          ) : (
            <>
              {/* OTP Code inputs */}
              <View style={styles.otpContainer}>
                {otpArray.map((digit, idx) => (
                  <TextInput
                    key={idx}
                    ref={(ref) => { otpRefs.current[idx] = ref; }}
                    style={[styles.otpBox, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.02)" }]}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={digit}
                    onChangeText={(t) => handleOtpBoxChange(t, idx)}
                    onKeyPress={(e) => handleOtpKeyPress(e, idx)}
                  />
                ))}
              </View>

              <View style={styles.otpActions}>
                <Pressable
                  disabled={otpCountdown > 0}
                  onPress={handleSendOtp}
                >
                  <ThemedText style={{ color: otpCountdown > 0 ? theme.textSecondary : theme.primary, fontSize: 13, fontWeight: "600" }}>
                    {otpCountdown > 0 ? `Resend in ${otpCountdown}s` : "Resend code"}
                  </ThemedText>
                </Pressable>
              </View>

              <AnimatedPressable
                style={[styles.primaryBtn, { shadowColor: theme.primary }, animatedButtonStyle]}
                onPress={() => { triggerHaptic(); handleVerifyOtp(); }}
                disabled={isLoading}
              >
                <LinearGradient colors={["#F97316", "#EA580C"]} style={styles.btnGradient}>
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedText style={styles.btnLabel}>Verify & Continue</ThemedText>
                  )}
                </LinearGradient>
              </AnimatedPressable>
            </>
          )}

          {/* Alternative methods */}
          {!showOtpVerification && (
            <>
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
                <ThemedText style={[styles.dividerLabel, { color: theme.textSecondary }]}>or continue with</ThemedText>
                <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              </View>

              <Pressable
                style={[
                  styles.googleBtn,
                  {
                    backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#FFFFFF",
                    borderColor: theme.border,
                  },
                ]}
                onPress={handleGoogleSignIn}
                disabled={isLoading || isGoogleLoading}
              >
                {isGoogleLoading ? (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <ActivityIndicator size="small" color="#4285F4" style={{ marginRight: 8 }} />
                    <ThemedText style={[styles.googleBtnLabel, { color: theme.text }]}>
                      {googleLoadingText || "Connecting to Google..."}
                    </ThemedText>
                  </View>
                ) : (
                  <>
                    <Ionicons name="logo-google" size={18} color="#4285F4" style={{ marginRight: 10 }} />
                    <ThemedText style={[styles.googleBtnLabel, { color: theme.text }]}>
                      Continue with Google
                    </ThemedText>
                  </>
                )}
              </Pressable>

              <View style={styles.altAuthRow}>
                <Pressable
                  style={[styles.altBtn, { borderColor: theme.border }]}
                  onPress={() => setLoginMode(loginMode === "password" ? "otp" : "password")}
                >
                  <Feather name={loginMode === "password" ? "mail" : "lock"} size={16} color={theme.text} />
                  <ThemedText style={[styles.altBtnLabel, { color: theme.text, marginLeft: 8 }]}>
                    {loginMode === "password" ? "Use OTP Login" : "Use Password"}
                  </ThemedText>
                </Pressable>

                {hasBiometric && (
                  <Pressable
                    style={[styles.altBtn, { borderColor: theme.border }]}
                    onPress={handleBiometricLogin}
                  >
                    <MaterialCommunityIcons name="fingerprint" size={20} color={theme.text} />
                    <ThemedText style={[styles.altBtnLabel, { color: theme.text, marginLeft: 8 }]}>
                      {biometricLabel}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </>
          )}
        </Animated.View>

        {/* Bottom links */}
        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.bottomNavRow}>
          <Pressable onPress={() => navigationProp.push("Signup" as any)} style={{ paddingVertical: 4 }}>
            <ThemedText style={{ color: theme.textSecondary, fontSize: 14 }}>
              Don't have an account? <ThemedText style={{ color: theme.primary, fontWeight: "700" }}>Register Here</ThemedText>
            </ThemedText>
          </Pressable>
        </Animated.View>
      </KeyboardAwareScrollView>

      <GoogleMobileCompletionModal
        visible={showMobileCompletionModal}
        googleProfile={pendingGoogleProfile}
        onClose={() => setShowMobileCompletionModal(false)}
        onSuccess={handleCompleteGoogleRegistration}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 },
  
  // Hero section
  heroSection: { alignItems: "center", marginBottom: 32 },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F97316",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 16,
  },
  appName: { fontSize: 24, fontWeight: "800", letterSpacing: 0.5 },
  tagline: { fontSize: 13, marginTop: 4 },

  // Card form
  formCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 4,
  },
  cardTitle: { fontSize: 18, fontWeight: "800" },
  cardSubtitle: { fontSize: 13, marginTop: 4, marginBottom: 20 },

  // Inputs
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15, height: "100%" },
  eyeButton: { padding: 4 },

  // Options
  optionsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, marginBottom: 16 },
  checkboxRow: { flexDirection: "row", alignItems: "center" },
  optionsLabel: { fontSize: 13 },

  // Buttons
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  btnLabel: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },

  // Divider
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 20 },
  dividerLine: { flex: 1, height: 1 },
  dividerLabel: { marginHorizontal: 12, fontSize: 12, textTransform: "lowercase" },

  // Alt auth
  altAuthRow: { flexDirection: "row", gap: 10 },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  googleBtnLabel: { fontSize: 14, fontWeight: "600" },
  altBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
  },
  altBtnLabel: { fontSize: 13, fontWeight: "600" },

  // OTP Verification boxes
  otpContainer: { flexDirection: "row", justifyContent: "space-between", marginVertical: 16 },
  otpBox: {
    width: 42,
    height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
  },
  otpActions: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 20 },

  // Bottom navigation links
  bottomNavRow: { alignItems: "center", marginTop: 32, gap: 16 },
  adminBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },

  // Error notifications
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: { color: "#FCA5A5", fontSize: 13, fontWeight: "600", marginLeft: 8, flex: 1 },
});
