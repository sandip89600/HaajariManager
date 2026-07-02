import React from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  Linking,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useTheme } from "@/hooks/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import * as Haptics from "expo-haptics";

export default function SupportScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = insets.bottom + 60;

  const handleWhatsApp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const phoneNumber = "+917057942248";
    const message = "Hi Haajari Support Team, I need help with my account...";
    const url = `https://wa.me/${phoneNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(message)}`;

    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      Linking.openURL(url).catch(() => {
        Alert.alert("Error", "WhatsApp is not installed on this device.");
      });
    }
  };

  const handleEmail = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const email = "info.haajariapp@gmail.com";
    const subject = "Haajari App Support Request";
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}`;

    if (Platform.OS === "web") {
      window.location.href = url;
    } else {
      Linking.openURL(url).catch(() => {
        Alert.alert("Error", "Could not open email client.");
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* HEADER */}
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
        <ThemedText type="h3">Support & Help Center</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      {/* CONTENT */}
      <ScreenScrollView
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
        }}
      >
        <ThemedText type="h1" style={styles.title}>
          Support & Help Center
        </ThemedText>
        <ThemedText
          type="body"
          style={[styles.subtitle, { color: theme.textSecondary }]}
        >
          We're here to assist you. Choose your preferred way of contacting us
          below.
        </ThemedText>

        {/* WHATSAPP CARD */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
              ...Shadows.card,
            },
          ]}
        >
          <View style={[styles.iconWrapper, { backgroundColor: "#E8F5E9" }]}>
            <Feather name="message-circle" size={32} color="#4CAF50" />
          </View>
          <ThemedText type="h2" style={styles.cardTitle}>
            WhatsApp Support
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.cardDesc, { color: theme.textSecondary }]}
          >
            Chat directly with our support team for quick answers regarding
            attendance, payments, or setting up your account.
          </ThemedText>
          <ThemedText
            type="h3"
            style={[styles.contactDetail, { color: theme.primary }]}
          >
            +91 7057942248
          </ThemedText>
          <Pressable
            onPress={handleWhatsApp}
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: "#4CAF50",
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Feather
              name="message-square"
              size={18}
              color="#FFFFFF"
              style={{ marginRight: Spacing.xs }}
            />
            <ThemedText style={styles.actionButtonText}>
              Start WhatsApp Chat
            </ThemedText>
          </Pressable>
        </View>

        {/* EMAIL CARD */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
              ...Shadows.card,
            },
          ]}
        >
          <View style={[styles.iconWrapper, { backgroundColor: "#E3F2FD" }]}>
            <Feather name="mail" size={32} color="#2196F3" />
          </View>
          <ThemedText type="h2" style={styles.cardTitle}>
            Email Support
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.cardDesc, { color: theme.textSecondary }]}
          >
            Send us your detailed queries or attachments, and our tech team will
            resolve your issue promptly.
          </ThemedText>
          <ThemedText
            type="h3"
            style={[styles.contactDetail, { color: theme.primary }]}
          >
            info.haajariapp@gmail.com
          </ThemedText>
          <Pressable
            onPress={handleEmail}
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: "#2196F3",
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Feather
              name="send"
              size={18}
              color="#FFFFFF"
              style={{ marginRight: Spacing.xs }}
            />
            <ThemedText style={styles.actionButtonText}>
              Send Support Email
            </ThemedText>
          </Pressable>
        </View>
      </ScreenScrollView>
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
  title: {
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  cardDesc: {
    textAlign: "center",
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  contactDetail: {
    fontWeight: "700",
    marginBottom: Spacing.lg,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    width: "100%",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
});
