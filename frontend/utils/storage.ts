import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, DeviceEventEmitter } from "react-native";
import * as SecureStore from "expo-secure-store";
import { Language } from "@/constants/i18n";
import { getDeviceHeaders } from "./device";
import { API_URL, getApiUrl } from "./apiConfig";
import { authenticatedFetch } from "./apiClient";

export { API_URL, getApiUrl, authenticatedFetch };

const inflightRequests = new Map<string, Promise<any>>();
const memoryCache = new Map<string, { data: any; timestamp: number }>();
const DEFAULT_STALE_TIME_MS = 15000; // 15 seconds memory cache stale time

export function getMemoryCache<T>(
  key: string,
  maxAgeMs = DEFAULT_STALE_TIME_MS,
): T | null {
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.timestamp < maxAgeMs) {
    return cached.data as T;
  }
  return null;
}

export function setMemoryCache<T>(key: string, data: T): void {
  memoryCache.set(key, { data, timestamp: Date.now() });
}

export function invalidateMemoryCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(keyPrefix)) {
      memoryCache.delete(key);
    }
  }
}

export function dedupeRequest<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const existing = inflightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }
  const promise = fetcher().finally(() => {
    inflightRequests.delete(key);
  });
  inflightRequests.set(key, promise);
  return promise;
}

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
    uniqueId: doc.uniqueId || undefined,
    projectId: doc.projectId || undefined,
    name: doc.name,
    category: doc.category as WorkerCategory,
    dailyRate: doc.dailyRate,
    skillCategory: doc.skillCategory || "unskilled",
    paymentType: doc.paymentType || "daily",
    pieceRateAmount: doc.pieceRateAmount || 0,
    subContractorName: doc.subContractorName || "",
    phone: doc.phone || "",
    address: doc.address || "",
    notes: doc.notes || "",
    photoUri: doc.photoUri || undefined,
    createdAt: doc.createdAt ? new Date(doc.createdAt).getTime() : Date.now(),
  };
}

export function mapAttendance(doc: any): AttendanceRecord {
  const wId =
    doc.workerId && typeof doc.workerId === "object"
      ? doc.workerId._id || doc.workerId.id || doc.workerId
      : doc.workerId;
  return {
    workerId: String(wId || ""),
    projectId: doc.projectId || undefined,
    year: doc.year,
    month: doc.month,
    day: doc.day,
    value: doc.value,
    dailyRate: doc.dailyRate !== undefined ? doc.dailyRate : undefined,
    customWage: doc.customWage !== undefined ? doc.customWage : undefined,
    finalPay: doc.finalPay !== undefined ? doc.finalPay : undefined,
    overtimeHours:
      doc.overtimeHours !== undefined ? doc.overtimeHours : undefined,
    overtimeWage: doc.overtimeWage !== undefined ? doc.overtimeWage : undefined,
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
    clientName: doc.clientName || "",
    budget: doc.budget || 0,
    startDate: doc.startDate || "",
    endDate: doc.endDate || "",
    retentionPercentage: doc.retentionPercentage || 0,
    mobilizationAdvance: doc.mobilizationAdvance || 0,
    labourLicenseNumber: doc.labourLicenseNumber || "",
    pfEsicStatus: doc.pfEsicStatus || "not_applicable",
    wcPolicyNumber: doc.wcPolicyNumber || "",
    progressUnit: doc.progressUnit || "cum",
    plannedQty: doc.plannedQty || 0,
    completedQty: doc.completedQty || 0,
    phases: doc.phases || [],
    createdAt: doc.createdAt ? new Date(doc.createdAt).getTime() : Date.now(),
  };
}

function mapSite(doc: any): Site {
  return {
    id: doc._id || doc.id,
    name: doc.name,
    projectType: doc.projectType,
    clientName: doc.clientName || "",
    address: doc.address || "",
    startDate: doc.startDate || "",
    description: doc.description || "",
    status: doc.status || "Planning",
    supervisor: doc.supervisor,
    createdBy: doc.createdBy,
    isArchived: doc.isArchived || false,
    isDeleted: doc.isDeleted || false,
    createdAt: doc.createdAt || "",
    updatedAt: doc.updatedAt || "",
    currentWork: doc.currentWork,
    currentProgress: doc.currentProgress,
    lastUpdateAt: doc.lastUpdateAt,
    lastUpdatedBy: doc.lastUpdatedBy,
    lastUpdateType: doc.lastUpdateType,
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
    receivedByName: doc.receivedByName,
    transactionId: doc.transactionId,
    referenceNumber: doc.referenceNumber,
    status: doc.status || "Completed",
  };
}

export const STORAGE_KEYS = {
  AUTH: "@haajari/auth",
  USERS: "@haajari/users",
  WORKERS: "@haajari/workers",
  ATTENDANCE: "@haajari/attendance",
  SETTINGS: "@haajari/settings",
  LANGUAGE: "@haajari/language",
  LANGUAGE_ONBOARDING_COMPLETED: "@haajari/language_onboarding_completed",
  PROFILE: "@haajari/profile",
  THEME: "@haajari/theme",
  PROJECTS: "@haajari/projects",
  SITES: "@haajari/sites",
  SYNC_QUEUE: "@haajari/sync_queue",
  LABOUR_DASHBOARD: "@haajari/labour_dashboard",
};

