import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { requestNotificationPermission } from "@/utils/notifications";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface FirstTimeSetupScreenProps {
  onComplete: () => void;
  navigation: any;
}

const LOCALIZED_TEXT: Record<string, any> = {
  en: {
    welcomeTitle: "Welcome to Haajari Manager 👋",
    welcomeSubtitle: "Manage your construction business smarter, faster and more efficiently.",
    welcomeDesc: "Haajari Manager helps builders, contractors and supervisors track attendance, manage sites, and handle payments in one app.",
    readAndAgree: "I have read and agree to the ",
    privacyPolicy: "Privacy Policy",
    termsConditions: "Terms & Conditions",
    and: " and ",
    continue: "Continue",
    stayUpdated: "Stay Updated 🔔",
    stayUpdatedDesc: "Enable notifications to receive important reminders and updates:",
    reminderAttendance: "Attendance reminders to mark daily reports",
    reminderPayment: "Payment and ledger status alerts",
    reminderSite: "Site allocations and progress updates",
    reminderAnnounce: "Important announcements and features",
    enableNotifications: "Enable Notifications",
    maybeLater: "Maybe Later",
    helpImprove: "Help Us Improve",
    helpImproveDesc: "Help us improve your experience by allowing anonymous usage analytics. We do NOT collect personal messages, passwords or private information. Your privacy always comes first.",
    allow: "Allow",
    notNow: "Not Now",
    loadingText: "Setting up your workspace...",
  },
  hi: {
    welcomeTitle: "Haajari Manager mein swagat hai 👋",
    welcomeSubtitle: "Apne construction business ko manage karein behad aasan aur fast tarike se.",
    welcomeDesc: "Haajari Manager builders, contractors aur supervisors ko attendance lagane, site manage karne aur payments track karne me help karta hai.",
    readAndAgree: "Maine ",
    privacyPolicy: "Privacy Policy",
    termsConditions: "Terms & Conditions",
    and: " aur ",
    continue: "Aage Badhein",
    stayUpdated: "Stay Updated 🔔",
    stayUpdatedDesc: "Important reminders aur updates paane ke liye notifications chalu karein:",
    reminderAttendance: "Rozana attendance lagane ka reminder",
    reminderPayment: "Payment aur ledger status ke updates",
    reminderSite: "Nayi site aur progress updates",
    reminderAnnounce: "Naye features aur important announcements",
    enableNotifications: "Notifications chalu karein",
    maybeLater: "Baad mein karein",
    helpImprove: "Haajari Manager ko behtar banayein",
    helpImproveDesc: "Anonymous usage analytics share karke app ko behtar banane me hamari madad karein. Hum aapka koi bhi personal message, password ya private jankari collect nahi karte. Aapki privacy sabse pehle aati hai.",
    allow: "Allow karein",
    notNow: "Abhi nahi",
    loadingText: "Aapka workspace taiyar ho raha hai...",
  }
};

