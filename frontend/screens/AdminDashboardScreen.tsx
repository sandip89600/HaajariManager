import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  FlatList,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, FontAwesome } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useSocket } from "@/hooks/useSocket";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BorderRadius } from "@/constants/theme";
import { API_URL } from "@/utils/storage";

// Import custom charts
import {
  UserGrowthChart,
  RevenueTrendChart,
  SubscriptionPieChart,
  WorkforceBarChart,
  AttendanceBarChart,
  PayrollTrendChart,
} from "@/components/AdminCharts";

// Dark Theme Colors specifically for Admin Portal
const ADMIN_COLORS = {
  background: "#080711", // Obsidian Dark Navy
  card: "#12121A", // Soft dark card background
  border: "#212030", // Elegant dark border
  primary: "#FF5E25", // Glowing Orange Accent
  success: "#10B981", // Mint Green
  text: "#FFFFFF",
  textSecondary: "#9E9EA8", // Curated secondary text
  danger: "#EF4444", // Modern Red
  cardHeader: "#1B1A24",
};

interface SystemMetrics {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalContractors: number;
  totalBuilders: number;
  totalSupervisors: number;
  totalWorkers: number;
  totalAttendance: number;
  totalRevenue: number;
  totalPayroll: number;
  outstandingAmount: number;
}

interface PlanCounts {
  free: number;
  professional: number;
  business: number;
}

interface WorkerAnalytics {
  workersByCategory: Record<string, number>;
  workersByCompany: Record<string, number>;
  newWorkersThisMonth: number;
  todayAttendance: number;
  monthlyAttendance: number;
  topActiveCompanies: Array<{ companyName: string; attendanceCount: number }>;
  userGrowth: any[];
  revenueGrowth: any[];
  attendanceBreakdown: { present: number; absent: number; halfDay: number };
  payrollTrend: any[];
}

interface ActivityItem {
  id: string;
  message: string;
  timestamp: string;
}

interface AdminUserItem {
  _id: string;
  name: string;
  phone: string;
  role: string;
  isActive: boolean;
  tenantId: {
    _id: string;
    name: string;
    code: string;
    plan: "free" | "professional" | "business";
    planExpiresAt?: string;
  };
}

