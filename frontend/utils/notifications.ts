import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants, { ExecutionEnvironment } from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LAST_PUSH_TOKEN_KEY = "@haajari/last_push_token";

/**
 * Safely check if the app is currently executing inside Expo Go.
 * Remote push notifications were removed from Expo Go on Android starting in Expo SDK 51+.
 */
export function isRunningInExpoGo(): boolean {
  return (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    (Constants as any).appOwnership === "expo"
  );
}

/**
 * Dynamically retrieve expo-notifications module only when NOT running in Expo Go on Android.
 * This prevents expo-notifications top-level module evaluation from calling warnOfExpoGoPushUsage().
 */
export function getNotificationsModule():
  | typeof import("expo-notifications")
  | null {
  if (Platform.OS === "android" && isRunningInExpoGo()) {
    return null;
  }
  try {
    return require("expo-notifications");
  } catch (e) {
    return null;
  }
}

// Safely configure default notification handler when module is available
const Notifications = getNotificationsModule();
if (Notifications && Notifications.setNotificationHandler) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {
    // Ignored in Expo Go
  }
}

export interface NotificationSettings {
  attendanceReminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  salaryReminderEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  attendanceReminderEnabled: false,
  reminderHour: 9,
  reminderMinute: 0,
  salaryReminderEnabled: false,
};

/**
 * Set up Android Notification Channel cleanly
 */
export async function setupNotificationChannels(): Promise<void> {
  const Notifs = getNotificationsModule();
  if (!Notifs) return;

  if (Platform.OS === "android") {
    try {
      await Notifs.setNotificationChannelAsync("default", {
        name: "Haajari Manager Alerts",
        importance: Notifs.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#F97316",
        sound: "default",
      });
    } catch (err) {
      console.warn(
        "[Notifications] Failed to setup notification channel:",
        err,
      );
    }
  }
}

/**
 * Request notification permissions with permission status check
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const Notifs = getNotificationsModule();
  if (!Notifs) return false;

  try {
    const permResult: any = await Notifs.getPermissionsAsync();
    const existing = permResult?.status;
    if (existing === "granted") return true;

    const reqResult: any = await Notifs.requestPermissionsAsync();
    const status = reqResult?.status;
    return status === "granted";
  } catch (err) {
    console.warn("[Notifications] Permission request error:", err);
    return false;
  }
}

/**
 * Register Expo Push Token cleanly.
 * In Expo Go on Android, gracefully returns null to prevent fatal red error overlays.
 * In Development Builds & Production Builds, obtains the Expo Push Token and returns it.
 */
export async function registerExpoPushToken(): Promise<string | null> {
  if (Platform.OS === "web" || !Device.isDevice) {
    return null;
  }

  const Notifs = getNotificationsModule();
  if (!Notifs) {
    console.log(
      "[Notifications] Android remote push notifications require a Development Build (npx expo start --dev-client). Skipping remote push token generation in Expo Go.",
    );
    return null;
  }

  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    // Ensure default notification channel is active on Android
    await setupNotificationChannels();

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      "dcbd8a8c-4812-4ec7-8bd4-b194a79981cf";

    const tokenData = await Notifs.getExpoPushTokenAsync({
      projectId,
    });

    const pushToken = tokenData.data;

    // Check if token was already registered to avoid duplicate backend API requests
    const lastToken = await AsyncStorage.getItem(LAST_PUSH_TOKEN_KEY);
    if (lastToken === pushToken) {
      return pushToken;
    }

    await AsyncStorage.setItem(LAST_PUSH_TOKEN_KEY, pushToken);
    return pushToken;
  } catch (error: any) {
    console.warn(
      "[Notifications] Remote push token retrieval:",
      error?.message || error,
    );
    return null;
  }
}

export async function scheduleAttendanceReminder(
  hour: number,
  minute: number,
): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const Notifs = getNotificationsModule();
  if (!Notifs) return false;

  const granted = await requestNotificationPermission();
  if (!granted) return false;

  await cancelAttendanceReminder();

  try {
    await Notifs.scheduleNotificationAsync({
      content: {
        title: "हाजरी / Haajari Reminder",
        body: "Time to mark today's attendance for your workers!",
        sound: true,
        data: { type: "attendance_reminder" },
      },
      trigger: {
        hour,
        minute,
        repeats: true,
      } as any,
    });
    return true;
  } catch {
    return false;
  }
}

export async function scheduleSalaryReminder(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const Notifs = getNotificationsModule();
  if (!Notifs) return false;

  const granted = await requestNotificationPermission();
  if (!granted) return false;

  try {
    await Notifs.scheduleNotificationAsync({
      content: {
        title: "Salary Reminder",
        body: "End of month approaching — review and process worker payments.",
        sound: true,
        data: { type: "salary_reminder" },
      },
      trigger: {
        day: 28,
        hour: 10,
        minute: 0,
        repeats: true,
      } as any,
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelAttendanceReminder(): Promise<void> {
  if (Platform.OS === "web") return;
  const Notifs = getNotificationsModule();
  if (!Notifs) return;

  try {
    const scheduled = await Notifs.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if ((n.content.data as any)?.type === "attendance_reminder") {
        await Notifs.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch (err) {
    console.warn("[Notifications] Cancel attendance reminder error:", err);
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  const Notifs = getNotificationsModule();
  if (!Notifs) return;

  try {
    await Notifs.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.warn("[Notifications] Cancel all reminders error:", err);
  }
}

export function formatReminderTime(hour: number, minute: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = minute.toString().padStart(2, "0");
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h}:${m} ${ampm}`;
}