export default function FirstTimeSetupScreen({
  onComplete,
  navigation,
}: FirstTimeSetupScreenProps) {
  const { theme, isDark } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // Animations
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const spinValue = useRef(new Animated.Value(0)).current;

  const currentTexts = LOCALIZED_TEXT[language] || LOCALIZED_TEXT.hi || LOCALIZED_TEXT.en;

  const runSlideTransition = (nextStep: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(50);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  useEffect(() => {
    if (step === 4) {
      setIsFinishing(true);
      // Start spin animation
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();

      // Finish after 1 second
      const timer = setTimeout(async () => {
        try {
          await AsyncStorage.setItem("@haajari/isFirstLaunchCompleted", "true");
        } catch (e) {
          console.warn(e);
        }
        onComplete();
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleNotificationOptIn = async (optIn: boolean) => {
    if (optIn) {
      await requestNotificationPermission();
    }
    runSlideTransition(3);
  };

  const handleAnalyticsOptIn = async (optIn: boolean) => {
    try {
      await AsyncStorage.setItem(
        "@haajari/analytics_allowed",
        optIn ? "true" : "false"
      );
    } catch (e) {
      console.warn(e);
    }
    runSlideTransition(4);
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.iconContainer}>
              <View style={[styles.logoCircle, { backgroundColor: theme.primary + "15" }]}>
                <MaterialCommunityIcons name="hard-hat" size={72} color={theme.primary} />
              </View>
            </View>
            <ThemedText style={[styles.title, { color: theme.text }]}>
              {currentTexts.welcomeTitle}
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              {currentTexts.welcomeSubtitle}
            </ThemedText>
            <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
              {currentTexts.welcomeDesc}
            </ThemedText>

            <View style={styles.flexSpacer} />

            {/* Checkbox and links */}
            <View style={styles.consentContainer}>
              <Pressable
                onPress={() => setAgreed(!agreed)}
                style={styles.checkboxRow}
                hitSlop={10}
              >
                <Ionicons
                  name={agreed ? "checkbox" : "square-outline"}
                  size={24}
                  color={agreed ? theme.primary : theme.textSecondary}
                  style={styles.checkbox}
                />
                <View style={styles.consentTextWrap}>
                  <ThemedText style={[styles.consentText, { color: theme.text }]}>
                    {currentTexts.readAndAgree}
                    <ThemedText
                      style={[styles.linkText, { color: theme.primary }]}
                      onPress={() => navigation.navigate("PrivacyPolicy")}
                    >
                      {currentTexts.privacyPolicy}
                    </ThemedText>
                    {currentTexts.and}
                    <ThemedText
                      style={[styles.linkText, { color: theme.primary }]}
                      onPress={() => navigation.navigate("TermsAndConditions")}
                    >
                      {currentTexts.termsConditions}
                    </ThemedText>
                    .
                  </ThemedText>
                </View>
              </Pressable>
            </View>

            <Pressable
              disabled={!agreed}
              onPress={() => runSlideTransition(2)}
              style={({ pressed }) => [
                styles.buttonPrimary,
                {
                  backgroundColor: agreed
                    ? pressed
                      ? theme.primary + "CC"
                      : theme.primary
                    : isDark ? "#334155" : "#E2E8F0",
                },
              ]}
            >
              <ThemedText style={[styles.buttonText, { color: agreed ? "#FFFFFF" : theme.textSecondary }]}>
                {currentTexts.continue}
              </ThemedText>
            </Pressable>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.iconContainer}>
              <View style={[styles.logoCircle, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons name="notifications-outline" size={72} color="#2563EB" />
              </View>
            </View>
            <ThemedText style={[styles.title, { color: theme.text }]}>
              {currentTexts.stayUpdated}
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              {currentTexts.stayUpdatedDesc}
            </ThemedText>

            <View style={styles.listContainer}>
              {[
                { icon: "calendar-outline", text: currentTexts.reminderAttendance },
                { icon: "cash-outline", text: currentTexts.reminderPayment },
                { icon: "construct-outline", text: currentTexts.reminderSite },
                { icon: "megaphone-outline", text: currentTexts.reminderAnnounce },
              ].map((item, idx) => (
                <View key={idx} style={styles.listItem}>
                  <Ionicons name={item.icon as any} size={20} color={theme.primary} style={styles.listIcon} />
                  <ThemedText style={[styles.listItemText, { color: theme.text }]}>
                    {item.text}
                  </ThemedText>
                </View>
              ))}
            </View>

            <View style={styles.flexSpacer} />

            <Pressable
              onPress={() => handleNotificationOptIn(true)}
              style={({ pressed }) => [
                styles.buttonPrimary,
                { backgroundColor: pressed ? "#1E40AF" : "#2563EB" },
              ]}
            >
              <ThemedText style={[styles.buttonText, { color: "#FFFFFF" }]}>
                {currentTexts.enableNotifications}
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => handleNotificationOptIn(false)}
              style={styles.buttonSecondary}
            >
              <ThemedText style={[styles.buttonTextSecondary, { color: theme.textSecondary }]}>
                {currentTexts.maybeLater}
              </ThemedText>
            </Pressable>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.iconContainer}>
              <View style={[styles.logoCircle, { backgroundColor: "#ECFDF5" }]}>
                <Feather name="shield" size={72} color="#059669" />
              </View>
            </View>
            <ThemedText style={[styles.title, { color: theme.text }]}>
              {currentTexts.helpImprove}
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              {currentTexts.helpImproveDesc}
            </ThemedText>

            <View style={styles.flexSpacer} />

            <Pressable
              onPress={() => handleAnalyticsOptIn(true)}
              style={({ pressed }) => [
                styles.buttonPrimary,
                { backgroundColor: pressed ? "#047857" : "#059669" },
              ]}
            >
              <ThemedText style={[styles.buttonText, { color: "#FFFFFF" }]}>
                {currentTexts.allow}
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => handleAnalyticsOptIn(false)}
              style={styles.buttonSecondary}
            >
              <ThemedText style={[styles.buttonTextSecondary, { color: theme.textSecondary }]}>
                {currentTexts.notNow}
              </ThemedText>
            </Pressable>
          </View>
        );

      case 4:
      default:
        const spin = spinValue.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "360deg"],
        });
        return (
          <View style={[styles.stepContainer, styles.center]}>
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <MaterialCommunityIcons name="cog-outline" size={80} color={theme.primary} />
            </Animated.View>
            <ThemedText style={[styles.loadingTitle, { color: theme.text }]}>
              {currentTexts.loadingText}
            </ThemedText>
            <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 24 }} />
          </View>
        );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault, paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <Animated.View
        style={[
          styles.animatedContent,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {renderStepContent()}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  animatedContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stepContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    marginTop: 40,
    marginBottom: 32,
    alignItems: "center",
  },
  logoCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  description: {
    fontSize: 13,
    fontWeight: "400",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  flexSpacer: {
    flex: 1,
  },
  listContainer: {
    width: "100%",
    paddingHorizontal: 12,
    marginTop: 16,
    gap: 16,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  listIcon: {
    marginRight: 16,
  },
  listItemText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  consentContainer: {
    width: "100%",
    marginBottom: 24,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 8,
  },
  checkbox: {
    marginRight: 12,
    marginTop: 2,
  },
  consentTextWrap: {
    flex: 1,
  },
  consentText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  linkText: {
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  buttonPrimary: {
    width: "100%",
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  buttonSecondary: {
    width: "100%",
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  buttonTextSecondary: {
    fontSize: 15,
    fontWeight: "700",
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 24,
  },
});
