import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  Platform,
  Modal,
  TextInput,
  Linking,
  ActivityIndicator,
  Dimensions,
  Image,
  DeviceEventEmitter,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { Feather, FontAwesome } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { translateWorkerName } from "@/utils/transliteration";
import { appContextTracker } from "@/utils/appContextTracker";
import { useAuth } from "@/hooks/useAuth";
import { Language, languageNames } from "@/constants/i18n";
import { Spacing, BorderRadius, Colors, Shadows } from "@/constants/theme";
import {
  storage,
  User,
  Project,
  authenticatedFetch,
  API_URL,
  STORAGE_KEYS,
  STORAGE_KEYS_EXT,
  VoiceSettings,
  DEFAULT_VOICE_SETTINGS,
} from "@/utils/storage";
import {
  scheduleAttendanceReminder,
  cancelAttendanceReminder,
  scheduleSalaryReminder,
  cancelAllReminders,
  requestNotificationPermission,
  DEFAULT_NOTIFICATION_SETTINGS,
} from "@/utils/notifications";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── UTILITY SETTING ROW COMPONENT ───────────────────────────────────────────
interface RowProps {
  icon: string;
  iconColor: string;
  label: string;
  sublabel?: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  isLast?: boolean;
  theme: typeof Colors.light;
  delay?: number;
}

function SettingRow({
  icon,
  iconColor,
  label,
  sublabel,
  value,
  onPress,
  right,
  isLast = false,
  theme,
}: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.row,
        {
          borderBottomColor: theme.border,
          borderBottomWidth: isLast ? 0 : 0.8,
        },
      ]}
    >
      <View
        style={[styles.rowIconWrapper, { backgroundColor: iconColor + "15" }]}
      >
        <Feather name={icon as any} size={16} color={iconColor} />
      </View>
      <View style={styles.rowInfo}>
        <ThemedText type="body" style={styles.rowLabel}>
          {label}
        </ThemedText>
        {sublabel ? (
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, marginTop: 1 }}
          >
            {sublabel}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.rowRight}>
        {value ? (
          <ThemedText
            type="body"
            style={[styles.rowValue, { color: theme.textSecondary }]}
          >
            {value}
          </ThemedText>
        ) : null}
        {right}
        {onPress && !right ? (
          <Feather name="chevron-right" size={16} color={theme.textSecondary} />
        ) : null}
      </View>
    </Pressable>
  );
}

// ─── CARD WRAPPER ────────────────────────────────────────────────────────────
function SettingCard({
  children,
  theme,
  isDark,
}: {
  children: React.ReactNode;
  theme: any;
  isDark: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundDefault,
          borderColor: theme.border,
        },
      ]}
    >
      {children}
    </View>
  );
}