export interface AuthData {
  isLoggedIn: boolean;
  userId: string;
  userType: "admin" | "user" | "guest";
  role?:
    | "contractor"
    | "builder"
    | "supervisor"
    | "labor"
    | "admin"
    | "guest"
    | "worker";
  phone?: string;
  email?: string;
  username?: string;
  isPhoneVerified?: boolean;
  rememberMe: boolean;
  token?: string;
  refreshToken?: string;
  tenantId?: string;
  plan?:
    | "free"
    | "starter"
    | "professional"
    | "business"
    | "basic"
    | "super"
    | "premium";
}

export interface ProfileData {
  name: string;
  avatarColor: string;
  photoUri?: string;
}

export interface User {
  id: string;
  uniqueId?: string;
  email?: string;
  password?: string;
  name: string;
  phone: string;
  address?: string;
  avatarColor: string;
  profileImage?: string;
  role: "contractor" | "builder" | "supervisor" | "labor" | "admin" | "worker";
  workerCategory?: string;
  dailyWage?: number;
  contractorName?: string;
  contractorCompany?: string;
  connectionStatus?: string;
  isActive: boolean;
  isVerified?: boolean;
  isPhoneVerified?: boolean;
  createdAt: number;
  lastLogin?: number;
  loginHistory: number[];
  assignedProjects?: string[];
  tenantId?: string;
  contractorId?: string;
  companyName?: string;
  plan?:
    | "free"
    | "starter"
    | "professional"
    | "business"
    | "basic"
    | "super"
    | "premium";
  planExpiresAt?: string;
  username?: string;
}

export interface Project {
  id: string;
  name: string;
  location?: string;
  status: "active" | "inactive";
  clientName?: string;
  budget?: number;
  startDate?: string;
  endDate?: string;
  retentionPercentage?: number;
  mobilizationAdvance?: number;
  labourLicenseNumber?: string;
  pfEsicStatus?: "applicable" | "not_applicable";
  wcPolicyNumber?: string;
  progressUnit?: string;
  plannedQty?: number;
  completedQty?: number;
  phases?: {
    name: string;
    weight: number;
    status: "pending" | "in_progress" | "completed";
    percentDone: number;
  }[];
  createdAt: number;
}

export interface Site {
  id: string;
  name: string;
  projectType: string;
  clientName?: string;
  address: string;
  startDate: string;
  description?: string;
  status:
    | "Planning"
    | "Started"
    | "In Progress"
    | "On Hold"
    | "Delayed"
    | "Completed"
    | "Active";
  supervisor?:
    | {
        _id: string;
        name: string;
        email?: string;
        phone?: string;
        role?: string;
      }
    | string;
  createdBy?: string;
  isArchived?: boolean;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;

  // Cache fields
  currentWork?: string;
  currentProgress?: number;
  lastUpdateAt?: string;
  lastUpdatedBy?:
    | {
        _id: string;
        name: string;
        role?: string;
      }
    | string;
  lastUpdateType?: string;
}

export interface Worker {
  id: string;
  uniqueId?: string;
  projectId?: string;
  name: string;
  category: WorkerCategory;
  dailyRate: number;
  skillCategory?: "skilled" | "semi_skilled" | "unskilled";
  paymentType?: "daily" | "piece_rate" | "contract";
  pieceRateAmount?: number;
  subContractorName?: string;
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
  method?: "Cash" | "UPI" | "Bank Transfer" | "Cheque" | "Other";
  paidByName?: string;
  receivedByName?: string;
  transactionId?: string;
  referenceNumber?: string;
  status?: "Pending" | "Completed" | "Failed";
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

