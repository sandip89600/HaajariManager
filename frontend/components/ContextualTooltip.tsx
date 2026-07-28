import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, Animated } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface ContextualTooltipProps {
  tooltipKey: string;
  title: string;
  description: string;
  style?: any;
}

const HINDI_TIPS: { [key: string]: string } = {
  create_worker: "👉 Sabse pehle worker add karein.",
  create_site: "👉 Yahan se nayi site shuru karein.",
  attendance: "👉 Roz attendance lagana na bhoolein.",
  payments: "👉 Yahan worker ko diya gaya paisa record karein.",
  materials: "👉 Site ka saman yahan add karein.",
  reports_summary: "👉 Mahine ki report yahan se nikalein.",
};

export default function ContextualTooltip({ tooltipKey, title, description, style }: ContextualTooltipProps) {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    AsyncStorage.getItem(`@haajari/tooltip_${tooltipKey}`).then((val) => {
      if (!val) {
        setVisible(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start();
      }
    });
  }, [tooltipKey]);

  const handleDismiss = async () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(async () => {
      setVisible(false);
      await AsyncStorage.setItem(`@haajari/tooltip_${tooltipKey}`, "true");
    });
  };

  if (!visible) return null;

  // Use the contractor-friendly Hinglish tip if defined, otherwise fallback to description
  const tipContent = HINDI_TIPS[tooltipKey] || description;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.primary + "12",
          borderColor: theme.primary,
          opacity: fadeAnim,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <ThemedText style={[styles.title, { color: theme.primary }]}>💡 Tip</ThemedText>
          <Pressable onPress={handleDismiss} hitSlop={15} style={styles.closeBtn}>
            <Feather name="x" size={16} color={theme.primary} />
          </Pressable>
        </View>
        <ThemedText style={[styles.description, { color: theme.text }]}>
          {tipContent}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    marginVertical: Spacing.sm,
  },
  content: {
    flexDirection: "column",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  closeBtn: {
    padding: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "900",
  },
  description: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
});
