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

export async function requestNotificationPermission(): Promise<boolean> {
  return false;
}

export async function scheduleAttendanceReminder(
  _hour: number,
  _minute: number,
): Promise<boolean> {
  return false;
}

export async function scheduleSalaryReminder(): Promise<boolean> {
  return false;
}

export async function cancelAttendanceReminder(): Promise<void> {}

export async function cancelAllReminders(): Promise<void> {}

export function formatReminderTime(hour: number, minute: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = minute.toString().padStart(2, "0");
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h}:${m} ${ampm}`;
}
