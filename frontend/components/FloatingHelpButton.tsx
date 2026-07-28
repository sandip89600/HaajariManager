/**
 * HelpSheet — a reusable bottom-sheet component that shows:
 *   1. App Tour (guided walkthrough)
 *   2. Contact Support  (call / WhatsApp)
 *
 * No floating button — this is opened from the Settings screen.
 * Usage:  <HelpSheet visible={show} onClose={() => setShow(false)} />
 */

import React, { useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  Linking,
  Alert,
  Animated,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useTour } from "@/contexts/TourContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

interface HelpSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Optional: called after tour is started so parent can navigate to Dashboard */
  onTourStart?: () => void;
}

const SUPPORT_PHONE = "+917057942248";
const SUPPORT_EMAIL = "info.haajariapp@gmail.com";

export default function HelpSheet({ visible, onClose, onTourStart }: HelpSheetProps) {
  const { theme, isDark } = useTheme();
  const tour = useTour();
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const handleShow = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 18,
        stiffness: 200,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleHide = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const handleRestartTour = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    handleHide();
    await AsyncStorage.removeItem("@haajari/onboarding_completed");
    tour.startTour();
    if (onTourStart) onTourStart();
  };

  const handleCallSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Contact Support",
      "Haajari Manager support team se baat karein.\n\n📞 " + SUPPORT_PHONE + "\n📧 " + SUPPORT_EMAIL,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "📞 Call Now",
          onPress: () =>
            Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() =>
              Alert.alert("Error", "Call nahi ho pa raha. Manually dial karein: " + SUPPORT_PHONE)
            ),
        },
        {
          text: "💬 WhatsApp",
          onPress: () =>
            Linking.openURL(
              `https://wa.me/${SUPPORT_PHONE.replace("+", "")}?text=Hi, Haajari Manager me help chahiye.`
            ).catch(() => Alert.alert("Error", "WhatsApp open nahi ho pa raha.")),
        },
      ],
      { cancelable: true }
    );
  };

  const ITEMS: {
    icon: string;
    iconBg: string;
    iconColor: string;
    label: string;
    sublabel: string;
    badge?: string;
    onPress: () => void;
  }[] = [
    {
      icon: "compass",
      iconBg: isDark ? "#1E3A5F" : "#EFF6FF",
      iconColor: theme.primary,
      label: "App Tour",
      sublabel: "Step-by-step guide dobara dekhein",
      badge: "GUIDED",
      onPress: handleRestartTour,
    },
    {
      icon: "phone",
      iconBg: isDark ? "#1A3A2F" : "#F0FDF4",
      iconColor: "#10B981",
      label: "Contact Support",
      sublabel: "Koi bhi problem ho — call ya WhatsApp karein",
      onPress: handleCallSupport,
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={handleHide}
      onShow={handleShow}
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleHide} />

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* Drag pill */}
          <View style={styles.pill} />

          {/* Close */}
          <Pressable onPress={handleHide} style={styles.closeBtn} hitSlop={16}>
            <Feather name="x" size={20} color={theme.textSecondary} />
          </Pressable>

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={[styles.headerIconWrap, { backgroundColor: isDark ? "#1E3A5F" : "#EFF6FF" }]}>
              <Feather name="life-buoy" size={22} color={theme.primary} />
            </View>
            <View>
              <ThemedText style={[styles.title, { color: theme.text }]}>Help & Support</ThemedText>
              <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
                App sikhein ya team se baat karein
              </ThemedText>
            </View>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }]} />

          {/* Items */}
          <View style={styles.itemsWrap}>
            {ITEMS.map((item, idx) => (
              <Pressable
                key={idx}
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.item,
                  {
                    backgroundColor: pressed
                      ? isDark ? "#1E293B" : "#F8FAFC"
                      : "transparent",
                    borderColor: isDark ? "#1E293B" : "#E2E8F0",
                  },
                ]}
              >
                {/* Icon */}
                <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
                  <Feather name={item.icon as any} size={22} color={item.iconColor} />
                </View>

                {/* Text */}
                <View style={styles.textWrap}>
                  <View style={styles.labelRow}>
                    <ThemedText style={[styles.label, { color: theme.text }]}>
                      {item.label}
                    </ThemedText>
                    {item.badge && (
                      <View style={[styles.badge, { backgroundColor: theme.primary + "20" }]}>
                        <ThemedText style={[styles.badgeText, { color: theme.primary }]}>
                          {item.badge}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  <ThemedText style={[styles.sublabel, { color: theme.textSecondary }]}>
                    {item.sublabel}
                  </ThemedText>
                </View>

                {/* Chevron */}
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              </Pressable>
            ))}
          </View>

          {/* Footer note */}
          <View style={[styles.footer, { backgroundColor: isDark ? "#1E293B" : "#F8FAFC" }]}>
            <Feather name="info" size={13} color={theme.textSecondary} />
            <ThemedText style={[styles.footerText, { color: theme.textSecondary }]}>
              Support hours: Mon – Sat, 9 AM – 7 PM IST
            </ThemedText>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
      },
      android: { elevation: 24 },
    }),
  },
  pill: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 99,
    backgroundColor: "#CBD5E1",
    marginBottom: 12,
  },
  closeBtn: {
    position: "absolute",
    top: 20,
    right: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
    marginTop: 4,
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginBottom: 14,
    borderRadius: 1,
  },
  itemsWrap: {
    gap: 8,
    marginBottom: 16,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  sublabel: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
    lineHeight: 17,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  footerText: {
    fontSize: 11,
    fontWeight: "500",
  },
});
