import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Dimensions,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { Language } from "@/constants/i18n";
import { storage } from "@/utils/storage";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export interface LanguageItem {
  code: Language;
  nativeName: string;
  englishName: string;
  script: string;
  isRTL?: boolean;
}

export const SUPPORTED_22_LANGUAGES: LanguageItem[] = [
  { code: "hi", nativeName: "हिंदी", englishName: "Hindi", script: "devanagari" },
  { code: "en", nativeName: "English", englishName: "English", script: "latin" },
  { code: "mr", nativeName: "मराठी", englishName: "Marathi", script: "devanagari" },
  { code: "gu", nativeName: "ગુજરાતી", englishName: "Gujarati", script: "gujarati" },
  { code: "bn", nativeName: "বাংলা", englishName: "Bengali", script: "bengali" },
  { code: "ta", nativeName: "தமிழ்", englishName: "Tamil", script: "tamil" },
  { code: "te", nativeName: "తెలుగు", englishName: "Telugu", script: "telugu" },
  { code: "kn", nativeName: "ಕನ್ನಡ", englishName: "Kannada", script: "kannada" },
  { code: "ml", nativeName: "മലയാളം", englishName: "Malayalam", script: "malayalam" },
  { code: "pa", nativeName: "ਪੰਜਾਬੀ", englishName: "Punjabi", script: "gurmukhi" },
  { code: "or", nativeName: "ଓଡ଼ିଆ", englishName: "Odia", script: "odia" },
  { code: "as", nativeName: "অসমীয়া", englishName: "Assamese", script: "bengali" },
  { code: "ur", nativeName: "اردو", englishName: "Urdu", script: "arabic", isRTL: true },
  { code: "sa", nativeName: "संस्कृतम्", englishName: "Sanskrit", script: "devanagari" },
  { code: "ne", nativeName: "नेपाली", englishName: "Nepali", script: "devanagari" },
  { code: "kok", nativeName: "कोंकणी", englishName: "Konkani", script: "devanagari" },
  { code: "mai", nativeName: "मैथिली", englishName: "Maithili", script: "devanagari" },
  { code: "bho", nativeName: "भोजपुरी", englishName: "Bhojpuri", script: "devanagari" },
  { code: "doi", nativeName: "डोगरी", englishName: "Dogri", script: "devanagari" },
  { code: "ks", nativeName: "کٲشُر / कश्मीरी", englishName: "Kashmiri", script: "arabic", isRTL: true },
  { code: "mni", nativeName: "মৈতৈলোন্ / মণিপুরি", englishName: "Manipuri", script: "bengali" },
  { code: "sat", nativeName: "ᱥᱟᱱᱛᱟᱲᱤ / संथाली", englishName: "Santali", script: "devanagari" },
];

interface LanguageSelectionScreenProps {
  onComplete: () => void;
}

export default function LanguageSelectionScreen({
  onComplete,
}: LanguageSelectionScreenProps) {
  const { theme, isDark } = useTheme();
  const { setLanguage } = useLanguage();
  const insets = useSafeAreaInsets();

  // Hindi selected by default
  const [selectedLang, setSelectedLang] = useState<Language>("hi");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelect = (lang: Language) => {
    setSelectedLang(lang);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleContinue = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      // 1. Save chosen language in i18n & storage
      await setLanguage(selectedLang);
      // 2. Mark language onboarding as completed
      await storage.setLanguageOnboardingCompleted(true);
      // 3. Mark first launch completed
      await storage.setLanguage(selectedLang);
      // 4. Trigger navigation
      onComplete();
    } catch (e) {
      console.warn("Language onboarding error:", e);
      onComplete();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? "#0F172A" : "#FAFAFA",
          paddingTop: insets.top,
        },
      ]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View
            style={[
              styles.logoBadge,
              { backgroundColor: theme.primary + "18" },
            ]}
          >
            <MaterialCommunityIcons
              name="hard-hat"
              size={32}
              color={theme.primary}
            />
          </View>
          <View style={{ marginLeft: 12 }}>
            <ThemedText style={[styles.brandTitle, { color: theme.primary }]}>
              HAAJARI MANAGER
            </ThemedText>
            <ThemedText style={[styles.brandSubtitle, { color: theme.textSecondary }]}>
              हाजिरी • साइट • हिसाब
            </ThemedText>
          </View>
        </View>

        <ThemedText style={[styles.screenTitle, { color: theme.text }]}>
          Choose Your Language
        </ThemedText>
        <ThemedText style={[styles.screenHindiTitle, { color: theme.primary }]}>
          अपनी भाषा चुनें
        </ThemedText>
        <ThemedText
          style={[styles.screenSubtitle, { color: theme.textSecondary }]}
        >
          Select your preferred language to continue
        </ThemedText>
      </View>

      {/* ── 22 LANGUAGES GRID / LIST ── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.gridContainer}>
          {SUPPORTED_22_LANGUAGES.map((lang) => {
            const isSelected = selectedLang === lang.code;

            return (
              <Pressable
                key={lang.code}
                onPress={() => handleSelect(lang.code)}
                style={({ pressed }) => [
                  styles.languageCard,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? "#431407"
                        : "#FFF7ED"
                      : isDark
                      ? "#1E293B"
                      : "#FFFFFF",
                    borderColor: isSelected
                      ? theme.primary
                      : isDark
                      ? "#334155"
                      : "#E2E8F0",
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <View style={styles.cardLeft}>
                  <ThemedText
                    style={[
                      styles.nativeName,
                      {
                        color: isSelected ? theme.primary : theme.text,
                        fontWeight: isSelected ? "800" : "700",
                        textAlign: lang.isRTL ? "right" : "left",
                      },
                    ]}
                  >
                    {lang.nativeName}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.englishName,
                      {
                        color: isSelected
                          ? isDark
                            ? "#FDBA74"
                            : "#C2410C"
                          : theme.textSecondary,
                      },
                    ]}
                  >
                    {lang.englishName}
                  </ThemedText>
                </View>

                <View
                  style={[
                    styles.radioCircle,
                    {
                      borderColor: isSelected
                        ? theme.primary
                        : isDark
                        ? "#64748B"
                        : "#CBD5E1",
                      backgroundColor: isSelected
                        ? theme.primary
                        : "transparent",
                    },
                  ]}
                >
                  {isSelected && (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* ── STICKY BOTTOM BUTTON ── */}
      <View
        style={[
          styles.bottomContainer,
          {
            backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
            borderTopColor: isDark ? "#1E293B" : "#F1F5F9",
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <Pressable
          onPress={handleContinue}
          disabled={isSubmitting}
          style={({ pressed }) => [
            styles.continueButton,
            {
              backgroundColor: theme.primary,
              opacity: pressed || isSubmitting ? 0.9 : 1,
            },
          ]}
        >
          <ThemedText style={styles.continueButtonText}>
            Continue • आगे बढ़ें
          </ThemedText>
          <Feather
            name="arrow-right"
            size={20}
            color="#FFFFFF"
            style={{ marginLeft: 8 }}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  screenHindiTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginTop: 2,
  },
  screenSubtitle: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  languageCard: {
    width: (SCREEN_WIDTH - 42) / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 2,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardLeft: {
    flex: 1,
    paddingRight: 6,
  },
  nativeName: {
    fontSize: 17,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  englishName: {
    fontSize: 12.5,
    fontWeight: "600",
    marginTop: 2,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  continueButton: {
    height: 54,
    borderRadius: 27,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#F97316",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  continueButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
