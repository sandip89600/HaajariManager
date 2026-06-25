import React from "react";
import { Modal, Pressable, View, StyleSheet, ScrollView } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface AppInfoModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AppInfoModal({ visible, onClose }: AppInfoModalProps) {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <View style={styles.header}>
            <ThemedText type="h2">Labour Attendance Manager</ThemedText>
            <Pressable onPress={onClose}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <ThemedText type="h3" style={styles.sectionTitle}>
                App Rules & Regulations
              </ThemedText>
            </View>

            <View style={styles.ruleSection}>
              <View style={styles.ruleTitleContainer}>
                <Feather name="lock" size={20} color={theme.primary} />
                <ThemedText type="h3" style={{ marginLeft: Spacing.md }}>
                  Login & Sign-In Rules
                </ThemedText>
              </View>
              <View style={styles.ruleContent}>
                <RuleItem
                  number="1"
                  title="Admin Access"
                  description="Admin login is restricted to authorized personnel only. Use email: sandeep@gmail.com and password: sandeep121"
                  theme={theme}
                />
                <RuleItem
                  number="2"
                  title="User Registration"
                  description="New users can sign up using email or mobile number. Mobile number signup requires OTP verification."
                  theme={theme}
                />
                <RuleItem
                  number="3"
                  title="Password Requirements"
                  description="Passwords must be at least 6 characters long for security purposes."
                  theme={theme}
                />
                <RuleItem
                  number="4"
                  title="Terms & Conditions"
                  description="All new users must accept Terms and Conditions during signup before accessing the app."
                  theme={theme}
                />
              </View>
            </View>

            <View style={styles.ruleSection}>
              <View style={styles.ruleTitleContainer}>
                <Feather name="check-square" size={20} color={theme.primary} />
                <ThemedText type="h3" style={{ marginLeft: Spacing.md }}>
                  Attendance Tracking Rules
                </ThemedText>
              </View>
              <View style={styles.ruleContent}>
                <RuleItem
                  number="1"
                  title="Marking Attendance"
                  description="Mark attendance as Present (P), Absent (A), or Half Day (H) as applicable."
                  theme={theme}
                />
                <RuleItem
                  number="2"
                  title="Profile Information"
                  description="Keep your profile information up to date including name, email, phone, and address."
                  theme={theme}
                />
                <RuleItem
                  number="3"
                  title="Account Security"
                  description="Never share your login credentials. Use the change password feature regularly for security."
                  theme={theme}
                />
              </View>
            </View>

            <View style={[styles.ruleSection, { marginBottom: Spacing.xl }]}>
              <View style={styles.ruleTitleContainer}>
                <Feather name="alert-circle" size={20} color={theme.primary} />
                <ThemedText type="h3" style={{ marginLeft: Spacing.md }}>
                  Important Notes
                </ThemedText>
              </View>
              <View style={styles.ruleContent}>
                <RuleItem
                  number="•"
                  title="Data Privacy"
                  description="Your personal information is encrypted and securely stored."
                  theme={theme}
                />
                <RuleItem
                  number="•"
                  title="Support"
                  description="Contact administrator for any issues or queries regarding login or attendance."
                  theme={theme}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

interface RuleItemProps {
  number: string;
  title: string;
  description: string;
  theme: any;
}

function RuleItem({ number, title, description, theme }: RuleItemProps) {
  return (
    <View style={styles.ruleItem}>
      <View
        style={[
          styles.numberCircle,
          { backgroundColor: theme.primary + "20", borderColor: theme.primary },
        ]}
      >
        <ThemedText
          type="body"
          style={{ fontWeight: "600", color: theme.primary }}
        >
          {number}
        </ThemedText>
      </View>
      <View style={{ flex: 1, marginLeft: Spacing.md }}>
        <ThemedText
          type="h4"
          style={{ fontWeight: "600", marginBottom: Spacing.xs }}
        >
          {title}
        </ThemedText>
        <ThemedText
          type="small"
          style={{ color: theme.textSecondary, lineHeight: 20 }}
        >
          {description}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    borderRadius: BorderRadius.lg,
    maxHeight: "85%",
    width: "100%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    fontWeight: "600",
  },
  ruleSection: {
    marginBottom: Spacing.xl,
  },
  ruleTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  ruleContent: {
    gap: Spacing.lg,
  },
  ruleItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  numberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    flexShrink: 0,
  },
});
