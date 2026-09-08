import React from "react";
import { View, StyleSheet, Pressable, Image, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";

export interface ProfileHeaderCardProps {
  name: string;
  phone?: string;
  email?: string;
  companyName?: string;
  profileImage?: string;
  avatarColor?: string;
  onEditPress?: () => void;
  onAvatarPress?: () => void;
  editLabel?: string;
}

export const ProfileHeaderCard: React.FC<ProfileHeaderCardProps> = ({
  name,
  phone = "8055813694",
  email = "panditganesh8055@gmail.com",
  companyName = "Ravi Construction",
  profileImage,
  avatarColor = "#5EEAD4",
  onEditPress,
  onAvatarPress,
  editLabel,
}) => {
  const { theme, isDark } = useTheme();

  // Compute initials (e.g. "Ganesh Pandit" -> "GP")
  const getInitials = (fullName: string) => {
    if (!fullName) return "GP";
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  const initials = getInitials(name);

  return (
    <View
      style={[
        styles.cardWrapper,
        {
          backgroundColor: theme.backgroundDefault,
          borderColor: isDark ? "#334155" : theme.border,
        },
      ]}
    >
      <LinearGradient
        colors={
          isDark
            ? ["#0F172A", "#1E293B", "#0F172A"]
            : [theme.backgroundDefault, theme.backgroundSecondary || "#F8FAFC"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        <View style={styles.cardContent}>
          {/* ── Left Side: Circular Avatar Badge ── */}
          <Pressable onPress={onAvatarPress} style={styles.avatarTouchArea}>
            <LinearGradient
              colors={["#4ADE80", "#2DD4BF", "#14B8A6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarCircle}
            >
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatarImage} />
              ) : (
                <View style={styles.initialsContainer}>
                  <ThemedText style={styles.avatarInitialsText}>
                    {initials}
                  </ThemedText>
                </View>
              )}
            </LinearGradient>
          </Pressable>

          {/* ── Right Side: User Details ── */}
          <View style={styles.detailsContainer}>
            {/* Top Row: User Name & Optional Edit Action */}
            <View style={styles.topRow}>
              <ThemedText style={[styles.nameText, { color: theme.text }]} numberOfLines={1}>
                {name || "Ganesh Pandit"}
              </ThemedText>

              {onEditPress && editLabel ? (
                <Pressable onPress={onEditPress} hitSlop={8} style={styles.editButton}>
                  <ThemedText style={styles.editText}>{editLabel}</ThemedText>
                </Pressable>
              ) : null}
            </View>

            {/* Vertically Stacked Contact List */}
            <View style={styles.contactList}>
              {/* Phone Row */}
              {phone ? (
                <View style={styles.contactItem}>
                  <View style={styles.iconBox}>
                    <Feather name="phone" size={13} color={theme.textSecondary} />
                  </View>
                  <ThemedText style={[styles.contactText, { color: theme.textSecondary }]} numberOfLines={1}>
                    {phone}
                  </ThemedText>
                </View>
              ) : null}

              {/* Email Row */}
              {email ? (
                <View style={styles.contactItem}>
                  <View style={styles.iconBox}>
                    <Feather name="mail" size={13} color={theme.textSecondary} />
                  </View>
                  <ThemedText style={[styles.contactText, { color: theme.textSecondary }]} numberOfLines={1}>
                    {email}
                  </ThemedText>
                </View>
              ) : null}

              {/* Company Row */}
              {companyName ? (
                <View style={styles.contactItem}>
                  <View style={styles.iconBox}>
                    <Feather name="briefcase" size={13} color={theme.textSecondary} />
                  </View>
                  <ThemedText style={[styles.contactText, { color: theme.textSecondary }]} numberOfLines={1}>
                    {companyName}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* ── Bottom-Right Accent Sparkle ── */}
        <View style={styles.sparkleAccent} pointerEvents="none">
          <Feather name="star" size={15} color={isDark ? "#2DD4BF" : "#F97316"} />
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    marginVertical: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardGradient: {
    padding: 16,
    position: "relative",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarTouchArea: {
    marginRight: 14,
  },
  avatarCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.4)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  avatarImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  initialsContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitialsText: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 3,
  },
  detailsContainer: {
    flex: 1,
    justifyContent: "center",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  nameText: {
    fontSize: 17,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  editButton: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  editText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F97316", // Bright Orange
  },
  contactList: {
    gap: 4,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBox: {
    width: 20,
    alignItems: "center",
    marginRight: 6,
  },
  contactText: {
    fontSize: 12.5,
    fontWeight: "400",
    flex: 1,
  },
  sparkleAccent: {
    position: "absolute",
    bottom: 10,
    right: 12,
    opacity: 0.9,
  },
});

export default ProfileHeaderCard;