export default function AdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUsername, setAdminUsername] = useState<string>("haajari896");

  // Dashboard Data
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [planCounts, setPlanCounts] = useState<PlanCounts | null>(null);
  const [analytics, setAnalytics] = useState<WorkerAnalytics | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Search Queries
  const [searchQuery, setSearchQuery] = useState("");

  // Socket context hook
  const {
    socket,
    isConnected: socketConnected,
    connectSocket,
    disconnectSocket,
  } = useSocket();

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "users"
    | "workers"
    | "attendance"
    | "payments"
    | "profile"
    | "support"
    | "security"
  >("dashboard");

  // Support Dashboard States
  const [supportProblems, setSupportProblems] = useState<any[]>([]);
  const [supportFeedback, setSupportFeedback] = useState<any[]>([]);
  const [isLoadingSupport, setIsLoadingSupport] = useState(false);
  const [supportFilterRating, setSupportFilterRating] = useState<number | null>(
    null,
  );
  const [supportFilterDate, setSupportFilterDate] = useState<string>("");

  // Security Module States
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [isLoadingSecurity, setIsLoadingSecurity] = useState(false);

  // Custom styled confirmation modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    type: "user" | "worker" | "attendance" | "payment";
  } | null>(null);

  // Edit Modals states
  const [editUserModalVisible, setEditUserModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserPhone, setEditUserPhone] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserRole, setEditUserRole] = useState("");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [editUserIsActive, setEditUserIsActive] = useState(true);

  const [editWorkerModalVisible, setEditWorkerModalVisible] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<any>(null);
  const [editWorkerName, setEditWorkerName] = useState("");
  const [editWorkerPhone, setEditWorkerPhone] = useState("");
  const [editWorkerRate, setEditWorkerRate] = useState("");
  const [editWorkerCategory, setEditWorkerCategory] = useState("");
  const [editWorkerAddress, setEditWorkerAddress] = useState("");
  const [editWorkerNotes, setEditWorkerNotes] = useState("");

  const [editAttendanceModalVisible, setEditAttendanceModalVisible] =
    useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState<any>(null);
  const [editAttendanceValue, setEditAttendanceValue] = useState("");

  const [editPaymentModalVisible, setEditPaymentModalVisible] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState("");
  const [editPaymentNote, setEditPaymentNote] = useState("");

  // Admin Change Password Form State
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Admin Profile States
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [editProfilePictureModalVisible, setEditProfilePictureModalVisible] =
    useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");

  // Verify Admin Session
  useFocusEffect(
    React.useCallback(() => {
      const verifySessionAndLoad = async () => {
        setIsLoadingData(true);
        try {
          const sessionData = await AsyncStorage.getItem(
            "@haajari/admin_session",
          );
          if (!sessionData) {
            navigation.navigate("AdminLogin" as any);
            return;
          }
          const session = JSON.parse(sessionData);
          if (session.token === "mock-offline-token") {
            console.log(
              "[Admin Dashboard] Detected stale mock token. Clearing and redirecting.",
            );
            await AsyncStorage.removeItem("@haajari/admin_session");
            navigation.navigate("AdminLogin" as any);
            return;
          }
          setAdminToken(session.token);
          setAdminUsername(session.username || "haajari896");
          await loadDashboardData(session.token);
        } catch (e) {
          console.error("Error loading session in dashboard", e);
          navigation.navigate("AdminLogin" as any);
        }
      };
      verifySessionAndLoad();
    }, [navigation, activeTab]),
  );

  // Socket.IO hook
  useEffect(() => {
    if (!adminToken) return;

    connectSocket();

    const onDashboardUpdate = () => {
      console.log("[Socket] Dashboard update event received");
      loadDashboardData(adminToken);
      // Also refresh tab-specific data on socket updates
      if (activeTab === "workers") loadWorkers();
      else if (activeTab === "attendance") loadAttendance();
      else if (activeTab === "payments") loadPayments();
      else if (activeTab === "profile") loadAdminProfile();
    };

    socket.on("admin_dashboard_update", onDashboardUpdate);

    return () => {
      socket.off("admin_dashboard_update", onDashboardUpdate);
    };
  }, [adminToken, socket, activeTab]);

  // Auto-load tab-specific data whenever the active tab changes
  useEffect(() => {
    if (!adminToken) return;
    if (activeTab === "workers") loadWorkers();
    else if (activeTab === "attendance") loadAttendance();
    else if (activeTab === "payments") loadPayments();
    else if (activeTab === "support") loadSupportData();
    else if (activeTab === "security") loadSecurityData();
    else if (activeTab === "profile") loadAdminProfile();
  }, [activeTab, adminToken, supportFilterRating, supportFilterDate]);

  // Fetch helper
  const adminFetch = async (url: string, options: RequestInit = {}) => {
    const headers: any = {
      "Content-Type": "application/json",
    };
    if (adminToken) {
      headers["Authorization"] = `Bearer ${adminToken}`;
    }
    return fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });
  };

  const loadDashboardData = async (token: string) => {
    try {
      console.log(
        "[Admin Frontend] loadDashboardData called with token:",
        token ? token.substring(0, 15) + "..." : "none",
      );
      const headers = { Authorization: `Bearer ${token}` };
      const [usersRes, analyticsRes] = await Promise.all([
        fetch(`${API_URL}/admin/users`, { headers }),
        fetch(`${API_URL}/admin/analytics`, { headers }),
      ]);

      console.log(
        "[Admin Frontend] usersRes.status:",
        usersRes.status,
        "ok:",
        usersRes.ok,
      );
      console.log(
        "[Admin Frontend] analyticsRes.status:",
        analyticsRes.status,
        "ok:",
        analyticsRes.ok,
      );

      if (usersRes.ok && analyticsRes.ok) {
        const usersData = await usersRes.json();
        const analyticsData = await analyticsRes.json();

        const response = analyticsData;
        console.log("Dashboard Response:", response);
        console.log("[Admin Frontend] Parsed users length:", usersData.length);
        console.log(
          "[Admin Frontend] Parsed analytics metrics:",
          analyticsData.metrics,
        );

        setUsers(usersData);
        setMetrics(analyticsData.metrics);
        setPlanCounts(analyticsData.plans);
        setAnalytics(analyticsData.analytics);
        setActivityFeed(analyticsData.activityFeed || []);
      } else {
        console.warn(
          "[Admin Frontend] Failed response status. usersRes status:",
          usersRes.status,
          "analyticsRes status:",
          analyticsRes.status,
        );
        if (
          usersRes.status === 401 ||
          usersRes.status === 403 ||
          analyticsRes.status === 401 ||
          analyticsRes.status === 403
        ) {
          console.log(
            "[Admin Frontend] Session expired or unauthorized. Clearing session and redirecting to login.",
          );
          await AsyncStorage.removeItem("@haajari/admin_session");
          navigation.navigate("AdminLogin" as any);
        }
      }

      // Context-aware fetching
      if (activeTab === "workers") loadWorkers();
      if (activeTab === "attendance") loadAttendance();
      if (activeTab === "payments") loadPayments();
      if (activeTab === "support") loadSupportData();
      if (activeTab === "security") loadSecurityData();
    } catch (err) {
      console.error("Error loading data", err);
    } finally {
      setIsLoadingData(false);
    }
  };

  const loadWorkers = async () => {
    try {
      const res = await adminFetch(`${API_URL}/admin/workers`);
      if (res.ok) setWorkers(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const loadAttendance = async () => {
    try {
      const res = await adminFetch(`${API_URL}/admin/attendance`);
      if (res.ok) setAttendanceList(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const loadPayments = async () => {
    try {
      const res = await adminFetch(`${API_URL}/admin/payments`);
      if (res.ok) setPayments(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const loadSupportData = async () => {
    try {
      setIsLoadingSupport(true);
      let problemUrl = `${API_URL}/admin/support/problems`;
      let feedbackUrl = `${API_URL}/admin/support/feedback`;

      const queryParams: string[] = [];
      if (supportFilterDate) {
        queryParams.push(`startDate=${supportFilterDate}`);
        const nextDay = new Date(supportFilterDate);
        nextDay.setDate(nextDay.getDate() + 1);
        queryParams.push(`endDate=${nextDay.toISOString().split("T")[0]}`);
      }

      const feedbackQueryParams = [...queryParams];
      if (supportFilterRating) {
        feedbackQueryParams.push(`rating=${supportFilterRating}`);
      }

      const problemQueryStr = queryParams.length
        ? `?${queryParams.join("&")}`
        : "";
      const feedbackQueryStr = feedbackQueryParams.length
        ? `?${feedbackQueryParams.join("&")}`
        : "";

      const [pRes, fRes] = await Promise.all([
        adminFetch(`${problemUrl}${problemQueryStr}`),
        adminFetch(`${feedbackUrl}${feedbackQueryStr}`),
      ]);

      if (pRes.ok && fRes.ok) {
        setSupportProblems(await pRes.json());
        setSupportFeedback(await fRes.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSupport(false);
    }
  };

  const loadSecurityData = async () => {
    try {
      setIsLoadingSecurity(true);
      const [sRes, lRes] = await Promise.all([
        adminFetch(`${API_URL}/admin/security/sessions`),
        adminFetch(`${API_URL}/admin/security/logs`),
      ]);

      if (sRes.ok && lRes.ok) {
        setActiveSessions(await sRes.json());
        setSecurityLogs(await lRes.json());
      }
    } catch (e) {
      console.error("Failed to load security data", e);
    } finally {
      setIsLoadingSecurity(false);
    }
  };

  const handleAdminForceLogout = async (userId: string, userName: string) => {
    const proceed =
      Platform.OS === "web"
        ? window.confirm(
            `Terminate all active sessions for user "${userName}"?`,
          )
        : await new Promise((resolve) => {
            Alert.alert(
              "Force Logout User",
              `Are you sure you want to terminate all active sessions for user "${userName}"?`,
              [
                {
                  text: "Cancel",
                  style: "cancel",
                  onPress: () => resolve(false),
                },
                {
                  text: "Force Logout",
                  style: "destructive",
                  onPress: () => resolve(true),
                },
              ],
            );
          });

    if (!proceed) return;

    try {
      const res = await adminFetch(`${API_URL}/admin/security/force-logout`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        if (Platform.OS === "web")
          alert("User sessions terminated successfully.");
        else Alert.alert("Success", "User sessions terminated successfully.");
        loadSecurityData();
      } else {
        if (Platform.OS === "web") alert("Failed to force logout user.");
        else Alert.alert("Error", "Failed to force logout user.");
      }
    } catch (err) {
      if (Platform.OS === "web") alert("Server connection failed.");
      else Alert.alert("Error", "Server connection failed.");
    }
  };

  const handleAdminDisableDevice = async (
    userId: string,
    deviceId: string,
    deviceName: string,
  ) => {
    const proceed =
      Platform.OS === "web"
        ? window.confirm(`Suspend and revoke access for "${deviceName}"?`)
        : await new Promise((resolve) => {
            Alert.alert(
              "Disable Device",
              `Are you sure you want to suspend and revoke access for "${deviceName}"?`,
              [
                {
                  text: "Cancel",
                  style: "cancel",
                  onPress: () => resolve(false),
                },
                {
                  text: "Disable",
                  style: "destructive",
                  onPress: () => resolve(true),
                },
              ],
            );
          });

    if (!proceed) return;

    try {
      const res = await adminFetch(`${API_URL}/admin/security/disable-device`, {
        method: "POST",
        body: JSON.stringify({ userId, deviceId }),
      });
      if (res.ok) {
        if (Platform.OS === "web")
          alert("Device disabled and logged out successfully.");
        else
          Alert.alert(
            "Success",
            "Device disabled and logged out successfully.",
          );
        loadSecurityData();
      } else {
        if (Platform.OS === "web") alert("Failed to disable device.");
        else Alert.alert("Error", "Failed to disable device.");
      }
    } catch (err) {
      if (Platform.OS === "web") alert("Server connection failed.");
      else Alert.alert("Error", "Server connection failed.");
    }
  };

  const handleResolveProblem = async (id: string) => {
    const confirmed =
      Platform.OS === "web"
        ? window.confirm("Mark this problem as resolved?")
        : true;
    if (!confirmed) return;
    try {
      const res = await adminFetch(
        `${API_URL}/admin/support/problems/${id}/resolve`,
        {
          method: "PUT",
        },
      );
      if (res.ok) {
        if (Platform.OS === "web")
          alert("Success: Problem marked as resolved.");
        else Alert.alert("Success", "Problem marked as resolved.");
        loadSupportData();
      } else {
        if (Platform.OS === "web") alert("Error: Failed to resolve problem.");
        else Alert.alert("Error", "Failed to resolve problem.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteProblem = async (id: string) => {
    const confirmed =
      Platform.OS === "web"
        ? window.confirm(
            "Are you sure you want to permanently delete this problem report?",
          )
        : true;
    if (!confirmed) return;
    try {
      const res = await adminFetch(`${API_URL}/admin/support/problems/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (Platform.OS === "web") alert("Success: Problem report deleted.");
        else Alert.alert("Success", "Problem report deleted.");
        loadSupportData();
      } else {
        if (Platform.OS === "web")
          alert("Error: Failed to delete problem report.");
        else Alert.alert("Error", "Failed to delete problem report.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    const confirmed =
      Platform.OS === "web"
        ? window.confirm(
            "Are you sure you want to permanently delete this feedback?",
          )
        : true;
    if (!confirmed) return;
    try {
      const res = await adminFetch(`${API_URL}/admin/support/feedback/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (Platform.OS === "web") alert("Success: Feedback deleted.");
        else Alert.alert("Success", "Feedback deleted.");
        loadSupportData();
      } else {
        if (Platform.OS === "web") alert("Error: Failed to delete feedback.");
        else Alert.alert("Error", "Failed to delete feedback.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ─── ADMIN ACTIONS ──────────────────────────────────────────────────────────

  // User Actions
  const openEditUser = (user: any) => {
    setSelectedUser(user);
    setEditUserName(user.name);
    setEditUserPhone(user.phone);
    setEditUserEmail(user.email || "");
    setEditUserRole(user.role);
    setEditUserIsActive(user.isActive);
    setEditUserPassword("");
    setEditUserModalVisible(true);
  };

  const handleUpdateUser = async () => {
    try {
      const res = await adminFetch(
        `${API_URL}/admin/users/${selectedUser._id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: editUserName,
            phone: editUserPhone,
            email: editUserEmail,
            role: editUserRole,
            isActive: editUserIsActive,
            password:
              editUserPassword.trim() !== "" ? editUserPassword : undefined,
          }),
        },
      );
      if (res.ok) {
        Alert.alert("Success", "User details updated.");
        setEditUserModalVisible(false);
        if (adminToken) loadDashboardData(adminToken);
      } else {
        const err = await res.json();
        Alert.alert("Error", err.error || "Update failed");
      }
    } catch {
      Alert.alert("Error", "Server unreachable");
    }
  };

  // Toggle user status helper
  const handleToggleUserStatus = async (
    userId: string,
    currentStatus: boolean,
  ) => {
    try {
      const res = await adminFetch(`${API_URL}/admin/users/${userId}/status`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (res.ok) {
        Alert.alert(
          "Success",
          `User has been ${!currentStatus ? "activated" : "suspended"}.`,
        );
        if (adminToken) loadDashboardData(adminToken);
      }
    } catch {
      Alert.alert("Error", "Failed to contact server.");
    }
  };

  // Plan Updates
  const handleUpdateUserPlan = async (
    tenantId: string,
    currentPlan: string,
  ) => {
    const plans: ("free" | "professional" | "business")[] = [
      "free",
      "professional",
      "business",
    ];
    const nextPlan =
      plans[(plans.indexOf(currentPlan as any) + 1) % plans.length];

    const performUpdate = async () => {
      try {
        const res = await adminFetch(
          `${API_URL}/admin/tenants/${tenantId}/plan`,
          {
            method: "PUT",
            body: JSON.stringify({ plan: nextPlan, durationDays: 30 }),
          },
        );
        if (res.ok) {
          if (Platform.OS === "web") {
            alert(`Success: Plan updated to ${nextPlan.toUpperCase()}`);
          } else {
            Alert.alert("Success", `Plan updated to ${nextPlan.toUpperCase()}`);
          }
          if (adminToken) loadDashboardData(adminToken);
        } else {
          if (Platform.OS === "web") {
            alert("Error: Server connection failed");
          } else {
            Alert.alert("Error", "Server connection failed");
          }
        }
      } catch (err) {
        if (Platform.OS === "web") {
          alert("Error: Server connection failed");
        } else {
          Alert.alert("Error", "Server connection failed");
        }
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        `Change Subscription Plan\n\nAre you sure you want to change this plan to: ${nextPlan.toUpperCase()}?`,
      );
      if (confirmed) {
        performUpdate();
      }
      return;
    }

    Alert.alert(
      "Change Subscription Plan",
      `Are you sure you want to change this plan to: ${nextPlan.toUpperCase()}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Change Plan",
          onPress: performUpdate,
        },
      ],
    );
  };

  // Worker Actions
  const openEditWorker = (worker: any) => {
    setSelectedWorker(worker);
    setEditWorkerName(worker.name);
    setEditWorkerPhone(worker.phone || "");
    setEditWorkerRate(worker.dailyRate.toString());
    setEditWorkerCategory(worker.category);
    setEditWorkerAddress(worker.address || "");
    setEditWorkerNotes(worker.notes || "");
    setEditWorkerModalVisible(true);
  };

  const handleUpdateWorker = async () => {
    try {
      const res = await adminFetch(
        `${API_URL}/admin/workers/${selectedWorker._id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: editWorkerName,
            phone: editWorkerPhone,
            dailyRate: parseFloat(editWorkerRate),
            category: editWorkerCategory,
            address: editWorkerAddress,
            notes: editWorkerNotes,
          }),
        },
      );
      if (res.ok) {
        Alert.alert("Success", "Worker data saved.");
        setEditWorkerModalVisible(false);
        loadWorkers();
        if (adminToken) loadDashboardData(adminToken);
      }
    } catch {
      Alert.alert("Error", "Fail to edit worker.");
    }
  };

  // Attendance Actions
  const openEditAttendance = (att: any) => {
    setSelectedAttendance(att);
    setEditAttendanceValue(att.value.toString());
    setEditAttendanceModalVisible(true);
  };

  const handleUpdateAttendance = async () => {
    try {
      const res = await adminFetch(
        `${API_URL}/admin/attendance/${selectedAttendance._id}`,
        {
          method: "PUT",
          body: JSON.stringify({ value: editAttendanceValue }),
        },
      );
      if (res.ok) {
        Alert.alert("Success", "Attendance value changed.");
        setEditAttendanceModalVisible(false);
        loadAttendance();
        if (adminToken) loadDashboardData(adminToken);
      }
    } catch {
      Alert.alert("Error", "Server error.");
    }
  };

  // Payment Actions
  const openEditPayment = (pay: any) => {
    setSelectedPayment(pay);
    setEditPaymentAmount(pay.amount.toString());
    setEditPaymentNote(pay.note || "");
    setEditPaymentModalVisible(true);
  };

  const handleUpdatePayment = async () => {
    try {
      const res = await adminFetch(
        `${API_URL}/admin/payments/${selectedPayment._id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            amount: parseFloat(editPaymentAmount),
            note: editPaymentNote,
          }),
        },
      );
      if (res.ok) {
        Alert.alert("Success", "Payment details saved.");
        setEditPaymentModalVisible(false);
        loadPayments();
        if (adminToken) loadDashboardData(adminToken);
      }
    } catch {
      Alert.alert("Error", "Update failed.");
    }
  };

  // ─── DELETIONS HANDLING ──────────────────────────────────────────────────────

  const promptDelete = (
    id: string,
    type: "user" | "worker" | "attendance" | "payment",
  ) => {
    console.log(`[Delete] promptDelete triggered: id=${id}, type=${type}`);
    setDeleteTarget({ id, type });
    setDeleteModalVisible(true);
  };

  const handleExecuteDelete = async () => {
    if (!deleteTarget) {
      console.log(
        "[Delete] handleExecuteDelete called but deleteTarget is null",
      );
      return;
    }
    const { id, type } = deleteTarget;
    console.log(`[Delete] Executing delete for: id=${id}, type=${type}`);
    setDeleteModalVisible(false);

    try {
      let endpoint = "";
      if (type === "user") endpoint = `/admin/users/${id}`;
      else if (type === "worker") endpoint = `/admin/workers/${id}`;
      else if (type === "attendance") endpoint = `/admin/attendance/${id}`;
      else if (type === "payment") endpoint = `/admin/payments/${id}`;

      const requestUrl = `${API_URL}${endpoint}`;
      console.log(`[Delete] Sending DELETE request to: ${requestUrl}`);

      const res = await adminFetch(requestUrl, { method: "DELETE" });
      console.log(
        `[Delete] Response received: status=${res.status}, ok=${res.ok}`,
      );

      if (res.ok) {
        console.log(`[Delete] Deletion successful for id=${id}`);
        Alert.alert("Success", "Item permanently removed.");

        // Remove locally from state instantly
        if (type === "user")
          setUsers((prev) => prev.filter((u) => u._id !== id));
        else if (type === "worker")
          setWorkers((prev) => prev.filter((w) => w._id !== id));
        else if (type === "attendance")
          setAttendanceList((prev) => prev.filter((a) => a._id !== id));
        else if (type === "payment")
          setPayments((prev) => prev.filter((p) => p._id !== id));

        if (adminToken) loadDashboardData(adminToken);
      } else {
        const errText = await res.text();
        console.error(`[Delete] Deletion failed on server: ${errText}`);
        Alert.alert("Error", "Failed to delete item from database");
      }
    } catch (err: any) {
      console.error("[Delete] Network error during deletion:", err);
      Alert.alert("Error", "Server connection timed out");
    } finally {
      setDeleteTarget(null);
    }
  };

  // Change Admin Password
  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "All fields are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match.");
      return;
    }
    setIsSavingPassword(true);
    try {
      const res = await adminFetch(`${API_URL}/auth/change-password`, {
        method: "PUT",
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      if (res.ok) {
        Alert.alert("Success", "Password updated successfully.");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const err = await res.json();
        Alert.alert("Error", err.error || "Password change failed.");
      }
    } catch {
      Alert.alert("Error", "Failed to connect to backend.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Load Admin Profile
  const loadAdminProfile = async () => {
    if (!adminToken) return;
    setIsLoadingProfile(true);
    try {
      const res = await adminFetch(`${API_URL}/auth/profile`);
      if (res.ok) {
        const data = await res.json();
        setAdminProfile(data.user);
        setEditName(data.user.name || "");
        setEditEmail(data.user.email || "");
        setEditPhone(data.user.phone || "");
      } else {
        console.warn(
          "[Admin Profile] Failed to fetch admin profile, status:",
          res.status,
        );
      }
    } catch (err) {
      console.error("[Admin Profile] Network error fetching profile:", err);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // Update Admin Profile Details
  const handleUpdateProfile = async () => {
    if (!editName || !editPhone) {
      Alert.alert("Error", "Name and Mobile number are required.");
      return;
    }
    setIsSavingProfile(true);
    try {
      const res = await adminFetch(`${API_URL}/auth/profile`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          phone: editPhone,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAdminProfile(data.user);
        setAdminUsername(data.user.name);

        // Update stored session so dashboard shows updated name
        const sessionData = await AsyncStorage.getItem(
          "@haajari/admin_session",
        );
        if (sessionData) {
          const session = JSON.parse(sessionData);
          session.username = data.user.name;
          await AsyncStorage.setItem(
            "@haajari/admin_session",
            JSON.stringify(session),
          );
        }
        Alert.alert("Success", "Profile details updated successfully.");
        setEditProfileModalVisible(false);
      } else {
        const err = await res.json();
        Alert.alert("Error", err.error || "Profile update failed.");
      }
    } catch (err) {
      Alert.alert("Error", "Failed to connect to server.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Update Admin Profile Picture
  const handleUpdateProfilePicture = async (profileImage: string) => {
    setIsSavingProfile(true);
    try {
      const res = await adminFetch(`${API_URL}/auth/profile`, {
        method: "PUT",
        body: JSON.stringify({ profileImage }),
      });
      if (res.ok) {
        const data = await res.json();
        setAdminProfile(data.user);
        Alert.alert("Success", "Profile picture updated successfully.");
        setEditProfilePictureModalVisible(false);
      } else {
        const err = await res.json();
        Alert.alert("Error", err.error || "Failed to update profile picture.");
      }
    } catch {
      Alert.alert("Error", "Server connection failed.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Pick Image from Gallery
  const handlePickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission Denied",
        "We need access to your photos to upload a profile picture.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets && result.assets[0]) {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      handleUpdateProfilePicture(base64);
    }
  };

  // Toggle Two-Factor / OTP setting
  const handleToggleOTP = async () => {
    try {
      const currentStatus = adminProfile?.otpEnabled;
      const res = await adminFetch(`${API_URL}/auth/security/otp`, {
        method: "PUT",
        body: JSON.stringify({ otpEnabled: !currentStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setAdminProfile((prev: any) =>
          prev ? { ...prev, otpEnabled: data.otpEnabled } : null,
        );
        Alert.alert(
          "Success",
          `OTP Verification is now ${!currentStatus ? "enabled" : "disabled"}.`,
        );
      } else {
        Alert.alert("Error", "Failed to update OTP settings.");
      }
    } catch {
      Alert.alert("Error", "Failed to connect to backend.");
    }
  };

  // Toggle Biometric Login setting
  const handleToggleBiometrics = async () => {
    try {
      const currentStatus = adminProfile?.biometricEnabled;
      const res = await adminFetch(`${API_URL}/auth/security/biometrics`, {
        method: "PUT",
        body: JSON.stringify({ biometricEnabled: !currentStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setAdminProfile((prev: any) =>
          prev ? { ...prev, biometricEnabled: data.biometricEnabled } : null,
        );
        Alert.alert(
          "Success",
          `Biometric Login is now ${!currentStatus ? "enabled" : "disabled"}.`,
        );
      } else {
        Alert.alert("Error", "Failed to update biometric settings.");
      }
    } catch {
      Alert.alert("Error", "Failed to connect to backend.");
    }
  };

  // Logout from all other devices
  const handleLogoutAllDevices = async () => {
    Alert.alert(
      "Confirm Logout",
      "Are you sure you want to log out from all other devices? This will invalidate all active sessions.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout All",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await adminFetch(
                `${API_URL}/auth/security/logout-all`,
                {
                  method: "POST",
                },
              );
              if (res.ok) {
                Alert.alert(
                  "Success",
                  "Logged out from all other devices successfully.",
                );
                if (typeof loadSecurityData === "function") loadSecurityData();
                loadAdminProfile();
              } else {
                Alert.alert("Error", "Failed to log out from other devices.");
              }
            } catch {
              Alert.alert("Error", "Server connection timed out.");
            }
          },
        },
      ],
    );
  };

  const handleAdminLogout = async () => {
    disconnectSocket();
    await AsyncStorage.removeItem("@haajari/admin_session");
    navigation.navigate("AdminLogin" as any);
  };

  // Search filtering
  const getFilteredData = (data: any[], keys: string[]) => {
    if (!searchQuery) return data;
    const query = searchQuery.toLowerCase();
    return data.filter((item) => {
      return keys.some((key) => {
        const val = key.split(".").reduce((acc, curr) => acc?.[curr], item);
        return String(val || "")
          .toLowerCase()
          .includes(query);
      });
    });
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.adminHeader}>
        <View>
          <ThemedText type="h1" style={styles.dashboardTitle}>
            Haajari Control Center
          </ThemedText>
          <View style={styles.connectionRow}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: socketConnected
                    ? ADMIN_COLORS.success
                    : ADMIN_COLORS.danger,
                },
              ]}
            />
            <ThemedText
              type="small"
              style={{
                color: socketConnected
                  ? ADMIN_COLORS.success
                  : ADMIN_COLORS.textSecondary,
                fontWeight: "700",
              }}
            >
              {socketConnected
                ? "Live Socket Link Active"
                : "Socket Server Connecting..."}
            </ThemedText>
          </View>
        </View>
        <Pressable onPress={handleAdminLogout} style={styles.logoutBtn}>
          <Feather name="log-out" size={20} color={ADMIN_COLORS.danger} />
        </Pressable>
      </View>

      {/* Navigation tabs */}
      <View style={styles.tabRowWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {[
            { id: "dashboard", label: "Dashboard", icon: "activity" },
            { id: "users", label: "Users", icon: "users" },
            { id: "workers", label: "Workers", icon: "briefcase" },
            { id: "attendance", label: "Attendance", icon: "calendar" },
            { id: "payments", label: "Payments", icon: "credit-card" },
            { id: "support", label: "Support & Help", icon: "help-circle" },
            { id: "security", label: "Security & Sessions", icon: "lock" },
            { id: "profile", label: "Profile", icon: "shield" },
          ].map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => {
                setActiveTab(tab.id as any);
                setSearchQuery("");
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              style={[
                styles.tab,
                activeTab === tab.id && {
                  backgroundColor: "rgba(255, 94, 37, 0.12)",
                },
              ]}
            >
              <Feather
                name={tab.icon as any}
                size={16}
                color={
                  activeTab === tab.id
                    ? ADMIN_COLORS.primary
                    : ADMIN_COLORS.textSecondary
                }
                style={{ marginRight: 6 }}
              />
              <ThemedText
                type="body"
                style={{
                  fontWeight: activeTab === tab.id ? "700" : "500",
                  color:
                    activeTab === tab.id
                      ? ADMIN_COLORS.primary
                      : ADMIN_COLORS.textSecondary,
                }}
              >
                {tab.label}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {isLoadingData ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ADMIN_COLORS.primary} />
        </View>
      ) : activeTab === "dashboard" ? (
        /* TAB 1: DASHBOARD & CHARTS */
        <ScrollView
          contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 100 }}
        >
          {/* Metrics summary cards */}
          <View style={styles.financialRow}>
            <View
              style={[
                styles.financialCard,
                { borderColor: ADMIN_COLORS.border },
              ]}
            >
              <Feather
                name="trending-up"
                size={18}
                color={ADMIN_COLORS.primary}
              />
              <ThemedText
                type="small"
                style={{
                  color: ADMIN_COLORS.textSecondary,
                  marginTop: Spacing.xs,
                }}
              >
                MRR Plan Income
              </ThemedText>
              <ThemedText
                type="h2"
                style={{ color: ADMIN_COLORS.primary, marginTop: 4 }}
              >
                ₹{metrics?.totalRevenue || 0}
              </ThemedText>
            </View>
            <View
              style={[
                styles.financialCard,
                { borderColor: ADMIN_COLORS.border },
              ]}
            >
              <Feather
                name="check-square"
                size={18}
                color={ADMIN_COLORS.success}
              />
              <ThemedText
                type="small"
                style={{
                  color: ADMIN_COLORS.textSecondary,
                  marginTop: Spacing.xs,
                }}
              >
                Total Paid Payroll
              </ThemedText>
              <ThemedText
                type="h2"
                style={{ color: ADMIN_COLORS.success, marginTop: 4 }}
              >
                ₹{metrics?.totalPayroll || 0}
              </ThemedText>
            </View>
            <View
              style={[
                styles.financialCard,
                { borderColor: ADMIN_COLORS.border },
              ]}
            >
              <Feather name="clock" size={18} color="#FFD166" />
              <ThemedText
                type="small"
                style={{
                  color: ADMIN_COLORS.textSecondary,
                  marginTop: Spacing.xs,
                }}
              >
                Total Due Liability
              </ThemedText>
              <ThemedText type="h2" style={{ color: "#FFD166", marginTop: 4 }}>
                ₹{metrics?.outstandingAmount || 0}
              </ThemedText>
            </View>
          </View>

          {/* User Distribution Counts */}
          <View
            style={[
              styles.planCard,
              { backgroundColor: ADMIN_COLORS.card, marginTop: Spacing.lg },
            ]}
          >
            <View style={styles.planRowItem}>
              <ThemedText type="body" style={{ color: ADMIN_COLORS.text }}>
                System Users (Contractors/Builders/Supervisors)
              </ThemedText>
              <ThemedText type="h3" style={{ color: "#FFFFFF" }}>
                {metrics?.totalUsers || 0}
              </ThemedText>
            </View>
            <View
              style={[styles.divider, { backgroundColor: ADMIN_COLORS.border }]}
            />
            <View style={styles.planRowItem}>
              <ThemedText type="body" style={{ color: ADMIN_COLORS.text }}>
                Active Client Base (Unblocked)
              </ThemedText>
              <ThemedText type="h3" style={{ color: ADMIN_COLORS.success }}>
                {metrics?.activeUsers || 0}
              </ThemedText>
            </View>
          </View>

          {/* Dashboard Charts */}
          <View style={{ marginTop: Spacing.xl }}>
            <ThemedText type="h2" style={styles.sectionTitle}>
              Dashboard Trend Graphs
            </ThemedText>
            {analytics?.userGrowth && (
              <UserGrowthChart data={analytics.userGrowth} />
            )}
            {analytics?.revenueGrowth && (
              <RevenueTrendChart data={analytics.revenueGrowth} />
            )}
            {planCounts && (
              <SubscriptionPieChart
                free={planCounts.free}
                pro={planCounts.professional}
                business={planCounts.business}
              />
            )}
            {analytics?.workersByCompany && (
              <WorkforceBarChart data={analytics.workersByCompany} />
            )}
            {analytics?.attendanceBreakdown && (
              <AttendanceBarChart
                present={analytics.attendanceBreakdown.present}
                absent={analytics.attendanceBreakdown.absent}
                halfDay={analytics.attendanceBreakdown.halfDay}
              />
            )}
            {analytics?.payrollTrend && (
              <PayrollTrendChart data={analytics.payrollTrend} />
            )}
          </View>

          {/* Live Timeline logs */}
          <View style={{ marginTop: Spacing.xl }}>
            <View style={styles.sectionHeaderRow}>
              <ThemedText type="h2" style={styles.sectionTitle}>
                Real-Time Event Audit Log
              </ThemedText>
              <View style={styles.pulseContainer}>
                <View style={styles.pulseIndicator} />
                <ThemedText
                  type="small"
                  style={{ color: ADMIN_COLORS.success, fontWeight: "600" }}
                >
                  Live Pushes
                </ThemedText>
              </View>
            </View>
            <View
              style={[styles.planCard, { backgroundColor: ADMIN_COLORS.card }]}
            >
              {activityFeed.length > 0 ? (
                activityFeed.map((item, idx) => (
                  <View key={item.id || idx}>
                    {idx > 0 && (
                      <View
                        style={[
                          styles.divider,
                          { backgroundColor: ADMIN_COLORS.border },
                        ]}
                      />
                    )}
                    <View style={styles.activityFeedItem}>
                      <Feather
                        name="activity"
                        size={14}
                        color={ADMIN_COLORS.primary}
                        style={{ marginRight: Spacing.sm, marginTop: 2 }}
                      />
                      <View style={{ flex: 1 }}>
                        <ThemedText
                          type="body"
                          style={{ color: ADMIN_COLORS.text }}
                        >
                          {item.message}
                        </ThemedText>
                        <ThemedText
                          type="small"
                          style={{
                            color: ADMIN_COLORS.textSecondary,
                            marginTop: 2,
                          }}
                        >
                          {new Date(item.timestamp).toLocaleTimeString()} -{" "}
                          {new Date(item.timestamp).toLocaleDateString()}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <ThemedText type="body" style={styles.noDataText}>
                  No platform activity recorded yet.
                </ThemedText>
              )}
            </View>
          </View>
        </ScrollView>
      ) : activeTab === "users" ? (
        /* TAB 2: USER CONTROL */
        <View style={{ flex: 1 }}>
          <View style={styles.searchBarContainer}>
            <Feather
              name="search"
              size={18}
              color={ADMIN_COLORS.textSecondary}
              style={{ marginRight: Spacing.sm }}
            />
            <TextInput
              placeholder="Search users name, phone, roles, company..."
              placeholderTextColor={ADMIN_COLORS.textSecondary}
              style={[styles.searchInput, { color: ADMIN_COLORS.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <FlatList
            data={getFilteredData(users, [
              "name",
              "phone",
              "role",
              "tenantId.name",
            ])}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 100 }}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.userCard,
                  {
                    backgroundColor: ADMIN_COLORS.card,
                    borderColor: ADMIN_COLORS.border,
                  },
                ]}
              >
                <View style={styles.cardInfo}>
                  <View style={styles.userMainRow}>
                    <ThemedText type="h3" style={{ color: ADMIN_COLORS.text }}>
                      {item.name}
                    </ThemedText>
                    <Pressable
                      onPress={() =>
                        handleUpdateUserPlan(
                          item.tenantId?._id,
                          item.tenantId?.plan,
                        )
                      }
                      style={[
                        styles.planBadge,
                        {
                          backgroundColor:
                            item.tenantId?.plan === "free"
                              ? ADMIN_COLORS.border
                              : ADMIN_COLORS.success + "1A",
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color:
                            item.tenantId?.plan === "free"
                              ? ADMIN_COLORS.text
                              : ADMIN_COLORS.success,
                          fontWeight: "700",
                        }}
                      >
                        Plan: {(item.tenantId?.plan || "free").toUpperCase()} 🔄
                      </ThemedText>
                    </Pressable>
                  </View>
                  <ThemedText
                    type="body"
                    style={{
                      color: ADMIN_COLORS.textSecondary,
                      marginTop: Spacing.xs,
                    }}
                  >
                    📱 {item.phone} | Role: {item.role.toUpperCase()}
                  </ThemedText>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: Spacing.sm,
                      marginTop: Spacing.xs,
                      flexWrap: "wrap",
                    }}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: ADMIN_COLORS.textSecondary }}
                    >
                      Workers: {item.workerCount ?? 0} /{" "}
                      {item.planLimit === Infinity ? "∞" : item.planLimit}
                    </ThemedText>
                    {item.limitViolation && (
                      <View
                        style={{
                          backgroundColor: ADMIN_COLORS.danger + "1F",
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: ADMIN_COLORS.danger + "40",
                        }}
                      >
                        <ThemedText
                          type="small"
                          style={{
                            color: ADMIN_COLORS.danger,
                            fontSize: 10,
                            fontWeight: "800",
                          }}
                        >
                          ⚠️ LIMIT VIOLATION
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  <ThemedText
                    type="small"
                    style={{
                      color: ADMIN_COLORS.textSecondary,
                      marginTop: Spacing.xs,
                    }}
                  >
                    Org: {item.tenantId?.name || "No Organization"}
                  </ThemedText>
                </View>

                <View style={styles.cardActions}>
                  <Pressable
                    onPress={() =>
                      handleToggleUserStatus(item._id, item.isActive)
                    }
                    style={[
                      styles.cardActionBtn,
                      {
                        backgroundColor: item.isActive
                          ? ADMIN_COLORS.success + "15"
                          : ADMIN_COLORS.danger + "15",
                      },
                    ]}
                  >
                    <Feather
                      name={item.isActive ? "check-circle" : "x-circle"}
                      size={16}
                      color={
                        item.isActive
                          ? ADMIN_COLORS.success
                          : ADMIN_COLORS.danger
                      }
                    />
                    <ThemedText
                      type="small"
                      style={{
                        color: item.isActive
                          ? ADMIN_COLORS.success
                          : ADMIN_COLORS.danger,
                        marginLeft: Spacing.xs,
                      }}
                    >
                      {item.isActive ? "Active" : "Suspended"}
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => openEditUser(item)}
                    style={[
                      styles.cardActionBtn,
                      { backgroundColor: "#FFD1661A" },
                    ]}
                  >
                    <Feather name="edit-2" size={16} color="#FFD166" />
                    <ThemedText
                      type="small"
                      style={{ color: "#FFD166", marginLeft: Spacing.xs }}
                    >
                      Edit
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => promptDelete(item._id, "user")}
                    style={[
                      styles.cardActionBtn,
                      { backgroundColor: ADMIN_COLORS.danger + "15" },
                    ]}
                  >
                    <Feather
                      name="trash-2"
                      size={16}
                      color={ADMIN_COLORS.danger}
                    />
                    <ThemedText
                      type="small"
                      style={{
                        color: ADMIN_COLORS.danger,
                        marginLeft: Spacing.xs,
                      }}
                    >
                      Delete
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            )}
          />
        </View>
      ) : activeTab === "workers" ? (
        /* TAB 3: WORKER CONTROL */
        <View style={{ flex: 1 }}>
          <View style={styles.searchBarContainer}>
            <Feather
              name="search"
              size={18}
              color={ADMIN_COLORS.textSecondary}
              style={{ marginRight: Spacing.sm }}
            />
            <TextInput
              placeholder="Search workers name, category, organization..."
              placeholderTextColor={ADMIN_COLORS.textSecondary}
              style={[styles.searchInput, { color: ADMIN_COLORS.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <FlatList
            data={getFilteredData(workers, [
              "name",
              "category",
              "tenantId.name",
            ])}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 100 }}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.userCard,
                  {
                    backgroundColor: ADMIN_COLORS.card,
                    borderColor: ADMIN_COLORS.border,
                  },
                ]}
              >
                <View style={styles.cardInfo}>
                  <View style={styles.userMainRow}>
                    <ThemedText type="h3" style={{ color: ADMIN_COLORS.text }}>
                      {item.name}
                    </ThemedText>
                    <ThemedText
                      type="body"
                      style={{ color: ADMIN_COLORS.primary, fontWeight: "700" }}
                    >
                      ₹{item.dailyRate}/Day
                    </ThemedText>
                  </View>
                  <ThemedText
                    type="body"
                    style={{
                      color: ADMIN_COLORS.textSecondary,
                      marginVertical: Spacing.xs,
                    }}
                  >
                    Category: {item.category} | phone:{" "}
                    {item.phone || "No phone"}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: ADMIN_COLORS.textSecondary }}
                  >
                    Employer Org: {item.tenantId?.name || "Unknown"}
                  </ThemedText>
                </View>

                <View style={styles.cardActions}>
                  <Pressable
                    onPress={() => openEditWorker(item)}
                    style={[
                      styles.cardActionBtn,
                      { backgroundColor: "#FFD1661A" },
                    ]}
                  >
                    <Feather name="edit-2" size={16} color="#FFD166" />
                    <ThemedText
                      type="small"
                      style={{ color: "#FFD166", marginLeft: Spacing.xs }}
                    >
                      Edit
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => promptDelete(item._id, "worker")}
                    style={[
                      styles.cardActionBtn,
                      { backgroundColor: ADMIN_COLORS.danger + "15" },
                    ]}
                  >
                    <Feather
                      name="trash-2"
                      size={16}
                      color={ADMIN_COLORS.danger}
                    />
                    <ThemedText
                      type="small"
                      style={{
                        color: ADMIN_COLORS.danger,
                        marginLeft: Spacing.xs,
                      }}
                    >
                      Delete
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            )}
          />
        </View>
      ) : activeTab === "attendance" ? (
        /* TAB 4: ATTENDANCE CONTROL */
        <View style={{ flex: 1 }}>
          <View style={styles.searchBarContainer}>
            <Feather
              name="search"
              size={18}
              color={ADMIN_COLORS.textSecondary}
              style={{ marginRight: Spacing.sm }}
            />
            <TextInput
              placeholder="Search attendance worker name, employer organization..."
              placeholderTextColor={ADMIN_COLORS.textSecondary}
              style={[styles.searchInput, { color: ADMIN_COLORS.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <FlatList
            data={getFilteredData(attendanceList, [
              "workerId.name",
              "tenantId.name",
            ])}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 100 }}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.userCard,
                  {
                    backgroundColor: ADMIN_COLORS.card,
                    borderColor: ADMIN_COLORS.border,
                  },
                ]}
              >
                <View style={styles.cardInfo}>
                  <View style={styles.userMainRow}>
                    <ThemedText type="h3" style={{ color: ADMIN_COLORS.text }}>
                      {item.workerId?.name || "Deleted Worker"}
                    </ThemedText>
                    <View
                      style={[
                        styles.roleBadge,
                        {
                          backgroundColor:
                            item.value === "P"
                              ? ADMIN_COLORS.success + "20"
                              : item.value === "A"
                                ? ADMIN_COLORS.danger + "20"
                                : item.value === "OT"
                                  ? "#3B82F620"
                                  : "#FFD16620",
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color:
                            item.value === "P"
                              ? ADMIN_COLORS.success
                              : item.value === "A"
                                ? ADMIN_COLORS.danger
                                : item.value === "OT"
                                  ? "#3B82F6"
                                  : "#FFD166",
                          fontWeight: "700",
                        }}
                      >
                        Status: {item.value}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText
                    type="body"
                    style={{
                      color: ADMIN_COLORS.textSecondary,
                      marginVertical: Spacing.xs,
                    }}
                  >
                    Date: {item.day}/{item.month + 1}/{item.year}
                  </ThemedText>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 6,
                      marginVertical: 4,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: "#1E293B",
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                      }}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color: "#FFFFFF",
                          fontWeight: "600",
                          fontSize: 10,
                        }}
                      >
                        Rate: ₹{item.dailyRate || item.workerId?.dailyRate || 0}
                      </ThemedText>
                    </View>
                    {item.customWage !== undefined &&
                      item.customWage !== null && (
                        <View
                          style={{
                            backgroundColor: "#FF6B3520",
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                          }}
                        >
                          <ThemedText
                            type="small"
                            style={{
                              color: "#FF6B35",
                              fontWeight: "600",
                              fontSize: 10,
                            }}
                          >
                            Custom: ₹{item.customWage}
                          </ThemedText>
                        </View>
                      )}
                    {item.finalPay !== undefined && item.finalPay !== null && (
                      <View
                        style={{
                          backgroundColor: "#10B98120",
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                        }}
                      >
                        <ThemedText
                          type="small"
                          style={{
                            color: "#10B981",
                            fontWeight: "600",
                            fontSize: 10,
                          }}
                        >
                          Pay: ₹{item.finalPay}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  <ThemedText
                    type="small"
                    style={{ color: ADMIN_COLORS.textSecondary, marginTop: 4 }}
                  >
                    Employer Org: {item.tenantId?.name || "Unknown"}
                  </ThemedText>
                </View>

                <View style={styles.cardActions}>
                  <Pressable
                    onPress={() => openEditAttendance(item)}
                    style={[
                      styles.cardActionBtn,
                      { backgroundColor: "#FFD1661A" },
                    ]}
                  >
                    <Feather name="edit-2" size={16} color="#FFD166" />
                    <ThemedText
                      type="small"
                      style={{ color: "#FFD166", marginLeft: Spacing.xs }}
                    >
                      Modify
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => promptDelete(item._id, "attendance")}
                    style={[
                      styles.cardActionBtn,
                      { backgroundColor: ADMIN_COLORS.danger + "15" },
                    ]}
                  >
                    <Feather
                      name="trash-2"
                      size={16}
                      color={ADMIN_COLORS.danger}
                    />
                    <ThemedText
                      type="small"
                      style={{
                        color: ADMIN_COLORS.danger,
                        marginLeft: Spacing.xs,
                      }}
                    >
                      Delete
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            )}
          />
        </View>
      ) : activeTab === "payments" ? (
        /* TAB 5: PAYMENT CONTROL */
        <View style={{ flex: 1 }}>
          <View style={styles.searchBarContainer}>
            <Feather
              name="search"
              size={18}
              color={ADMIN_COLORS.textSecondary}
              style={{ marginRight: Spacing.sm }}
            />
            <TextInput
              placeholder="Search payments worker name, notes, organization..."
              placeholderTextColor={ADMIN_COLORS.textSecondary}
              style={[styles.searchInput, { color: ADMIN_COLORS.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <FlatList
            data={getFilteredData(payments, [
              "workerId.name",
              "note",
              "tenantId.name",
            ])}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 100 }}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.userCard,
                  {
                    backgroundColor: ADMIN_COLORS.card,
                    borderColor: ADMIN_COLORS.border,
                  },
                ]}
              >
                <View style={styles.cardInfo}>
                  <View style={styles.userMainRow}>
                    <ThemedText type="h3" style={{ color: ADMIN_COLORS.text }}>
                      {item.workerId?.name || "Deleted Worker"}
                    </ThemedText>
                    <ThemedText
                      type="h2"
                      style={{ color: ADMIN_COLORS.success }}
                    >
                      ₹{item.amount}
                    </ThemedText>
                  </View>
                  <ThemedText
                    type="body"
                    style={{
                      color: ADMIN_COLORS.textSecondary,
                      marginVertical: Spacing.xs,
                    }}
                  >
                    Period: {item.month + 1}/{item.year} | Notes:{" "}
                    {item.note || "No note"}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: ADMIN_COLORS.textSecondary }}
                  >
                    Employer Org: {item.tenantId?.name || "Unknown"}
                  </ThemedText>
                </View>

                <View style={styles.cardActions}>
                  <Pressable
                    onPress={() => openEditPayment(item)}
                    style={[
                      styles.cardActionBtn,
                      { backgroundColor: "#FFD1661A" },
                    ]}
                  >
                    <Feather name="edit-2" size={16} color="#FFD166" />
                    <ThemedText
                      type="small"
                      style={{ color: "#FFD166", marginLeft: Spacing.xs }}
                    >
                      Edit
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => promptDelete(item._id, "payment")}
                    style={[
                      styles.cardActionBtn,
                      { backgroundColor: ADMIN_COLORS.danger + "15" },
                    ]}
                  >
                    <Feather
                      name="trash-2"
                      size={16}
                      color={ADMIN_COLORS.danger}
                    />
                    <ThemedText
                      type="small"
                      style={{
                        color: ADMIN_COLORS.danger,
                        marginLeft: Spacing.xs,
                      }}
                    >
                      Delete
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            )}
          />
        </View>
      ) : activeTab === "support" ? (
        /* TAB 7: SUPPORT & FEEDBACK MANAGEMENT */
        <View style={{ flex: 1 }}>
          {/* Support Filters */}
          <View
            style={[
              styles.searchBarContainer,
              {
                gap: Spacing.md,
                paddingHorizontal: Spacing.xl,
                paddingVertical: Spacing.sm,
              },
            ]}
          >
            <View
              style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
            >
              <Feather
                name="calendar"
                size={18}
                color={ADMIN_COLORS.textSecondary}
                style={{ marginRight: Spacing.sm }}
              />
              <TextInput
                placeholder="Filter by Date (YYYY-MM-DD)..."
                placeholderTextColor={ADMIN_COLORS.textSecondary}
                style={[styles.searchInput, { color: ADMIN_COLORS.text }]}
                value={supportFilterDate}
                onChangeText={setSupportFilterDate}
              />
              {supportFilterDate ? (
                <Pressable onPress={() => setSupportFilterDate("")}>
                  <Feather name="x" size={16} color={ADMIN_COLORS.danger} />
                </Pressable>
              ) : null}
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: Spacing.xs,
              }}
            >
              <ThemedText style={{ color: ADMIN_COLORS.textSecondary }}>
                Filter Stars:
              </ThemedText>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() =>
                    setSupportFilterRating(
                      supportFilterRating === star ? null : star,
                    )
                  }
                  style={{
                    padding: 4,
                    backgroundColor:
                      supportFilterRating === star
                        ? ADMIN_COLORS.primary + "30"
                        : "transparent",
                    borderRadius: 6,
                  }}
                >
                  <FontAwesome
                    name={
                      star <= (supportFilterRating || 0) ? "star" : "star-o"
                    }
                    size={16}
                    color={
                      star <= (supportFilterRating || 0)
                        ? "#FFC107"
                        : ADMIN_COLORS.textSecondary
                    }
                  />
                </Pressable>
              ))}
            </View>
          </View>

          {isLoadingSupport ? (
            <ActivityIndicator
              size="large"
              color={ADMIN_COLORS.primary}
              style={{ marginTop: Spacing.xl }}
            />
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 100 }}
            >
              {/* 1. REPORTED PROBLEMS SECTION */}
              <View
                style={{ paddingHorizontal: Spacing.xl, marginTop: Spacing.md }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: Spacing.md,
                  }}
                >
                  <ThemedText
                    type="h2"
                    style={{ color: ADMIN_COLORS.text, fontWeight: "700" }}
                  >
                    Reported Problems ({supportProblems.length})
                  </ThemedText>
                </View>

                {supportProblems.length === 0 ? (
                  <View
                    style={[
                      styles.userCard,
                      {
                        padding: Spacing.xl,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: ADMIN_COLORS.card,
                        borderColor: ADMIN_COLORS.border,
                      },
                    ]}
                  >
                    <ThemedText style={{ color: ADMIN_COLORS.textSecondary }}>
                      No reported problems found.
                    </ThemedText>
                  </View>
                ) : (
                  supportProblems.map((problem) => (
                    <View
                      key={problem._id}
                      style={[
                        styles.userCard,
                        {
                          backgroundColor: ADMIN_COLORS.card,
                          borderColor: ADMIN_COLORS.border,
                          marginBottom: Spacing.md,
                        },
                      ]}
                    >
                      <View style={styles.cardInfo}>
                        <View style={styles.userMainRow}>
                          <ThemedText
                            type="h3"
                            style={{
                              color: ADMIN_COLORS.text,
                              fontWeight: "700",
                            }}
                          >
                            {problem.subject}
                          </ThemedText>
                          <View
                            style={[
                              styles.roleBadge,
                              {
                                backgroundColor:
                                  problem.status === "resolved"
                                    ? ADMIN_COLORS.success + "15"
                                    : ADMIN_COLORS.danger + "15",
                              },
                            ]}
                          >
                            <ThemedText
                              type="small"
                              style={{
                                color:
                                  problem.status === "resolved"
                                    ? ADMIN_COLORS.success
                                    : ADMIN_COLORS.danger,
                                fontWeight: "700",
                              }}
                            >
                              {problem.status.toUpperCase()}
                            </ThemedText>
                          </View>
                        </View>
                        <ThemedText
                          type="body"
                          style={{
                            color: ADMIN_COLORS.text,
                            marginTop: Spacing.xs,
                          }}
                        >
                          {problem.description}
                        </ThemedText>
                        <ThemedText
                          type="small"
                          style={{
                            color: ADMIN_COLORS.textSecondary,
                            marginTop: Spacing.sm,
                          }}
                        >
                          By: {problem.userName} ({problem.mobileNumber})
                        </ThemedText>
                        {problem.screenshot ? (
                          <ThemedText
                            type="small"
                            style={{
                              color: ADMIN_COLORS.primary,
                              marginTop: 4,
                            }}
                          >
                            Attachment/Note: {problem.screenshot}
                          </ThemedText>
                        ) : null}
                        <ThemedText
                          type="small"
                          style={{
                            color: ADMIN_COLORS.textSecondary,
                            marginTop: 4,
                          }}
                        >
                          Reported:{" "}
                          {new Date(problem.createdAt).toLocaleString()}
                        </ThemedText>
                      </View>

                      <View style={styles.cardActions}>
                        {problem.status === "open" && (
                          <Pressable
                            onPress={() => handleResolveProblem(problem._id)}
                            style={[
                              styles.cardActionBtn,
                              { backgroundColor: ADMIN_COLORS.success + "15" },
                            ]}
                          >
                            <Feather
                              name="check"
                              size={16}
                              color={ADMIN_COLORS.success}
                            />
                            <ThemedText
                              type="small"
                              style={{
                                color: ADMIN_COLORS.success,
                                marginLeft: Spacing.xs,
                              }}
                            >
                              Resolve
                            </ThemedText>
                          </Pressable>
                        )}
                        <Pressable
                          onPress={() => handleDeleteProblem(problem._id)}
                          style={[
                            styles.cardActionBtn,
                            { backgroundColor: ADMIN_COLORS.danger + "15" },
                          ]}
                        >
                          <Feather
                            name="trash-2"
                            size={16}
                            color={ADMIN_COLORS.danger}
                          />
                          <ThemedText
                            type="small"
                            style={{
                              color: ADMIN_COLORS.danger,
                              marginLeft: Spacing.xs,
                            }}
                          >
                            Delete
                          </ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </View>

              {/* 2. USER FEEDBACK SECTION */}
              <View
                style={{ paddingHorizontal: Spacing.xl, marginTop: Spacing.xl }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: Spacing.md,
                  }}
                >
                  <ThemedText
                    type="h2"
                    style={{ color: ADMIN_COLORS.text, fontWeight: "700" }}
                  >
                    User Feedback ({supportFeedback.length})
                  </ThemedText>
                </View>

                {supportFeedback.length === 0 ? (
                  <View
                    style={[
                      styles.userCard,
                      {
                        padding: Spacing.xl,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: ADMIN_COLORS.card,
                        borderColor: ADMIN_COLORS.border,
                      },
                    ]}
                  >
                    <ThemedText style={{ color: ADMIN_COLORS.textSecondary }}>
                      No feedback reviews found.
                    </ThemedText>
                  </View>
                ) : (
                  supportFeedback.map((feedback) => (
                    <View
                      key={feedback._id}
                      style={[
                        styles.userCard,
                        {
                          backgroundColor: ADMIN_COLORS.card,
                          borderColor: ADMIN_COLORS.border,
                          marginBottom: Spacing.md,
                        },
                      ]}
                    >
                      <View style={styles.cardInfo}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: Spacing.sm,
                          }}
                        >
                          <View style={{ flexDirection: "row", gap: 2 }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <FontAwesome
                                key={star}
                                name={
                                  star <= feedback.rating ? "star" : "star-o"
                                }
                                size={14}
                                color={
                                  star <= feedback.rating
                                    ? "#FFC107"
                                    : ADMIN_COLORS.textSecondary
                                }
                              />
                            ))}
                          </View>
                          <ThemedText
                            type="small"
                            style={{ color: ADMIN_COLORS.textSecondary }}
                          >
                            ({feedback.rating}/5 Stars)
                          </ThemedText>
                        </View>
                        <ThemedText
                          type="body"
                          style={{
                            color: ADMIN_COLORS.text,
                            marginTop: Spacing.xs,
                          }}
                        >
                          "{feedback.feedback}"
                        </ThemedText>
                        <ThemedText
                          type="small"
                          style={{
                            color: ADMIN_COLORS.textSecondary,
                            marginTop: Spacing.sm,
                          }}
                        >
                          By: {feedback.userName} ({feedback.mobileNumber})
                        </ThemedText>
                        <ThemedText
                          type="small"
                          style={{
                            color: ADMIN_COLORS.textSecondary,
                            marginTop: 4,
                          }}
                        >
                          Submitted:{" "}
                          {new Date(feedback.createdAt).toLocaleString()}
                        </ThemedText>
                      </View>

                      <View style={styles.cardActions}>
                        <Pressable
                          onPress={() => handleDeleteFeedback(feedback._id)}
                          style={[
                            styles.cardActionBtn,
                            { backgroundColor: ADMIN_COLORS.danger + "15" },
                          ]}
                        >
                          <Feather
                            name="trash-2"
                            size={16}
                            color={ADMIN_COLORS.danger}
                          />
                          <ThemedText
                            type="small"
                            style={{
                              color: ADMIN_COLORS.danger,
                              marginLeft: Spacing.xs,
                            }}
                          >
                            Delete
                          </ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          )}
        </View>
      ) : activeTab === "security" ? (
        /* TAB: SECURITY & SESSIONS AUDIT */
        <View style={{ flex: 1 }}>
          {isLoadingSecurity ? (
            <ActivityIndicator
              size="large"
              color={ADMIN_COLORS.primary}
              style={{ marginTop: Spacing.xl }}
            />
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 100 }}
            >
              {/* Active Sessions */}
              <View
                style={{ paddingHorizontal: Spacing.xl, marginTop: Spacing.md }}
              >
                <ThemedText
                  type="h2"
                  style={{
                    color: ADMIN_COLORS.text,
                    fontWeight: "700",
                    marginBottom: Spacing.md,
                  }}
                >
                  Active Device Sessions ({activeSessions.length})
                </ThemedText>

                {activeSessions.length === 0 ? (
                  <View
                    style={[
                      styles.userCard,
                      {
                        padding: Spacing.xl,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: ADMIN_COLORS.card,
                        borderColor: ADMIN_COLORS.border,
                      },
                    ]}
                  >
                    <ThemedText style={{ color: ADMIN_COLORS.textSecondary }}>
                      No active user sessions found.
                    </ThemedText>
                  </View>
                ) : (
                  activeSessions.map((session, index) => (
                    <View
                      key={session.deviceId || index}
                      style={[
                        styles.userCard,
                        {
                          backgroundColor: ADMIN_COLORS.card,
                          borderColor: ADMIN_COLORS.border,
                          marginBottom: Spacing.md,
                        },
                      ]}
                    >
                      <View style={styles.cardInfo}>
                        <View style={styles.userMainRow}>
                          <ThemedText
                            type="h3"
                            style={{
                              color: ADMIN_COLORS.text,
                              fontWeight: "700",
                            }}
                          >
                            {session.userName}
                          </ThemedText>
                          <View
                            style={[
                              styles.roleBadge,
                              {
                                backgroundColor: session.isSuspicious
                                  ? ADMIN_COLORS.danger + "15"
                                  : ADMIN_COLORS.success + "15",
                              },
                            ]}
                          >
                            <ThemedText
                              type="small"
                              style={{
                                color: session.isSuspicious
                                  ? ADMIN_COLORS.danger
                                  : ADMIN_COLORS.success,
                                fontWeight: "700",
                              }}
                            >
                              {session.isSuspicious ? "SUSPICIOUS" : "ACTIVE"}
                            </ThemedText>
                          </View>
                        </View>
                        <ThemedText
                          type="body"
                          style={{
                            color: ADMIN_COLORS.text,
                            marginTop: Spacing.xs,
                          }}
                        >
                          Device: {session.deviceName} ({session.deviceOs})
                        </ThemedText>
                        <ThemedText
                          type="small"
                          style={{
                            color: ADMIN_COLORS.textSecondary,
                            marginTop: 2,
                          }}
                        >
                          📍 {session.location} | IP: {session.ipAddress}
                        </ThemedText>
                        <ThemedText
                          type="small"
                          style={{
                            color: ADMIN_COLORS.textSecondary,
                            marginTop: 2,
                          }}
                        >
                          Browser: {session.deviceBrowser}
                        </ThemedText>
                        <ThemedText
                          type="small"
                          style={{
                            color: ADMIN_COLORS.primary,
                            fontWeight: "600",
                            marginTop: 4,
                          }}
                        >
                          Last Active:{" "}
                          {new Date(session.lastActiveAt).toLocaleString()}
                        </ThemedText>
                      </View>

                      <View style={styles.cardActions}>
                        <Pressable
                          onPress={() =>
                            handleAdminDisableDevice(
                              session.userId,
                              session.deviceId,
                              session.deviceName,
                            )
                          }
                          style={[
                            styles.cardActionBtn,
                            { backgroundColor: ADMIN_COLORS.danger + "15" },
                          ]}
                        >
                          <Feather
                            name="slash"
                            size={14}
                            color={ADMIN_COLORS.danger}
                          />
                          <ThemedText
                            type="small"
                            style={{
                              color: ADMIN_COLORS.danger,
                              marginLeft: Spacing.xs,
                            }}
                          >
                            Disable Device
                          </ThemedText>
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            handleAdminForceLogout(
                              session.userId,
                              session.userName,
                            )
                          }
                          style={[
                            styles.cardActionBtn,
                            { backgroundColor: ADMIN_COLORS.primary + "15" },
                          ]}
                        >
                          <Feather
                            name="log-out"
                            size={14}
                            color={ADMIN_COLORS.primary}
                          />
                          <ThemedText
                            type="small"
                            style={{
                              color: ADMIN_COLORS.primary,
                              marginLeft: Spacing.xs,
                            }}
                          >
                            Force Logout
                          </ThemedText>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </View>

              {/* Security Logs */}
              <View
                style={{ paddingHorizontal: Spacing.xl, marginTop: Spacing.xl }}
              >
                <ThemedText
                  type="h2"
                  style={{
                    color: ADMIN_COLORS.text,
                    fontWeight: "700",
                    marginBottom: Spacing.md,
                  }}
                >
                  Security Audit Logs ({securityLogs.length})
                </ThemedText>

                <View
                  style={{
                    borderRadius: BorderRadius.md,
                    borderWidth: 1,
                    borderColor: ADMIN_COLORS.border,
                    overflow: "hidden",
                    backgroundColor: ADMIN_COLORS.card,
                  }}
                >
                  {securityLogs.length === 0 ? (
                    <View style={{ padding: Spacing.xl, alignItems: "center" }}>
                      <ThemedText style={{ color: ADMIN_COLORS.textSecondary }}>
                        No security logs recorded yet.
                      </ThemedText>
                    </View>
                  ) : (
                    securityLogs.map((log, index) => (
                      <View
                        key={log._id || index}
                        style={{
                          padding: Spacing.lg,
                          borderBottomWidth:
                            index < securityLogs.length - 1 ? 1 : 0,
                          borderBottomColor: ADMIN_COLORS.border,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <ThemedText
                            style={{
                              fontWeight: "700",
                              color: log.eventType.includes("FAILED")
                                ? ADMIN_COLORS.danger
                                : ADMIN_COLORS.primary,
                            }}
                          >
                            {log.eventType}
                          </ThemedText>
                          <ThemedText
                            type="small"
                            style={{ color: ADMIN_COLORS.textSecondary }}
                          >
                            {new Date(log.timestamp).toLocaleString()}
                          </ThemedText>
                        </View>
                        <ThemedText
                          type="body"
                          style={{ color: ADMIN_COLORS.text, marginTop: 4 }}
                        >
                          {log.details}
                        </ThemedText>
                        <ThemedText
                          type="small"
                          style={{
                            color: ADMIN_COLORS.textSecondary,
                            marginTop: 4,
                          }}
                        >
                          User Mobile: {log.userPhone || "N/A"} | IP:{" "}
                          {log.ipAddress}
                        </ThemedText>
                      </View>
                    ))
                  )}
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      ) : (
        /* TAB 6: ADMIN PROFILE & CHANGE PASSWORD */
        <ScrollView
          contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 100 }}
        >
          {/* Profile Header */}
          <View
            style={[
              styles.profileHeaderCard,
              {
                backgroundColor: ADMIN_COLORS.card,
                borderColor: ADMIN_COLORS.border,
              },
            ]}
          >
            <View style={styles.avatarWrapper}>
              {adminProfile?.profileImage ? (
                <View style={styles.avatarImgContainer}>
                  <ThemedText
                    type="h1"
                    style={[
                      styles.avatarInitials,
                      { color: ADMIN_COLORS.primary },
                    ]}
                  >
                    {adminProfile.profileImage.startsWith("data:")
                      ? "📸"
                      : adminProfile.profileImage}
                  </ThemedText>
                </View>
              ) : (
                <View
                  style={[
                    styles.avatarImgContainer,
                    { backgroundColor: ADMIN_COLORS.primary + "1F" },
                  ]}
                >
                  <Feather name="user" size={44} color={ADMIN_COLORS.primary} />
                </View>
              )}
              <Pressable
                onPress={() => setEditProfilePictureModalVisible(true)}
                style={[
                  styles.editPhotoBadge,
                  { backgroundColor: ADMIN_COLORS.primary },
                ]}
              >
                <Feather name="camera" size={12} color="#FFF" />
              </Pressable>
            </View>

            <View style={styles.profileTextDetails}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                <ThemedText type="h2" style={{ color: ADMIN_COLORS.text }}>
                  {adminProfile?.name || adminUsername}
                </ThemedText>
                <View
                  style={[
                    styles.roleBadge,
                    { backgroundColor: ADMIN_COLORS.primary + "15" },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{ color: ADMIN_COLORS.primary, fontWeight: "700" }}
                  >
                    👑 Super Admin
                  </ThemedText>
                </View>
              </View>

              <ThemedText
                type="body"
                style={{
                  color: ADMIN_COLORS.textSecondary,
                  marginTop: 4,
                  textAlign: "center",
                }}
              >
                📧 {adminProfile?.email || "info@haajariapp.com"}
              </ThemedText>
              <ThemedText
                type="body"
                style={{
                  color: ADMIN_COLORS.textSecondary,
                  marginTop: 2,
                  textAlign: "center",
                }}
              >
                📱 +91 {adminProfile?.phone || "haajari896"}
              </ThemedText>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: Spacing.sm,
                }}
              >
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: ADMIN_COLORS.success },
                  ]}
                />
                <ThemedText
                  type="small"
                  style={{ color: ADMIN_COLORS.success, fontWeight: "700" }}
                >
                  🟢 Status: Active
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Quick Access System Shortcuts */}
          <ThemedText
            type="h2"
            style={[styles.sectionTitle, { marginTop: Spacing.xl }]}
          >
            System Control Quick Shortcuts
          </ThemedText>
          <View style={styles.shortcutGrid}>
            <Pressable
              onPress={() => setActiveTab("users")}
              style={[
                styles.shortcutBtn,
                {
                  backgroundColor: ADMIN_COLORS.card,
                  borderColor: ADMIN_COLORS.border,
                },
              ]}
            >
              <Feather name="users" size={18} color={ADMIN_COLORS.primary} />
              <ThemedText type="small" style={styles.shortcutBtnText}>
                Manage Users
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("workers")}
              style={[
                styles.shortcutBtn,
                {
                  backgroundColor: ADMIN_COLORS.card,
                  borderColor: ADMIN_COLORS.border,
                },
              ]}
            >
              <Feather
                name="briefcase"
                size={18}
                color={ADMIN_COLORS.primary}
              />
              <ThemedText type="small" style={styles.shortcutBtnText}>
                Manage Workers
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("attendance")}
              style={[
                styles.shortcutBtn,
                {
                  backgroundColor: ADMIN_COLORS.card,
                  borderColor: ADMIN_COLORS.border,
                },
              ]}
            >
              <Feather name="calendar" size={18} color={ADMIN_COLORS.primary} />
              <ThemedText type="small" style={styles.shortcutBtnText}>
                Attendance
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("security")}
              style={[
                styles.shortcutBtn,
                {
                  backgroundColor: ADMIN_COLORS.card,
                  borderColor: ADMIN_COLORS.border,
                },
              ]}
            >
              <Feather name="shield" size={18} color={ADMIN_COLORS.primary} />
              <ThemedText type="small" style={styles.shortcutBtnText}>
                Security Audits
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("support")}
              style={[
                styles.shortcutBtn,
                {
                  backgroundColor: ADMIN_COLORS.card,
                  borderColor: ADMIN_COLORS.border,
                },
              ]}
            >
              <Feather
                name="help-circle"
                size={18}
                color={ADMIN_COLORS.primary}
              />
              <ThemedText type="small" style={styles.shortcutBtnText}>
                Support Tickets
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab("dashboard")}
              style={[
                styles.shortcutBtn,
                {
                  backgroundColor: ADMIN_COLORS.card,
                  borderColor: ADMIN_COLORS.border,
                },
              ]}
            >
              <Feather
                name="bar-chart-2"
                size={18}
                color={ADMIN_COLORS.primary}
              />
              <ThemedText type="small" style={styles.shortcutBtnText}>
                Analytics
              </ThemedText>
            </Pressable>
          </View>

          {/* Admin Live Platform Statistics */}
          <ThemedText
            type="h2"
            style={[styles.sectionTitle, { marginTop: Spacing.xl }]}
          >
            Haajari Control Live Statistics
          </ThemedText>
          <View style={styles.shortcutGrid}>
            <View
              style={[
                styles.shortcutBtn,
                {
                  backgroundColor: ADMIN_COLORS.card,
                  borderColor: ADMIN_COLORS.border,
                  alignItems: "flex-start",
                  padding: Spacing.md,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={{ color: ADMIN_COLORS.textSecondary }}
              >
                System Users
              </ThemedText>
              <ThemedText type="h2" style={{ color: "#FFF", marginTop: 4 }}>
                {metrics?.totalUsers || 0}
              </ThemedText>
            </View>
            <View
              style={[
                styles.shortcutBtn,
                {
                  backgroundColor: ADMIN_COLORS.card,
                  borderColor: ADMIN_COLORS.border,
                  alignItems: "flex-start",
                  padding: Spacing.md,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={{ color: ADMIN_COLORS.textSecondary }}
              >
                Companies/Tenants
              </ThemedText>
              <ThemedText type="h2" style={{ color: "#FFF", marginTop: 4 }}>
                {(planCounts?.free || 0) +
                  (planCounts?.professional || 0) +
                  (planCounts?.business || 0)}
              </ThemedText>
            </View>
            <View
              style={[
                styles.shortcutBtn,
                {
                  backgroundColor: ADMIN_COLORS.card,
                  borderColor: ADMIN_COLORS.border,
                  alignItems: "flex-start",
                  padding: Spacing.md,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={{ color: ADMIN_COLORS.textSecondary }}
              >
                Contractors
              </ThemedText>
              <ThemedText type="h2" style={{ color: "#FFF", marginTop: 4 }}>
                {metrics?.totalContractors || 0}
              </ThemedText>
            </View>
            <View
              style={[
                styles.shortcutBtn,
                {
                  backgroundColor: ADMIN_COLORS.card,
                  borderColor: ADMIN_COLORS.border,
                  alignItems: "flex-start",
                  padding: Spacing.md,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={{ color: ADMIN_COLORS.textSecondary }}
              >
                Supervisors
              </ThemedText>
              <ThemedText type="h2" style={{ color: "#FFF", marginTop: 4 }}>
                {metrics?.totalSupervisors || 0}
              </ThemedText>
            </View>
            <View
              style={[
                styles.shortcutBtn,
                {
                  backgroundColor: ADMIN_COLORS.card,
                  borderColor: ADMIN_COLORS.border,
                  alignItems: "flex-start",
                  padding: Spacing.md,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={{ color: ADMIN_COLORS.textSecondary }}
              >
                Total Workers
              </ThemedText>
              <ThemedText type="h2" style={{ color: "#FFF", marginTop: 4 }}>
                {metrics?.totalWorkers || 0}
              </ThemedText>
            </View>
            <View
              style={[
                styles.shortcutBtn,
                {
                  backgroundColor: ADMIN_COLORS.card,
                  borderColor: ADMIN_COLORS.border,
                  alignItems: "flex-start",
                  padding: Spacing.md,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={{ color: ADMIN_COLORS.textSecondary }}
              >
                Platform Income
              </ThemedText>
              <ThemedText
                type="h2"
                style={{ color: ADMIN_COLORS.primary, marginTop: 4 }}
              >
                ₹{metrics?.totalRevenue || 0}
              </ThemedText>
            </View>
            <View
              style={[
                styles.shortcutBtn,
                {
                  backgroundColor: ADMIN_COLORS.card,
                  borderColor: ADMIN_COLORS.border,
                  alignItems: "flex-start",
                  padding: Spacing.md,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={{ color: ADMIN_COLORS.textSecondary }}
              >
                Attendance Records
              </ThemedText>
              <ThemedText type="h2" style={{ color: "#FFF", marginTop: 4 }}>
                {metrics?.totalAttendance || 0}
              </ThemedText>
            </View>
            <View
              style={[
                styles.shortcutBtn,
                {
                  backgroundColor: ADMIN_COLORS.card,
                  borderColor: ADMIN_COLORS.border,
                  alignItems: "flex-start",
                  padding: Spacing.md,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={{ color: ADMIN_COLORS.textSecondary }}
              >
                Pro Subscriptions
              </ThemedText>
              <ThemedText
                type="h2"
                style={{ color: ADMIN_COLORS.success, marginTop: 4 }}
              >
                {planCounts?.professional || 0}
              </ThemedText>
            </View>
          </View>

          {/* Notification Center */}
          <ThemedText
            type="h2"
            style={[styles.sectionTitle, { marginTop: Spacing.xl }]}
          >
            Admin Notification Alerts
          </ThemedText>
          <View
            style={[
              styles.formCard,
              {
                backgroundColor: ADMIN_COLORS.card,
                borderColor: ADMIN_COLORS.border,
                padding: Spacing.lg,
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: Spacing.md,
              }}
            >
              <Feather
                name="bell"
                size={18}
                color={ADMIN_COLORS.primary}
                style={{ marginRight: Spacing.sm }}
              />
              <ThemedText type="h3" style={{ color: "#FFF" }}>
                Live System Alerts
              </ThemedText>
            </View>

            <View
              style={[
                styles.notificationCard,
                { borderLeftColor: ADMIN_COLORS.primary },
              ]}
            >
              <Feather
                name="help-circle"
                size={16}
                color={ADMIN_COLORS.primary}
              />
              <ThemedText
                type="body"
                style={{ color: "#FFF", marginLeft: Spacing.sm, flex: 1 }}
              >
                Pending Support Tickets:{" "}
                {supportProblems.filter((p) => p.status === "open").length}{" "}
                unresolved issues require action.
              </ThemedText>
            </View>

            <View
              style={[
                styles.notificationCard,
                {
                  borderLeftColor: ADMIN_COLORS.success,
                  marginTop: Spacing.sm,
                },
              ]}
            >
              <Feather
                name="user-plus"
                size={16}
                color={ADMIN_COLORS.success}
              />
              <ThemedText
                type="body"
                style={{ color: "#FFF", marginLeft: Spacing.sm, flex: 1 }}
              >
                New Registrations: {users.length} active platform contractors
                logged.
              </ThemedText>
            </View>

            <View
              style={[
                styles.notificationCard,
                { borderLeftColor: "#FFD166", marginTop: Spacing.sm },
              ]}
            >
              <Feather name="alert-triangle" size={16} color="#FFD166" />
              <ThemedText
                type="body"
                style={{ color: "#FFF", marginLeft: Spacing.sm, flex: 1 }}
              >
                Security: {activeSessions.length} active sessions logged across{" "}
                {users.length} contractors.
              </ThemedText>
            </View>
          </View>

          {/* Profile Management Actions */}
          <ThemedText
            type="h2"
            style={[styles.sectionTitle, { marginTop: Spacing.xl }]}
          >
            Profile Management
          </ThemedText>
          <View
            style={[
              styles.formCard,
              {
                backgroundColor: ADMIN_COLORS.card,
                borderColor: ADMIN_COLORS.border,
              },
            ]}
          >
            <Pressable
              onPress={() => setEditProfileModalVisible(true)}
              style={styles.menuItem}
            >
              <Feather
                name="user"
                size={18}
                color={ADMIN_COLORS.textSecondary}
              />
              <ThemedText type="body" style={styles.menuItemText}>
                Edit Profile Details
              </ThemedText>
              <Feather
                name="chevron-right"
                size={18}
                color={ADMIN_COLORS.textSecondary}
              />
            </Pressable>
            <View
              style={[styles.divider, { backgroundColor: ADMIN_COLORS.border }]}
            />

            <Pressable
              onPress={() => setEditProfilePictureModalVisible(true)}
              style={styles.menuItem}
            >
              <Feather
                name="image"
                size={18}
                color={ADMIN_COLORS.textSecondary}
              />
              <ThemedText type="body" style={styles.menuItemText}>
                Update Profile Picture
              </ThemedText>
              <Feather
                name="chevron-right"
                size={18}
                color={ADMIN_COLORS.textSecondary}
              />
            </Pressable>
            <View
              style={[styles.divider, { backgroundColor: ADMIN_COLORS.border }]}
            />

            <Pressable onPress={handleLogoutAllDevices} style={styles.menuItem}>
              <Feather
                name="shield"
                size={18}
                color={ADMIN_COLORS.textSecondary}
              />
              <ThemedText type="body" style={styles.menuItemText}>
                Logout From Other Devices
              </ThemedText>
              <Feather
                name="chevron-right"
                size={18}
                color={ADMIN_COLORS.textSecondary}
              />
            </Pressable>
          </View>

          {/* Security Controls */}
          <ThemedText
            type="h2"
            style={[styles.sectionTitle, { marginTop: Spacing.xl }]}
          >
            Security Credentials & 2FA
          </ThemedText>
          <View
            style={[
              styles.formCard,
              {
                backgroundColor: ADMIN_COLORS.card,
                borderColor: ADMIN_COLORS.border,
              },
            ]}
          >
            <View style={styles.securityRow}>
              <View style={styles.securityTextContainer}>
                <ThemedText
                  type="body"
                  style={{ color: "#FFF", fontWeight: "700" }}
                >
                  Two Factor Authentication (2FA)
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: ADMIN_COLORS.textSecondary }}
                >
                  Secure account access using mobile verification codes
                </ThemedText>
              </View>
              <Pressable onPress={handleToggleOTP}>
                <Feather
                  name={
                    adminProfile?.otpEnabled ? "toggle-right" : "toggle-left"
                  }
                  size={32}
                  color={
                    adminProfile?.otpEnabled
                      ? ADMIN_COLORS.success
                      : ADMIN_COLORS.textSecondary
                  }
                />
              </Pressable>
            </View>

            <View
              style={[styles.divider, { backgroundColor: ADMIN_COLORS.border }]}
            />

            <View style={styles.securityRow}>
              <View style={styles.securityTextContainer}>
                <ThemedText
                  type="body"
                  style={{ color: "#FFF", fontWeight: "700" }}
                >
                  Biometric Authentication
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: ADMIN_COLORS.textSecondary }}
                >
                  Log in instantly using phone fingerprint or FaceID
                </ThemedText>
              </View>
              <Pressable onPress={handleToggleBiometrics}>
                <Feather
                  name={
                    adminProfile?.biometricEnabled
                      ? "toggle-right"
                      : "toggle-left"
                  }
                  size={32}
                  color={
                    adminProfile?.biometricEnabled
                      ? ADMIN_COLORS.success
                      : ADMIN_COLORS.textSecondary
                  }
                />
              </Pressable>
            </View>
          </View>

          {/* Update Password */}
          <ThemedText
            type="h2"
            style={[styles.sectionTitle, { marginTop: Spacing.xl }]}
          >
            Update Admin Password
          </ThemedText>
          <View
            style={[
              styles.formCard,
              {
                backgroundColor: ADMIN_COLORS.card,
                borderColor: ADMIN_COLORS.border,
              },
            ]}
          >
            <ThemedText type="body" style={styles.inputLabel}>
              Current Password
            </ThemedText>
            <TextInput
              secureTextEntry
              value={oldPassword}
              onChangeText={setOldPassword}
              style={[styles.formInputLine, { color: ADMIN_COLORS.text }]}
              placeholder="••••••••"
              placeholderTextColor={ADMIN_COLORS.textSecondary}
            />

            <ThemedText
              type="body"
              style={[styles.inputLabel, { marginTop: Spacing.md }]}
            >
              New Password
            </ThemedText>
            <TextInput
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              style={[styles.formInputLine, { color: ADMIN_COLORS.text }]}
              placeholder="••••••••"
              placeholderTextColor={ADMIN_COLORS.textSecondary}
            />

            <ThemedText
              type="body"
              style={[styles.inputLabel, { marginTop: Spacing.md }]}
            >
              Confirm New Password
            </ThemedText>
            <TextInput
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={[styles.formInputLine, { color: ADMIN_COLORS.text }]}
              placeholder="••••••••"
              placeholderTextColor={ADMIN_COLORS.textSecondary}
            />

            <Pressable
              onPress={handleChangePassword}
              disabled={isSavingPassword}
              style={[
                styles.saveBtn,
                { backgroundColor: ADMIN_COLORS.primary },
              ]}
            >
              {isSavingPassword ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText
                  type="body"
                  style={{ color: "#FFFFFF", fontWeight: "700" }}
                >
                  Save Password Changes
                </ThemedText>
              )}
            </Pressable>
          </View>

          {/* Login History */}
          <ThemedText
            type="h2"
            style={[styles.sectionTitle, { marginTop: Spacing.xl }]}
          >
            Device Login History
          </ThemedText>
          <View
            style={{
              borderRadius: BorderRadius.md,
              borderWidth: 1,
              borderColor: ADMIN_COLORS.border,
              overflow: "hidden",
              backgroundColor: ADMIN_COLORS.card,
            }}
          >
            {!adminProfile?.loginHistory ||
            adminProfile.loginHistory.length === 0 ? (
              <View style={{ padding: Spacing.xl, alignItems: "center" }}>
                <ThemedText style={{ color: ADMIN_COLORS.textSecondary }}>
                  No login history logged yet.
                </ThemedText>
              </View>
            ) : (
              adminProfile.loginHistory
                .slice(0, 10)
                .map((log: any, index: number) => (
                  <View
                    key={log._id || index}
                    style={{
                      padding: Spacing.lg,
                      borderBottomWidth:
                        index <
                        Math.min(adminProfile.loginHistory.length, 10) - 1
                          ? 1
                          : 0,
                      borderBottomColor: ADMIN_COLORS.border,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <ThemedText
                        style={{
                          fontWeight: "700",
                          color: ADMIN_COLORS.primary,
                        }}
                      >
                        {log.deviceName || "Unknown Device"} (
                        {log.deviceOs || "Unknown OS"})
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{ color: ADMIN_COLORS.textSecondary }}
                      >
                        {new Date(log.loginTime).toLocaleDateString()}
                      </ThemedText>
                    </View>
                    <ThemedText
                      type="body"
                      style={{ color: "#FFF", marginTop: 4 }}
                    >
                      Browser: {log.deviceBrowser || "N/A"}
                    </ThemedText>
                    <ThemedText
                      type="small"
                      style={{
                        color: ADMIN_COLORS.textSecondary,
                        marginTop: 4,
                      }}
                    >
                      📍 Location: {log.location || "Mumbai, India"} | IP:{" "}
                      {log.ipAddress || "::1"}
                    </ThemedText>
                  </View>
                ))
            )}
          </View>

          {/* Admin Activity Logs */}
          <ThemedText
            type="h2"
            style={[styles.sectionTitle, { marginTop: Spacing.xl }]}
          >
            Recent Platform Activity Logs
          </ThemedText>
          <View
            style={[styles.planCard, { backgroundColor: ADMIN_COLORS.card }]}
          >
            {activityFeed.length > 0 ? (
              activityFeed.slice(0, 10).map((item, idx) => (
                <View key={item.id} style={{ paddingVertical: Spacing.sm }}>
                  {idx > 0 && (
                    <View
                      style={[
                        styles.divider,
                        {
                          backgroundColor: ADMIN_COLORS.border,
                          marginVertical: Spacing.xs,
                        },
                      ]}
                    />
                  )}
                  <View
                    style={{ flexDirection: "row", alignItems: "flex-start" }}
                  >
                    <Feather
                      name="activity"
                      size={14}
                      color={ADMIN_COLORS.primary}
                      style={{ marginRight: Spacing.sm, marginTop: 2 }}
                    />
                    <View style={{ flex: 1 }}>
                      <ThemedText
                        type="body"
                        style={{ color: ADMIN_COLORS.text }}
                      >
                        {item.message}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{
                          color: ADMIN_COLORS.textSecondary,
                          marginTop: 2,
                        }}
                      >
                        {new Date(item.timestamp).toLocaleString()}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <ThemedText type="body" style={styles.noDataText}>
                No platform activity recorded yet.
              </ThemedText>
            )}
          </View>
        </ScrollView>
      )}

      {/* ─── MODALS ───────────────────────────────────────────────────────────── */}

      {/* 1. Custom styled Glassmorphic Delete Confirmation Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.alertModalContainer,
              {
                backgroundColor: ADMIN_COLORS.card,
                borderColor: ADMIN_COLORS.border,
              },
            ]}
          >
            <Feather
              name="alert-triangle"
              size={40}
              color={ADMIN_COLORS.danger}
              style={{ marginBottom: Spacing.md }}
            />
            <ThemedText
              type="h2"
              style={{
                color: "#FFFFFF",
                textAlign: "center",
                marginBottom: Spacing.xs,
              }}
            >
              Confirm Deletion
            </ThemedText>
            <ThemedText
              type="body"
              style={{
                color: ADMIN_COLORS.textSecondary,
                textAlign: "center",
                marginBottom: Spacing.xl,
              }}
            >
              Are you sure you want to delete this item? This action is
              permanent and cannot be undone.
            </ThemedText>
            <View style={styles.modalBtnRow}>
              <Pressable
                onPress={() => setDeleteModalVisible(false)}
                style={[
                  styles.modalBtn,
                  { backgroundColor: ADMIN_COLORS.border },
                ]}
              >
                <ThemedText type="body" style={{ color: ADMIN_COLORS.text }}>
                  Cancel
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handleExecuteDelete}
                style={[
                  styles.modalBtn,
                  { backgroundColor: ADMIN_COLORS.danger },
                ]}
              >
                <ThemedText
                  type="body"
                  style={{ color: "#FFFFFF", fontWeight: "700" }}
                >
                  Delete
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 2. Edit User Modal */}
      <Modal visible={editUserModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.editorModalContainer,
              { backgroundColor: ADMIN_COLORS.card },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <ThemedText type="h2" style={{ color: "#FFFFFF" }}>
                Edit System User
              </ThemedText>
              <Pressable onPress={() => setEditUserModalVisible(false)}>
                <Feather name="x" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
            <ScrollView style={{ paddingHorizontal: Spacing.xl }}>
              <ThemedText type="body" style={styles.inputLabel}>
                Full Name
              </ThemedText>
              <TextInput
                value={editUserName}
                onChangeText={setEditUserName}
                style={[styles.formInputLine, { color: "#FFF" }]}
              />

              <ThemedText
                type="body"
                style={[styles.inputLabel, { marginTop: Spacing.md }]}
              >
                phone Number
              </ThemedText>
              <TextInput
                value={editUserPhone}
                onChangeText={setEditUserPhone}
                style={[styles.formInputLine, { color: "#FFF" }]}
              />

              <ThemedText
                type="body"
                style={[styles.inputLabel, { marginTop: Spacing.md }]}
              >
                Email Address
              </ThemedText>
              <TextInput
                value={editUserEmail}
                onChangeText={setEditUserEmail}
                style={[styles.formInputLine, { color: "#FFF" }]}
              />

              <ThemedText
                type="body"
                style={[styles.inputLabel, { marginTop: Spacing.md }]}
              >
                User Role (contractor / builder / supervisor)
              </ThemedText>
              <TextInput
                value={editUserRole}
                onChangeText={setEditUserRole}
                style={[styles.formInputLine, { color: "#FFF" }]}
              />

              <ThemedText
                type="body"
                style={[styles.inputLabel, { marginTop: Spacing.md }]}
              >
                Reset Password (leave empty to keep current)
              </ThemedText>
              <TextInput
                secureTextEntry
                placeholder="Enter new password"
                placeholderTextColor={ADMIN_COLORS.textSecondary}
                value={editUserPassword}
                onChangeText={setEditUserPassword}
                style={[styles.formInputLine, { color: "#FFF" }]}
              />

              <View style={[styles.checkboxRow, { marginTop: Spacing.md }]}>
                <Pressable
                  onPress={() => setEditUserIsActive(!editUserIsActive)}
                  style={styles.checkboxTrack}
                >
                  <Feather
                    name={editUserIsActive ? "check-square" : "square"}
                    size={20}
                    color={
                      editUserIsActive
                        ? ADMIN_COLORS.success
                        : ADMIN_COLORS.textSecondary
                    }
                  />
                  <ThemedText
                    type="body"
                    style={{ color: "#FFF", marginLeft: Spacing.sm }}
                  >
                    Active Account Status
                  </ThemedText>
                </Pressable>
              </View>

              <Pressable
                onPress={handleUpdateUser}
                style={[
                  styles.saveBtn,
                  {
                    backgroundColor: ADMIN_COLORS.primary,
                    marginVertical: Spacing.xl,
                  },
                ]}
              >
                <ThemedText
                  type="body"
                  style={{ color: "#FFF", fontWeight: "700" }}
                >
                  Save User Changes
                </ThemedText>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 3. Edit Worker Modal */}
      <Modal visible={editWorkerModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.editorModalContainer,
              { backgroundColor: ADMIN_COLORS.card },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <ThemedText type="h2" style={{ color: "#FFFFFF" }}>
                Edit Worker Details
              </ThemedText>
              <Pressable onPress={() => setEditWorkerModalVisible(false)}>
                <Feather name="x" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
            <ScrollView style={{ paddingHorizontal: Spacing.xl }}>
              <ThemedText type="body" style={styles.inputLabel}>
                Name
              </ThemedText>
              <TextInput
                value={editWorkerName}
                onChangeText={setEditWorkerName}
                style={[styles.formInputLine, { color: "#FFF" }]}
              />

              <ThemedText
                type="body"
                style={[styles.inputLabel, { marginTop: Spacing.md }]}
              >
                phone
              </ThemedText>
              <TextInput
                value={editWorkerPhone}
                onChangeText={setEditWorkerPhone}
                style={[styles.formInputLine, { color: "#FFF" }]}
              />

              <ThemedText
                type="body"
                style={[styles.inputLabel, { marginTop: Spacing.md }]}
              >
                Daily Wage Rate (₹)
              </ThemedText>
              <TextInput
                value={editWorkerRate}
                onChangeText={setEditWorkerRate}
                keyboardType="numeric"
                style={[styles.formInputLine, { color: "#FFF" }]}
              />

              <ThemedText
                type="body"
                style={[styles.inputLabel, { marginTop: Spacing.md }]}
              >
                Category (e.g. Skilled, Helper)
              </ThemedText>
              <TextInput
                value={editWorkerCategory}
                onChangeText={setEditWorkerCategory}
                style={[styles.formInputLine, { color: "#FFF" }]}
              />

              <ThemedText
                type="body"
                style={[styles.inputLabel, { marginTop: Spacing.md }]}
              >
                Address
              </ThemedText>
              <TextInput
                value={editWorkerAddress}
                onChangeText={setEditWorkerAddress}
                style={[styles.formInputLine, { color: "#FFF" }]}
              />

              <ThemedText
                type="body"
                style={[styles.inputLabel, { marginTop: Spacing.md }]}
              >
                Notes
              </ThemedText>
              <TextInput
                value={editWorkerNotes}
                onChangeText={setEditWorkerNotes}
                style={[styles.formInputLine, { color: "#FFF" }]}
              />

              <Pressable
                onPress={handleUpdateWorker}
                style={[
                  styles.saveBtn,
                  {
                    backgroundColor: ADMIN_COLORS.primary,
                    marginVertical: Spacing.xl,
                  },
                ]}
              >
                <ThemedText
                  type="body"
                  style={{ color: "#FFF", fontWeight: "700" }}
                >
                  Save Worker Details
                </ThemedText>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 4. Edit Attendance Modal */}
      <Modal
        visible={editAttendanceModalVisible}
        transparent
        animationType="slide"
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.editorModalContainer,
              { backgroundColor: ADMIN_COLORS.card, height: 260 },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <ThemedText type="h2" style={{ color: "#FFFFFF" }}>
                Modify Attendance Record
              </ThemedText>
              <Pressable onPress={() => setEditAttendanceModalVisible(false)}>
                <Feather name="x" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: Spacing.xl }}>
              <ThemedText type="body" style={styles.inputLabel}>
                Attendance Status (P = Present, A = Absent, H = Half Day)
              </ThemedText>
              <TextInput
                value={editAttendanceValue}
                onChangeText={setEditAttendanceValue}
                style={[styles.formInputLine, { color: "#FFF" }]}
              />

              <Pressable
                onPress={handleUpdateAttendance}
                style={[
                  styles.saveBtn,
                  {
                    backgroundColor: ADMIN_COLORS.primary,
                    marginTop: Spacing.lg,
                  },
                ]}
              >
                <ThemedText
                  type="body"
                  style={{ color: "#FFF", fontWeight: "700" }}
                >
                  Save Record
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 5. Edit Payment Modal */}
      <Modal
        visible={editPaymentModalVisible}
        transparent
        animationType="slide"
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.editorModalContainer,
              { backgroundColor: ADMIN_COLORS.card, height: 350 },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <ThemedText type="h2" style={{ color: "#FFFFFF" }}>
                Edit Payment Transaction
              </ThemedText>
              <Pressable onPress={() => setEditPaymentModalVisible(false)}>
                <Feather name="x" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: Spacing.xl }}>
              <ThemedText type="body" style={styles.inputLabel}>
                Amount (₹)
              </ThemedText>
              <TextInput
                value={editPaymentAmount}
                onChangeText={setEditPaymentAmount}
                keyboardType="numeric"
                style={[styles.formInputLine, { color: "#FFF" }]}
              />

              <ThemedText
                type="body"
                style={[styles.inputLabel, { marginTop: Spacing.md }]}
              >
                Note
              </ThemedText>
              <TextInput
                value={editPaymentNote}
                onChangeText={setEditPaymentNote}
                style={[styles.formInputLine, { color: "#FFF" }]}
              />

              <Pressable
                onPress={handleUpdatePayment}
                style={[
                  styles.saveBtn,
                  {
                    backgroundColor: ADMIN_COLORS.primary,
                    marginTop: Spacing.xl,
                  },
                ]}
              >
                <ThemedText
                  type="body"
                  style={{ color: "#FFF", fontWeight: "700" }}
                >
                  Save Payment Changes
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 6. Edit Profile Details Modal */}
      <Modal
        visible={editProfileModalVisible}
        transparent
        animationType="slide"
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.editorModalContainer,
              { backgroundColor: ADMIN_COLORS.card, height: 420 },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <ThemedText type="h2" style={{ color: "#FFFFFF" }}>
                Edit Admin Profile
              </ThemedText>
              <Pressable onPress={() => setEditProfileModalVisible(false)}>
                <Feather name="x" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: Spacing.xl }}>
              <ThemedText type="body" style={styles.inputLabel}>
                Full Name
              </ThemedText>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                style={[styles.formInputLine, { color: "#FFF" }]}
              />

              <ThemedText
                type="body"
                style={[styles.inputLabel, { marginTop: Spacing.md }]}
              >
                Email Address
              </ThemedText>
              <TextInput
                value={editEmail}
                onChangeText={setEditEmail}
                keyboardType="email-address"
                style={[styles.formInputLine, { color: "#FFF" }]}
              />

              <ThemedText
                type="body"
                style={[styles.inputLabel, { marginTop: Spacing.md }]}
              >
                Mobile Number
              </ThemedText>
              <TextInput
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                style={[styles.formInputLine, { color: "#FFF" }]}
              />

              <Pressable
                onPress={handleUpdateProfile}
                disabled={isSavingProfile}
                style={[
                  styles.saveBtn,
                  {
                    backgroundColor: ADMIN_COLORS.primary,
                    marginTop: Spacing.xl,
                  },
                ]}
              >
                {isSavingProfile ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText
                    type="body"
                    style={{ color: "#FFF", fontWeight: "700" }}
                  >
                    Save Profile Details
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 7. Edit Profile Picture Modal */}
      <Modal
        visible={editProfilePictureModalVisible}
        transparent
        animationType="slide"
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.editorModalContainer,
              { backgroundColor: ADMIN_COLORS.card, height: 400 },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <ThemedText type="h2" style={{ color: "#FFFFFF" }}>
                Update Profile Picture
              </ThemedText>
              <Pressable
                onPress={() => setEditProfilePictureModalVisible(false)}
              >
                <Feather name="x" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: Spacing.xl }}>
              <ThemedText type="body" style={styles.inputLabel}>
                Choose from Premium Avatars
              </ThemedText>
              <View style={styles.presetsContainer}>
                {[
                  { icon: "👑", label: "Super Root" },
                  { icon: "🛡️", label: "Security" },
                  { icon: "🚀", label: "Tech Lead" },
                  { icon: "💼", label: "Director" },
                  { icon: "🏢", label: "Corporate" },
                  { icon: "👤", label: "Standard" },
                ].map((item, index) => (
                  <Pressable
                    key={index}
                    onPress={() => handleUpdateProfilePicture(item.icon)}
                    style={[
                      styles.presetAvatar,
                      { borderColor: ADMIN_COLORS.border },
                    ]}
                  >
                    <ThemedText type="h1">{item.icon}</ThemedText>
                    <ThemedText
                      type="small"
                      style={{
                        color: ADMIN_COLORS.textSecondary,
                        fontSize: 10,
                        marginTop: 4,
                      }}
                    >
                      {item.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <ThemedText
                type="body"
                style={[styles.inputLabel, { marginTop: Spacing.lg }]}
              >
                Or upload from device
              </ThemedText>
              <Pressable
                onPress={handlePickImage}
                disabled={isSavingProfile}
                style={[
                  styles.saveBtn,
                  {
                    backgroundColor: ADMIN_COLORS.primary,
                    marginTop: Spacing.sm,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                ]}
              >
                <Feather
                  name="image"
                  size={16}
                  color="#FFF"
                  style={{ marginRight: Spacing.sm }}
                />
                <ThemedText
                  type="body"
                  style={{ color: "#FFF", fontWeight: "700" }}
                >
                  Select from Gallery
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ADMIN_COLORS.background,
  },
  adminHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
  },
  dashboardTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: ADMIN_COLORS.text,
  },
  connectionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.xs,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ADMIN_COLORS.card,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  tabRowWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
    paddingVertical: Spacing.md,
  },
  tabScroll: {
    paddingHorizontal: Spacing.md,
    gap: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    borderRadius: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  financialRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  financialCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.md,
    backgroundColor: ADMIN_COLORS.card,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: ADMIN_COLORS.text,
    marginBottom: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  pulseContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  pulseIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ADMIN_COLORS.success,
    marginRight: Spacing.xs,
  },
  planCard: {
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
  },
  planRowItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  divider: {
    height: 1,
    width: "100%",
  },
  activityFeedItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing.md,
  },
  noDataText: {
    color: ADMIN_COLORS.textSecondary,
    textAlign: "center",
    paddingVertical: Spacing.xl,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ADMIN_COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
  },
  userCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardInfo: {
    marginBottom: Spacing.md,
  },
  userMainRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  roleBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  cardActionBtn: {
    flex: 1,
    flexDirection: "row",
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfoCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.xl,
    alignItems: "center",
  },
  shieldIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.xl,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: ADMIN_COLORS.textSecondary,
    marginBottom: Spacing.xs,
  },
  formInputLine: {
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: ADMIN_COLORS.border,
    fontSize: 14,
    marginBottom: Spacing.md,
    paddingHorizontal: 4,
  },
  saveBtn: {
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      web: {
        position: "fixed" as any,
        width: "100%" as any,
        height: "100%" as any,
        zIndex: 9999,
      },
    }),
  },
  alertModalContainer: {
    width: 320,
    padding: Spacing.xl,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  editorModalContainer: {
    width: "100%",
    maxWidth: 450,
    height: 520,
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
    position: "absolute",
    bottom: 0,
    paddingTop: Spacing.xl,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkboxTrack: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileHeaderCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: Spacing.md,
  },
  avatarImgContainer: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: ADMIN_COLORS.primary,
    overflow: "hidden",
  },
  avatarInitials: {
    fontSize: 48,
    textAlign: "center",
  },
  editPhotoBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: ADMIN_COLORS.card,
  },
  profileTextDetails: {
    alignItems: "center",
    width: "100%",
  },
  shortcutGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  shortcutBtn: {
    flexGrow: 1,
    flexShrink: 0,
    minWidth: 140,
    height: 70,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  shortcutBtnText: {
    color: ADMIN_COLORS.text,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 4,
  },
  notificationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    backgroundColor: ADMIN_COLORS.background,
    borderLeftWidth: 4,
    borderRadius: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  menuItemText: {
    flex: 1,
    color: ADMIN_COLORS.text,
    marginLeft: Spacing.md,
    fontSize: 14,
    fontWeight: "500",
  },
  securityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  securityTextContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  presetsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: Spacing.sm,
    justifyContent: "center",
  },
  presetAvatar: {
    width: 70,
    height: 70,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ADMIN_COLORS.background,
  },
});
