import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

const ATTENDANCE_REMINDER_ID_KEY = "@haajari/attendance_reminder_id";

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleAttendanceReminder(
  hour: number,
  minute: number,
): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  await cancelAttendanceReminder();

  try {
    await Notifications.scheduleNotificationAsync({
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
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  try {
    await Notifications.scheduleNotificationAsync({
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
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if ((n.content.data as any)?.type === "attendance_reminder") {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export function formatReminderTime(hour: number, minute: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = minute.toString().padStart(2, "0");
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h}:${m} ${ampm}`;
}
