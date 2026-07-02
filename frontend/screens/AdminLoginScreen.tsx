import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors, Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { api } from "@/services/api";

const ACCENT_ORANGE = "#FF6B35";
const DARK_BG = "#121212";
const CARD_BG = "#1E1E1E";
const INPUT_BG = "#292929";

export default function AdminLoginScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if admin is already logged in and redirect
  useFocusEffect(
    React.useCallback(() => {
      const checkSession = async () => {
        try {
          const sessionData = await AsyncStorage.getItem(
            "@haajari/admin_session",
          );
          if (sessionData) {
            navigation.navigate("AdminDashboard" as any);
          }
        } catch (e) {
          console.error("Error checking admin session", e);
        }
      };
      checkSession();
    }, [navigation]),
  );

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError("Please fill all fields");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    if (username.trim() !== "haajari896" || password !== "12345678") {
      setError("Invalid Username or Password");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      const res = await api.post("/auth/login", {
        phone: username.trim(),
        password,
      });

      const data = res.data;
      const session = {
        token: data.token,
        refreshToken: data.refreshToken,
        username: username.trim(),
        loggedInAt: Date.now(),
      };
      await AsyncStorage.setItem(
        "@haajari/admin_session",
        JSON.stringify(session),
      );
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      navigation.navigate("AdminDashboard" as any);
    } catch (e: any) {
      setError(
        e.response?.data?.error || "Network error: Backend server unreachable",
      );
      console.error("[Admin Login] Failed to connect to server:", e);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: DARK_BG }]}>
      <LinearGradient
        colors={["rgba(255, 107, 53, 0.15)", "transparent"]}
        style={styles.gradientHeader}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContainer,
            {
              paddingTop: insets.top + Spacing.xl,
              paddingBottom: insets.bottom + Spacing.xl,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            {/* Header / Logo */}
            <View style={styles.logoContainer}>
              <View style={styles.logoGlow}>
                <Feather name="shield" size={48} color={ACCENT_ORANGE} />
              </View>
              <ThemedText type="h1" style={styles.title}>
                Haajari Admin
              </ThemedText>
              <ThemedText type="body" style={styles.subtitle}>
                System Administration Control Panel
              </ThemedText>
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Feather name="alert-triangle" size={18} color="#FF5252" />
                <ThemedText type="small" style={styles.errorText}>
                  {error}
                </ThemedText>
              </View>
            )}

            {/* Fields */}
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <ThemedText type="small" style={styles.label}>
                  Username
                </ThemedText>
                <View style={styles.inputWrapper}>
                  <Feather
                    name="user"
                    size={20}
                    color="#888888"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter admin username"
                    placeholderTextColor="#555555"
                    value={username}
                    onChangeText={(text) => {
                      setUsername(text);
                      setError(null);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <ThemedText type="small" style={styles.label}>
                  Password
                </ThemedText>
                <View style={styles.inputWrapper}>
                  <Feather
                    name="lock"
                    size={20}
                    color="#888888"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter admin password"
                    placeholderTextColor="#555555"
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
                    style={styles.eyeBtn}
                  >
                    <Feather
                      name={showPassword ? "eye-off" : "eye"}
                      size={20}
                      color="#888888"
                    />
                  </Pressable>
                </View>
              </View>

              {/* Login Button */}
              <Pressable
                onPress={handleLogin}
                disabled={isLoading}
                style={({ pressed }) => [
                  styles.loginButton,
                  {
                    backgroundColor: ACCENT_ORANGE,
                    opacity: pressed || isLoading ? 0.8 : 1,
                  },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <ThemedText type="body" style={styles.loginBtnText}>
                    Sign In
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: "#2C2C2C",
    ...Shadows.lg,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  logoGlow: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255, 107, 53, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 107, 53, 0.2)",
    marginBottom: Spacing.md,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  subtitle: {
    color: "#888888",
    fontSize: 13,
    marginTop: Spacing.xs,
    textAlign: "center",
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
    marginLeft: Spacing.sm,
    fontWeight: "500",
  },
  form: {
    gap: Spacing.lg,
  },
  inputContainer: {
    gap: Spacing.xs,
  },
  label: {
    color: "#AAAAAA",
    fontWeight: "600",
    marginLeft: 2,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: BorderRadius.xs,
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.md,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    height: "100%",
  },
  eyeBtn: {
    padding: Spacing.xs,
  },
  loginButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
    ...Shadows.md,
  },
  loginBtnText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
});
