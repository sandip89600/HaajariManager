import React from "react";
import { View, StyleSheet, Pressable, Image, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
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
  onQrPress?: () => void;
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
  onQrPress,
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
          backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
          borderColor: isDark ? "#334155" : "#E2E8F0",
        },
      ]}
    >
      <LinearGradient
        colors={isDark ? ["#1E293B", "#0F172A"] : ["#FFFFFF", "#F8FAFC"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        <View style={styles.cardContent}>
          {/* ── Left Side: Avatar with edit photo badge ── */}
          <Pressable
            onPress={onAvatarPress || onEditPress}
            style={styles.avatarTouchArea}
          >
            <LinearGradient
              colors={["#10B981", "#14B8A6", "#06B6D4"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarCircle}
            >
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.initialsContainer}>
                  <ThemedText style={styles.avatarInitialsText}>
                    {initials}
                  </ThemedText>
                </View>
              )}
            </LinearGradient>

            {/* Small camera/edit badge on avatar */}
            <View
              style={[
                styles.avatarBadge,
                {
                  backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                  borderColor: isDark ? "#475569" : "#CBD5E1",
                },
              ]}
            >
              <Feather
                name="camera"
                size={10}
                color={isDark ? "#38BDF8" : "#0284C7"}
              />
            </View>
          </Pressable>

          {/* ── Center & Right: User Details & Top Actions ── */}
          <View style={styles.detailsContainer}>
            {/* Top Row: User Name & Action Buttons (QR & Edit) */}
            <View style={styles.topRow}>
              <ThemedText
                style={[styles.nameText, { color: theme.text }]}
                numberOfLines={1}
              >
                {name || "Ganesh Pandit"}
              </ThemedText>

              <View style={styles.actionsContainer}>
                {onQrPress ? (
                  <Pressable
                    onPress={onQrPress}
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.qrBtn,
                      {
                        backgroundColor: isDark
                          ? "rgba(59, 130, 246, 0.18)"
                          : "#EFF6FF",
                        borderColor: isDark
                          ? "rgba(59, 130, 246, 0.4)"
                          : "#BFDBFE",
                        transform: [{ scale: pressed ? 0.94 : 1 }],
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="qrcode"
                      size={15}
                      color={isDark ? "#60A5FA" : "#2563EB"}
                    />
                    <ThemedText
                      style={[
                        styles.qrBtnText,
                        { color: isDark ? "#93C5FD" : "#1D4ED8" },
                      ]}
                    >
                      QR
                    </ThemedText>
                  </Pressable>
                ) : null}

                {onEditPress ? (
                  <Pressable
                    onPress={onEditPress}
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.editActionBtn,
                      {
                        backgroundColor: isDark
                          ? "rgba(249, 115, 22, 0.15)"
                          : "#FFF7ED",
                        borderColor: isDark
                          ? "rgba(249, 115, 22, 0.35)"
                          : "#FED7AA",
                        transform: [{ scale: pressed ? 0.94 : 1 }],
                      },
                    ]}
                  >
                    <Feather name="edit-2" size={12} color="#EA580C" />
                    <ThemedText style={styles.editActionBtnText}>
                      Edit
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {/* Contact Details List */}
            <View style={styles.contactList}>
              {/* Phone Row */}
              {phone ? (
                <View style={styles.contactItem}>
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor: isDark
                          ? "rgba(148, 163, 184, 0.12)"
                          : "#F1F5F9",
                      },
                    ]}
                  >
                    <Feather
                      name="phone"
                      size={11}
                      color={isDark ? "#94A3B8" : "#64748B"}
                    />
                  </View>
                  <ThemedText
                    style={[styles.contactText, { color: theme.textSecondary }]}
                    numberOfLines={1}
                  >
                    {phone}
                  </ThemedText>
                </View>
              ) : null}

              {/* Email Row */}
              {email ? (
                <View style={styles.contactItem}>
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor: isDark
                          ? "rgba(148, 163, 184, 0.12)"
                          : "#F1F5F9",
                      },
                    ]}
                  >
                    <Feather
                      name="mail"
                      size={11}
                      color={isDark ? "#94A3B8" : "#64748B"}
                    />
                  </View>
                  <ThemedText
                    style={[styles.contactText, { color: theme.textSecondary }]}
                    numberOfLines={1}
                  >
                    {email}
                  </ThemedText>
                </View>
              ) : null}

              {/* Company Row */}
              {companyName ? (
                <View style={styles.contactItem}>
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor: isDark
                          ? "rgba(148, 163, 184, 0.12)"
                          : "#F1F5F9",
                      },
                    ]}
                  >
                    <Feather
                      name="briefcase"
                      size={11}
                      color={isDark ? "#94A3B8" : "#64748B"}
                    />
                  </View>
                  <ThemedText
                    style={[
                      styles.contactText,
                      { color: theme.textSecondary, fontWeight: "500" },
                    ]}
                    numberOfLines={1}
                  >
                    {companyName}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginVertical: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardGradient: {
    padding: 16,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarTouchArea: {
    marginRight: 14,
    position: "relative",
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.35)",
    ...Platform.select({
      ios: {
        shadowColor: "#10B981",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  initialsContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitialsText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
    textShadowColor: "rgba(0, 0, 0, 0.25)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  avatarBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
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
    gap: 8,
  },
  nameText: {
    fontSize: 16,
    fontWeight: "800",
    flex: 1,
    letterSpacing: 0.2,
  },
  actionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  qrBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
  },
  qrBtnText: {
    fontSize: 11,
    fontWeight: "700",
  },
  editActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  editActionBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#EA580C",
  },
  contactList: {
    gap: 4,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  contactText: {
    fontSize: 12,
    fontWeight: "400",
    flex: 1,
  },
});

export default ProfileHeaderCard;
