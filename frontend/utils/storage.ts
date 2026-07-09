import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, DeviceEventEmitter } from "react-native";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { Language } from "@/constants/i18n";

const getApiUrl = () => {
  // If in development mode, connect to the developer's computer IP or Android emulator loopback:
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    const localhost = hostUri ? hostUri.split(":")[0] : "10.0.2.2";
    return `http://${localhost}:5000/api`;
  }
  return "https://haajari-manager-production.up.railway.app/api";
};

export const API_URL = getApiUrl();

async function getHeaders(): Promise<HeadersInit> {
  try {
    const data = await AsyncStorage.getItem("@haajari/auth");
    const auth = data ? JSON.parse(data) : null;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (auth?.token) {
      headers["Authorization"] = `Bearer ${auth.token}`;
    }
    return headers;
  } catch {
    return { "Content-Type": "application/json" };
  }
}

function mapWorker(doc: any): Worker {
  return {
    id: doc._id || doc.id,
    projectId: doc.projectId || undefined,
    name: doc.name,
    category: doc.category as WorkerCategory,
    dailyRate: doc.dailyRate,
    phone: doc.phone || "",
    address: doc.address || "",
    notes: doc.notes || "",
    photoUri: doc.photoUri || undefined,
    createdAt: doc.createdAt ? new Date(doc.createdAt).getTime() : Date.now(),
  };
}

function mapAttendance(doc: any): AttendanceRecord {
  return {
    workerId: doc.workerId,
    projectId: doc.projectId || undefined,
    year: doc.year,
    month: doc.month,
    day: doc.day,
    value: doc.value,
    dailyRate: doc.dailyRate || undefined,
    customWage: doc.customWage || undefined,
    finalPay: doc.finalPay || undefined,
    overtimeHours: doc.overtimeHours || undefined,
    overtimeWage: doc.overtimeWage || undefined,
    location: doc.location || undefined,
    timestamp: doc.timestamp ? new Date(doc.timestamp).getTime() : undefined,
  };
}

function mapProject(doc: any): Project {
  return {
    id: doc._id || doc.id,
    name: doc.name,
    location: doc.location || "",
    status: doc.status || "active",
    createdAt: doc.createdAt ? new Date(doc.createdAt).getTime() : Date.now(),
  };
}

function mapPayment(doc: any): PaymentRecord {
  return {
    id: doc._id || doc.id,
    workerId: doc.workerId,
    year: doc.year,
    month: doc.month,
    amount: doc.amount,
    paidAt: doc.paidAt
      ? new Date(doc.paidAt).getTime()
      : doc.createdAt
        ? new Date(doc.createdAt).getTime()
        : Date.now(),
    note: doc.note || undefined,
    method: doc.method || "Cash",
    paidByName:
      doc.createdBy && typeof doc.createdBy === "object"
        ? doc.createdBy.name
        : doc.paidByName,
  };
}

export const STORAGE_KEYS = {
  AUTH: "@haajari/auth",
  USERS: "@haajari/users",
  WORKERS: "@haajari/workers",
  ATTENDANCE: "@haajari/attendance",
  SETTINGS: "@haajari/settings",
  LANGUAGE: "@haajari/language",
  PROFILE: "@haajari/profile",
  THEME: "@haajari/theme",
  PROJECTS: "@haajari/projects",
};

export interface AuthData {
  isLoggedIn: boolean;
  userId: string;
  userType: "admin" | "user" | "guest";
  role?: "contractor" | "builder" | "supervisor" | "admin" | "guest";
  phone?: string;
  email?: string;
  rememberMe: boolean;
  token?: string;
  refreshToken?: string;
  tenantId?: string;
  plan?: "free" | "professional" | "business";
}

export interface ProfileData {
  name: string;
  avatarColor: string;
  photoUri?: string;
}

export interface User {
  id: string;
  email?: string;
  password?: string;
  name: string;
  phone: string;
  address?: string;
  avatarColor: string;
  profileImage?: string;
  role: "contractor" | "builder" | "supervisor" | "admin";
  isActive: boolean;
  createdAt: number;
  lastLogin?: number;
  loginHistory: number[];
  assignedProjects?: string[];
  companyName?: string;
  plan?: "free" | "professional" | "business";
  planExpiresAt?: string;
  username?: string;
}

