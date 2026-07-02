import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useTheme } from "@/hooks/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spacing, BorderRadius } from "@/constants/theme";
import { authenticatedFetch, API_URL } from "@/utils/storage";
import { useLanguage } from "@/hooks/useLanguage";
import { appContextTracker } from "@/utils/appContextTracker";

export default function PrivacySettingsScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = insets.bottom + 60;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Profile fields visibility
  const [profileVisibility, setProfileVisibility] = useState("public");
  const [attendanceVisibility, setAttendanceVisibility] = useState("only_me");
  const [analyticsConsent, setAnalyticsConsent] = useState(true);

  // Notifications preferences
  const [attendanceAlerts, setAttendanceAlerts] = useState(true);
  const [salaryAlerts, setSalaryAlerts] = useState(true);
  const [appUpdates, setAppUpdates] = useState(true);

  // Security preferences
  const [loginTracking, setLoginTracking] = useState(true);
  const [deviceTracking, setDeviceTracking] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      appContextTracker.setContext({
        currentScreen: "PrivacySettings",
      });
    });
    return unsubscribe;
  }, [navigation]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/auth/security/sessions`);
      if (res.ok) {
        const data = await res.json();
        if (data.privacySettings) {
          const settings = data.privacySettings;
          setProfileVisibility(settings.profileVisibility || "public");
          setAttendanceVisibility(settings.attendanceVisibility || "only_me");
          setAnalyticsConsent(settings.analyticsConsent !== false);

          if (settings.notificationPreferences) {
            setAttendanceAlerts(
              settings.notificationPreferences.attendanceAlerts !== false,
            );
            setSalaryAlerts(
              settings.notificationPreferences.salaryAlerts !== false,
            );
            setAppUpdates(
              settings.notificationPreferences.appUpdates !== false,
            );
          }
        }
      }
    } catch (e) {
      console.warn("Failed to load privacy settings from backend", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/auth/security/privacy`, {
        method: "PUT",
        body: JSON.stringify({
          profileVisibility,
          attendanceVisibility,
          analyticsConsent,
          notificationPreferences: {
            attendanceAlerts,
            salaryAlerts,
            appUpdates,
          },
          loginTracking,
          deviceTracking,
        }),
      });

      if (res.ok) {
        Alert.alert(t.common.success || "Success", t.privacy.saveSuccess);
        navigation.goBack();
      } else {
        Alert.alert(t.common.error || "Error", t.privacy.saveError);
      }
    } catch (e) {
      Alert.alert(t.common.error || "Error", t.privacy.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          { backgroundColor: theme.backgroundRoot },
        ]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.backgroundDefault,
            borderBottomColor: theme.border,
            paddingTop: insets.top || Spacing.md,
          },
        ]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="chevron-left" size={28} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">{t.privacy.title}</ThemedText>
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          style={styles.saveHeaderBtn}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <ThemedText style={{ color: theme.primary, fontWeight: "700" }}>
              {t.common.save || "Save"}
            </ThemedText>
          )}
        </Pressable>
      </View>

      <ScreenScrollView
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
        }}
      >
        {/* Profile Visibility */}
        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            {t.privacy.profileVisibility}
          </ThemedText>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
              },
            ]}
          >
            <RadioItem
              label={t.privacy.public}
              description={t.privacy.publicDesc}
              selected={profileVisibility === "public"}
              onPress={() => setProfileVisibility("public")}
              theme={theme}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <RadioItem
              label={t.privacy.private}
              description={t.privacy.privateDesc}
              selected={profileVisibility === "private"}
              onPress={() => setProfileVisibility("private")}
              theme={theme}
            />
          </View>
        </View>

        {/* Attendance Visibility */}
        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            {t.privacy.attendanceVisibility}
          </ThemedText>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
              },
            ]}
          >
            <RadioItem
              label={t.privacy.onlyMe}
              description={t.privacy.onlyMeDesc}
              selected={attendanceVisibility === "only_me"}
              onPress={() => setAttendanceVisibility("only_me")}
              theme={theme}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <RadioItem
              label={t.privacy.supervisors}
              description={t.privacy.supervisorsDesc}
              selected={attendanceVisibility === "supervisors"}
              onPress={() => setAttendanceVisibility("supervisors")}
              theme={theme}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <RadioItem
              label={t.privacy.companyAdmin}
              description={t.privacy.companyAdminDesc}
              selected={attendanceVisibility === "admin"}
              onPress={() => setAttendanceVisibility("admin")}
              theme={theme}
            />
          </View>
        </View>

        {/* Analytics Sharing */}
        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            {t.privacy.analyticsSharing}
          </ThemedText>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
              },
            ]}
          >
            <ToggleRow
              label={t.privacy.allowAnalytics}
              description={t.privacy.analyticsDesc}
              value={analyticsConsent}
              onValueChange={setAnalyticsConsent}
              theme={theme}
            />
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            {t.privacy.notifications}
          </ThemedText>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
              },
            ]}
          >
            <ToggleRow
              label={t.privacy.attendanceAlerts}
              description={t.privacy.attendanceAlertsDesc}
              value={attendanceAlerts}
              onValueChange={setAttendanceAlerts}
              theme={theme}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <ToggleRow
              label={t.privacy.salaryAlerts}
              description={t.privacy.salaryAlertsDesc}
              value={salaryAlerts}
              onValueChange={setSalaryAlerts}
              theme={theme}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <ToggleRow
              label={t.privacy.appUpdates}
              description={t.privacy.appUpdatesDesc}
              value={appUpdates}
              onValueChange={setAppUpdates}
              theme={theme}
            />
          </View>
        </View>

        {/* Account Security */}
        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            {t.privacy.accountSecurity}
          </ThemedText>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
              },
            ]}
          >
            <ToggleRow
              label={t.privacy.loginActivity}
              description={t.privacy.loginActivityDesc}
              value={loginTracking}
              onValueChange={setLoginTracking}
              theme={theme}
            />
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <ToggleRow
              label={t.privacy.deviceTracking}
              description={t.privacy.deviceTrackingDesc}
              value={deviceTracking}
              onValueChange={setDeviceTracking}
              theme={theme}
            />
          </View>
        </View>

        {/* Save Button */}
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          style={[styles.saveBtn, { backgroundColor: theme.primary }]}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <ThemedText style={styles.saveBtnText}>{t.privacy.saveChanges}</ThemedText>
          )}
        </Pressable>
      </ScreenScrollView>
    </View>
  );
}

