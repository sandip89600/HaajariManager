import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useTheme } from "@/hooks/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spacing } from "@/constants/theme";
import { privacyPolicyContent } from "@/data/privacyPolicy";

export default function PrivacyPolicyScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = insets.bottom + 60;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.backgroundDefault,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="chevron-left" size={28} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Privacy Policy</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScreenScrollView
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
        }}
      >
        <ThemedText type="h2" style={{ marginBottom: Spacing.lg }}>
          Privacy Policy
        </ThemedText>

        {privacyPolicyContent.map((section, idx) => (
          <View key={idx}>
            <Section title={section.title} content={section.content} />
            {section.bullets && <BulletPoints items={section.bullets} />}
          </View>
        ))}

        <View style={styles.bottomSpacing} />
      </ScreenScrollView>
    </View>
  );
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <View style={styles.section}>
      <ThemedText type="h4" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      <ThemedText type="body" style={styles.sectionContent}>
        {content}
      </ThemedText>
    </View>
  );
}

function BulletPoints({ items }: { items: string[] }) {
  return (
    <View style={styles.bulletContainer}>
      {items.map((item, index) => (
        <View key={index} style={styles.bulletPoint}>
          <ThemedText type="body" style={styles.bullet}>
            •
          </ThemedText>
          <ThemedText type="body" style={styles.bulletText}>
            {item}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  headerSpacer: {
    width: 28,
  },
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    fontWeight: "700",
  },
  sectionContent: {
    lineHeight: 22,
  },
  bulletContainer: {
    marginLeft: Spacing.lg,
    marginBottom: Spacing["2xl"],
  },
  bulletPoint: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  bullet: {
    marginRight: Spacing.md,
    fontWeight: "600",
  },
  bulletText: {
    flex: 1,
    lineHeight: 22,
  },
  bottomSpacing: {
    height: Spacing.xl,
  },
});