export interface Project {
  id: string;
  name: string;
  location?: string;
  status: "active" | "inactive";
  createdAt: number;
}

export interface Worker {
  id: string;
  projectId?: string;
  name: string;
  category: WorkerCategory;
  dailyRate: number;
  phone?: string;
  address?: string;
  notes?: string;
  photoUri?: string;
  createdAt: number;
}

export type WorkerCategory =
  | "labour"
  | "bai"
  | "mistri"
  | "bandkam"
  | "plaster"
  | "tiles"
  | "sutar";

export type AttendanceValue = "P" | "A" | "H" | "OT" | number;

export interface AttendanceRecord {
  workerId: string;
  projectId?: string;
  year: number;
  month: number;
  day: number;
  value: AttendanceValue;
  dailyRate?: number;
  customWage?: number;
  finalPay?: number;
  overtimeHours?: number;
  overtimeWage?: number;
  location?: { latitude: number; longitude: number; accuracy?: number };
  timestamp?: number;
}

export interface Settings {
  defaultMonth: number;
  defaultYear: number;
}

export interface PaymentRecord {
  id: string;
  workerId: string;
  year: number;
  month: number;
  amount: number;
  paidAt: number;
  note?: string;
  method?: string;
  paidByName?: string;
}

export type ThemeMode = "light" | "dark" | "system";

export const STORAGE_KEYS_EXT = {
  PAYMENTS: "@haajari/payments",
  NOTIFICATION_SETTINGS: "@haajari/notification_settings",
  VOICE_SETTINGS: "@haajari/voice_settings",
};

export interface NotificationSettings {
  attendanceReminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  salaryReminderEnabled: boolean;
}

export interface VoiceSettings {
  enabled: boolean;
  speed: number;
  pitch: number;
  volume: number;
  languageAuto: boolean;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  enabled: true,
  speed: 1.0,
  pitch: 1.0,
  volume: 1.0,
  languageAuto: true,
};

