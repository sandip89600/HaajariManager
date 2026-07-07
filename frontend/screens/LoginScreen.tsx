import React, { useState, useEffect } from "react";
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
import * as LocalAuthentication from "expo-local-authentication";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { AppInfoModal } from "@/components/AppInfoModal";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { Language, languageNames } from "@/constants/i18n";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { storage, API_URL } from "@/utils/storage";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootNavigatorParamList } from "@/navigation/RootNavigator";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type LoginScreenNavigationProp = NativeStackNavigationProp<
  RootNavigatorParamList,
  "Login"
>;

export default function LoginScreen() {
  const navigationProp = useNavigation<LoginScreenNavigationProp>();
  const { theme } = useTheme();
  const { login, loginAsGuest, loginWithBiometrics } = useAuth();
  const { t, language, setLanguage } = useLanguage();
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

  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

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

        const types =
          await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (
          types.includes(
            LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
          )
        ) {
          setBiometricLabel("Face ID Login");
        } else if (
          types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
        ) {
          setBiometricLabel("Fingerprint Login");
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
          t.common.error,
          "No saved biometric credentials. Please log in using your password first and enable Biometric Login in Settings.",
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Login to Haajari",
        cancelLabel: t.common.cancel,
        fallbackLabel: "Use Password",
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsLoading(true);
        try {
          if (token && savedPhone) {
            const success = await loginWithBiometrics(
              savedPhone,
              token,
              rememberMe,
            );
            if (!success) {
              Alert.alert(
                t.common.error,
                "Biometric authentication failed on server.",
              );
            }
          } else if (savedCreds) {
            const success = await login(
              savedCreds.email,
              savedCreds.password,
              undefined,
              rememberMe,
            );
            if (!success) {
              Alert.alert(t.common.error, t.auth.invalidCredentials);
            }
          }
        } finally {
          setIsLoading(false);
        }
      }
    } catch {
      Alert.alert(t.common.error, "Biometric authentication failed.");
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (otpCountdown > 0) {
      timer = setTimeout(() => {
        setOtpCountdown(otpCountdown - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [otpCountdown]);

  const handleResendOtp = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (res.ok) {
        setOtpCountdown(300);
        Alert.alert("Success", "A new OTP verification code has been sent.");
      } else {
        const data = await res.json();
        Alert.alert("Error", data.error || "Failed to resend OTP.");
      }
    } catch {
      Alert.alert("Error", "Could not connect to the server.");
    }
  };

  const handleLogin = async () => {
    setError(null);

    if (!phone.trim()) {
      setError("Please enter your email, username or mobile number");
      return;
    }

    const trimmedPhone = phone.trim();
    const isAdminUsername = trimmedPhone === "haajari896" || trimmedPhone.toLowerCase() === "admin";
    const isEmail = trimmedPhone.includes("@");
    const isPhone = /^\d{10}$/.test(trimmedPhone);
    const isUsername = trimmedPhone.length >= 3;

    if (!isAdminUsername && !isEmail && !isPhone && !isUsername) {
      setError("Please enter a valid email, username or mobile number");
      return;
    }

    if (!showOtpVerification && loginMode === "password" && !password.trim()) {
      setError("Please enter your password");
      return;
    }

    if ((showOtpVerification || loginMode === "otp") && !otp.trim()) {
      setError("Please enter the OTP verification code");
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(
        phone,
        !showOtpVerification && loginMode === "password" ? password : undefined,
        showOtpVerification || loginMode === "otp" ? otp : undefined,
        rememberMe,
      );

      if (result && result.requiresOtp) {
        setShowOtpVerification(true);
        setOtpCountdown(300);
        setError(null);
        Alert.alert(
          "Verification Required",
          "An OTP verification code has been sent to your registered mobile number.",
        );
      } else if (result === true) {
        if (
          rememberMe &&
          !showOtpVerification &&
          loginMode === "password" &&
          Platform.OS !== "web"
        ) {
          await storage.saveBiometricCredentials(phone.trim(), password);
        }
      } else {
        setError("Login failed. Please check your credentials or OTP.");
      }
    } catch (err: any) {
      setError(err.message || "Could not connect to the server.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
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
            paddingTop: insets.top + Spacing["3xl"],
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoContainer}>
          <Image
            source={require("../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <ThemedText
            type="h1"
            style={[styles.appName, { color: Colors.light.primaryDark }]}
            lightColor={Colors.light.primaryDark}
            darkColor={Colors.dark.text}
          >
            {t.app.name}
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.tagline, { color: theme.textSecondary }]}
          >
            {t.app.tagline}
          </ThemedText>
        </View>

        <View style={styles.formContainer}>
          {error && (
            <View style={styles.errorContainer}>
              <Feather
                name="alert-triangle"
                size={18}
                color="#FF5252"
                style={{ marginRight: Spacing.xs }}
              />
              <ThemedText type="small" style={styles.errorText}>
                {error}
              </ThemedText>
            </View>
          )}

          {showOtpVerification ? (
            <View>
              <ThemedText type="h2" style={styles.welcomeText}>
                Verify OTP
              </ThemedText>
              <ThemedText
                type="body"
                style={{
                  textAlign: "center",
                  marginBottom: Spacing.xl,
                  color: theme.textSecondary,
                }}
              >
                Enter the 6-digit verification code sent to {phone}
              </ThemedText>

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
                    name="shield"
                    size={20}
                    color={theme.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="Enter 6-digit OTP"
                    placeholderTextColor={theme.textSecondary}
                    value={otp}
                    onChangeText={(text) => {
                      setOtp(text);
                      setError(null);
                    }}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: Spacing.lg,
                }}
              >
                {otpCountdown > 0 ? (
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    Resend code in {Math.floor(otpCountdown / 60)}:
                    {(otpCountdown % 60).toString().padStart(2, "0")}
                  </ThemedText>
                ) : (
                  <Pressable onPress={handleResendOtp}>
                    <ThemedText
                      type="small"
                      style={{ color: theme.primary, fontWeight: "600" }}
                    >
                      Resend OTP Code
                    </ThemedText>
                  </Pressable>
                )}

                <Pressable
                  onPress={() => {
                    setShowOtpVerification(false);
                    setOtp("");
                    setError(null);
                  }}
                >
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, fontWeight: "600" }}
                  >
                    Cancel
                  </ThemedText>
                </Pressable>
              </View>

              <AnimatedPressable
                onPress={handleLogin}
                onPressIn={() => {
                  buttonScale.value = withSpring(0.96);
                }}
                onPressOut={() => {
                  buttonScale.value = withSpring(1);
                }}
                disabled={isLoading}
                style={[
                  styles.loginButton,
                  { backgroundColor: theme.primary },
                  animatedButtonStyle,
                ]}
              >
                <ThemedText
                  type="body"
                  style={[styles.loginButtonText, { color: "#FFFFFF" }]}
                >
                  {isLoading ? t.common.loading : "Verify & Login"}
                </ThemedText>
              </AnimatedPressable>
            </View>
          ) : (
            <>
              <ThemedText type="h2" style={styles.welcomeText}>
                {t.auth.welcome}
              </ThemedText>

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
                    placeholder={t.auth.email}
                    placeholderTextColor={theme.textSecondary}
                    value={phone}
                    onChangeText={(text) => {
                      setPhone(text);
                      setError(null);
                    }}
                    keyboardType="default"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

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
                    onChangeText={(text) => {
                      setPassword(text);
                      setError(null);
                    }}
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

              <View style={styles.optionsRow}>
                <Pressable
                  onPress={() => setRememberMe(!rememberMe)}
                  style={styles.rememberMeContainer}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: rememberMe ? theme.primary : theme.border,
                        backgroundColor: rememberMe
                          ? theme.primary
                          : "transparent",
                      },
                    ]}
                  >
                    {rememberMe ? (
                      <Feather name="check" size={14} color="#FFFFFF" />
                    ) : null}
                  </View>
                  <ThemedText type="body" style={styles.rememberMeText}>
                    {t.auth.rememberMe}
                  </ThemedText>
                </Pressable>
              </View>

              <AnimatedPressable
                onPress={handleLogin}
                onPressIn={() => {
                  buttonScale.value = withSpring(0.96);
                }}
                onPressOut={() => {
                  buttonScale.value = withSpring(1);
                }}
                disabled={isLoading}
                style={[
                  styles.loginButton,
                  { backgroundColor: theme.primary },
                  animatedButtonStyle,
                ]}
              >
                <ThemedText
                  type="body"
                  style={[styles.loginButtonText, { color: "#FFFFFF" }]}
                >
                  {isLoading ? t.common.loading : t.auth.login}
                </ThemedText>
              </AnimatedPressable>

              {hasBiometric && Platform.OS !== "web" ? (
                <Pressable
                  onPress={handleBiometricLogin}
                  style={[
                    styles.biometricButton,
                    {
                      borderColor: theme.primary + "40",
                      backgroundColor: theme.primary + "0C",
                    },
                  ]}
                >
                  <Feather name="shield" size={20} color={theme.primary} />
                  <ThemedText
                    type="body"
                    style={{
                      color: theme.primary,
                      marginLeft: Spacing.sm,
                      fontWeight: "600",
                    }}
                  >
                    {biometricLabel}
                  </ThemedText>
                </Pressable>
              ) : null}

              <View style={styles.signupContainer}>
                <ThemedText type="body">{t.auth.noAccount} </ThemedText>
                <Pressable onPress={() => navigationProp.push("Signup")}>
                  <ThemedText
                    type="body"
                    style={{ color: theme.primary, fontWeight: "600" }}
                  >
                    {t.auth.signUp}
                  </ThemedText>
                </Pressable>
              </View>

              <Pressable
                onPress={loginAsGuest}
                style={[styles.skipButton, { borderColor: theme.border }]}
              >
                <Feather name="eye" size={16} color={theme.textSecondary} />
                <ThemedText
                  type="body"
                  style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}
                >
                  {t.auth.guestBrowse}
                </ThemedText>
              </Pressable>
            </>
          )}
        </View>

        <View style={styles.languageContainer}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {t.settings.language}:
          </ThemedText>
          <View style={styles.languageButtons}>
            {(["en", "hi"] as Language[]).map((lang) => (
              <Pressable
                key={lang}
                onPress={() => handleLanguageChange(lang)}
                style={[
                  styles.languageButton,
                  {
                    backgroundColor:
                      language === lang
                        ? theme.primary
                        : theme.backgroundDefault,
                    borderColor:
                      language === lang ? theme.primary : theme.border,
                  },
                ]}
              >
                <ThemedText
                  type="small"
                  style={{
                    color: language === lang ? "#FFFFFF" : theme.text,
                    fontWeight: language === lang ? "600" : "400",
                  }}
                >
                  {languageNames[lang]}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollContainer>

      <AppInfoModal
        visible={showAppInfo}
        onClose={() => setShowAppInfo(false)}
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
  logoContainer: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 20,
    marginBottom: Spacing.lg,
  },
  appName: { marginBottom: Spacing.xs },
  tagline: { textAlign: "center" },
  formContainer: { flex: 1 },
  welcomeText: {
    marginBottom: Spacing["2xl"],
    textAlign: "center",
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
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  rememberMeContainer: {
    flexDirection: "row",
    alignItems: "center",
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
  rememberMeText: { fontSize: 14 },
  toggleModeButton: {},
  loginButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonText: {
    fontWeight: "600",
    fontSize: 16,
  },
  biometricButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    borderWidth: 1.5,
  },
  languageContainer: {
    alignItems: "center",
    marginTop: Spacing["3xl"],
    paddingBottom: Spacing.xl,
  },
  languageButtons: {
    flexDirection: "row",
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  languageButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.xl,
  },
  skipButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 82, 82, 0.1)",
    borderColor: "rgba(255, 82, 82, 0.2)",
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    color: "#FF5252",
    fontSize: 14,
    fontWeight: "500",
  },
});