  async isLanguageOnboardingCompleted(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(
        STORAGE_KEYS.LANGUAGE_ONBOARDING_COMPLETED,
      );
      return val === "true";
    } catch {
      return false;
    }
  },

  async setLanguageOnboardingCompleted(completed = true): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.LANGUAGE_ONBOARDING_COMPLETED,
        completed ? "true" : "false",
      );
    } catch (error) {
      console.error("Error saving language onboarding status:", error);
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

    if (auth?.role !== "guest") {
      if ((plan === "free" || plan === "basic") && projects.length >= 2) {
        throw new Error("LIMIT_EXCEEDED_PROJECTS");
      }
      if (
        (plan === "professional" || plan === "super") &&
        projects.length >= 10
      ) {
        throw new Error("LIMIT_EXCEEDED_PROJECTS");
      }
    }

    if (auth?.token) {
      try {
        const res = await authenticatedFetch(`${API_URL}/projects`, {
          method: "POST",
          body: JSON.stringify({
            name: project.name,
            location: project.location,
            clientName: project.clientName,
            budget: project.budget,
            startDate: project.startDate,
            endDate: project.endDate,
            retentionPercentage: project.retentionPercentage,
            mobilizationAdvance: project.mobilizationAdvance,
            labourLicenseNumber: project.labourLicenseNumber,
            pfEsicStatus: project.pfEsicStatus,
            wcPolicyNumber: project.wcPolicyNumber,
            progressUnit: project.progressUnit,
            plannedQty: project.plannedQty,
            phases: project.phases,
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
            clientName: updatedProject.clientName,
            budget: updatedProject.budget,
            startDate: updatedProject.startDate,
            endDate: updatedProject.endDate,
            retentionPercentage: updatedProject.retentionPercentage,
            mobilizationAdvance: updatedProject.mobilizationAdvance,
            labourLicenseNumber: updatedProject.labourLicenseNumber,
            pfEsicStatus: updatedProject.pfEsicStatus,
            wcPolicyNumber: updatedProject.wcPolicyNumber,
            progressUnit: updatedProject.progressUnit,
            plannedQty: updatedProject.plannedQty,
            completedQty: updatedProject.completedQty,
            phases: updatedProject.phases,
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

  // Site methods
  async getSiteStats() {
    return this.getSiteDashboardStats();
  },

  async getSiteDashboardStats(): Promise<{
    totalSites: number;
    activeSites: number;
    workersPresent: number;
    workersAbsent: number;
    totalWorkers: number;
    sitesInProgress: number;
    delayedSites: number;
    completedSites: number;
  }> {
    try {
      const auth = await this.getAuth();
      if (auth?.token) {
        const res = await authenticatedFetch(
          `${API_URL}/sites/dashboard/stats`,
        );
        if (res.ok) {
          return await res.json();
        }
      }
    } catch (e) {
      console.warn("Failed to fetch site dashboard stats", e);
    }
    return {
      totalSites: 0,
      activeSites: 0,
      workersPresent: 0,
      workersAbsent: 0,
      totalWorkers: 0,
      sitesInProgress: 0,
      delayedSites: 0,
      completedSites: 0,
    };
  },

  async getSites(params?: {
    search?: string;
    status?: string;
    sortBy?: string;
    page?: number;
    limit?: number;
  }): Promise<{ sites: Site[]; pagination?: any }> {
    const key = `sites_${JSON.stringify(params || {})}`;
    return dedupeRequest(key, async () => {
      try {
        const auth = await this.getAuth();
        if (auth?.token) {
          try {
            let url = `${API_URL}/sites?`;
            if (params) {
              const queryParams = [];
              if (params.search)
                queryParams.push(`search=${encodeURIComponent(params.search)}`);
              if (params.status)
                queryParams.push(`status=${encodeURIComponent(params.status)}`);
              if (params.sortBy)
                queryParams.push(`sortBy=${encodeURIComponent(params.sortBy)}`);
              if (params.page) queryParams.push(`page=${params.page}`);
              if (params.limit) queryParams.push(`limit=${params.limit}`);
              url += queryParams.join("&");
            }

            const res = await authenticatedFetch(url);
            if (res.ok) {
              const data = await res.json();
              const serverSites = (data.sites || []).map(mapSite);
              await AsyncStorage.setItem(
                STORAGE_KEYS.SITES,
                JSON.stringify(serverSites),
              );
              return { sites: serverSites, pagination: data.pagination };
            }
          } catch (e) {
            console.log("Failed to fetch sites from backend, using cache", e);
          }
        }
        const data = await AsyncStorage.getItem(STORAGE_KEYS.SITES);
        return { sites: data ? JSON.parse(data) : [] };
      } catch {
        return { sites: [] };
      }
    });
  },

  async getSiteById(siteId: string): Promise<Site | null> {
    try {
      const auth = await this.getAuth();
      if (auth?.token) {
        const res = await authenticatedFetch(`${API_URL}/sites/${siteId}`);
        if (res.ok) {
          return mapSite(await res.json());
        }
      }
    } catch (e) {
      console.warn("Failed to get site details from backend", e);
    }
    return null;
  },

  async getSiteUpdates(siteId: string): Promise<any[]> {
    try {
      const res = await authenticatedFetch(
        `${API_URL}/sites/${siteId}/updates`,
      );
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("Failed to get site updates from backend", e);
    }
    return [];
  },

  async createSiteUpdate(siteId: string, updateData: any): Promise<any | null> {
    const auth = await this.getAuth();
    if (auth?.token && siteId.length >= 24) {
      const res = await authenticatedFetch(
        `${API_URL}/sites/${siteId}/updates`,
        {
          method: "POST",
          body: JSON.stringify(updateData),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.error || `Failed to create site update (${res.status})`,
        );
      }
      const saved = await res.json();
      DeviceEventEmitter.emit("refreshData");
      return saved;
    }

    const localUpdate = {
      _id: `upd_${Date.now()}`,
      siteId,
      ...updateData,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    return localUpdate;
  },

  async createSite(siteData: any): Promise<Site | null> {
    const auth = await this.getAuth();
    if (auth?.token) {
      const res = await authenticatedFetch(`${API_URL}/sites`, {
        method: "POST",
        body: JSON.stringify(siteData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to create site (${res.status})`);
      }
      const saved = await res.json();
      const serverSite = mapSite(saved);
      const { sites } = await this.getSites();
      await AsyncStorage.setItem(
        STORAGE_KEYS.SITES,
        JSON.stringify([
          serverSite,
          ...sites.filter((s) => s.id !== serverSite.id),
        ]),
      );
      DeviceEventEmitter.emit("refreshData");
      return serverSite;
    }
    return null;
  },

  async updateSite(siteId: string, siteData: any): Promise<Site | null> {
    const auth = await this.getAuth();
    if (auth?.token && siteId.length >= 24) {
      const res = await authenticatedFetch(`${API_URL}/sites/${siteId}`, {
        method: "PUT",
        body: JSON.stringify(siteData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to update site (${res.status})`);
      }
      const saved = await res.json();
      const serverSite = mapSite(saved);
      const { sites } = await this.getSites();
      const idx = sites.findIndex((s) => s.id === siteId);
      if (idx !== -1) {
        sites[idx] = serverSite;
        await AsyncStorage.setItem(STORAGE_KEYS.SITES, JSON.stringify(sites));
      }
      DeviceEventEmitter.emit("refreshData");
      return serverSite;
    }
    return null;
  },

  async archiveSite(siteId: string): Promise<Site | null> {
    try {
      const auth = await this.getAuth();
      if (auth?.token) {
        const res = await authenticatedFetch(
          `${API_URL}/sites/${siteId}/archive`,
          {
            method: "PUT",
          },
        );
        if (res.ok) {
          const site = mapSite(await res.json());
          DeviceEventEmitter.emit("refreshData");
          return site;
        }
      }
    } catch (e) {
      console.warn("Failed to archive site", e);
    }
    return null;
  },

  async deleteSite(siteId: string): Promise<boolean> {
    try {
      const auth = await this.getAuth();
      if (auth?.token) {
        const res = await authenticatedFetch(`${API_URL}/sites/${siteId}`, {
          method: "DELETE",
        });
        const isOk = res.ok;
        if (isOk) {
          DeviceEventEmitter.emit("refreshData");
        }
        return isOk;
      }
    } catch (e) {
      console.warn("Failed to delete site", e);
    }
    return false;
  },

  // Worker methods
  async getWorkers(forceRefresh = false): Promise<Worker[]> {
    if (!forceRefresh) {
      const cached = getMemoryCache<Worker[]>("workers");
      if (cached) return cached;
    }
    return dedupeRequest("workers", async () => {
      try {
        const auth = await this.getAuth();
        if (auth?.token) {
          try {
            const res = await authenticatedFetch(`${API_URL}/workers`);
            if (res.ok) {
              const data = await res.json();
              const serverWorkers = data.map(mapWorker);
              setMemoryCache("workers", serverWorkers);
              AsyncStorage.setItem(
                STORAGE_KEYS.WORKERS,
                JSON.stringify(serverWorkers),
              ).catch(() => {});
              return serverWorkers;
            }
          } catch (e) {
            console.log("Failed to fetch workers from backend, using cache", e);
          }
        }
        const data = await AsyncStorage.getItem(STORAGE_KEYS.WORKERS);
        const parsed = data ? JSON.parse(data) : [];
        setMemoryCache("workers", parsed);
        return parsed;
      } catch {
        return [];
      }
    });
  },

  async setWorkers(workers: Worker[]): Promise<void> {
    try {
      setMemoryCache("workers", workers);
      await AsyncStorage.setItem(STORAGE_KEYS.WORKERS, JSON.stringify(workers));
      DeviceEventEmitter.emit("refreshData");
    } catch (error) {
      console.error("Error saving workers:", error);
    }
  },

  async addWorker(worker: Worker): Promise<Worker> {
    const auth = await this.getAuth();
    if (auth?.token) {
      const res = await authenticatedFetch(`${API_URL}/workers`, {
        method: "POST",
        body: JSON.stringify({
          name: worker.name,
          projectId: worker.projectId,
          category: worker.category,
          dailyRate: worker.dailyRate,
          skillCategory: worker.skillCategory,
          paymentType: worker.paymentType,
          pieceRateAmount: worker.pieceRateAmount,
          subContractorName: worker.subContractorName,
          phone: worker.phone,
          address: worker.address,
          notes: worker.notes,
          photoUri: worker.photoUri,
        }),
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("LIMIT_EXCEEDED_WORKERS");
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to add worker (${res.status})`);
      }

      const saved = await res.json();
      const serverWorker = mapWorker(saved);
      const workers = await this.getWorkers();
      const updatedWorkers = [
        serverWorker,
        ...workers.filter((w) => w.id !== serverWorker.id),
      ];
      setMemoryCache("workers", updatedWorkers);
      await AsyncStorage.setItem(
        STORAGE_KEYS.WORKERS,
        JSON.stringify(updatedWorkers),
      ).catch(() => {});
      DeviceEventEmitter.emit("refreshData");
      return serverWorker;
    }
    throw new Error("You must be logged in to add a worker");
  },

  async updateWorker(updatedWorker: Worker): Promise<Worker> {
    const auth = await this.getAuth();
    if (auth?.token && updatedWorker.id && updatedWorker.id.length >= 24) {
      const res = await authenticatedFetch(
        `${API_URL}/workers/${updatedWorker.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: updatedWorker.name,
            projectId: updatedWorker.projectId,
            category: updatedWorker.category,
            dailyRate: updatedWorker.dailyRate,
            skillCategory: updatedWorker.skillCategory,
            paymentType: updatedWorker.paymentType,
            pieceRateAmount: updatedWorker.pieceRateAmount,
            subContractorName: updatedWorker.subContractorName,
            phone: updatedWorker.phone,
            address: updatedWorker.address,
            notes: updatedWorker.notes,
            photoUri: updatedWorker.photoUri,
          }),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to update worker (${res.status})`);
      }

      const saved = await res.json();
      const serverWorker = mapWorker(saved);
      const workers = await this.getWorkers();
      const index = workers.findIndex((w) => w.id === updatedWorker.id);
      if (index !== -1) {
        workers[index] = serverWorker;
        setMemoryCache("workers", workers);
        await AsyncStorage.setItem(
          STORAGE_KEYS.WORKERS,
          JSON.stringify(workers),
        );
      }
      invalidateMemoryCache();
      DeviceEventEmitter.emit("refreshData");
      return serverWorker;
    }
    throw new Error("Invalid worker ID or session");
  },

  async deleteWorker(workerId: string): Promise<void> {
    const auth = await this.getAuth();
    if (auth?.token && workerId && workerId.length >= 24) {
      const res = await authenticatedFetch(`${API_URL}/workers/${workerId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 404) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to delete worker (${res.status})`);
      }
    }

    const workers = await this.getWorkers();
    const filtered = workers.filter((w) => w.id !== workerId);
    await this.setWorkers(filtered);
    const attendance = await this.getAttendance();
    const filteredAttendance = attendance.filter(
      (a) => a.workerId !== workerId,
    );
    await this.setAttendance(filteredAttendance);
    invalidateMemoryCache();
    DeviceEventEmitter.emit("refreshData");
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
      DeviceEventEmitter.emit("refreshData");
    } catch (error) {
      console.error("Error saving attendance:", error);
    }
  },

  async setAttendanceRecord(record: AttendanceRecord): Promise<void> {
    const isOT = record.value === "OT";
    const isAbsent = record.value === "A";
    const sanitizedRecord: AttendanceRecord = {
      ...record,
      overtimeHours: isOT ? record.overtimeHours : undefined,
      overtimeWage: isOT ? record.overtimeWage : undefined,
      customWage: isAbsent ? undefined : record.customWage,
    };

    const auth = await this.getAuth();
    if (auth?.token) {
      const res = await authenticatedFetch(`${API_URL}/attendance/record`, {
        method: "POST",
        body: JSON.stringify({
          workerId: sanitizedRecord.workerId,
          year: sanitizedRecord.year,
          month: sanitizedRecord.month,
          day: sanitizedRecord.day,
          value: sanitizedRecord.value,
          dailyRate: sanitizedRecord.dailyRate,
          customWage: sanitizedRecord.customWage,
          finalPay: sanitizedRecord.finalPay,
          overtimeHours: sanitizedRecord.overtimeHours,
          overtimeWage: sanitizedRecord.overtimeWage,
          location: sanitizedRecord.location,
          projectId: sanitizedRecord.projectId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.error || `Failed to record attendance (${res.status})`,
        );
      }
    }

    // Update local cache so UI is immediately refreshed
    const monthKey = `attendance_${sanitizedRecord.year}_${sanitizedRecord.month}`;
    const cachedMonthRecords = getMemoryCache<AttendanceRecord[]>(monthKey);
    if (cachedMonthRecords) {
      const idx = cachedMonthRecords.findIndex(
        (r) =>
          r.workerId === sanitizedRecord.workerId &&
          r.year === sanitizedRecord.year &&
          r.month === sanitizedRecord.month &&
          r.day === sanitizedRecord.day,
      );
      if (idx !== -1) {
        cachedMonthRecords[idx] = sanitizedRecord;
      } else {
        cachedMonthRecords.push(sanitizedRecord);
      }
      setMemoryCache(monthKey, cachedMonthRecords);
    }

    const records = await this.getAttendance();
    const existingIndex = records.findIndex(
      (r) =>
        r.workerId === sanitizedRecord.workerId &&
        r.year === sanitizedRecord.year &&
        r.month === sanitizedRecord.month &&
        r.day === sanitizedRecord.day,
    );
    if (existingIndex !== -1) {
      records[existingIndex] = sanitizedRecord;
    } else {
      records.push(sanitizedRecord);
    }
    await AsyncStorage.setItem(
      STORAGE_KEYS.ATTENDANCE,
      JSON.stringify(records),
    );

    invalidateMemoryCache();
    DeviceEventEmitter.emit("refreshData");
    DeviceEventEmitter.emit("attendanceUpdated");
  },

  async clearAttendanceRecord(params: {
    workerId: string;
    year: number;
    month: number;
    day: number;
    id?: string;
  }): Promise<void> {
    const { workerId, year, month, day, id } = params;
    const auth = await this.getAuth();
    if (auth?.token) {
      try {
        await authenticatedFetch(`${API_URL}/attendance/clear`, {
          method: "POST",
          body: JSON.stringify({ workerId, year, month, day, id }),
        });
      } catch (e) {
        console.warn(
          "Failed to clear attendance on backend, removing locally:",
          e,
        );
      }
    }

    const monthVariations = [
      month,
      month + 1,
      ...(month > 0 ? [month - 1] : []),
    ];

    // 1. Remove from all possible month memory caches
    for (const m of monthVariations) {
      const monthKey = `attendance_${year}_${m}`;
      const cachedMonthRecords = getMemoryCache<AttendanceRecord[]>(monthKey);
      if (cachedMonthRecords) {
        const filteredMonth = cachedMonthRecords.filter(
          (r) =>
            !(
              r.workerId === workerId &&
              r.year === year &&
              monthVariations.includes(r.month) &&
              r.day === day
            ),
        );
        setMemoryCache(monthKey, filteredMonth);
      }

      // Purge labour dashboard cache
      try {
        const dashboardKey = `${STORAGE_KEYS.LABOUR_DASHBOARD}_${year}_${m}`;
        await AsyncStorage.removeItem(dashboardKey);
      } catch {}
    }

    // 2. Remove from global attendance in AsyncStorage
    const allRecords = await this.getAttendance();
    const filteredAll = allRecords.filter(
      (r) =>
        !(
          r.workerId === workerId &&
          r.year === year &&
          monthVariations.includes(r.month) &&
          r.day === day
        ),
    );
    await AsyncStorage.setItem(
      STORAGE_KEYS.ATTENDANCE,
      JSON.stringify(filteredAll),
    );

    invalidateMemoryCache();
    DeviceEventEmitter.emit("refreshData");
    DeviceEventEmitter.emit("attendanceUpdated");
  },

  async getAttendanceForMonth(
    year: number,
    month: number,
    forceRefresh = false,
  ): Promise<AttendanceRecord[]> {
    const key = `attendance_${year}_${month}`;
    if (!forceRefresh) {
      const cached = getMemoryCache<AttendanceRecord[]>(key);
      if (cached) return cached;
    }
    return dedupeRequest(key, async () => {
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
              setMemoryCache(key, serverAttendance);
              (async () => {
                const localRecords = await this.getAttendance();
                const filteredLocal = localRecords.filter(
                  (r) =>
                    !(
                      r.year === year &&
                      (r.month === month ||
                        r.month === month + 1 ||
                        (month > 0 && r.month === month - 1))
                    ),
                );
                const merged = [...filteredLocal, ...serverAttendance];
                await AsyncStorage.setItem(
                  STORAGE_KEYS.ATTENDANCE,
                  JSON.stringify(merged),
                );
              })().catch(() => {});
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
      const filtered = records.filter(
        (r) =>
          r.year === year &&
          (r.month === month ||
            r.month === month + 1 ||
            (month > 0 && r.month === month - 1)),
      );
      setMemoryCache(key, filtered);
      return filtered;
    });
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

  async addPayment(payment: PaymentRecord): Promise<PaymentRecord> {
    const auth = await this.getAuth();
    if (auth?.token) {
      payment.method = payment.method || "Cash";
      const profile = await this.getProfile();
      payment.paidByName = profile?.name || "Admin";

      const res = await authenticatedFetch(`${API_URL}/payments`, {
        method: "POST",
        body: JSON.stringify({
          workerId: payment.workerId,
          year: payment.year,
          month: payment.month,
          amount: payment.amount,
          note: payment.note,
          method: payment.method,
          transactionId: payment.transactionId,
          referenceNumber: payment.referenceNumber,
          paidByName: payment.paidByName,
          receivedByName: payment.receivedByName,
          status: payment.status || "Completed",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.error || `Failed to record payment (${res.status})`,
        );
      }

      const saved = await res.json();
      if (saved._id || saved.id) {
        payment.id = saved._id || saved.id;
      }
    }

    const payments = await this.getPayments();
    payments.push(payment);
    await AsyncStorage.setItem(
      STORAGE_KEYS_EXT.PAYMENTS,
      JSON.stringify(payments),
    );

    DeviceEventEmitter.emit("refreshData");
    return payment;
  },

  async deletePayment(paymentId: string): Promise<void> {
    const auth = await this.getAuth();
    if (auth?.token && paymentId && paymentId.length >= 24) {
      const res = await authenticatedFetch(`${API_URL}/payments/${paymentId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 404) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.error || `Failed to delete payment (${res.status})`,
        );
      }
    }

    const payments = await this.getPayments();
    const filtered = payments.filter((p) => p.id !== paymentId);
    await AsyncStorage.setItem(
      STORAGE_KEYS_EXT.PAYMENTS,
      JSON.stringify(filtered),
    );
    DeviceEventEmitter.emit("refreshData");
  },

  // Labour Dashboard Cache
  async getLabourDashboardCache(
    year: number,
    month: number,
  ): Promise<any | null> {
    try {
      const key = `${STORAGE_KEYS.LABOUR_DASHBOARD}_${year}_${month}`;
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async setLabourDashboardCache(
    year: number,
    month: number,
    data: any,
  ): Promise<void> {
    try {
      const key = `${STORAGE_KEYS.LABOUR_DASHBOARD}_${year}_${month}`;
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      console.warn("Failed to cache labour dashboard:", err);
    }
  },

  async getPaymentsForMonth(
    year: number,
    month: number,
  ): Promise<PaymentRecord[]> {
    return dedupeRequest(`payments_${year}_${month}`, async () => {
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
              (async () => {
                const localPayments = await this.getPayments();
                const filteredLocal = localPayments.filter(
                  (p) =>
                    !(
                      p.year === year &&
                      (p.month === month ||
                        p.month === month + 1 ||
                        (month > 0 && p.month === month - 1))
                    ),
                );
                const merged = [...filteredLocal, ...serverPayments];
                await AsyncStorage.setItem(
                  STORAGE_KEYS_EXT.PAYMENTS,
                  JSON.stringify(merged),
                );
              })().catch(() => {});
              return serverPayments;
            }
          } catch (e) {
            console.log(
              "Failed to fetch payments from backend, using cache",
              e,
            );
          }
        }
      } catch (e) {
        console.error(e);
      }
      const payments = await this.getPayments();
      return payments.filter(
        (p) =>
          p.year === year &&
          (p.month === month ||
            p.month === month + 1 ||
            (month > 0 && p.month === month - 1)),
      );
    });
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
      return data
        ? { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(data) }
        : DEFAULT_VOICE_SETTINGS;
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
    try {
      const auth = await this.getAuth();
      if (!auth?.token) return;
      if (auth.role === "labor" || auth.role === "worker") {
        return;
      }
      DeviceEventEmitter.emit("sync:processQueue");
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
  workerAltId?: string,
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
  const targetId = String(workerId || "");
  const targetAlt = workerAltId ? String(workerAltId) : "";
  const workerAttendance = attendance.filter((a) => {
    const aId = String(a.workerId || "");
    return (
      aId === targetId ||
      (targetAlt && aId === targetAlt) ||
      (targetId && targetId === aId)
    );
  });

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
    // 1. Calculate pay for this day (Gross Earnings = Base Rate + Overtime)
    const rate =
      record.dailyRate !== undefined && record.dailyRate !== null
        ? record.dailyRate
        : dailyRate;
    const overtime =
      record.overtimeWage !== undefined && record.overtimeWage !== null
        ? record.overtimeWage
        : 0;
    let recordPay = 0;

    if (record.value === "P" || record.value === "OT") {
      recordPay = rate + overtime;
    } else if (record.value === "H") {
      recordPay = rate / 2 + overtime;
    } else if (record.value === "A") {
      recordPay = 0;
    } else if (typeof record.value === "number") {
      recordPay = record.value + overtime;
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

    // 3. Track Advance Deductions and Overtime Totals
    if (
      record.customWage !== undefined &&
      record.customWage !== null &&
      record.customWage > 0
    ) {
      totalAdvanceAmount += record.customWage;
    }

    if (
      record.overtimeWage !== undefined &&
      record.overtimeWage !== null &&
      record.overtimeWage > 0
    ) {
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

// Site Control Center & Daily Site Activity Types & Storage Extension
export interface SiteActivityProof {
  id: string;
  type: "MORNING_WORK" | "EVENING_WORK" | "ISSUE" | "INSTRUCTION";
  title?: string;
  description?: string;
  photo?: {
    url: string;
    thumbnailUrl?: string;
    capturedAt: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
    isVerifiedSiteLocation?: boolean;
    distanceFromSiteMeters?: number;
  };
  worker?: {
    id: string;
    uniqueId?: string;
    name: string;
    category?: string;
    profileImage?: string;
  };
  user?: {
    id: string;
    name: string;
    role: string;
  };
  site?: {
    id: string;
    name: string;
    address?: string;
  };
  status?: string;
  dateStr: string;
  timeStr: string;
  createdAt: string;
}

export interface WorkerTodayContext {
  success: boolean;
  worker: {
    id: string;
    uniqueId: string;
    name: string;
    category: string;
    dailyWage: number;
    profileImage?: string;
  };
  hasActiveSession: boolean;
  activeSession: any;
  defaultSite: {
    id: string;
    name: string;
    address?: string;
    location?: any;
  } | null;
  detectedNearbySite: {
    id: string;
    name: string;
    address?: string;
    location?: any;
  } | null;
  activeWorkingSite: {
    id: string;
    name: string;
    address?: string;
    location?: any;
  } | null;
  attendance: {
    status: string;
    overtimeHours: number;
  };
  workUpdates: {
    morning: {
      submitted: boolean;
      time?: string;
      photo?: any;
      description?: string;
    };
    evening: {
      submitted: boolean;
      time?: string;
      photo?: any;
      description?: string;
    };
  };
  latestInstruction: {
    id: string;
    description: string;
    voiceNoteUrl?: string;
    priority?: string;
    timeStr?: string;
    givenBy?: string;
  } | null;
}

// Extended storage methods for Site Activity & Workforce
export const siteActivityStorage = {
  async getContractorSitesControl(date?: string) {
    const cacheKey = `@haajari_cache_contractor_sites_control_${date || "today"}`;
    try {
      const url = date
        ? `${API_URL}/sites/control/summary?date=${date}`
        : `${API_URL}/sites/control/summary`;
      const res = await authenticatedFetch(url);
      if (res.ok) {
        const data = await res.json();
        AsyncStorage.setItem(cacheKey, JSON.stringify(data)).catch(() => {});
        return data;
      }
    } catch (e) {
      console.warn("getContractorSitesControl offline fallback:", e);
    }
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (_) {}
    }
    return {
      success: true,
      metrics: {
        totalSites: 0,
        activeSites: 0,
        totalWorkers: 0,
        workersPresent: 0,
        totalUpdates: 0,
        totalOpenIssues: 0,
      },
      sites: [],
    };
  },

  async getSiteControlCenter(siteId: string, date?: string) {
    const cacheKey = `@haajari_cache_site_control_${siteId}_${date || "today"}`;
    try {
      const url = date
        ? `${API_URL}/sites/${siteId}/control?date=${date}`
        : `${API_URL}/sites/${siteId}/control`;
      const res = await authenticatedFetch(url);
      if (res.ok) {
        const data = await res.json();
        AsyncStorage.setItem(cacheKey, JSON.stringify(data)).catch(() => {});
        return data;
      }
    } catch (e) {
      console.warn("getSiteControlCenter offline fallback:", e);
    }
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (_) {}
    }
    return null;
  },

  async getSitePhotos(
    siteId: string,
    params?: { date?: string; activityType?: string; workerId?: string },
  ) {
    const cacheKey = `@haajari_cache_site_photos_${siteId}_${params?.date || "today"}`;
    try {
      const query = new URLSearchParams();
      if (params?.date) query.append("date", params.date);
      if (params?.activityType) query.append("activityType", params.activityType);
      if (params?.workerId) query.append("workerId", params.workerId);

      const qs = query.toString();
      const url = qs
        ? `${API_URL}/sites/${siteId}/photos?${qs}`
        : `${API_URL}/sites/${siteId}/photos`;
      const res = await authenticatedFetch(url);
      if (res.ok) {
        const data = await res.json();
        AsyncStorage.setItem(cacheKey, JSON.stringify(data)).catch(() => {});
        return data;
      }
    } catch (e) {
      console.warn("getSitePhotos offline fallback:", e);
    }
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (_) {}
    }
    return {
      success: true,
      total: 0,
      morningCount: 0,
      eveningCount: 0,
      issueCount: 0,
      photos: [],
    };
  },

  async submitWorkUpdate(
    siteId: string,
    payload: {
      activityType: "MORNING_WORK" | "EVENING_WORK";
      photo: string;
      description?: string;
      location?: {
        latitude?: number;
        longitude?: number;
        accuracy?: number;
        address?: string;
      };
      clientRequestId?: string;
    },
  ) {
    const res = await authenticatedFetch(
      `${API_URL}/sites/${siteId}/work-updates`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.error || `Failed to submit work update: ${res.status}`,
      );
    }
    DeviceEventEmitter.emit("refreshData");
    return await res.json();
  },

  async startDailyWorkSession(
    siteId: string,
    location?: {
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      address?: string;
    },
  ) {
    const res = await authenticatedFetch(`${API_URL}/sites/session/start`, {
      method: "POST",
      body: JSON.stringify({ siteId, ...location }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.error || `Failed to start work session: ${res.status}`,
      );
    }
    DeviceEventEmitter.emit("refreshData");
    return await res.json();
  },

  async getWorkerTodayContext(coords?: {
    latitude?: number;
    longitude?: number;
  }): Promise<WorkerTodayContext> {
    let url = `${API_URL}/sites/workers/me/today-context`;
    if (coords?.latitude && coords?.longitude) {
      url += `?lat=${coords.latitude}&lon=${coords.longitude}`;
    }
    const res = await authenticatedFetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch worker today context: ${res.status}`);
    }
    return await res.json();
  },

  async getWorkerSiteLogs(filter = "all", limit = 50) {
    const url = `${API_URL}/sites/workers/me/site-logs?filter=${filter}&limit=${limit}`;
    const res = await authenticatedFetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch worker site logs: ${res.status}`);
    }
    return await res.json();
  },

  async reportSiteIssue(
    siteId: string,
    payload: {
      description: string;
      photo?: string;
      severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      location?: {
        latitude?: number;
        longitude?: number;
        accuracy?: number;
        address?: string;
      };
    },
  ) {
    const res = await authenticatedFetch(`${API_URL}/sites/${siteId}/issues`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to report issue: ${res.status}`);
    }
    DeviceEventEmitter.emit("refreshData");
    return await res.json();
  },

  async resolveSiteIssue(issueId: string, resolutionNotes?: string) {
    const res = await authenticatedFetch(
      `${API_URL}/sites/issues/${issueId}/resolve`,
      {
        method: "PATCH",
        body: JSON.stringify({ resolutionNotes }),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to resolve issue: ${res.status}`);
    }
    DeviceEventEmitter.emit("refreshData");
    return await res.json();
  },

  async addSiteInstruction(
    siteId: string,
    payload: {
      description: string;
      voiceNoteUrl?: string;
      priority?: "NORMAL" | "HIGH" | "URGENT";
    },
  ) {
    const res = await authenticatedFetch(
      `${API_URL}/sites/${siteId}/instructions`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to add instruction: ${res.status}`);
    }
    DeviceEventEmitter.emit("refreshData");
    return await res.json();
  },

  async getWorkerSummaryStats() {
    const res = await authenticatedFetch(`${API_URL}/sites/workers/me/summary`);
    if (!res.ok) {
      throw new Error(`Failed to fetch worker summary stats: ${res.status}`);
    }
    return await res.json();
  },
};