export const storage = {
  // Auth methods
  async getAuth(): Promise<AuthData | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.AUTH);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async setAuth(auth: AuthData): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(auth));
    } catch (error) {
      console.error("Error saving auth:", error);
    }
  },

  async clearAuth(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH);
    } catch (error) {
      console.error("Error clearing auth:", error);
    }
  },

  // User methods
  async getUsers(): Promise<User[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async getUserById(userId: string): Promise<User | null> {
    const users = await this.getUsers();
    return users.find((u) => u.id === userId) || null;
  },

  async getUserByPhone(phone: string): Promise<User | null> {
    const users = await this.getUsers();
    return users.find((u) => u.phone === phone) || null;
  },

  async addUser(user: User): Promise<void> {
    const users = await this.getUsers();
    users.push(user);
    await AsyncStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  async updateUser(updatedUser: User): Promise<void> {
    const users = await this.getUsers();
    const index = users.findIndex((u) => u.id === updatedUser.id);
    if (index !== -1) {
      users[index] = updatedUser;
    } else {
      users.push(updatedUser);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  async deleteUser(userId: string): Promise<void> {
    // Call server-side account deletion first
    try {
      const auth = await this.getAuth();
      if (auth?.token) {
        await authenticatedFetch(`${API_URL}/auth/delete-account`, {
          method: "DELETE",
        });
      }
    } catch (e) {
      console.warn("Failed to delete account on backend, clearing locally", e);
    }
    // Clear local user data regardless
    const users = await this.getUsers();
    const filtered = users.filter((u) => u.id !== userId);
    await AsyncStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(filtered));
  },

  async getUserByEmail(email: string): Promise<User | null> {
    const users = await this.getUsers();
    return (
      users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null
    );
  },

  async recordUserLogin(userId: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (user) {
      user.lastLogin = Date.now();
      user.loginHistory = [...(user.loginHistory || []), Date.now()].slice(-20);
      await this.updateUser(user);
    }
  },

  // Language methods
  async getLanguage(): Promise<Language> {
    try {
      const lang = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
      return (lang as Language) || "en";
    } catch {
      return "en";
    }
  },

  async setLanguage(language: Language): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, language);
    } catch (error) {
      console.error("Error saving language:", error);
    }
  },

  // Project methods
  async getProjects(): Promise<Project[]> {
    try {
      const auth = await this.getAuth();
      if (auth?.token) {
        try {
          const res = await authenticatedFetch(`${API_URL}/projects`);
          if (res.ok) {
            const data = await res.json();
            const serverProjects = data.map(mapProject);
            await AsyncStorage.setItem(
              STORAGE_KEYS.PROJECTS,
              JSON.stringify(serverProjects),
            );
            return serverProjects;
          }
        } catch (e) {
          console.log("Failed to fetch projects from backend, using cache", e);
        }
      }
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PROJECTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async setProjects(projects: Project[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.PROJECTS,
        JSON.stringify(projects),
      );
    } catch (error) {
      console.error("Error saving projects:", error);
    }
  },

  async addProject(project: Project): Promise<void> {
    const projects = await this.getProjects();
    const auth = await this.getAuth();
    const plan = auth?.plan || "free";

    if (auth?.role !== "guest" && plan === "free" && projects.length >= 1) {
      throw new Error("LIMIT_EXCEEDED_PROJECTS");
    }

    if (auth?.token) {
      try {
        const res = await authenticatedFetch(`${API_URL}/projects`, {
          method: "POST",
          body: JSON.stringify({
            name: project.name,
            location: project.location,
          }),
        });
        if (res.ok) {
          const saved = await res.json();
          project.id = saved._id || saved.id;
        } else if (res.status === 403) {
          throw new Error("LIMIT_EXCEEDED_PROJECTS");
        }
      } catch (e: any) {
        if (e.message === "LIMIT_EXCEEDED_PROJECTS") throw e;
        console.warn("Failed to add project on backend, saving locally", e);
      }
    }
    projects.push(project);
    await this.setProjects(projects);
  },

  async updateProject(updatedProject: Project): Promise<void> {
    const projects = await this.getProjects();
    const index = projects.findIndex((p) => p.id === updatedProject.id);
    if (index !== -1) {
      projects[index] = updatedProject;
      await this.setProjects(projects);
    }

    const auth = await this.getAuth();
    if (auth?.token && updatedProject.id.length >= 24) {
      try {
        await authenticatedFetch(`${API_URL}/projects/${updatedProject.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: updatedProject.name,
            location: updatedProject.location,
            status: updatedProject.status,
          }),
        });
      } catch (e) {
        console.warn("Failed to update project on backend, updated locally", e);
      }
    }
  },

  async deleteProject(projectId: string): Promise<void> {
    const projects = await this.getProjects();
    const filtered = projects.filter((p) => p.id !== projectId);
    await this.setProjects(filtered);

    // Dissociate workers
    const workers = await this.getWorkers();
    const updatedWorkers = workers.map((w) =>
      w.projectId === projectId ? { ...w, projectId: undefined } : w,
    );
    await this.setWorkers(updatedWorkers);

    const auth = await this.getAuth();
    if (auth?.token && projectId.length >= 24) {
      try {
        await authenticatedFetch(`${API_URL}/projects/${projectId}`, {
          method: "DELETE",
        });
      } catch (e) {
        console.warn("Failed to delete project on backend, deleted locally", e);
      }
    }
  },

  // Worker methods
  async getWorkers(): Promise<Worker[]> {
    try {
      const auth = await this.getAuth();
      if (auth?.token) {
        try {
          const res = await authenticatedFetch(`${API_URL}/workers`);
          if (res.ok) {
            const data = await res.json();
            const serverWorkers = data.map(mapWorker);
            await AsyncStorage.setItem(
              STORAGE_KEYS.WORKERS,
              JSON.stringify(serverWorkers),
            );
            return serverWorkers;
          }
        } catch (e) {
          console.log("Failed to fetch workers from backend, using cache", e);
        }
      }
      const data = await AsyncStorage.getItem(STORAGE_KEYS.WORKERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async setWorkers(workers: Worker[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.WORKERS, JSON.stringify(workers));
    } catch (error) {
      console.error("Error saving workers:", error);
    }
  },

  async addWorker(worker: Worker): Promise<void> {
    const workers = await this.getWorkers();
    const auth = await this.getAuth();
    const plan = auth?.plan || "free";

    if (auth?.role !== "guest") {
      if (plan === "free" && workers.length >= 15) {
        throw new Error("LIMIT_EXCEEDED_WORKERS");
      }
      if (plan === "professional" && workers.length >= 100) {
        throw new Error("LIMIT_EXCEEDED_WORKERS");
      }
    }

    if (auth?.token) {
      try {
        const res = await authenticatedFetch(`${API_URL}/workers`, {
          method: "POST",
          body: JSON.stringify({
            name: worker.name,
            projectId: worker.projectId,
            category: worker.category,
            dailyRate: worker.dailyRate,
            phone: worker.phone,
            address: worker.address,
            notes: worker.notes,
            photoUri: worker.photoUri,
          }),
        });
        if (res.ok) {
          const saved = await res.json();
          worker.id = saved._id || saved.id;
        } else if (res.status === 403) {
          throw new Error("LIMIT_EXCEEDED_WORKERS");
        }
      } catch (e: any) {
        if (e.message === "LIMIT_EXCEEDED_WORKERS") throw e;
        console.warn("Failed to add worker on backend, saving locally", e);
      }
    }
    workers.push(worker);
    await this.setWorkers(workers);
  },

  async updateWorker(updatedWorker: Worker): Promise<void> {
    const workers = await this.getWorkers();
    const index = workers.findIndex((w) => w.id === updatedWorker.id);
    if (index !== -1) {
      workers[index] = updatedWorker;
      await this.setWorkers(workers);
    }

    const auth = await this.getAuth();
    if (auth?.token && updatedWorker.id.length >= 24) {
      try {
        await authenticatedFetch(`${API_URL}/workers/${updatedWorker.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: updatedWorker.name,
            projectId: updatedWorker.projectId,
            category: updatedWorker.category,
            dailyRate: updatedWorker.dailyRate,
            phone: updatedWorker.phone,
            address: updatedWorker.address,
            notes: updatedWorker.notes,
            photoUri: updatedWorker.photoUri,
          }),
        });
      } catch (e) {
        console.warn("Failed to update worker on backend, updated locally", e);
      }
    }
  },

  async deleteWorker(workerId: string): Promise<void> {
    const workers = await this.getWorkers();
    const filtered = workers.filter((w) => w.id !== workerId);
    await this.setWorkers(filtered);
    const attendance = await this.getAttendance();
    const filteredAttendance = attendance.filter(
      (a) => a.workerId !== workerId,
    );
    await this.setAttendance(filteredAttendance);

    const auth = await this.getAuth();
    if (auth?.token && workerId.length >= 24) {
      try {
        await authenticatedFetch(`${API_URL}/workers/${workerId}`, {
          method: "DELETE",
        });
      } catch (e) {
        console.warn("Failed to delete worker on backend, deleted locally", e);
      }
    }
  },

  // Attendance methods
  async getAttendance(): Promise<AttendanceRecord[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ATTENDANCE);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async setAttendance(records: AttendanceRecord[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.ATTENDANCE,
        JSON.stringify(records),
      );
    } catch (error) {
      console.error("Error saving attendance:", error);
    }
  },

  async setAttendanceRecord(record: AttendanceRecord): Promise<void> {
    const records = await this.getAttendance();
    const existingIndex = records.findIndex(
      (r) =>
        r.workerId === record.workerId &&
        r.year === record.year &&
        r.month === record.month &&
        r.day === record.day,
    );
    if (existingIndex !== -1) {
      records[existingIndex] = record;
    } else {
      records.push(record);
    }
    await this.setAttendance(records);

    const auth = await this.getAuth();
    if (auth?.token && record.workerId.length >= 24) {
      try {
        await authenticatedFetch(`${API_URL}/attendance/record`, {
          method: "POST",
          body: JSON.stringify({
            workerId: record.workerId,
            year: record.year,
            month: record.month,
            day: record.day,
            value: record.value,
            dailyRate: record.dailyRate,
            customWage: record.customWage,
            finalPay: record.finalPay,
            overtimeHours: record.overtimeHours,
            overtimeWage: record.overtimeWage,
            location: record.location,
          }),
        });
      } catch (e) {
        console.warn(
          "Failed to save attendance record to backend, saved locally",
          e,
        );
      }
    }
  },

  async getAttendanceForMonth(
    year: number,
    month: number,
  ): Promise<AttendanceRecord[]> {
    try {
      const auth = await this.getAuth();
      if (auth?.token) {
        try {
          const res = await authenticatedFetch(
            `${API_URL}/attendance/month?year=${year}&month=${month}`,
          );
          if (res.ok) {
            const data = await res.json();
            const serverAttendance = data.map(mapAttendance);
            const localRecords = await this.getAttendance();
            const filteredLocal = localRecords.filter(
              (r) => !(r.year === year && r.month === month),
            );
            const merged = [...filteredLocal, ...serverAttendance];
            await this.setAttendance(merged);
            return serverAttendance;
          }
        } catch (e) {
          console.warn(
            "Failed to fetch attendance from backend, using cache",
            e,
          );
        }
      }
    } catch (e) {
      console.error(e);
    }
    const records = await this.getAttendance();
    return records.filter((r) => r.year === year && r.month === month);
  },

  // Settings methods
  async getSettings(): Promise<Settings> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // Fall through to default
    }
    const now = new Date();
    return {
      defaultMonth: now.getMonth(),
      defaultYear: now.getFullYear(),
    };
  },

  async setSettings(settings: Settings): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.SETTINGS,
        JSON.stringify(settings),
      );
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  },

  // Profile methods
  async getProfile(): Promise<ProfileData> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // Fall through to default
    }
    return { name: "Admin", avatarColor: "#FF6B6B" };
  },

  async setProfile(profile: ProfileData): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch (error) {
      console.error("Error saving profile:", error);
    }
  },

  // Payment methods
  async getPayments(): Promise<PaymentRecord[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS_EXT.PAYMENTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async addPayment(payment: PaymentRecord): Promise<void> {
    try {
      const payments = await this.getPayments();
      const auth = await this.getAuth();

      payment.method = payment.method || "Cash";
      const profile = await this.getProfile();
      payment.paidByName = profile?.name || "Admin";

      if (auth?.token && payment.workerId.length >= 24) {
        try {
          const res = await authenticatedFetch(`${API_URL}/payments`, {
            method: "POST",
            body: JSON.stringify({
              workerId: payment.workerId,
              year: payment.year,
              month: payment.month,
              amount: payment.amount,
              note: payment.note,
              method: payment.method,
            }),
          });
          if (res.ok) {
            const saved = await res.json();
            payment.id = saved._id || saved.id;
            if (saved.paidAt) {
              payment.paidAt = new Date(saved.paidAt).getTime();
            }
            if (saved.createdBy && typeof saved.createdBy === "object") {
              payment.paidByName = saved.createdBy.name || payment.paidByName;
            }
          }
        } catch (e) {
          console.warn("Failed to save payment on backend, saving locally", e);
        }
      }
      payments.push(payment);
      await AsyncStorage.setItem(
        STORAGE_KEYS_EXT.PAYMENTS,
        JSON.stringify(payments),
      );
    } catch (error) {
      console.error("Error saving payment:", error);
    }
  },

  async deletePayment(paymentId: string): Promise<void> {
    try {
      const payments = await this.getPayments();
      const filtered = payments.filter((p) => p.id !== paymentId);
      await AsyncStorage.setItem(
        STORAGE_KEYS_EXT.PAYMENTS,
        JSON.stringify(filtered),
      );

      const auth = await this.getAuth();
      if (auth?.token && paymentId.length >= 24) {
        try {
          await authenticatedFetch(`${API_URL}/payments/${paymentId}`, {
            method: "DELETE",
          });
        } catch (e) {
          console.warn(
            "Failed to delete payment on backend, deleted locally",
            e,
          );
        }
      }
    } catch (error) {
      console.error("Error deleting payment:", error);
    }
  },

  async getPaymentsForMonth(
    year: number,
    month: number,
  ): Promise<PaymentRecord[]> {
    try {
      const auth = await this.getAuth();
      if (auth?.token) {
        try {
          const res = await authenticatedFetch(
            `${API_URL}/payments/month?year=${year}&month=${month}`,
          );
          if (res.ok) {
            const data = await res.json();
            const serverPayments = data.map(mapPayment);
            const localPayments = await this.getPayments();
            const filteredLocal = localPayments.filter(
              (p) => !(p.year === year && p.month === month),
            );
            const merged = [...filteredLocal, ...serverPayments];
            await AsyncStorage.setItem(
              STORAGE_KEYS_EXT.PAYMENTS,
              JSON.stringify(merged),
            );
            return serverPayments;
          }
        } catch (e) {
          console.log("Failed to fetch payments from backend, using cache", e);
        }
      }
    } catch (e) {
      console.error(e);
    }
    const payments = await this.getPayments();
    return payments.filter((p) => p.year === year && p.month === month);
  },

  async getPaymentsForWorkerMonth(
    workerId: string,
    year: number,
    month: number,
  ): Promise<PaymentRecord[]> {
    const payments = await this.getPaymentsForMonth(year, month);
    return payments.filter(
      (p) => p.workerId === workerId && p.year === year && p.month === month,
    );
  },

  async getNotificationSettings(): Promise<NotificationSettings | null> {
    const data = await AsyncStorage.getItem(
      STORAGE_KEYS_EXT.NOTIFICATION_SETTINGS,
    );
    return data ? JSON.parse(data) : null;
  },

  async setNotificationSettings(settings: NotificationSettings): Promise<void> {
    await AsyncStorage.setItem(
      STORAGE_KEYS_EXT.NOTIFICATION_SETTINGS,
      JSON.stringify(settings),
    );
  },

  async getVoiceSettings(): Promise<VoiceSettings> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS_EXT.VOICE_SETTINGS);
      return data ? { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(data) } : DEFAULT_VOICE_SETTINGS;
    } catch {
      return DEFAULT_VOICE_SETTINGS;
    }
  },

  async setVoiceSettings(settings: VoiceSettings): Promise<void> {
    await AsyncStorage.setItem(
      STORAGE_KEYS_EXT.VOICE_SETTINGS,
      JSON.stringify(settings),
    );
  },

  async exportAllData(): Promise<string> {
    const [workers, attendance, payments, settings, profile] =
      await Promise.all([
        this.getWorkers(),
        this.getAttendance(),
        this.getPayments(),
        this.getSettings(),
        this.getProfile(),
      ]);
    const backup = {
      version: 1,
      exportedAt: Date.now(),
      appName: "Haajari",
      workers,
      attendance,
      payments,
      settings,
      profile,
    };
    return JSON.stringify(backup);
  },

  async importAllData(json: string): Promise<void> {
    const backup = JSON.parse(json);
    if (!backup.appName || backup.appName !== "Haajari")
      throw new Error("Invalid backup file");
    await Promise.all([
      backup.workers ? this.setWorkers(backup.workers) : Promise.resolve(),
      backup.attendance
        ? this.setAttendance(backup.attendance)
        : Promise.resolve(),
      backup.payments
        ? AsyncStorage.setItem(
            STORAGE_KEYS_EXT.PAYMENTS,
            JSON.stringify(backup.payments),
          )
        : Promise.resolve(),
      backup.settings ? this.setSettings(backup.settings) : Promise.resolve(),
      backup.profile ? this.setProfile(backup.profile) : Promise.resolve(),
    ]);
  },

  async saveBiometricCredentials(
    email: string,
    password: string,
  ): Promise<void> {
    try {
      if (Platform.OS === "web") return;
      await SecureStore.setItemAsync("@haajari_bio_email", email);
      await SecureStore.setItemAsync("@haajari_bio_pass", password);
    } catch {}
  },

  async getBiometricCredentials(): Promise<{
    email: string;
    password: string;
  } | null> {
    try {
      if (Platform.OS === "web") return null;
      const email = await SecureStore.getItemAsync("@haajari_bio_email");
      const password = await SecureStore.getItemAsync("@haajari_bio_pass");
      if (email && password) return { email, password };
      return null;
    } catch {
      return null;
    }
  },

  async clearBiometricCredentials(): Promise<void> {
    try {
      if (Platform.OS === "web") return;
      await SecureStore.deleteItemAsync("@haajari_bio_email");
      await SecureStore.deleteItemAsync("@haajari_bio_pass");
    } catch {}
  },

  async updateWorkerIdReferences(oldId: string, newId: string): Promise<void> {
    const localAttendance = await AsyncStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    if (localAttendance) {
      const attendance: AttendanceRecord[] = JSON.parse(localAttendance);
      const updated = attendance.map((r) =>
        r.workerId === oldId ? { ...r, workerId: newId } : r,
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS.ATTENDANCE,
        JSON.stringify(updated),
      );
    }

    const localPayments = await AsyncStorage.getItem(STORAGE_KEYS_EXT.PAYMENTS);
    if (localPayments) {
      const payments: PaymentRecord[] = JSON.parse(localPayments);
      const updated = payments.map((p) =>
        p.workerId === oldId ? { ...p, workerId: newId } : p,
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS_EXT.PAYMENTS,
        JSON.stringify(updated),
      );
    }
  },

  async syncWithBackend(): Promise<void> {
    const auth = await this.getAuth();
    if (!auth?.token) return;

    try {
      // 1. Sync workers
      const localWorkers = await AsyncStorage.getItem(STORAGE_KEYS.WORKERS);
      if (localWorkers) {
        const workers: Worker[] = JSON.parse(localWorkers);
        for (let i = 0; i < workers.length; i++) {
          const w = workers[i];
          if (w.id.length < 24) {
            const res = await authenticatedFetch(`${API_URL}/workers`, {
              method: "POST",
              body: JSON.stringify({
                name: w.name,
                category: w.category,
                dailyRate: w.dailyRate,
                phone: w.phone,
                address: w.address,
                notes: w.notes,
                photoUri: w.photoUri,
              }),
            });
            if (res.ok) {
              const saved: any = await res.json();
              const serverId = saved._id || saved.id;
              await this.updateWorkerIdReferences(w.id, serverId);
              w.id = serverId;
            }
          }
        }
        await AsyncStorage.setItem(
          STORAGE_KEYS.WORKERS,
          JSON.stringify(workers),
        );
      }

      // 2. Sync attendance
      const localAttendance = await AsyncStorage.getItem(
        STORAGE_KEYS.ATTENDANCE,
      );
      if (localAttendance) {
        const attendance: AttendanceRecord[] = JSON.parse(localAttendance);
        const validRecords = attendance.filter((r) => r.workerId.length >= 24);
        if (validRecords.length > 0) {
          const res = await authenticatedFetch(`${API_URL}/attendance/sync`, {
            method: "POST",
            body: JSON.stringify({ records: validRecords }),
          });
          if (res.ok) {
            console.log("Successfully bulk synced attendance records");
          }
        }
      }

      // 3. Sync payments
      const localPayments = await AsyncStorage.getItem(
        STORAGE_KEYS_EXT.PAYMENTS,
      );
      if (localPayments) {
        const payments: PaymentRecord[] = JSON.parse(localPayments);
        for (let i = 0; i < payments.length; i++) {
          const p = payments[i];
          if (p.id.length < 24 && p.workerId.length >= 24) {
            const res = await authenticatedFetch(`${API_URL}/payments`, {
              method: "POST",
              body: JSON.stringify({
                workerId: p.workerId,
                year: p.year,
                month: p.month,
                amount: p.amount,
                note: p.note,
              }),
            });
            if (res.ok) {
              const saved: any = await res.json();
              p.id = saved._id || saved.id;
            }
          }
        }
        await AsyncStorage.setItem(
          STORAGE_KEYS_EXT.PAYMENTS,
          JSON.stringify(payments),
        );
      }
    } catch (error) {
      console.log("Error during syncWithBackend:", error);
    }
  },

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        ...Object.values(STORAGE_KEYS),
        STORAGE_KEYS_EXT.PAYMENTS,
      ]);
      await this.clearBiometricCredentials();
    } catch (error) {
      console.error("Error clearing storage:", error);
    }
  },
};

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export async function authenticatedFetch(
  url: string,
  options: RequestInit & { _retry?: boolean } = {},
): Promise<Response> {
  const auth = await storage.getAuth();

  const headers = (options.headers || {}) as Record<string, string>;
  if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (auth?.token) {
    headers["Authorization"] = `Bearer ${auth.token}`;
  }
  options.headers = headers;

  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (netError) {
    console.log("Network request failed in authenticatedFetch:", netError);
    throw netError;
  }

  if (res.status === 401 && !options._retry) {
    if (auth?.token && auth?.refreshToken) {
      if (isRefreshing) {
        console.log("Queueing request during token refresh:", url);
        return new Promise<Response>((resolve, reject) => {
          subscribeTokenRefresh((newToken) => {
            // Update auth token for request and retry
            const updatedHeaders = (options.headers || {}) as Record<string, string>;
            updatedHeaders["Authorization"] = `Bearer ${newToken}`;
            options.headers = updatedHeaders;
            options._retry = true; // Mark retry to avoid infinite loop
            fetch(url, options).then(resolve).catch(reject);
          });
        });
      }

      isRefreshing = true;
      console.log("Token expired (401), attempting to refresh token...");

      try {
        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: auth.refreshToken }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const updatedAuth = {
            ...auth,
            token: refreshData.token,
            refreshToken: refreshData.refreshToken,
          };
          await storage.setAuth(updatedAuth);
          isRefreshing = false;

          // Dispatch the new token to all queued subscribers
          onRefreshed(refreshData.token);

          // Retry the original request
          headers["Authorization"] = `Bearer ${refreshData.token}`;
          options.headers = headers;
          options._retry = true;
          return fetch(url, options);
        } else if (refreshRes.status === 401 || refreshRes.status === 403 || refreshRes.status === 400) {
          console.warn("Refresh token rejected by server: status", refreshRes.status);
          isRefreshing = false;
          refreshSubscribers = [];
          await storage.clearAuth();
          DeviceEventEmitter.emit("unauthorized");
        } else {
          console.warn("Temporary server error during token refresh: status", refreshRes.status);
          isRefreshing = false;
          // Resolve queued items with old token so they fail or recover
          onRefreshed(auth.token);
        }
      } catch (err) {
        console.warn("Network error during token refresh, keeping credentials:", err);
        isRefreshing = false;
        onRefreshed(auth.token);
      }
    } else {
      console.log("No token or refresh token, triggering unauthorized...");
      await storage.clearAuth();
      DeviceEventEmitter.emit("unauthorized");
    }
  }

  return res;
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function calculateWorkerSummary(
  workerId: string,
  attendance: AttendanceRecord[],
  dailyRate: number,
): {
  presentDays: number;
  halfDays: number;
  absentDays: number;
  overtimeDays: number;
  customDays: number;
  customAmount: number;
  totalAmount: number;
  totalAdvanceAmount: number;
  totalOvertimeAmount: number;
} {
  const workerAttendance = attendance.filter((a) => a.workerId === workerId);

  let presentDays = 0;
  let halfDays = 0;
  let absentDays = 0;
  let overtimeDays = 0;
  let customDays = 0;
  let customAmount = 0;
  let totalAmount = 0;
  let totalAdvanceAmount = 0;
  let totalOvertimeAmount = 0;

  workerAttendance.forEach((record) => {
    // 1. Calculate pay for this day
    const rate =
      record.dailyRate !== undefined && record.dailyRate !== null
        ? record.dailyRate
        : dailyRate;
    const advance =
      record.customWage !== undefined && record.customWage !== null
        ? record.customWage
        : 0;
    const overtime =
      record.overtimeWage !== undefined && record.overtimeWage !== null
        ? record.overtimeWage
        : 0;
    let recordPay = 0;

    if (record.value === "P" || record.value === "OT") {
      recordPay = rate + advance + overtime;
    } else if (record.value === "H") {
      recordPay = rate / 2 + advance + overtime;
    } else if (record.value === "A") {
      recordPay = 0;
    } else if (typeof record.value === "number") {
      recordPay = record.value;
    } else {
      recordPay = 0;
    }
    totalAmount += recordPay;

    // 2. Count stats
    if (record.value === "P") {
      presentDays++;
    } else if (record.value === "A") {
      absentDays++;
    } else if (record.value === "H") {
      halfDays++;
    } else if (record.value === "OT") {
      overtimeDays++;
    } else if (typeof record.value === "number") {
      customDays++;
      customAmount += record.value;
    }

    if (record.customWage !== undefined && record.customWage !== null) {
      customDays++;
      customAmount += record.customWage;
      totalAdvanceAmount += record.customWage;
    }

    if (record.overtimeWage !== undefined && record.overtimeWage !== null) {
      totalOvertimeAmount += record.overtimeWage;
    }
  });

  return {
    presentDays,
    halfDays,
    absentDays,
    overtimeDays,
    customDays,
    customAmount,
    totalAmount,
    totalAdvanceAmount,
    totalOvertimeAmount,
  };
}