// ─── HELPER COMPONENTS ──────────────────────────────────────────────────────

interface RadioItemProps {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  theme: any;
}

function RadioItem({
  label,
  description,
  selected,
  onPress,
  theme,
}: RadioItemProps) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={{ flex: 1, marginRight: Spacing.md }}>
        <ThemedText style={{ fontWeight: "700", fontSize: 16 }}>
          {label}
        </ThemedText>
        <ThemedText
          type="small"
          style={{ color: theme.textSecondary, marginTop: 2 }}
        >
          {description}
        </ThemedText>
      </View>
      <View
        style={[
          styles.radioCircle,
          {
            borderColor: selected ? theme.primary : theme.border,
            backgroundColor: "transparent",
          },
        ]}
      >
        {selected && (
          <View style={[styles.radioDot, { backgroundColor: theme.primary }]} />
        )}
      </View>
    </Pressable>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  theme: any;
}

function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  theme,
}: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, marginRight: Spacing.md }}>
        <ThemedText style={{ fontWeight: "700", fontSize: 16 }}>
          {label}
        </ThemedText>
        <ThemedText
          type="small"
          style={{ color: theme.textSecondary, marginTop: 2 }}
        >
          {description}
        </ThemedText>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  saveHeaderBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    fontWeight: "700",
  },
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  divider: {
    height: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  saveBtn: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
});