// ─── MAIN SETTINGS SCREEN ────────────────────────────────────────────────────
export default function SettingsScreen() {
  const { theme, themeMode, setThemeMode, isDark } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { user: authUser, logout, isGuest } = useAuth();

  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const finalHeaderHeight =
    headerHeight > 0
      ? headerHeight
      : insets.top + Platform.select({ ios: 44, default: 56 });
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // State Declarations
  const SCREEN_HEIGHT = Dimensions.get("window").height;
  const [currentUser, setCurrentUser] = useState<User | null>(authUser || null);
  const [currentPlan, setCurrentPlan] = useState<
    "free" | "professional" | "business"
  >("free");
  const [notifSettings, setNotifSettings] = useState(
    DEFAULT_NOTIFICATION_SETTINGS,
  );
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [langSearch, setLangSearch] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Voice Settings States
  const [voiceSettings, setVoiceSettingsState] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [showSpeedModal, setShowSpeedModal] = useState(false);
  const [showPitchModal, setShowPitchModal] = useState(false);
  const [liveModeEnabled, setLiveModeEnabled] = useState(true);
  const [voiceConfirmationEnabled, setVoiceConfirmationEnabled] = useState(true);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [highSensitivityEnabled, setHighSensitivityEnabled] = useState(true);

  useEffect(() => {
    if (route.params?.openUpgrade) {
      setShowUpgradeModal(true);
      // Clear the params so it doesn't trigger again on subsequent focuses
      navigation.setParams({ openUpgrade: undefined });
    }
  }, [route.params?.openUpgrade]);

  // Storage metrics
  const [metrics, setMetrics] = useState({
    storageUsed: "0 KB",
    workersCount: 0,
    attendanceCount: 0,
  });

  // Builder Modals
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companyNameInput, setCompanyNameInput] = useState("");
  const [showContractorsModal, setShowContractorsModal] = useState(false);

  // Supervisor Modals
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [showWorkersModal, setShowWorkersModal] = useState(false);
  const [supervisorProjects, setSupervisorProjects] = useState<Project[]>([]);
  const [supervisorWorkers, setSupervisorWorkers] = useState<any[]>([]);

  // Toggles local states
  const [otpVerification, setOtpVerification] = useState(true);
  const [biometricLogin, setBiometricLogin] = useState(false);

  // Support Modals States
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubject, setReportSubject] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportScreenshot, setReportScreenshot] = useState("");
  const [isReporting, setIsReporting] = useState(false);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadProfileAndState();
      loadNotifSettings();
      loadVoiceSettings();
      loadMetrics();
      appContextTracker.setContext({
        currentScreen: "Settings",
      });
    }, []),
  );

  const loadProfileAndState = async () => {
    const auth = await storage.getAuth();
    if (auth?.userId) {
      const userData = await storage.getUserById(auth.userId);
      if (userData) {
        setCurrentUser(userData);
        if (userData.plan) {
          setCurrentPlan(userData.plan as any);
        }
      }
    }
    if (auth?.plan && (!currentUser || !currentUser.plan)) {
      setCurrentPlan(auth.plan as any);
    }

    if (!isGuest) {
      try {
        const res = await authenticatedFetch(
          `${API_URL}/auth/security/sessions`,
        );
        if (res.ok) {
          const data = await res.json();
          setOtpVerification(data.otpEnabled || false);
          setBiometricLogin(data.biometricEnabled || false);
        }
      } catch (err) {
        console.warn("Failed to load security settings", err);
      }
    }
  };

  const handleToggleOtp = async (value: boolean) => {
    try {
      const res = await authenticatedFetch(`${API_URL}/auth/security/otp`, {
        method: "PUT",
        body: JSON.stringify({ otpEnabled: value }),
      });
      if (res.ok) {
        setOtpVerification(value);
        Alert.alert(
          "Success",
          `OTP verification ${value ? "enabled" : "disabled"}.`,
        );
      } else {
        Alert.alert("Error", "Failed to update OTP setting.");
      }
    } catch (e) {
      Alert.alert("Error", "Could not connect to server.");
    }
  };

  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHardware || !isEnrolled) {
          Alert.alert(
            "Error",
            "Biometric authentication is not supported or set up on this device.",
          );
          return;
        }

        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Authenticate to enable Biometric Login",
          fallbackLabel: "Use Passcode",
        });

        if (result.success) {
          const token = Array.from({ length: 32 }, () =>
            Math.floor(Math.random() * 16).toString(16),
          ).join("");
          const phone = currentUser?.phone || authUser?.phone;
          if (!phone) {
            Alert.alert("Error", "User phone number not found.");
            return;
          }

          const res = await authenticatedFetch(
            `${API_URL}/auth/register-biometric`,
            {
              method: "POST",
              body: JSON.stringify({ biometricToken: token }),
            },
          );

          if (res.ok) {
            await SecureStore.setItemAsync("biometric_token", token);
            await SecureStore.setItemAsync("biometric_phone", phone);
            setBiometricLogin(true);
            Alert.alert("Success", "Biometric login enabled successfully.");
          } else {
            const data = await res.json();
            Alert.alert(
              "Error",
              data.error || "Failed to register biometrics on the server.",
            );
          }
        }
      } catch (err: any) {
        Alert.alert("Error", "Biometric authentication failed: " + err.message);
      }
    } else {
      try {
        const res = await authenticatedFetch(
          `${API_URL}/auth/security/biometrics`,
          {
            method: "PUT",
            body: JSON.stringify({ biometricEnabled: false }),
          },
        );

        if (res.ok) {
          await SecureStore.deleteItemAsync("biometric_token");
          await SecureStore.deleteItemAsync("biometric_phone");
          setBiometricLogin(false);
          Alert.alert("Success", "Biometric login disabled.");
        } else {
          Alert.alert("Error", "Failed to disable biometric login on server.");
        }
      } catch (e) {
        Alert.alert("Error", "Could not connect to server.");
      }
    }
  };

  const loadNotifSettings = async () => {
    const saved = await storage.getNotificationSettings();
    if (saved) setNotifSettings(saved);
  };

  const loadVoiceSettings = async () => {
    const saved = await storage.getVoiceSettings();
    setVoiceSettingsState(saved);
    try {
      const liveModeSaved = await AsyncStorage.getItem("voice_live_mode");
      if (liveModeSaved !== null) setLiveModeEnabled(JSON.parse(liveModeSaved));
      
      const voiceConfSaved = await AsyncStorage.getItem("voice_confirmation");
      if (voiceConfSaved !== null) setVoiceConfirmationEnabled(JSON.parse(voiceConfSaved));
      
      const wakeWordSaved = await AsyncStorage.getItem("voice_wake_word");
      if (wakeWordSaved !== null) setWakeWordEnabled(JSON.parse(wakeWordSaved));
      
      const micSensSaved = await AsyncStorage.getItem("voice_mic_sensitivity");
      if (micSensSaved !== null) setHighSensitivityEnabled(JSON.parse(micSensSaved));
    } catch (err) {
      console.warn("Failed to load local voice toggles:", err);
    }
  };

  const handleVoiceToggle = async (val: boolean) => {
    const updated = { ...voiceSettings, enabled: val };
    setVoiceSettingsState(updated);
    await storage.setVoiceSettings(updated);
    DeviceEventEmitter.emit("voiceSettingsChanged", updated);
  };

  const handleToggleLiveMode = async (val: boolean) => {
    setLiveModeEnabled(val);
    await AsyncStorage.setItem("voice_live_mode", JSON.stringify(val));
    DeviceEventEmitter.emit("voiceLiveModeChanged", val);
  };

  const handleToggleVoiceConf = async (val: boolean) => {
    setVoiceConfirmationEnabled(val);
    await AsyncStorage.setItem("voice_confirmation", JSON.stringify(val));
    DeviceEventEmitter.emit("voiceConfirmationChanged", val);
  };

  const handleToggleWakeWord = async (val: boolean) => {
    setWakeWordEnabled(val);
    await AsyncStorage.setItem("voice_wake_word", JSON.stringify(val));
    DeviceEventEmitter.emit("voiceWakeWordChanged", val);
  };

  const handleToggleMicSens = async (val: boolean) => {
    setHighSensitivityEnabled(val);
    await AsyncStorage.setItem("voice_mic_sensitivity", JSON.stringify(val));
    DeviceEventEmitter.emit("voiceMicSensitivityChanged", val);
  };

  const handleVoiceSpeedSelect = async (speed: number) => {
    const updated = { ...voiceSettings, speed };
    setVoiceSettingsState(updated);
    await storage.setVoiceSettings(updated);
    DeviceEventEmitter.emit("voiceSettingsChanged", updated);
    setShowSpeedModal(false);
  };

  const handleVoicePitchSelect = async (pitch: number) => {
    const updated = { ...voiceSettings, pitch };
    setVoiceSettingsState(updated);
    await storage.setVoiceSettings(updated);
    DeviceEventEmitter.emit("voiceSettingsChanged", updated);
    setShowPitchModal(false);
  };

  const loadMetrics = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const items = await AsyncStorage.multiGet(keys);
      let totalSize = 0;
      items.forEach(([key, val]) => {
        if (val) totalSize += key.length + val.length;
      });
      const formattedSize =
        totalSize > 1024 * 1024
          ? `${(totalSize / (1024 * 1024)).toFixed(2)} MB`
          : `${(totalSize / 1024).toFixed(2)} KB`;

      const workers = await storage.getWorkers();
      const rawAttendance = await AsyncStorage.getItem(STORAGE_KEYS.ATTENDANCE);
      const attendance = rawAttendance ? JSON.parse(rawAttendance) : [];

      setMetrics({
        storageUsed: formattedSize,
        workersCount: workers.length,
        attendanceCount: attendance.length,
      });

      // If supervisor, load assigned projects and workers for supervisor modal viewing
      const auth = await storage.getAuth();
      if (auth?.userId) {
        const userData = await storage.getUserById(auth.userId);
        if (userData && userData.role === "supervisor") {
          const assignedIds = userData.assignedProjects || [];
          const allProjects = await storage.getProjects();
          const filteredProj = allProjects.filter((p) =>
            assignedIds.includes(p.id),
          );
          setSupervisorProjects(filteredProj);

          const filteredWorkers = workers.filter(
            (w) => w.projectId && assignedIds.includes(w.projectId),
          );
          setSupervisorWorkers(filteredWorkers);
        }
      }
    } catch (e) {
      console.warn("Failed to load metrics", e);
    }
  };

  const changeTheme = async (mode: "light" | "dark" | "system") => {
    setShowThemeModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setThemeMode(mode);
  };

  const handleLangSelect = async (lang: Language) => {
    setShowLangModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setLanguage(lang);
  };

  // ─── REMINDERS TOGGLES ──────────────────────────────────────────────────────
  const handleAttendanceReminderToggle = async (enabled: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          t.notifications.permissionDenied,
          t.notifications.permissionRequired,
        );
        return;
      }
      await scheduleAttendanceReminder(
        notifSettings.reminderHour,
        notifSettings.reminderMinute,
      );
    } else {
      await cancelAttendanceReminder();
    }
    const updated = { ...notifSettings, attendanceReminderEnabled: enabled };
    setNotifSettings(updated);
    await storage.setNotificationSettings(updated);
  };

  const handleSalaryReminderToggle = async (enabled: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          t.notifications.permissionDenied,
          t.notifications.permissionRequired,
        );
        return;
      }
      await scheduleSalaryReminder();
    } else {
      await cancelAllReminders();
      if (notifSettings.attendanceReminderEnabled) {
        await scheduleAttendanceReminder(
          notifSettings.reminderHour,
          notifSettings.reminderMinute,
        );
      }
    }
    const updated = { ...notifSettings, salaryReminderEnabled: enabled };
    setNotifSettings(updated);
    await storage.setNotificationSettings(updated);
  };

  // ─── DATA MANAGEMENT ACTIONS ───────────────────────────────────────────────
  const handleBackup = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const json = await storage.exportAllData();
      const filename =
        (FileSystem.documentDirectory ?? "") +
        `haajari_backup_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(filename, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filename, {
          mimeType: "application/json",
          UTI: "public.json",
        });
      } else {
        Alert.alert("Success", "Backup file created locally.");
      }
    } catch {
      Alert.alert("Error", "Failed to create backup.");
    }
  };

  const handleRestore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Restore Data",
      "This will replace ALL local app data with the backup file. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: "application/json",
                copyToCacheDirectory: true,
              });
              if (result.canceled) return;
              const json = await FileSystem.readAsStringAsync(
                result.assets[0].uri,
              );
              await storage.importAllData(json);
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              Alert.alert(
                "Success",
                "Data restored successfully. Restart the app to apply all changes.",
              );
              await loadMetrics();
            } catch {
              Alert.alert("Error", "Failed to restore backup file.");
            }
          },
        },
      ],
    );
  };

  const handleSyncData = async () => {
    if (isGuest) {
      Alert.alert("Guest Mode", "Sync is disabled in Guest Mode.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSyncing(true);
    try {
      await storage.syncWithBackend();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Data successfully synced with Cloud database.");
      await loadMetrics();
    } catch {
      Alert.alert("Error", "Cloud synchronization failed.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportData = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Export Data", "Select export format:", [
      {
        text: "JSON Backup File",
        onPress: handleBackup,
      },
      {
        text: "Worker Directory (CSV)",
        onPress: async () => {
          try {
            const workers = await storage.getWorkers();
            if (workers.length === 0) {
              Alert.alert("No Data", "No workers available to export.");
              return;
            }
            let csv = "Name,Phone,Category,Daily Rate,Address,Notes\n";
            workers.forEach((w) => {
              csv += `"${w.name}","${w.phone}","${w.category}",${w.dailyRate},"${w.address || ""}","${w.notes || ""}"\n`;
            });
            const filename =
              (FileSystem.documentDirectory ?? "") +
              `haajari_workers_${Date.now()}.csv`;
            await FileSystem.writeAsStringAsync(filename, csv, {
              encoding: FileSystem.EncodingType.UTF8,
            });

            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
              await Sharing.shareAsync(filename, {
                mimeType: "text/csv",
                UTI: "public.comma-separated-values-text",
              });
            } else {
              Alert.alert("Success", "CSV file exported.");
            }
          } catch {
            Alert.alert("Error", "Failed to export workers.");
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleClearCache = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const cacheDir = FileSystem.cacheDirectory;
      if (cacheDir) {
        const files = await FileSystem.readDirectoryAsync(cacheDir);
        for (const file of files) {
          await FileSystem.deleteAsync(cacheDir + file, { idempotent: true });
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Cache memory cleared successfully.");
      await loadMetrics();
    } catch {
      Alert.alert("Success", "Cache cleared.");
    }
  };

  // ─── BUILDER SPECIFIC ACTIONS ──────────────────────────────────────────────
  const handleOpenCompanyModal = () => {
    setCompanyNameInput(currentUser?.companyName || "");
    setShowCompanyModal(true);
  };

  const handleUpdateCompany = async () => {
    if (!companyNameInput.trim()) {
      Alert.alert("Error", "Company Name cannot be empty");
      return;
    }
    try {
      setIsSyncing(true);
      const res = await authenticatedFetch(`${API_URL}/auth/profile`, {
        method: "PUT",
        body: JSON.stringify({
          name: currentUser?.name,
          phone: currentUser?.phone,
          companyName: companyNameInput.trim(),
        }),
      });

      if (res.ok) {
        const resData = await res.json();
        if (currentUser) {
          const updated = {
            ...currentUser,
            companyName: resData.user.companyName,
          };
          await storage.updateUser(updated);
          setCurrentUser(updated);
        }
        setShowCompanyModal(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Success", "Company name updated successfully.");
      } else {
        Alert.alert("Error", "Failed to update company name on server.");
      }
    } catch {
      // Offline fallback
      if (currentUser) {
        const updated = {
          ...currentUser,
          companyName: companyNameInput.trim(),
        };
        await storage.updateUser(updated);
        setCurrentUser(updated);
      }
      setShowCompanyModal(false);
      Alert.alert("Offline Success", "Company name updated locally.");
    } finally {
      setIsSyncing(false);
    }
  };

  // ─── SUBSCRIPTION UPGRADE FLOW ──────────────────────────────────────────────
  const handleUpgrade = async (plan: "pro" | "business") => {
    const planName = plan === "pro" ? "Professional" : "Business";
    const paymentLinks = {
      pro: "https://rzp.io/rzp/6bP0p3Q",
      business: "https://rzp.io/rzp/6bP0p3Q",
    };

    const baseLink = paymentLinks[plan];
    const emailStr = currentUser?.phone || "";
    const paymentUrl = `${baseLink}?email=${encodeURIComponent(emailStr)}&name=${encodeURIComponent(currentUser?.name || "")}`;

    try {
      setShowUpgradeModal(false);
      const result = await WebBrowser.openBrowserAsync(paymentUrl);
      if (result.type === "cancel") {
        Alert.alert("Payment Cancelled", "Subscription process was cancelled.");
      } else {
        const backendPlan: "professional" | "business" =
          plan === "pro" ? "professional" : "business";

        // Update subscription plan on backend
        const res = await authenticatedFetch(`${API_URL}/auth/upgrade`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: backendPlan }),
        });

        if (!res.ok) {
          throw new Error("Failed to update subscription on server");
        }

        // Sync local storage and state
        if (currentUser) {
          const updatedUser = { ...currentUser, plan: backendPlan };
          await storage.updateUser(updatedUser);
          setCurrentUser(updatedUser);

          const auth = await storage.getAuth();
          if (auth) {
            auth.plan = backendPlan;
            await storage.setAuth(auth);
          }
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Success", `Your Haajari ${planName} Plan is now active.`);
      }
    } catch (error) {
      console.warn("Failed to open Razorpay / update plan:", error);
      Alert.alert("Error", "Could not complete the plan upgrade.");
    }
  };

  // ─── LOGOUT FLOW ───────────────────────────────────────────────────────────
  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // On web, Alert.alert buttons are unreliable — use window.confirm instead
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to logout?");
      if (confirmed) {
        await logout();
      }
      return;
    }

    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  // ─── SUPPORT HELPERS ───────────────────────────────────────────────────────
  const handleWhatsAppSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const phoneNumber = "+917057942248";
    const message = "Hi Haajari Support Team, I need help with my account...";
    const url = `https://wa.me/${phoneNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(message)}`;

    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      Linking.openURL(url).catch(() =>
        Alert.alert("Error", "WhatsApp is not installed on this device."),
      );
    }
  };

  const handleEmailSupport = () => {
    const url = "mailto:info.haajariapp@gmail.com";
    if (Platform.OS === "web") {
      window.location.href = url;
    } else {
      Linking.openURL(url).catch(() =>
        Alert.alert("Error", "Could not open email client."),
      );
    }
  };

  const handlePhoneSupport = () => {
    const url = "tel:+917057942248";
    if (Platform.OS === "web") {
      window.location.href = url;
    } else {
      Linking.openURL(url).catch(() =>
        Alert.alert("Error", "Could not open phone dialer."),
      );
    }
  };

  const handleReportSubmit = async () => {
    if (!reportSubject.trim() || !reportDescription.trim()) {
      if (Platform.OS === "web")
        alert("Error: Subject and description are required.");
      else Alert.alert("Error", "Subject and description are required.");
      return;
    }

    setIsReporting(true);
    try {
      const res = await authenticatedFetch(
        `${API_URL}/support/report-problem`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: reportSubject,
            description: reportDescription,
            screenshot: reportScreenshot || undefined,
          }),
        },
      );

      if (res.ok) {
        if (Platform.OS === "web") {
          alert(
            "Your issue has been reported successfully. Our team will contact you soon.",
          );
        } else {
          Alert.alert(
            "Success",
            "Your issue has been reported successfully. Our team will contact you soon.",
          );
        }
        setShowReportModal(false);
        setReportSubject("");
        setReportDescription("");
        setReportScreenshot("");
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit report");
      }
    } catch (err: any) {
      if (Platform.OS === "web") alert("Error: " + err.message);
      else Alert.alert("Error", err.message);
    } finally {
      setIsReporting(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackText.trim()) {
      if (Platform.OS === "web")
        alert("Error: Feedback comments cannot be empty.");
      else Alert.alert("Error", "Feedback comments cannot be empty.");
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      const res = await authenticatedFetch(`${API_URL}/support/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: feedbackRating,
          feedback: feedbackText,
        }),
      });

      if (res.ok) {
        if (Platform.OS === "web") {
          alert("Thank you for your feedback.");
        } else {
          Alert.alert("Success", "Thank you for your feedback.");
        }
        setShowFeedbackModal(false);
        setFeedbackRating(5);
        setFeedbackText("");
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit feedback");
      }
    } catch (err: any) {
      if (Platform.OS === "web") alert("Error: " + err.message);
      else Alert.alert("Error", err.message);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Label color utilities
  const getRoleLabel = (r?: string) => {
    if (!r) return "";
    if (r === "contractor") return "👷 Contractor";
    if (r === "builder") return "🏗️ Builder / Owner";
    if (r === "supervisor") return "👨💼 Supervisor";
    return r.toUpperCase();
  };

  const getRoleColor = (r?: string) => {
    if (!r) return theme.primary;
    if (r === "contractor") return "#FF6B35";
    if (r === "builder") return "#2196F3";
    if (r === "supervisor") return "#4CAF50";
    return theme.primary;
  };

  const getPlanLabel = (p: string) => {
    if (p === "free") return "Free";
    if (p === "professional" || p === "pro") return "Professional";
    if (p === "business") return "Business";
    return p;
  };

  const getPlanColor = (p: string) => {
    if (p === "free") return "#9E9E9E";
    if (p === "professional" || p === "pro") return "#7C3AED";
    if (p === "business") return "#E53935";
    return theme.primary;
  };

  const initials = (translateWorkerName(currentUser?.name || "", language) || "?").charAt(0).toUpperCase();

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: finalHeaderHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing["5xl"],
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >


        {/* ─── GUEST BANNER ─── */}
        {isGuest && (
          <View
            style={[
              styles.guestBanner,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.border,
              },
            ]}
          >
            <Feather name="shield" size={18} color="#FF6B35" />
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <ThemedText style={{ fontWeight: "700" }}>
                Guest Access Enabled
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Sign up to store attendance in the cloud database.
              </ThemedText>
            </View>
          </View>
        )}

        {/* ─── 2. BUSINESS MANAGEMENT SECTION (DYNAMIC) ─── */}
        {!isGuest && currentUser && (
          <>
            <ThemedText type="small" style={styles.sectionLabel}>
              {t.settings.businessManagement}
            </ThemedText>
            <SettingCard theme={theme} isDark={isDark}>
              {currentUser.role === "contractor" && (
                <>
                  <SettingRow
                    icon="users"
                    iconColor="#00BCD4"
                    label={t.settings.manageWorkers}
                    sublabel={t.settings.manageWorkersDesc}
                    onPress={() => navigation.navigate("AttendanceTab", { screen: "Workers" })}
                    theme={theme}
                  />
                  <SettingRow
                    icon="map"
                    iconColor="#FF9800"
                    label={t.settings.manageProjects}
                    sublabel={t.settings.manageProjectsDesc}
                    onPress={() => navigation.navigate("ProjectManagement")}
                    theme={theme}
                  />
                  <SettingRow
                    icon="shield"
                    iconColor="#7C3AED"
                    label={t.settings.supervisorManagement}
                    sublabel={t.settings.supervisorManagementDesc}
                    onPress={() => navigation.navigate("SupervisorManagement")}
                    theme={theme}
                  />
                  <SettingRow
                    icon="grid"
                    iconColor="#FF5722"
                    label={t.settings.siteManagement}
                    sublabel={t.settings.siteManagementDesc}
                    onPress={() => navigation.navigate("SiteManagement")}
                    isLast
                    theme={theme}
                  />
                </>
              )}

              {currentUser.role === "builder" && (
                <>
                  <SettingRow
                    icon="briefcase"
                    iconColor="#9C27B0"
                    label={t.settings.companyManagement}
                    sublabel={t.settings.companyManagementDesc}
                    onPress={handleOpenCompanyModal}
                    theme={theme}
                  />
                  <SettingRow
                    icon="users"
                    iconColor="#4CAF50"
                    label={t.settings.contractorManagement}
                    sublabel={t.settings.contractorManagementDesc}
                    onPress={() => setShowContractorsModal(true)}
                    theme={theme}
                  />
                  <SettingRow
                    icon="bar-chart-2"
                    iconColor="#03A9F4"
                    label={t.settings.businessAnalytics}
                    sublabel={t.settings.businessAnalyticsDesc}
                    onPress={() => navigation.navigate("AttendanceTab", { screen: "Summary" })}
                    theme={theme}
                  />
                  <SettingRow
                    icon="grid"
                    iconColor="#FF5722"
                    label={t.settings.siteManagement}
                    sublabel={t.settings.siteManagementDesc}
                    onPress={() => navigation.navigate("SiteManagement")}
                    isLast
                    theme={theme}
                  />
                </>
              )}

              {currentUser.role === "supervisor" && (
                <>
                  <SettingRow
                    icon="map-pin"
                    iconColor="#E91E63"
                    label={t.settings.assignedProjects}
                    sublabel={t.settings.assignedProjectsDesc}
                    onPress={() => setShowProjectsModal(true)}
                    theme={theme}
                  />
                  <SettingRow
                    icon="users"
                    iconColor="#00BCD4"
                    label={t.settings.assignedWorkers}
                    sublabel={t.settings.assignedWorkersDesc}
                    onPress={() => setShowWorkersModal(true)}
                    theme={theme}
                  />
                  <SettingRow
                    icon="grid"
                    iconColor="#FF5722"
                    label={t.settings.siteManagement}
                    sublabel={t.settings.siteManagementDesc}
                    onPress={() => navigation.navigate("SiteManagement")}
                    isLast
                    theme={theme}
                  />
                </>
              )}
            </SettingCard>
          </>
        )}

        {/* ─── 3. SUBSCRIPTION & BILLING SECTION ─── */}
        {!isGuest && (
          <>
            <ThemedText type="small" style={styles.sectionLabel}>
              {t.settings.subscriptionBilling}
            </ThemedText>
            <SettingCard theme={theme} isDark={isDark}>
              <SettingRow
                icon="credit-card"
                iconColor="#3F51B5"
                label={t.settings.currentPlan}
                value={getPlanLabel(currentPlan)}
                theme={theme}
              />
              <SettingRow
                icon="calendar"
                iconColor="#607D8B"
                label={t.settings.planExpiryDate}
                value={t.settings.autoRenews}
                theme={theme}
              />
              <SettingRow
                icon="trending-up"
                iconColor="#E040FB"
                label={t.settings.upgradePlan}
                sublabel={t.settings.upgradePlanDesc}
                onPress={() => setShowUpgradeModal(true)}
                isLast
                theme={theme}
              />
            </SettingCard>
          </>
        )}

        {/* ─── 5. NOTIFICATIONS SECTION ─── */}
        <ThemedText type="small" style={styles.sectionLabel}>
          {t.settings.notifications}
        </ThemedText>
        <SettingCard theme={theme} isDark={isDark}>
          <SettingRow
            icon="bell"
            iconColor="#9C27B0"
            label={t.settings.attendanceReminderShort}
            sublabel={t.settings.attendanceReminderShortDesc}
            right={
              <Switch
                value={notifSettings.attendanceReminderEnabled}
                onValueChange={handleAttendanceReminderToggle}
                trackColor={{ false: theme.border, true: "#4CAF50" }}
                thumbColor="#FFFFFF"
              />
            }
            theme={theme}
          />
          <SettingRow
            icon="dollar-sign"
            iconColor="#4CAF50"
            label={t.settings.salaryReminderShort}
            sublabel={t.settings.salaryReminderShortDesc}
            right={
              <Switch
                value={notifSettings.salaryReminderEnabled}
                onValueChange={handleSalaryReminderToggle}
                trackColor={{ false: theme.border, true: "#4CAF50" }}
                thumbColor="#FFFFFF"
              />
            }
            theme={theme}
          />
          <SettingRow
            icon="credit-card"
            iconColor="#FF9800"
            label={t.settings.subscriptionReminder}
            sublabel={t.settings.subscriptionReminderDesc}
            right={
              <Switch
                value={true}
                disabled
                trackColor={{ false: theme.border, true: "#4CAF50" }}
                thumbColor="#FFFFFF"
              />
            }
            theme={theme}
          />
          <SettingRow
            icon="message-square"
            iconColor="#03A9F4"
            label={t.settings.appNotifications}
            sublabel={t.settings.appNotificationsDesc}
            right={
              <Switch
                value={true}
                trackColor={{ false: theme.border, true: "#4CAF50" }}
                thumbColor="#FFFFFF"
              />
            }
            isLast
            theme={theme}
          />
        </SettingCard>

        {/* ─── 6. APPEARANCE SECTION ─── */}
        <ThemedText type="small" style={styles.sectionLabel}>
          {t.settings.appearance}
        </ThemedText>
        <SettingCard theme={theme} isDark={isDark}>
          <SettingRow
            icon="sun"
            iconColor="#FFC107"
            label={t.settings.themeSettings}
            value={themeMode.toUpperCase()}
            onPress={() => setShowThemeModal(true)}
            isLast
            theme={theme}
          />
        </SettingCard>

        {/* ─── VOICE SETTINGS SECTION ─── */}
        <ThemedText type="small" style={styles.sectionLabel}>
          {t.voiceSettings?.title || "Voice Response"}
        </ThemedText>
        <SettingCard theme={theme} isDark={isDark}>
          <SettingRow
            icon="volume-2"
            iconColor="#E91E63"
            label="Voice Response"
            sublabel="Ask HAI speaks after completing actions"
            right={
              <Switch
                value={voiceSettings.enabled}
                onValueChange={handleVoiceToggle}
                trackColor={{ false: theme.border, true: "#2563EB" }}
                thumbColor="#FFFFFF"
              />
            }
            theme={theme}
          />
          <SettingRow
            icon="activity"
            iconColor="#3F51B5"
            label="Voice Speed"
            value={
              voiceSettings.speed <= 0.8
                ? "Slow"
                : voiceSettings.speed >= 1.2
                ? "Fast"
                : "Normal"
            }
            onPress={() => setShowSpeedModal(true)}
            theme={theme}
          />
          <SettingRow
            icon="zap"
            iconColor="#F59E0B"
            label="Enable Live Mode"
            sublabel="Continuous hands-free conversation"
            right={
              <Switch
                value={liveModeEnabled}
                onValueChange={handleToggleLiveMode}
                trackColor={{ false: theme.border, true: "#2563EB" }}
                thumbColor="#FFFFFF"
              />
            }
            theme={theme}
          />
          <SettingRow
            icon="check-circle"
            iconColor="#22C55E"
            label="Voice Confirmation"
            sublabel="Speak short task summaries"
            right={
              <Switch
                value={voiceConfirmationEnabled}
                onValueChange={handleToggleVoiceConf}
                trackColor={{ false: theme.border, true: "#2563EB" }}
                thumbColor="#FFFFFF"
              />
            }
            theme={theme}
          />
          <SettingRow
            icon="message-square"
            iconColor="#EF4444"
            label="Wake Word"
            sublabel="Listen for 'Hey HAI' trigger word"
            right={
              <Switch
                value={wakeWordEnabled}
                onValueChange={handleToggleWakeWord}
                trackColor={{ false: theme.border, true: "#2563EB" }}
                thumbColor="#FFFFFF"
              />
            }
            theme={theme}
          />
          <SettingRow
            icon="sliders"
            iconColor="#9C27B0"
            label="Microphone Sensitivity"
            sublabel="Increase mic audio range"
            right={
              <Switch
                value={highSensitivityEnabled}
                onValueChange={handleToggleMicSens}
                trackColor={{ false: theme.border, true: "#2563EB" }}
                thumbColor="#FFFFFF"
              />
            }
            isLast
            theme={theme}
          />
        </SettingCard>

        {/* ─── 7. LANGUAGE SECTION ─── */}
        <ThemedText type="small" style={styles.sectionLabel}>
          {t.settings.language}
        </ThemedText>
        <SettingCard theme={theme} isDark={isDark}>
          <SettingRow
            icon="globe"
            iconColor="#009688"
            label={t.settings.appLanguage}
            value={languageNames[language]}
            onPress={() => setShowLangModal(true)}
            isLast
            theme={theme}
          />
        </SettingCard>

        {/* ─── 8. SECURITY SECTION ─── */}
        {!isGuest && (
          <>
            <ThemedText type="small" style={styles.sectionLabel}>
              {t.settings.security}
            </ThemedText>
            <SettingCard theme={theme} isDark={isDark}>
              <SettingRow
                icon="shield"
                iconColor="#3F51B5"
                label={t.settings.otpVerification}
                sublabel={t.settings.otpVerificationDesc}
                right={
                  <Switch
                    value={otpVerification}
                    onValueChange={handleToggleOtp}
                    trackColor={{ false: theme.border, true: "#4CAF50" }}
                    thumbColor="#FFFFFF"
                  />
                }
                theme={theme}
              />
              <SettingRow
                icon="cpu"
                iconColor="#607D8B"
                label={t.settings.biometricLogin}
                sublabel={t.settings.biometricLoginDesc}
                right={
                  <Switch
                    value={biometricLogin}
                    onValueChange={handleToggleBiometric}
                    trackColor={{ false: theme.border, true: "#4CAF50" }}
                    thumbColor="#FFFFFF"
                  />
                }
                theme={theme}
              />
              <SettingRow
                icon="eye-off"
                iconColor="#7C3AED"
                label={t.settings.privacySettings}
                sublabel={t.settings.privacySettingsDesc}
                onPress={() => navigation.navigate("PrivacySettings")}
                theme={theme}
              />
              <SettingRow
                icon="hard-drive"
                iconColor="#E91E63"
                label={t.settings.deviceSessionManagement}
                sublabel={t.settings.deviceSessionManagementDesc}
                onPress={() => navigation.navigate("DeviceManagement")}
                isLast
                theme={theme}
              />
            </SettingCard>
          </>
        )}

        {/* ─── 9. SUPPORT & HELP SECTION ─── */}
        <ThemedText type="small" style={styles.sectionLabel}>
          {t.settings.supportHelp}
        </ThemedText>
        {/* Support Information Info Card */}
        <View
          style={[
            styles.supportInfoCard,
            {
              backgroundColor: theme.backgroundSecondary,
              borderColor: theme.border,
            },
          ]}
        >
          <ThemedText style={{ fontWeight: "700", marginBottom: Spacing.sm }}>
            {t.settings.needAssistance}
          </ThemedText>
          <Pressable
            onPress={handleEmailSupport}
            style={styles.supportContactRow}
          >
            <Feather name="mail" size={14} color={theme.primary} style={{ marginRight: 6 }} />
            <ThemedText
              style={[styles.supportContactLink, { color: theme.primary }]}
            >
              info.haajariapp@gmail.com
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={handleWhatsAppSupport}
            style={styles.supportContactRow}
          >
            <Feather name="message-circle" size={14} color={theme.primary} style={{ marginRight: 6 }} />
            <ThemedText
              style={[styles.supportContactLink, { color: theme.primary }]}
            >
              +91 7057942248
            </ThemedText>
          </Pressable>

          <Pressable onPress={handleWhatsAppSupport} style={styles.whatsappBtn}>
            <Feather name="message-circle" size={16} color="#FFFFFF" />
            <ThemedText style={styles.whatsappBtnText}>
              {t.settings.whatsAppSupport}
            </ThemedText>
          </Pressable>
        </View>

        <SettingCard theme={theme} isDark={isDark}>
          <SettingRow
            icon="help-circle"
            iconColor="#4CAF50"
            label={t.settings.helpCenter}
            sublabel={t.settings.helpCenterDesc}
            onPress={() => navigation.navigate("Support")}
            theme={theme}
          />
          <SettingRow
            icon="alert-triangle"
            iconColor="#FF5722"
            label={t.settings.reportProblem}
            sublabel={t.settings.reportProblemDesc}
            onPress={() => setShowReportModal(true)}
            theme={theme}
          />
          <SettingRow
            icon="thumbs-up"
            iconColor="#00BCD4"
            label={t.settings.submitFeedback}
            sublabel={t.settings.submitFeedbackDesc}
            onPress={() => setShowFeedbackModal(true)}
            isLast
            theme={theme}
          />
        </SettingCard>

        {/* ─── 9B. EXCLUDED MODULES ─── */}
        <ThemedText type="small" style={styles.sectionLabel}>
          {t.settings.excludedModules}
        </ThemedText>
        <SettingCard theme={theme} isDark={isDark}>
          <SettingRow
            icon="shopping-bag"
            iconColor={theme.textSecondary}
            label={t.settings.labourMarketplace}
            sublabel={t.settings.labourMarketplaceDesc}
            right={
              <ThemedText
                type="small"
                style={{ color: theme.error, fontWeight: "600" }}
              >
                {t.settings.excluded}
              </ThemedText>
            }
            theme={theme}
          />
          <SettingRow
            icon="rss"
            iconColor={theme.textSecondary}
            label={t.settings.labourJobFeed}
            sublabel={t.settings.labourJobFeedDesc}
            right={
              <ThemedText
                type="small"
                style={{ color: theme.error, fontWeight: "600" }}
              >
                {t.settings.excluded}
              </ThemedText>
            }
            theme={theme}
          />
          <SettingRow
            icon="briefcase"
            iconColor={theme.textSecondary}
            label={t.settings.labourManagement}
            sublabel={t.settings.labourManagementDesc}
            right={
              <ThemedText
                type="small"
                style={{ color: theme.error, fontWeight: "600" }}
              >
                {t.settings.excluded}
              </ThemedText>
            }
            isLast
            theme={theme}
          />
        </SettingCard>

        {/* ─── 10. ABOUT HAI ─── */}
        <ThemedText type="small" style={styles.sectionLabel}>
          {t.settings.aboutHai}
        </ThemedText>
        <SettingCard theme={theme} isDark={isDark}>
          <View style={{ padding: Spacing.md, gap: Spacing.xs }}>
            <ThemedText style={{ fontWeight: "800", color: theme.primary }}>
              {t.settings.haiTitle}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {t.settings.versionText}
            </ThemedText>
            <ThemedText
              type="small"
              style={{
                color: theme.textSecondary,
                marginTop: Spacing.xs,
                lineHeight: 18,
              }}
            >
              {t.settings.haiDesc}
            </ThemedText>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <SettingRow
            icon="shield"
            iconColor="#607D8B"
            label={t.settings.privacyPolicy}
            onPress={() => navigation.navigate("PrivacyPolicy" as any)}
            theme={theme}
          />
          <SettingRow
            icon="file-text"
            iconColor="#FF9800"
            label={t.settings.termsConditions}
            onPress={() => navigation.navigate("TermsAndConditions" as any)}
            isLast
            theme={theme}
          />
        </SettingCard>

        {/* ─── 11. LOGOUT BUTTON ─── */}
        <Pressable
          onPress={handleLogout}
          style={[styles.logoutBtn, { borderColor: theme.error }]}
        >
          <Feather name="log-out" size={16} color={theme.error} />
          <ThemedText style={{ color: theme.error, fontWeight: "700" }}>
            {t.settings.logout}
          </ThemedText>
        </Pressable>
      </ScrollView>

      {/* ─── THEME MODAL ─── */}
      <Modal
        visible={showThemeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowThemeModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowThemeModal(false)}
        >
          <View
            style={[
              styles.bottomSheet,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <ThemedText type="h3" style={styles.sheetTitle}>
              Select Appearance Mode
            </ThemedText>
            <Pressable
              onPress={() => changeTheme("light")}
              style={styles.sheetOption}
            >
              <Feather name="sun" size={20} color={theme.text} />
              <ThemedText style={styles.sheetOptionText}>Light Mode</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => changeTheme("dark")}
              style={styles.sheetOption}
            >
              <Feather name="moon" size={20} color={theme.text} />
              <ThemedText style={styles.sheetOptionText}>Dark Mode</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => changeTheme("system")}
              style={styles.sheetOption}
            >
              <Feather name="settings" size={20} color={theme.text} />
              <ThemedText style={styles.sheetOptionText}>
                System Default
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setShowThemeModal(false)}
              style={[styles.sheetCloseBtn, { backgroundColor: theme.border }]}
            >
              <ThemedText style={{ fontWeight: "700" }}>Close</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ─── LANGUAGE MODAL ─── */}
      <Modal
        visible={showLangModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowLangModal(false);
          setLangSearch("");
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setShowLangModal(false);
            setLangSearch("");
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.bottomSheet,
              {
                backgroundColor: theme.backgroundDefault,
                height: SCREEN_HEIGHT * 0.7,
              },
            ]}
          >
            <ThemedText type="h3" style={styles.sheetTitle}>
              Select App Language
            </ThemedText>

            {/* Search input */}
            <View
              style={[styles.searchInputWrapper, { borderColor: theme.border }]}
            >
              <Feather name="search" size={18} color={theme.textSecondary} />
              <TextInput
                placeholder="Search language..."
                value={langSearch}
                onChangeText={setLangSearch}
                placeholderTextColor={theme.textSecondary}
                style={[styles.searchInput, { color: theme.text }]}
              />
              {langSearch.length > 0 && (
                <Pressable onPress={() => setLangSearch("")}>
                  <Feather name="x" size={18} color={theme.textSecondary} />
                </Pressable>
              )}
            </View>

            <ScrollView
              style={{ flex: 1, marginVertical: Spacing.xs }}
              showsVerticalScrollIndicator={true}
            >
              {Object.entries(languageNames)
                .filter(
                  ([key, name]) =>
                    name.toLowerCase().includes(langSearch.toLowerCase()) ||
                    key.toLowerCase().includes(langSearch.toLowerCase()),
                )
                .map(([key, name]) => (
                  <Pressable
                    key={key}
                    onPress={() => handleLangSelect(key as Language)}
                    style={[
                      styles.sheetOption,
                      language === key && {
                        backgroundColor: "rgba(255, 107, 53, 0.08)",
                      },
                    ]}
                  >
                    <Feather
                      name={language === key ? "check-circle" : "globe"}
                      size={20}
                      color={language === key ? theme.primary : theme.text}
                    />
                    <ThemedText
                      style={[
                        styles.sheetOptionText,
                        language === key && {
                          color: theme.primary,
                          fontWeight: "700",
                        },
                      ]}
                    >
                      {name}
                    </ThemedText>
                  </Pressable>
                ))}
            </ScrollView>

            <Pressable
              onPress={() => {
                setShowLangModal(false);
                setLangSearch("");
              }}
              style={[styles.sheetCloseBtn, { backgroundColor: theme.border }]}
            >
              <ThemedText style={{ fontWeight: "700" }}>Close</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── VOICE SPEED MODAL ─── */}
      <Modal
        visible={showSpeedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSpeedModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSpeedModal(false)}
        >
          <View
            style={[
              styles.bottomSheet,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <ThemedText type="h3" style={styles.sheetTitle}>
              {t.voiceSettings?.speed || "Speech Speed"}
            </ThemedText>
            <Pressable
              onPress={() => handleVoiceSpeedSelect(0.75)}
              style={[
                styles.sheetOption,
                voiceSettings.speed === 0.75 && {
                  backgroundColor: "rgba(255, 107, 53, 0.08)",
                },
              ]}
            >
              <Feather
                name={voiceSettings.speed === 0.75 ? "check-circle" : "activity"}
                size={20}
                color={voiceSettings.speed === 0.75 ? theme.primary : theme.text}
              />
              <ThemedText
                style={[
                  styles.sheetOptionText,
                  voiceSettings.speed === 0.75 && {
                    color: theme.primary,
                    fontWeight: "700",
                  },
                ]}
              >
                {t.voiceSettings?.speedSlow || "Slow"} (0.75x)
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => handleVoiceSpeedSelect(1.0)}
              style={[
                styles.sheetOption,
                voiceSettings.speed === 1.0 && {
                  backgroundColor: "rgba(255, 107, 53, 0.08)",
                },
              ]}
            >
              <Feather
                name={voiceSettings.speed === 1.0 ? "check-circle" : "activity"}
                size={20}
                color={voiceSettings.speed === 1.0 ? theme.primary : theme.text}
              />
              <ThemedText
                style={[
                  styles.sheetOptionText,
                  voiceSettings.speed === 1.0 && {
                    color: theme.primary,
                    fontWeight: "700",
                  },
                ]}
              >
                {t.voiceSettings?.speedNormal || "Normal"} (1.0x)
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => handleVoiceSpeedSelect(1.25)}
              style={[
                styles.sheetOption,
                voiceSettings.speed === 1.25 && {
                  backgroundColor: "rgba(255, 107, 53, 0.08)",
                },
              ]}
            >
              <Feather
                name={voiceSettings.speed === 1.25 ? "check-circle" : "activity"}
                size={20}
                color={voiceSettings.speed === 1.25 ? theme.primary : theme.text}
              />
              <ThemedText
                style={[
                  styles.sheetOptionText,
                  voiceSettings.speed === 1.25 && {
                    color: theme.primary,
                    fontWeight: "700",
                  },
                ]}
              >
                {t.voiceSettings?.speedFast || "Fast"} (1.25x)
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setShowSpeedModal(false)}
              style={[styles.sheetCloseBtn, { backgroundColor: theme.border }]}
            >
              <ThemedText style={{ fontWeight: "700" }}>Close</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ─── VOICE PITCH MODAL ─── */}
      <Modal
        visible={showPitchModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPitchModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowPitchModal(false)}
        >
          <View
            style={[
              styles.bottomSheet,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <ThemedText type="h3" style={styles.sheetTitle}>
              {t.voiceSettings?.pitch || "Voice Pitch"}
            </ThemedText>
            <Pressable
              onPress={() => handleVoicePitchSelect(0.8)}
              style={[
                styles.sheetOption,
                voiceSettings.pitch === 0.8 && {
                  backgroundColor: "rgba(255, 107, 53, 0.08)",
                },
              ]}
            >
              <Feather
                name={voiceSettings.pitch === 0.8 ? "check-circle" : "music"}
                size={20}
                color={voiceSettings.pitch === 0.8 ? theme.primary : theme.text}
              />
              <ThemedText
                style={[
                  styles.sheetOptionText,
                  voiceSettings.pitch === 0.8 && {
                    color: theme.primary,
                    fontWeight: "700",
                  },
                ]}
              >
                {t.voiceSettings?.pitchLow || "Low"}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => handleVoicePitchSelect(1.0)}
              style={[
                styles.sheetOption,
                voiceSettings.pitch === 1.0 && {
                  backgroundColor: "rgba(255, 107, 53, 0.08)",
                },
              ]}
            >
              <Feather
                name={voiceSettings.pitch === 1.0 ? "check-circle" : "music"}
                size={20}
                color={voiceSettings.pitch === 1.0 ? theme.primary : theme.text}
              />
              <ThemedText
                style={[
                  styles.sheetOptionText,
                  voiceSettings.pitch === 1.0 && {
                    color: theme.primary,
                    fontWeight: "700",
                  },
                ]}
              >
                {t.voiceSettings?.pitchNormal || "Normal"}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => handleVoicePitchSelect(1.2)}
              style={[
                styles.sheetOption,
                voiceSettings.pitch === 1.2 && {
                  backgroundColor: "rgba(255, 107, 53, 0.08)",
                },
              ]}
            >
              <Feather
                name={voiceSettings.pitch === 1.2 ? "check-circle" : "music"}
                size={20}
                color={voiceSettings.pitch === 1.2 ? theme.primary : theme.text}
              />
              <ThemedText
                style={[
                  styles.sheetOptionText,
                  voiceSettings.pitch === 1.2 && {
                    color: theme.primary,
                    fontWeight: "700",
                  },
                ]}
              >
                {t.voiceSettings?.pitchHigh || "High"}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setShowPitchModal(false)}
              style={[styles.sheetCloseBtn, { backgroundColor: theme.border }]}
            >
              <ThemedText style={{ fontWeight: "700" }}>Close</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ─── REPORT A PROBLEM MODAL ─── */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.formModalContainer}>
          <ThemedView
            style={[
              styles.formContent,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.formHeader}>
              <ThemedText type="h2">Report a Problem</ThemedText>
              <Pressable
                onPress={() => setShowReportModal(false)}
                style={styles.formCloseIcon}
              >
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.formScroll}>
              <ThemedText type="small" style={styles.label}>
                Subject
              </ThemedText>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundSecondary,
                  },
                ]}
                value={reportSubject}
                onChangeText={setReportSubject}
                placeholder="e.g. App crashing, sync error, etc."
                placeholderTextColor={theme.textSecondary}
              />
              <ThemedText type="small" style={styles.label}>
                Problem Description
              </ThemedText>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundSecondary,
                    height: 100,
                    textAlignVertical: "top",
                    paddingVertical: Spacing.sm,
                  },
                ]}
                value={reportDescription}
                onChangeText={setReportDescription}
                placeholder="Describe your issue in detail..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={4}
              />
              <ThemedText type="small" style={styles.label}>
                Screenshot URL / Details (optional)
              </ThemedText>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundSecondary,
                  },
                ]}
                value={reportScreenshot}
                onChangeText={setReportScreenshot}
                placeholder="Paste link or notes here..."
                placeholderTextColor={theme.textSecondary}
              />

              {isReporting && (
                <ActivityIndicator size="small" color={theme.primary} />
              )}

              <View style={styles.formActions}>
                <Pressable
                  onPress={() => setShowReportModal(false)}
                  style={[
                    styles.formBtn,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <ThemedText style={{ color: theme.text, fontWeight: "700" }}>
                    Cancel
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleReportSubmit}
                  style={[styles.formBtn, { backgroundColor: theme.primary }]}
                  disabled={isReporting}
                >
                  <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>
                    Submit Report
                  </ThemedText>
                </Pressable>
              </View>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      {/* ─── SEND FEEDBACK MODAL ─── */}
      <Modal
        visible={showFeedbackModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFeedbackModal(false)}
      >
        <View style={styles.formModalContainer}>
          <ThemedView
            style={[
              styles.formContent,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.formHeader}>
              <ThemedText type="h2">Send Feedback</ThemedText>
              <Pressable
                onPress={() => setShowFeedbackModal(false)}
                style={styles.formCloseIcon}
              >
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.formScroll}>
              <ThemedText
                type="small"
                style={[
                  styles.label,
                  { textAlign: "center", marginBottom: Spacing.sm },
                ]}
              >
                Rate your experience
              </ThemedText>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: Spacing.sm,
                  marginBottom: Spacing.md,
                }}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable key={star} onPress={() => setFeedbackRating(star)}>
                    <FontAwesome
                      name={star <= feedbackRating ? "star" : "star-o"}
                      size={36}
                      color={
                        star <= feedbackRating ? "#FFC107" : theme.textSecondary
                      }
                    />
                  </Pressable>
                ))}
              </View>

              <ThemedText type="small" style={styles.label}>
                Your Feedback
              </ThemedText>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundSecondary,
                    height: 100,
                    textAlignVertical: "top",
                    paddingVertical: Spacing.sm,
                  },
                ]}
                value={feedbackText}
                onChangeText={setFeedbackText}
                placeholder="What can we do to improve? Tell us..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={4}
              />

              {isSubmittingFeedback && (
                <ActivityIndicator size="small" color={theme.primary} />
              )}

              <View style={styles.formActions}>
                <Pressable
                  onPress={() => setShowFeedbackModal(false)}
                  style={[
                    styles.formBtn,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <ThemedText style={{ color: theme.text, fontWeight: "700" }}>
                    Cancel
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleFeedbackSubmit}
                  style={[styles.formBtn, { backgroundColor: theme.primary }]}
                  disabled={isSubmittingFeedback}
                >
                  <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>
                    Submit Feedback
                  </ThemedText>
                </Pressable>
              </View>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      {/* ─── COMPANY NAME MODAL ─── */}
      <Modal
        visible={showCompanyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCompanyModal(false)}
      >
        <View style={styles.formModalContainer}>
          <ThemedView
            style={[
              styles.formContent,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.formHeader}>
              <ThemedText type="h2">{t.auth.companyName || "Company Name"}</ThemedText>
              <Pressable
                onPress={() => setShowCompanyModal(false)}
                style={styles.formCloseIcon}
              >
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.formScroll}>
              <ThemedText type="small" style={styles.label}>
                {t.auth.companyName || "Company Name"}
              </ThemedText>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    color: theme.text,
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundSecondary,
                  },
                ]}
                value={companyNameInput}
                onChangeText={setCompanyNameInput}
                placeholder={t.auth.companyName || "Company Name"}
                placeholderTextColor={theme.textSecondary}
              />
              {isSyncing ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : null}
              <View style={styles.formActions}>
                <Pressable
                  onPress={() => setShowCompanyModal(false)}
                  style={[
                    styles.formBtn,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <ThemedText style={{ color: theme.text }}>Cancel</ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleUpdateCompany}
                  style={[styles.formBtn, { backgroundColor: theme.primary }]}
                >
                  <ThemedText style={{ color: "#FFFFFF", fontWeight: "700" }}>
                    Update Company
                  </ThemedText>
                </Pressable>
              </View>
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      {/* ─── CONTRACTORS MODAL ─── */}
      <Modal
        visible={showContractorsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowContractorsModal(false)}
      >
        <View style={styles.formModalContainer}>
          <ThemedView
            style={[
              styles.formContent,
              { backgroundColor: theme.backgroundDefault, height: 400 },
            ]}
          >
            <View style={styles.formHeader}>
              <ThemedText type="h2">Contractor Directory</ThemedText>
              <Pressable onPress={() => setShowContractorsModal(false)}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: Spacing.md }}
            >
              <View style={[styles.listItem, { borderColor: theme.border }]}>
                <ThemedText style={{ fontWeight: "700" }}>
                  Rajesh Kumar Construction
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  📞 +91 98765 43210 | 👷 Contractor
                </ThemedText>
              </View>
              <View style={[styles.listItem, { borderColor: theme.border }]}>
                <ThemedText style={{ fontWeight: "700" }}>
                  Sandeep Pandit Contractors Ltd
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  📞 +91 99887 76655 | 👷 Contractor
                </ThemedText>
              </View>
              <View style={[styles.listItem, { borderColor: theme.border }]}>
                <ThemedText style={{ fontWeight: "700" }}>
                  Ravi Verma Projects
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  📞 +91 91234 56789 | 👷 Contractor
                </ThemedText>
              </View>
            </ScrollView>
            <Pressable
              onPress={() => setShowContractorsModal(false)}
              style={[
                styles.sheetCloseBtn,
                { backgroundColor: theme.border, marginTop: Spacing.md },
              ]}
            >
              <ThemedText style={{ fontWeight: "700" }}>Close</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>

      {/* ─── SUPERVISOR ASSIGNED PROJECTS MODAL ─── */}
      <Modal
        visible={showProjectsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProjectsModal(false)}
      >
        <View style={styles.formModalContainer}>
          <ThemedView
            style={[
              styles.formContent,
              { backgroundColor: theme.backgroundDefault, height: 400 },
            ]}
          >
            <View style={styles.formHeader}>
              <ThemedText type="h2">Assigned Projects</ThemedText>
              <Pressable onPress={() => setShowProjectsModal(false)}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: Spacing.md }}
            >
              {supervisorProjects.length > 0 ? (
                supervisorProjects.map((proj) => (
                  <View
                    key={proj.id}
                    style={[styles.listItem, { borderColor: theme.border }]}
                  >
                    <ThemedText style={{ fontWeight: "700" }}>
                      🏢 {proj.name}
                    </ThemedText>
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary }}
                    >
                      📍 Location: {proj.location || "Not Provided"}
                    </ThemedText>
                  </View>
                ))
              ) : (
                <ThemedText
                  style={{
                    textAlign: "center",
                    color: theme.textSecondary,
                    marginVertical: Spacing.xl,
                  }}
                >
                  No active projects assigned to your account.
                </ThemedText>
              )}
            </ScrollView>
            <Pressable
              onPress={() => setShowProjectsModal(false)}
              style={[
                styles.sheetCloseBtn,
                { backgroundColor: theme.border, marginTop: Spacing.md },
              ]}
            >
              <ThemedText style={{ fontWeight: "700" }}>Close</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>

      {/* ─── SUPERVISOR ASSIGNED WORKERS MODAL ─── */}
      <Modal
        visible={showWorkersModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWorkersModal(false)}
      >
        <View style={styles.formModalContainer}>
          <ThemedView
            style={[
              styles.formContent,
              { backgroundColor: theme.backgroundDefault, height: 400 },
            ]}
          >
            <View style={styles.formHeader}>
              <ThemedText type="h2">Assigned Workers</ThemedText>
              <Pressable onPress={() => setShowWorkersModal(false)}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: Spacing.md }}
            >
              {supervisorWorkers.length > 0 ? (
                supervisorWorkers.map((w) => (
                  <View
                    key={w.id}
                    style={[styles.listItem, { borderColor: theme.border }]}
                  >
                    <ThemedText style={{ fontWeight: "700" }}>
                      👷 {w.name}
                    </ThemedText>
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary }}
                    >
                      📞 Phone: {w.phone} | Category: {w.category.toUpperCase()}
                    </ThemedText>
                  </View>
                ))
              ) : (
                <ThemedText
                  style={{
                    textAlign: "center",
                    color: theme.textSecondary,
                    marginVertical: Spacing.xl,
                  }}
                >
                  No active workers assigned to your projects.
                </ThemedText>
              )}
            </ScrollView>
            <Pressable
              onPress={() => setShowWorkersModal(false)}
              style={[
                styles.sheetCloseBtn,
                { backgroundColor: theme.border, marginTop: Spacing.md },
              ]}
            >
              <ThemedText style={{ fontWeight: "700" }}>Close</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>

      {/* ─── PRICING UPGRADE COMPARISON MODAL ─── */}
      <Modal
        visible={showUpgradeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUpgradeModal(false)}
      >
        <BlurView
          intensity={isDark ? 80 : 90}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        >
          <ThemedView
            style={[
              styles.modalWrapper,
              {
                marginTop: insets.top + 20,
                marginBottom: insets.bottom + 20,
                backgroundColor: theme.backgroundDefault,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: Spacing.sm }}>
                <ThemedText
                  type="h2"
                  style={{ fontWeight: "800", color: theme.primary }}
                >
                  Choose Your Plan
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginTop: 4 }}
                >
                  Select a subscription plan that fits your business
                </ThemedText>
              </View>
              <Pressable
                onPress={() => setShowUpgradeModal(false)}
                style={[
                  styles.closeModalBtn,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.04)",
                  },
                ]}
              >
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.planScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* FREE */}
              <View
                style={[
                  styles.planCard,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "#FFFFFF",
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.planCardHeader}>
                  <View>
                    <ThemedText type="h3" style={{ fontWeight: "700" }}>
                      FREE
                    </ThemedText>
                    <ThemedText
                      type="body"
                      style={{ color: theme.textSecondary, marginTop: 2 }}
                    >
                      For small teams
                    </ThemedText>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <ThemedText
                      type="h2"
                      style={{ fontWeight: "800", color: theme.text }}
                    >
                      ₹0
                    </ThemedText>
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary }}
                    >
                      /year
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.featureDivider} />
                <View style={styles.featureList}>
                  <View style={styles.featureRow}>
                    <Feather name="check" size={14} color="#10B981" />
                    <ThemedText type="body" style={styles.featureText}>
                      15 Workers
                    </ThemedText>
                  </View>
                  <View style={styles.featureRow}>
                    <Feather name="check" size={14} color="#10B981" />
                    <ThemedText type="body" style={styles.featureText}>
                      Basic attendance marking
                    </ThemedText>
                  </View>
                </View>
                <Pressable
                  onPress={() =>
                    Alert.alert(
                      "Active Plan",
                      "You are currently on the Free plan.",
                    )
                  }
                  style={[
                    styles.planActionBtn,
                    { backgroundColor: theme.border },
                  ]}
                >
                  <ThemedText
                    style={[styles.planActionText, { color: theme.text }]}
                  >
                    Current Plan
                  </ThemedText>
                </Pressable>
              </View>

              {/* PROFESSIONAL */}
              <View
                style={[
                  styles.planCard,
                  {
                    backgroundColor: isDark
                      ? "rgba(79, 70, 229, 0.05)"
                      : "#F5F3FF",
                    borderColor: "#7C3AED",
                    borderWidth: 2,
                  },
                ]}
              >
                <View style={styles.popularBadge}>
                  <ThemedText style={styles.popularBadgeText}>
                    RECOMMENDED
                  </ThemedText>
                </View>
                <View style={styles.planCardHeader}>
                  <View>
                    <ThemedText
                      type="h3"
                      style={{ fontWeight: "700", color: "#7C3AED" }}
                    >
                      PRO
                    </ThemedText>
                    <ThemedText
                      type="body"
                      style={{ color: theme.textSecondary, marginTop: 2 }}
                    >
                      For growing businesses
                    </ThemedText>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <ThemedText
                      type="h2"
                      style={{ fontWeight: "800", color: "#7C3AED" }}
                    >
                      ₹299
                    </ThemedText>
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary }}
                    >
                      /year
                    </ThemedText>
                  </View>
                </View>
                <View
                  style={[
                    styles.featureDivider,
                    { backgroundColor: "#7C3AED25" },
                  ]}
                />
                <View style={styles.featureList}>
                  <View style={styles.featureRow}>
                    <Feather name="check" size={14} color="#7C3AED" />
                    <ThemedText type="body" style={styles.featureText}>
                      100 Workers
                    </ThemedText>
                  </View>
                  <View style={styles.featureRow}>
                    <Feather name="check" size={14} color="#7C3AED" />
                    <ThemedText type="body" style={styles.featureText}>
                      Attendance tracking
                    </ThemedText>
                  </View>
                  <View style={styles.featureRow}>
                    <Feather name="check" size={14} color="#7C3AED" />
                    <ThemedText type="body" style={styles.featureText}>
                      Payroll & salary calculations
                    </ThemedText>
                  </View>
                  <View style={styles.featureRow}>
                    <Feather name="check" size={14} color="#7C3AED" />
                    <ThemedText type="body" style={styles.featureText}>
                      Advanced PDF/CSV reports
                    </ThemedText>
                  </View>
                </View>
                <Pressable
                  onPress={() => handleUpgrade("pro")}
                  style={{ marginTop: Spacing.md }}
                >
                  <LinearGradient
                    colors={["#7C3AED", "#EC4899"]}
                    style={styles.planActionBtnPrimary}
                  >
                    <ThemedText style={styles.planActionTextPrimary}>
                      Upgrade to Pro
                    </ThemedText>
                  </LinearGradient>
                </Pressable>
              </View>

              {/* BUSINESS */}
              <View
                style={[
                  styles.planCard,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.03)"
                      : "#FFFFFF",
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.planCardHeader}>
                  <View>
                    <ThemedText
                      type="h3"
                      style={{ fontWeight: "700", color: "#FF6B35" }}
                    >
                      BUSINESS
                    </ThemedText>
                    <ThemedText
                      type="body"
                      style={{ color: theme.textSecondary, marginTop: 2 }}
                    >
                      For enterprises
                    </ThemedText>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <ThemedText
                      type="h2"
                      style={{ fontWeight: "800", color: "#FF6B35" }}
                    >
                      ₹499
                    </ThemedText>
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary }}
                    >
                      /year
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.featureDivider} />
                <View style={styles.featureList}>
                  <View style={styles.featureRow}>
                    <Feather name="check" size={14} color="#FF6B35" />
                    <ThemedText type="body" style={styles.featureText}>
                      Unlimited Workers
                    </ThemedText>
                  </View>
                  <View style={styles.featureRow}>
                    <Feather name="check" size={14} color="#FF6B35" />
                    <ThemedText type="body" style={styles.featureText}>
                      GPS location attendance
                    </ThemedText>
                  </View>
                  <View style={styles.featureRow}>
                    <Feather name="check" size={14} color="#FF6B35" />
                    <ThemedText type="body" style={styles.featureText}>
                      Cloud Sync & Backup
                    </ThemedText>
                  </View>
                  <View style={styles.featureRow}>
                    <Feather name="check" size={14} color="#FF6B35" />
                    <ThemedText type="body" style={styles.featureText}>
                      Multi-device operation
                    </ThemedText>
                  </View>
                </View>
                <Pressable
                  onPress={() => handleUpgrade("business")}
                  style={{ marginTop: Spacing.md }}
                >
                  <LinearGradient
                    colors={["#FF6B35", "#FF8C35"]}
                    style={styles.planActionBtnPrimary}
                  >
                    <ThemedText style={styles.planActionTextPrimary}>
                      Upgrade to Business
                    </ThemedText>
                  </LinearGradient>
                </Pressable>
              </View>
            </ScrollView>
          </ThemedView>
        </BlurView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Hero Account Header Card
  heroCard: {
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  heroGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: 24,
  },
  heroAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: Spacing.md,
  },
  heroAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  heroAvatarInitials: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    fontWeight: "800",
    marginBottom: 4,
  },
  heroBadgeRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    alignItems: "center",
    marginBottom: 4,
  },
  roleBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 0.8,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  planBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  planBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  // Guest banner
  guestBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },

  // Category labels
  sectionLabel: {
    fontWeight: "800",
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.6,
  },

  // Setting Cards & rows
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    ...Shadows.sm,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 64,
  },
  rowIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  rowInfo: {
    flex: 1,
  },
  rowLabel: {
    fontWeight: "700",
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  rowValue: {
    fontWeight: "600",
  },

  // Metrics block
  metricsContainer: {
    flexDirection: "row",
    borderRadius: 20,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    justifyContent: "space-around",
    alignItems: "center",
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  metricBlock: {
    alignItems: "center",
    flex: 1,
  },
  metricDivider: {
    width: 1,
    height: 36,
  },

  // Support card
  supportInfoCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  supportContactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  supportContactLink: {
    fontWeight: "600",
    fontSize: 14,
  },
  whatsappBtn: {
    backgroundColor: "#25D366",
    height: 40,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.md,
    ...Shadows.xs,
  },
  whatsappBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },

  // Logout button
  logoutBtn: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },

  divider: {
    height: 0.8,
  },

  // Modals overlays
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  sheetTitle: {
    fontWeight: "800",
    marginBottom: Spacing.xs,
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  sheetOptionText: {
    fontSize: 15,
    fontWeight: "600",
  },
  sheetCloseBtn: {
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.sm,
    height: 44,
    marginBottom: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: Spacing.xs,
    paddingVertical: 0,
  },

  // Form modals
  formModalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  formContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  formCloseIcon: {
    padding: 4,
  },
  formScroll: {
    gap: Spacing.md,
  },
  label: {
    fontWeight: "700",
    marginBottom: 4,
  },
  inputField: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  formActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  formBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  listItem: {
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.md,
    gap: 4,
  },

  // Pricing Modal Wrapper
  modalWrapper: {
    flex: 1,
    borderRadius: 24,
    marginHorizontal: 16,
    overflow: "hidden",
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  closeModalBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  planScrollContent: {
    paddingBottom: 40,
    gap: Spacing.md,
  },
  planCard: {
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    position: "relative",
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  planCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  featureDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.06)",
    marginVertical: Spacing.md,
  },
  featureList: {
    gap: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureText: {
    fontSize: 13,
  },
  planActionBtn: {
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
  },
  planActionText: {
    fontWeight: "700",
    fontSize: 14,
  },
  planActionBtnPrimary: {
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  planActionTextPrimary: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  popularBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 10,
  },
  popularBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "800",
  },
});
