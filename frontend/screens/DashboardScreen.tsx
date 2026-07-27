import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Platform,
  Modal,
  Alert,
  TextInput,
  Switch,
  Animated,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { WebView } from "react-native-webview";
import SettingsDrawer from "@/components/SettingsDrawer";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import { storage, Project, Worker, AttendanceRecord, AttendanceValue, authenticatedFetch, API_URL } from "@/utils/storage";
import { Spacing, BorderRadius, Shadows, Colors } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface PrimeBillingTransaction {
  date: string;
  planName: string;
  amount: number;
  paymentId: string;
}

export default function DashboardScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { socket, connectSocket } = useSocket();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);

  // States
  const [loading, setLoading] = useState(true);
  const [activeSite, setActiveSite] = useState<Project | null>(null);
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [workersList, setWorkersList] = useState<Worker[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [showSubModal, setShowSubModal] = useState(false);
  const [selectedPlanOption, setSelectedPlanOption] = useState<"standard" | "pro">("standard");
  const [currentPlan, setCurrentPlan] = useState<"free" | "professional" | "business">("free");
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [showRazorpayModal, setShowRazorpayModal] = useState(false);
  const [razorpayHtml, setRazorpayHtml] = useState("");
  const [billingHistory, setBillingHistory] = useState<PrimeBillingTransaction[]>([]);
  const [gpsCheckInActive, setGpsCheckInActive] = useState(false);

  // Undo Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [lastAction, setLastAction] = useState<{
    type: "single" | "bulk";
    workerId?: string;
    prevValue: string; // JSON string for bulk, or string value for single
  } | null>(null);
  const toastFadeAnim = useRef(new Animated.Value(0)).current;

  // Gamification & insights fallbacks
  const [streakCount, setStreakCount] = useState(5);
  const [smartInsight, setSmartInsight] = useState("Attendance dropped 15% vs last Thursday");

  // Custom interactive attendance modal states
  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
  const [selectedWorkerForAttendance, setSelectedWorkerForAttendance] = useState<Worker | null>(null);
  const [modalAttendanceValue, setModalAttendanceValue] = useState<"P" | "A" | "H" | "OT" | "">("");
  const [modalAdvanceAmount, setModalAdvanceAmount] = useState("");
  const [modalOvertimeWage, setModalOvertimeWage] = useState("");
  const [modalOvertimeHours, setModalOvertimeHours] = useState("");

  // Statistics
  const [stats, setStats] = useState({
    totalWorkers: 0,
    present: 0,
    absent: 0,
    halfDay: 0,
    overtime: 0,
    rate: 0,
  });

  // Current date strings
  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const loadBillingHistory = async () => {
    try {
      const saved = await AsyncStorage.getItem("@haajari/prime_billing_history");
      if (saved) {
        setBillingHistory(JSON.parse(saved));
      } else {
        setBillingHistory([]);
      }
    } catch (e) {
      console.warn("Failed to load billing history:", e);
    }
  };

  const loadDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const projects = await storage.getProjects();
      const workers = await storage.getWorkers();

      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth();
      const todayDay = today.getDate();

      const attendance = await storage.getAttendanceForMonth(todayYear, todayMonth);

      const auth = await storage.getAuth();
      if (auth?.plan) {
        setCurrentPlan(auth.plan);
      } else if (user?.plan) {
        setCurrentPlan(user.plan);
      }

      setProjectsList(projects);
      setWorkersList(workers);
      setAttendanceRecords(attendance);
      await loadBillingHistory();

      // Find first active site/project
      const active = projects.find((p) => p.status === "active") || projects[0] || null;
      setActiveSite(active);

      // Filter workers assigned to the active site (or use all workers if no active site)
      const siteWorkers = active ? workers.filter(w => w.projectId === active.id) : workers;
      const totalWorkers = siteWorkers.length;

      const todayAttendance = attendance.filter(
        (r) => r.year === todayYear && r.month === todayMonth && r.day === todayDay
      );

      let presentCount = 0;
      let halfDayCount = 0;
      let overtimeCount = 0;

      todayAttendance.forEach((rec) => {
        const belongsToScope = siteWorkers.some(sw => sw.id === rec.workerId);
        if (belongsToScope) {
          if (rec.value === "P") presentCount++;
          else if (rec.value === "H") halfDayCount++;
          else if (rec.value === "OT") overtimeCount++;
        }
      });

      // MATH CONSISTENCY ENFORCEMENT:
      // Any unmarked worker is automatically counted as Absent.
      // Total = Present + Half Day + Overtime + Absent.
      const absentCount = totalWorkers - presentCount - halfDayCount - overtimeCount;

      const rate = totalWorkers > 0 ? Math.round(((presentCount + halfDayCount + overtimeCount) / totalWorkers) * 100) : 0;

      setStats({
        totalWorkers,
        present: presentCount,
        absent: Math.max(0, absentCount),
        halfDay: halfDayCount,
        overtime: overtimeCount,
        rate: totalWorkers > 0 ? rate : 0,
      });

      // Smart dynamic insights based on statistics
      if (totalWorkers > 0) {
        if (rate >= 85) {
          setSmartInsight("Attendance is high today 🔥 Great project momentum!");
        } else if (rate < 50) {
          setSmartInsight("⚠️ Alert: Critical labor shortage! Less than 50% on site.");
        } else {
          setSmartInsight("Attendance drop: 2 workers took half-day today.");
        }
      } else {
        setSmartInsight("Welcome! Register workers and sites to view live insights.");
      }

    } catch (error) {
      console.warn("Failed to load dashboard statistics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    connectSocket();
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      loadDashboardData(true);
    };
    socket.on("admin_dashboard_update", handleUpdate);
    socket.on("admin_activity", handleUpdate);
    return () => {
      socket.off("admin_dashboard_update", handleUpdate);
      socket.off("admin_activity", handleUpdate);
    };
  }, [socket]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [activeSite?.id])
  );

  // Toast animation handler
  useEffect(() => {
    if (showToast) {
      Animated.timing(toastFadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        hideToast();
      }, 5000); // disappear after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const hideToast = () => {
    Animated.timing(toastFadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowToast(false);
      setLastAction(null);
    });
  };

  const deleteAttendanceLocally = async (workerId: string, year: number, month: number, day: number) => {
    const allRecords = await storage.getAttendance();
    const filtered = allRecords.filter(
      r => !(r.workerId === workerId && r.year === year && r.month === month && r.day === day)
    );
    await storage.setAttendance(filtered);
  };

  // Quick Marking actions
  const handleMarkPresent = async (workerId: string) => {
    triggerHaptic();
    try {
      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth();
      const todayDay = today.getDate();

      const existingIdx = attendanceRecords.findIndex(
        (r) => r.workerId === workerId && r.year === todayYear && r.month === todayMonth && r.day === todayDay
      );

      let prevVal: AttendanceValue | "" = "";
      let newVal = "P";

      if (existingIdx !== -1) {
        prevVal = attendanceRecords[existingIdx].value;
        if (prevVal === "P") {
          newVal = ""; // toggle to unmarked
        }
      }

      setLastAction({ workerId, type: "single", prevValue: String(prevVal) });

      if (newVal === "") {
        if (existingIdx !== -1) {
          await deleteAttendanceLocally(workerId, todayYear, todayMonth, todayDay);
          const updated = [...attendanceRecords];
          updated.splice(existingIdx, 1);
          setAttendanceRecords(updated);
        }
      } else {
        const newRecord: AttendanceRecord = {
          workerId,
          projectId: activeSite?.id || undefined,
          year: todayYear,
          month: todayMonth,
          day: todayDay,
          value: "P",
        };
        await storage.setAttendanceRecord(newRecord);
        const updated = [...attendanceRecords];
        if (existingIdx !== -1) {
          updated[existingIdx] = newRecord;
        } else {
          updated.push(newRecord);
        }
        setAttendanceRecords(updated);
      }

      await loadDashboardData(true);
      const workerName = workersList.find(w => w.id === workerId)?.name || "Worker";
      setToastMessage(newVal === "" ? `Cleared attendance for ${workerName}` : `Marked ${workerName} as Present`);
      setShowToast(true);

    } catch (e) {
      console.warn("Failed to mark attendance:", e);
    }
  };

  const handleMarkOptions = (workerId: string) => {
    triggerHaptic();
    const worker = workersList.find(w => w.id === workerId);
    if (!worker) return;

    const todayDay = today.getDate();
    const existingRecord = attendanceRecords.find(
      (r) => r.workerId === workerId && r.day === todayDay
    );

    setSelectedWorkerForAttendance(worker);
    setModalAttendanceValue(existingRecord ? (existingRecord.value as any) : "");
    setModalAdvanceAmount(existingRecord && existingRecord.customWage ? String(existingRecord.customWage) : "");
    setModalOvertimeWage(existingRecord && existingRecord.overtimeWage ? String(existingRecord.overtimeWage) : "");
    setModalOvertimeHours(existingRecord && existingRecord.overtimeHours ? String(existingRecord.overtimeHours) : "");
    
    setAttendanceModalVisible(true);
  };

  const handleSaveAttendanceModal = async () => {
    if (!selectedWorkerForAttendance) return;
    const workerId = selectedWorkerForAttendance.id;
    const val = modalAttendanceValue;
    
    try {
      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth();
      const todayDay = today.getDate();

      const existingIdx = attendanceRecords.findIndex(
        (r) => r.workerId === workerId && r.year === todayYear && r.month === todayMonth && r.day === todayDay
      );

      const prevVal = existingIdx !== -1 ? attendanceRecords[existingIdx].value : "";
      setLastAction({ workerId, type: "single", prevValue: String(prevVal) });

      if (val === "") {
        if (existingIdx !== -1) {
          await deleteAttendanceLocally(workerId, todayYear, todayMonth, todayDay);
          const updated = [...attendanceRecords];
          updated.splice(existingIdx, 1);
          setAttendanceRecords(updated);
        }
      } else {
        const adv = modalAdvanceAmount ? parseFloat(modalAdvanceAmount) : undefined;
        const otW = modalOvertimeWage ? parseFloat(modalOvertimeWage) : undefined;
        const otH = modalOvertimeHours ? parseFloat(modalOvertimeHours) : undefined;
        
        const newRecord: AttendanceRecord = {
          workerId,
          projectId: activeSite?.id || undefined,
          year: todayYear,
          month: todayMonth,
          day: todayDay,
          value: val as any,
          customWage: adv,
          overtimeWage: otW,
          overtimeHours: otH,
        };
        
        await storage.setAttendanceRecord(newRecord);
        const updated = [...attendanceRecords];
        if (existingIdx !== -1) {
          updated[existingIdx] = newRecord;
        } else {
          updated.push(newRecord);
        }
        setAttendanceRecords(updated);
      }

      await loadDashboardData(true);
      setAttendanceModalVisible(false);
      
      const workerName = selectedWorkerForAttendance.name;
      let statusLabel = "Present";
      if (val === "H") statusLabel = "Half Day";
      else if (val === "OT") statusLabel = "Overtime";
      else if (val === "A") statusLabel = "Absent";
      else if (val === "") statusLabel = "Unmarked";

      setToastMessage(`Marked ${workerName} as ${statusLabel}`);
      setShowToast(true);
    } catch (e) {
      console.warn("Failed to save attendance:", e);
    }
  };

  const updateAttendanceValue = async (workerId: string, val: string) => {
    try {
      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth();
      const todayDay = today.getDate();

      const existingIdx = attendanceRecords.findIndex(
        (r) => r.workerId === workerId && r.year === todayYear && r.month === todayMonth && r.day === todayDay
      );

      const prevVal = existingIdx !== -1 ? attendanceRecords[existingIdx].value : "";
      setLastAction({ workerId, type: "single", prevValue: String(prevVal) });

      if (val === "") {
        if (existingIdx !== -1) {
          await deleteAttendanceLocally(workerId, todayYear, todayMonth, todayDay);
          const updated = [...attendanceRecords];
          updated.splice(existingIdx, 1);
          setAttendanceRecords(updated);
        }
      } else {
        const newRecord: AttendanceRecord = {
          workerId,
          projectId: activeSite?.id || undefined,
          year: todayYear,
          month: todayMonth,
          day: todayDay,
          value: val as any,
        };
        await storage.setAttendanceRecord(newRecord);
        const updated = [...attendanceRecords];
        if (existingIdx !== -1) {
          updated[existingIdx] = newRecord;
        } else {
          updated.push(newRecord);
        }
        setAttendanceRecords(updated);
      }

      await loadDashboardData(true);
      const workerName = workersList.find(w => w.id === workerId)?.name || "Worker";
      let statusLabel = "Present";
      if (val === "H") statusLabel = "Half Day";
      else if (val === "OT") statusLabel = "Overtime";
      else if (val === "A") statusLabel = "Absent";
      else if (val === "") statusLabel = "Unmarked";

      setToastMessage(`Marked ${workerName} as ${statusLabel}`);
      setShowToast(true);
    } catch (e) {
      console.warn("Failed to update attendance value:", e);
    }
  };

  const handleMarkAllPresent = async () => {
    triggerHaptic();
    try {
      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth();
      const todayDay = today.getDate();

      const siteWorkers = activeSite
        ? workersList.filter(w => w.projectId === activeSite.id)
        : workersList;

      if (siteWorkers.length === 0) {
        Alert.alert("No Workers", "There are no workers registered to mark.");
        return;
      }

      const prevRecords = [...attendanceRecords];
      setLastAction({ type: "bulk", prevValue: JSON.stringify(prevRecords) });

      const updated = [...attendanceRecords];

      for (const worker of siteWorkers) {
        const idx = updated.findIndex(
          (r) => r.workerId === worker.id && r.year === todayYear && r.month === todayMonth && r.day === todayDay
        );

        const newRecord: AttendanceRecord = {
          workerId: worker.id,
          projectId: activeSite?.id || undefined,
          year: todayYear,
          month: todayMonth,
          day: todayDay,
          value: "P",
        };
        await storage.setAttendanceRecord(newRecord);

        if (idx !== -1) {
          updated[idx] = newRecord;
        } else {
          updated.push(newRecord);
        }
      }

      setAttendanceRecords(updated);
      await loadDashboardData(true);
      setToastMessage("Marked all workers as Present");
      setShowToast(true);
    } catch (e) {
      console.warn("Bulk mark failed:", e);
    }
  };

  const handleUndo = async () => {
    triggerHaptic();
    if (!lastAction) return;

    try {
      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth();
      const todayDay = today.getDate();

      if (lastAction.type === "bulk") {
        const prevRecords = JSON.parse(lastAction.prevValue) as AttendanceRecord[];

        const siteWorkers = activeSite
          ? workersList.filter(w => w.projectId === activeSite.id)
          : workersList;

        for (const worker of siteWorkers) {
          await deleteAttendanceLocally(worker.id, todayYear, todayMonth, todayDay);
        }

        for (const rec of prevRecords) {
          await storage.setAttendanceRecord(rec);
        }

        setAttendanceRecords(prevRecords);
        setLastAction(null);
        setShowToast(false);
        await loadDashboardData(true);
        Alert.alert("Undone", "Bulk action has been reverted.");
        return;
      }

      const { workerId, prevValue } = lastAction;
      if (!workerId) return;

      const existingIdx = attendanceRecords.findIndex(
        (r) => r.workerId === workerId && r.year === todayYear && r.month === todayMonth && r.day === todayDay
      );

      if (prevValue === "" || prevValue === "undefined") {
        if (existingIdx !== -1) {
          await deleteAttendanceLocally(workerId, todayYear, todayMonth, todayDay);
          const updated = [...attendanceRecords];
          updated.splice(existingIdx, 1);
          setAttendanceRecords(updated);
        }
      } else {
        const newRecord: AttendanceRecord = {
          workerId,
          projectId: activeSite?.id || undefined,
          year: todayYear,
          month: todayMonth,
          day: todayDay,
          value: prevValue as any,
        };
        await storage.setAttendanceRecord(newRecord);
        const updated = [...attendanceRecords];
        if (existingIdx !== -1) {
          updated[existingIdx] = newRecord;
        } else {
          updated.push(newRecord);
        }
        setAttendanceRecords(updated);
      }

      setLastAction(null);
      setShowToast(false);
      await loadDashboardData(true);
      Alert.alert("Undone", "Last action reverted successfully.");
    } catch (e) {
      console.warn("Undo failed:", e);
    }
  };

  const handleQuickAction = (action: string) => {
    triggerHaptic();
    if (action === "AddWorker") {
      navigation.navigate("AddWorker");
    } else if (action === "ProjectManagement") {
      navigation.navigate("ProjectManagement");
    } else if (action === "AttendanceDetail") {
      navigation.navigate("AttendanceDetail");
    } else if (action === "Reports") {
      navigation.navigate("ReportsTab");
    }
  };

  const generateRazorpayHtml = (plan: "standard" | "pro") => {
    const amount = plan === "standard" ? 99 : 399;
    const planName = plan === "standard" ? "PRIME Monthly Standard" : "PRIME Monthly Pro";
    const amountPaise = amount * 100;
    const email = user?.email || "contractor@example.com";
    const phone = user?.phone || "9999999999";
    const name = user?.name || "Contractor User";

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background-color: #F8FAFC;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
          }
          .card {
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            width: 100%;
            max-width: 400px;
            text-align: center;
          }
          h2 { margin-top: 0; color: #1E293B; }
          p { color: #64748B; font-size: 14px; margin-bottom: 24px; }
          .btn {
            background-color: #F59E0B;
            color: white;
            border: none;
            padding: 14px 24px;
            font-size: 16px;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            width: 100%;
            margin-bottom: 12px;
          }
          .btn-secondary {
            background-color: #E2E8F0;
            color: #475569;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Razorpay Secure Checkout</h2>
          <p>You are paying <strong>INR ${amount}</strong> for the <strong>${planName}</strong> subscription plan (Test Mode).</p>
          <button class="btn" onclick="payNow()">Pay with Razorpay</button>
          <button class="btn btn-secondary" onclick="cancelPay()">Cancel</button>
        </div>

        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <script>
          function payNow() {
            var options = {
              "key": "rzp_test_mock1234567890",
              "amount": "${amountPaise}",
              "currency": "INR",
              "name": "Haajari Manager",
              "description": "PRIME Subscription - ${planName}",
              "image": "https://haajari.com/logo.png",
              "handler": function (response){
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  status: "success",
                  razorpay_payment_id: response.razorpay_payment_id
                }));
              },
              "modal": {
                "ondismiss": function(){
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    status: "cancelled"
                  }));
                }
              },
              "prefill": {
                "name": "${name}",
                "email": "${email}",
                "contact": "${phone}"
              },
              "theme": {
                "color": "#F59E0B"
              }
            };
            var rzp = new Razorpay(options);
            rzp.open();
          }
          
          function cancelPay() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              status: "cancelled"
            }));
          }
        </script>
      </body>
      </html>
    `;
  };

  const handlePaymentResponse = async (dataStr: string) => {
    try {
      const data = JSON.parse(dataStr);
      setShowRazorpayModal(false);

      if (data.status === "success") {
        const chosenPlan = selectedPlanOption === "standard" ? "professional" : "business";
        const price = selectedPlanOption === "standard" ? 99 : 399;
        
        try {
          await authenticatedFetch(`${API_URL}/auth/upgrade`, {
            method: "PUT",
            body: JSON.stringify({ plan: chosenPlan }),
          });
        } catch (e) {
          console.warn("Backend sync failed, updated locally", e);
        }

        const auth = await storage.getAuth();
        if (auth) {
          await storage.setAuth({ ...auth, plan: chosenPlan });
        }
        setCurrentPlan(chosenPlan);

        const newTransaction = {
          date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
          planName: selectedPlanOption === "standard" ? "PRIME Standard (Monthly)" : "PRIME Pro (Monthly)",
          amount: price,
          paymentId: data.razorpay_payment_id || "pay_mock" + Math.random().toString(36).substring(7),
        };

        const updatedHistory = [newTransaction, ...billingHistory];
        setBillingHistory(updatedHistory);
        await AsyncStorage.setItem("@haajari/prime_billing_history", JSON.stringify(updatedHistory));

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Payment Successful", `Successfully upgraded to PRIME ${selectedPlanOption === "standard" ? "Standard" : "Pro"} (₹${price}/month)!`);
        setShowSubModal(false);
      } else if (data.status === "cancelled") {
        Alert.alert("Payment Cancelled", "The payment process was cancelled.");
      }
    } catch (err) {
      console.warn("Error parsing payment response:", err);
    }
  };

  // Filter display workers list
  const displayWorkers = activeSite
    ? workersList.filter(w => w.projectId === activeSite.id)
    : workersList;

  const todayDay = today.getDate();

  if (loading && workersList.length === 0) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </ThemedView>
    );
  }

  const siteName = activeSite ? activeSite.name : "No Active Site";
  const summaryStr = `Total: ${stats.totalWorkers} | Present: ${stats.present + stats.halfDay + stats.overtime} | Absent: ${stats.absent}`;

  return (
    <ThemedView style={styles.container}>
      {/* 1. Header Redesign (Date, Active Site Name, Worker-Count Summary) */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.headerTopRow}>
          <View style={[styles.headerTitleArea, { marginLeft: 0 }]}>
            <ThemedText style={styles.headerDate}>{formattedDate.toUpperCase()}</ThemedText>
            <ThemedText style={styles.headerSiteName} numberOfLines={1}>
              🏢 {siteName}
            </ThemedText>
          </View>
          {currentPlan !== "free" ? (
            <View style={styles.primeBadge}>
              <ThemedText style={styles.primeBadgeText}>PRIME</ThemedText>
            </View>
          ) : (
            <Pressable onPress={() => setShowSubModal(true)} style={styles.upgradeBadge}>
              <ThemedText style={styles.upgradeBadgeText}>UPGRADE</ThemedText>
            </Pressable>
          )}
        </View>

        <View style={styles.headerSummaryBar}>
          <ThemedText style={styles.summaryBarText}>
            👷 {stats.totalWorkers} Workers  |  🟢 {stats.present + stats.halfDay + stats.overtime} Active  |  🔴 {stats.absent} Absent
          </ThemedText>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Engagement Streak & Insight Banner */}
        <View style={styles.streakBannerRow}>
          <View style={styles.streakCard}>
            <ThemedText style={styles.streakText}>🔥 {streakCount}-Day Streak</ThemedText>
          </View>
          <View style={styles.insightCard}>
            <Feather name="trending-down" size={14} color="#F59E0B" />
            <ThemedText style={styles.insightText} numberOfLines={1}>{smartInsight}</ThemedText>
          </View>
        </View>

        {/* 2. Unified Card Summary (Today's Attendance + Active Site Info) */}
        <View style={styles.cardHeaderRow}>
          <ThemedText style={styles.cardSectionTitle}>Active Site Summary</ThemedText>
        </View>

        {!activeSite ? (
          <Pressable
            onPress={() => handleQuickAction("ProjectManagement")}
            style={styles.emptyStateCard}
          >
            <Feather name="map" size={32} color="#94A3B8" />
            <ThemedText style={styles.emptyStateText}>No active site — tap to set one up</ThemedText>
            <View style={styles.emptyStateBtn}>
              <ThemedText style={styles.emptyStateBtnText}>Create / Activate Site</ThemedText>
            </View>
          </Pressable>
        ) : (
          <View style={styles.unifiedCard}>
            <LinearGradient
              colors={["#1E293B", "#0F172A"]}
              style={styles.unifiedGradient}
            >
              <View style={styles.unifiedHeader}>
                <View>
                  <ThemedText style={styles.unifiedSiteTitle}>{activeSite.name}</ThemedText>
                  <ThemedText style={styles.unifiedSiteSub}>Location: {activeSite.location || "N/A"}</ThemedText>
                </View>
                <View style={styles.rateCircle}>
                  <ThemedText style={styles.ratePercent}>{stats.rate}%</ThemedText>
                  <ThemedText style={styles.rateLabel}>Rate</ThemedText>
                </View>
              </View>

              {/* Progress bar */}
              <View style={styles.barBg}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${stats.rate}%`,
                      backgroundColor: stats.rate < 50 ? "#EF4444" : stats.rate < 75 ? "#F59E0B" : "#10B981",
                    },
                  ]}
                />
              </View>

              <View style={styles.statsSummaryGrid}>
                <View style={styles.statsBox}>
                  <ThemedText style={styles.statsNumber}>{stats.totalWorkers}</ThemedText>
                  <ThemedText style={styles.statsLabel}>Total</ThemedText>
                </View>
                <View style={styles.statsBox}>
                  <ThemedText style={[styles.statsNumber, { color: "#10B981" }]}>{stats.present}</ThemedText>
                  <ThemedText style={styles.statsLabel}>Present</ThemedText>
                </View>
                <View style={styles.statsBox}>
                  <ThemedText style={[styles.statsNumber, { color: "#F59E0B" }]}>{stats.halfDay}</ThemedText>
                  <ThemedText style={styles.statsLabel}>Half Day</ThemedText>
                </View>
                <View style={styles.statsBox}>
                  <ThemedText style={[styles.statsNumber, { color: "#A855F7" }]}>{stats.overtime}</ThemedText>
                  <ThemedText style={styles.statsLabel}>Overtime</ThemedText>
                </View>
                <View style={styles.statsBox}>
                  <ThemedText style={[styles.statsNumber, { color: "#EF4444" }]}>{stats.absent}</ThemedText>
                  <ThemedText style={styles.statsLabel}>Absent</ThemedText>
                </View>
              </View>

              <View style={styles.siteInfoFooter}>
                <Feather name="calendar" size={13} color="#94A3B8" style={{ marginRight: 6 }} />
                <ThemedText style={styles.footerText}>
                  Est. Completion: {activeSite.endDate || "N/A"}
                </ThemedText>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Visually Dominant Quick Action Button */}
        <View style={{ marginVertical: Spacing.md }}>
          <Pressable
            style={styles.primaryMarkBtn}
            onPress={() => {
              triggerHaptic();
              scrollViewRef.current?.scrollTo({ y: 400, animated: true });
            }}
          >
            <Ionicons name="checkbox" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <ThemedText style={styles.primaryMarkBtnText}>Mark Today's Attendance</ThemedText>
          </Pressable>
        </View>

        {/* Secondary Operations */}
        <View style={styles.secondaryActionsGrid}>
          <Pressable onPress={() => handleQuickAction("AddWorker")} style={styles.secondaryActionBtn}>
            <Feather name="user-plus" size={16} color="#3B82F6" />
            <ThemedText style={styles.secondaryBtnText}>Add Worker</ThemedText>
          </Pressable>
          <Pressable onPress={() => handleQuickAction("ProjectManagement")} style={styles.secondaryActionBtn}>
            <Feather name="plus-circle" size={16} color="#8B5CF6" />
            <ThemedText style={styles.secondaryBtnText}>Add Site</ThemedText>
          </Pressable>
          <Pressable onPress={() => handleQuickAction("Reports")} style={styles.secondaryActionBtn}>
            <Feather name="file-text" size={16} color="#10B981" />
            <ThemedText style={styles.secondaryBtnText}>View Reports</ThemedText>
          </Pressable>
        </View>

        {/* GPS Auto Check-in Toggle */}
        <View style={styles.gpsRow}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.gpsTitle}>GPS Auto Check-in</ThemedText>
            <ThemedText style={styles.gpsDesc}>Automatically mark present on arrival</ThemedText>
          </View>
          <Switch
            value={gpsCheckInActive}
            onValueChange={(val) => {
              triggerHaptic();
              setGpsCheckInActive(val);
              if (val) {
                Alert.alert("GPS Active", "Auto check-in simulates marking present for on-site workers.");
              }
            }}
            trackColor={{ false: "#334155", true: "#10B981" }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Core Attendance marking: Tappable Worker List */}
        <View style={styles.workerListHeader}>
          <ThemedText style={styles.cardSectionTitle}>Today's Attendance Log</ThemedText>
          <Pressable onPress={handleMarkAllPresent} style={styles.bulkMarkBtn}>
            <Feather name="check" size={14} color="#3B82F6" style={{ marginRight: 4 }} />
            <ThemedText style={styles.bulkMarkText}>Mark All Present</ThemedText>
          </Pressable>
        </View>

        {displayWorkers.length === 0 ? (
          <View style={styles.emptyWorkersContainer}>
            <Feather name="users" size={24} color="#475569" style={{ marginBottom: 8 }} />
            <ThemedText style={styles.emptyWorkersText}>No workers registered for this site.</ThemedText>
          </View>
        ) : (
          <View style={styles.workersListCard}>
            {displayWorkers.map((worker) => {
              const todayRecord = attendanceRecords.find(
                (r) => r.workerId === worker.id && r.day === todayDay
              );
              const val = todayRecord ? todayRecord.value : "";

              return (
                <Pressable
                  key={worker.id}
                  onPress={() => handleMarkPresent(worker.id)}
                  onLongPress={() => handleMarkOptions(worker.id)}
                  delayLongPress={300}
                  style={({ pressed }) => [
                    styles.workerRow,
                    { backgroundColor: pressed ? "#334155" : "transparent" },
                    { borderBottomColor: "#1E293B" }
                  ]}
                >
                  <View style={styles.workerAvatar}>
                    <ThemedText style={styles.workerAvatarText}>
                      {worker.name.charAt(0).toUpperCase()}
                    </ThemedText>
                  </View>
                  <View style={styles.workerInfo}>
                    <ThemedText style={styles.workerName}>{worker.name}</ThemedText>
                    <ThemedText style={styles.workerCategory}>{worker.category.toUpperCase()}</ThemedText>
                  </View>

                  <View style={styles.attendanceStatusContainer}>
                    {val === "P" && (
                      <View style={[styles.statusBadge, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                        <ThemedText style={[styles.statusBadgeText, { color: "#10B981" }]}>PRESENT</ThemedText>
                      </View>
                    )}
                    {val === "H" && (
                      <View style={[styles.statusBadge, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                        <ThemedText style={[styles.statusBadgeText, { color: "#F59E0B" }]}>HALF DAY</ThemedText>
                      </View>
                    )}
                    {val === "OT" && (
                      <View style={[styles.statusBadge, { backgroundColor: "rgba(168, 85, 247, 0.15)" }]}>
                        <ThemedText style={[styles.statusBadgeText, { color: "#A855F7" }]}>OVERTIME</ThemedText>
                      </View>
                    )}
                    {val === "A" && (
                      <View style={[styles.statusBadge, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
                        <ThemedText style={[styles.statusBadgeText, { color: "#EF4444" }]}>ABSENT</ThemedText>
                      </View>
                    )}
                    {val === "" && (
                      <View style={styles.checkboxEmpty}>
                        <Feather name="square" size={18} color="#475569" />
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* View Grid Attendance Register Button/Cell */}
        <Pressable
          onPress={() => {
            triggerHaptic();
            navigation.navigate("AttendanceDetail");
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
            borderRadius: 12,
            padding: 16,
            marginTop: Spacing.md,
            marginBottom: Spacing.lg,
            borderWidth: 1,
            borderColor: isDark ? "#334155" : "#E2E8F0",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(59, 130, 246, 0.15)", justifyContent: "center", alignItems: "center" }}>
              <Feather name="calendar" size={18} color="#3B82F6" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={{ fontWeight: "700", fontSize: 14 }}>View Attendance Register (Grid Sheet)</ThemedText>
              <ThemedText style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>See month-wise matrix, presets, and reports</ThemedText>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </Pressable>

        {/* Weekly Trend (Color Coded with Threshold Rules) */}
        <View style={styles.cardHeaderRow}>
          <ThemedText style={styles.cardSectionTitle}>Weekly Attendance Trend</ThemedText>
        </View>
        <View style={styles.chartCard}>
          <View style={styles.barsContainer}>
            {[
              { day: "Mon", rate: stats.totalWorkers > 0 ? 85 : 0 },
              { day: "Tue", rate: stats.totalWorkers > 0 ? 90 : 0 },
              { day: "Wed", rate: stats.totalWorkers > 0 ? 45 : 0 },
              { day: "Thu", rate: stats.totalWorkers > 0 ? 80 : 0 },
              { day: "Fri", rate: stats.totalWorkers > 0 ? 65 : 0 },
              { day: "Sat", rate: stats.totalWorkers > 0 ? 78 : 0 },
            ].map((item) => {
              let barColor = "#EF4444";
              if (item.rate >= 75) barColor = "#10B981";
              else if (item.rate >= 50) barColor = "#F59E0B";

              return (
                <View key={item.day} style={styles.barItem}>
                  <View style={styles.barWrapper}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${item.rate}%`,
                          backgroundColor: barColor,
                        },
                      ]}
                    />
                    <ThemedText style={styles.barPercentage}>{item.rate}%</ThemedText>
                  </View>
                  <ThemedText style={styles.barDayText}>{item.day}</ThemedText>
                </View>
              );
            })}
          </View>
        </View>

        {/* Dynamic Prime/Upgrade Billing History */}
        {billingHistory.length > 0 && (
          <View style={styles.billingSection}>
            <ThemedText style={styles.cardSectionTitle}>Billing History</ThemedText>
            <View style={styles.historyCard}>
              {billingHistory.map((item, index) => (
                <View key={index} style={styles.historyRow}>
                  <ThemedText style={styles.historyDate}>{item.date}</ThemedText>
                  <ThemedText style={styles.historyDesc}>{item.planName}</ThemedText>
                  <ThemedText style={styles.historyAmount}>₹{item.amount}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>



      {/* Custom Attendance Entry & Advanced Configuration Modal */}
      <Modal
        visible={attendanceModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAttendanceModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: isDark ? "#0F172A" : "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <View>
                <ThemedText style={{ fontSize: 18, fontWeight: "800", color: isDark ? "#FFFFFF" : "#0F172A" }}>
                  {selectedWorkerForAttendance?.name || "Mark Attendance"}
                </ThemedText>
                <ThemedText style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>
                  Choose status and configure special parameters for today
                </ThemedText>
              </View>
              <Pressable onPress={() => setAttendanceModalVisible(false)} style={{ padding: 6, backgroundColor: isDark ? "#1E293B" : "#F1F5F9", borderRadius: 20 }}>
                <Feather name="x" size={20} color={isDark ? "#94A3B8" : "#475569"} />
              </Pressable>
            </View>

            {/* Attendance Status Selectors (Explicitly Structured Rows to prevent overlapping) */}
            <ThemedText style={{ fontSize: 13, fontWeight: "700", color: isDark ? "#94A3B8" : "#475569", marginBottom: 10 }}>Status</ThemedText>
            
            {/* Row 1: Present, Absent, Half-Day */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              {[
                { val: "P", label: "Present", color: "#10B981" },
                { val: "A", label: "Absent", color: "#EF4444" },
                { val: "H", label: "Half-Day", color: "#F59E0B" }
              ].map((status) => {
                const isActive = modalAttendanceValue === status.val;
                return (
                  <Pressable
                    key={status.val}
                    onPress={() => {
                      triggerHaptic();
                      setModalAttendanceValue(status.val as any);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor: isActive ? status.color : (isDark ? "#334155" : "#E2E8F0"),
                      backgroundColor: isActive ? `${status.color}15` : (isDark ? "#1E293B" : "#F8FAFC"),
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <ThemedText style={{ fontSize: 13, fontWeight: "800", color: isActive ? status.color : (isDark ? "#94A3B8" : "#475569") }}>
                      {status.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {/* Row 2: Overtime, Unmark */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
              {[
                { val: "OT", label: "Overtime", color: "#6366F1" },
                { val: "", label: "Unmark", color: "#64748B" }
              ].map((status) => {
                const isActive = modalAttendanceValue === status.val;
                return (
                  <Pressable
                    key={status.val}
                    onPress={() => {
                      triggerHaptic();
                      setModalAttendanceValue(status.val as any);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor: isActive ? status.color : (isDark ? "#334155" : "#E2E8F0"),
                      backgroundColor: isActive ? `${status.color}15` : (isDark ? "#1E293B" : "#F8FAFC"),
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <ThemedText style={{ fontSize: 13, fontWeight: "800", color: isActive ? status.color : (isDark ? "#94A3B8" : "#475569") }}>
                      {status.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {/* Optional Fields (Only if present/half-day/overtime is checked) */}
            {modalAttendanceValue !== "A" && modalAttendanceValue !== "" ? (
              <View style={{ gap: 16, marginBottom: 24 }}>
                {/* Advance Amount (Custom Wage) */}
                <View>
                  <ThemedText style={{ fontSize: 13, fontWeight: "700", color: isDark ? "#94A3B8" : "#475569", marginBottom: 6 }}>Advance / Custom Wage (₹)</ThemedText>
                  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: isDark ? "#1E293B" : "#F8FAFC", borderRadius: 8, borderWidth: 1, borderColor: isDark ? "#334155" : "#E2E8F0", paddingHorizontal: 12, height: 44 }}>
                    <ThemedText style={{ color: theme.textSecondary, marginRight: 6, fontWeight: "700" }}>₹</ThemedText>
                    <TextInput
                      keyboardType="numeric"
                      placeholder="e.g. 100 (optional)"
                      placeholderTextColor={theme.textSecondary}
                      style={{ flex: 1, color: isDark ? "#FFFFFF" : "#0F172A", fontSize: 14 }}
                      value={modalAdvanceAmount}
                      onChangeText={setModalAdvanceAmount}
                    />
                  </View>
                </View>

                {/* Overtime Fields */}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ fontSize: 13, fontWeight: "700", color: isDark ? "#94A3B8" : "#475569", marginBottom: 6 }}>OT Wage (₹)</ThemedText>
                    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: isDark ? "#1E293B" : "#F8FAFC", borderRadius: 8, borderWidth: 1, borderColor: isDark ? "#334155" : "#E2E8F0", paddingHorizontal: 12, height: 44 }}>
                      <ThemedText style={{ color: theme.textSecondary, marginRight: 6, fontWeight: "700" }}>₹</ThemedText>
                      <TextInput
                        keyboardType="numeric"
                        placeholder="OT amount"
                        placeholderTextColor={theme.textSecondary}
                        style={{ flex: 1, color: isDark ? "#FFFFFF" : "#0F172A", fontSize: 14 }}
                        value={modalOvertimeWage}
                        onChangeText={setModalOvertimeWage}
                      />
                    </View>
                  </View>

                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ fontSize: 13, fontWeight: "700", color: isDark ? "#94A3B8" : "#475569", marginBottom: 6 }}>OT Hours</ThemedText>
                    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: isDark ? "#1E293B" : "#F8FAFC", borderRadius: 8, borderWidth: 1, borderColor: isDark ? "#334155" : "#E2E8F0", paddingHorizontal: 12, height: 44 }}>
                      <TextInput
                        keyboardType="numeric"
                        placeholder="Hours"
                        placeholderTextColor={theme.textSecondary}
                        style={{ flex: 1, color: isDark ? "#FFFFFF" : "#0F172A", fontSize: 14 }}
                        value={modalOvertimeHours}
                        onChangeText={setModalOvertimeHours}
                      />
                    </View>
                  </View>
                </View>
              </View>
            ) : null}

            {/* Action Buttons */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => setAttendanceModalVisible(false)}
                style={{ flex: 1, height: 46, borderRadius: 8, justifyContent: "center", alignItems: "center", backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }}
              >
                <ThemedText style={{ fontWeight: "700", color: isDark ? "#94A3B8" : "#475569" }}>Cancel</ThemedText>
              </Pressable>
              
              <Pressable
                onPress={handleSaveAttendanceModal}
                style={{ flex: 1.5, height: 46, borderRadius: 8, justifyContent: "center", alignItems: "center", backgroundColor: "#3B82F6" }}
              >
                <ThemedText style={{ fontWeight: "800", color: "#FFFFFF" }}>Save Attendance</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Razorpay WebView Checkout Modal */}
      <Modal
        visible={showRazorpayModal}
        animationType="slide"
        onRequestClose={() => setShowRazorpayModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
          <View style={styles.razorpayHeader}>
            <ThemedText style={styles.razorpayTitle}>Razorpay Payment Gateway</ThemedText>
            <Pressable onPress={() => setShowRazorpayModal(false)} style={{ padding: 8 }}>
              <Feather name="x" size={24} color="#64748B" />
            </Pressable>
          </View>
          <WebView
            source={{ html: razorpayHtml }}
            onMessage={(e) => handlePaymentResponse(e.nativeEvent.data)}
            style={{ flex: 1 }}
          />
        </View>
      </Modal>

      {/* PRIME Subscription upgrade modal */}
      <Modal
        visible={showSubModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSubModal(false)}
      >
        <View style={styles.subModalOverlay}>
          <View style={styles.subModalContent}>
            <View style={styles.subHeader}>
              <ThemedText style={styles.subTitle}>PRIME Membership</ThemedText>
              <Pressable onPress={() => setShowSubModal(false)} style={{ padding: 4 }}>
                <Feather name="x" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
              <ThemedText style={styles.planSelectorLabel}>Select Subscription Plan</ThemedText>
              <View style={styles.planGrid}>
                <Pressable
                  onPress={() => setSelectedPlanOption("standard")}
                  style={[
                    styles.planOption,
                    selectedPlanOption === "standard" && styles.planOptionActive,
                  ]}
                >
                  <ThemedText style={styles.planOptionName}>Standard</ThemedText>
                  <ThemedText style={styles.planOptionPrice}>₹99/month</ThemedText>
                  <ThemedText style={styles.planOptionSub}>Half features included</ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => setSelectedPlanOption("pro")}
                  style={[
                    styles.planOption,
                    selectedPlanOption === "pro" && styles.planOptionActive,
                  ]}
                >
                  <ThemedText style={styles.planOptionName}>Pro</ThemedText>
                  <ThemedText style={styles.planOptionPrice}>₹399/month</ThemedText>
                  <ThemedText style={styles.planOptionSub}>Full unlimited access</ThemedText>
                </Pressable>
              </View>

              <ThemedText style={styles.planSelectorLabel}>Benefits Summary</ThemedText>
              {[
                { text: "Max 50 Workers", active: true },
                { text: "Max 5 Sites", active: true },
                { text: "Export PDF and Excel (Max 10)", active: true },
                { text: "Unlimited Workers", active: selectedPlanOption === "pro" },
                { text: "Unlimited Sites", active: selectedPlanOption === "pro" },
                { text: "Unlimited PDF & Excel Exports", active: selectedPlanOption === "pro" },
                { text: "Cloud Backup", active: selectedPlanOption === "pro" },
                { text: "Multi Device Access", active: selectedPlanOption === "pro" },
                { text: "Future AI Features", active: selectedPlanOption === "pro" },
              ].map((b, index) => (
                <View key={index} style={styles.benefitRow}>
                  <Feather
                    name={b.active ? "check-circle" : "x-circle"}
                    size={14}
                    color={b.active ? "#10B981" : "#475569"}
                  />
                  <ThemedText style={[styles.benefitText, { color: b.active ? "#F8FAFC" : "#64748B" }]}>
                    {b.text}
                  </ThemedText>
                </View>
              ))}

              <Pressable
                style={styles.checkoutBtn}
                onPress={() => {
                  triggerHaptic();
                  const html = generateRazorpayHtml(selectedPlanOption);
                  setRazorpayHtml(html);
                  setShowRazorpayModal(true);
                }}
              >
                <ThemedText style={styles.checkoutBtnText}>
                  Proceed to Checkout — {selectedPlanOption === "standard" ? "₹99" : "₹399"}
                </ThemedText>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Undo Toast overlay popup */}
      {showToast && (
        <Animated.View style={[styles.toastContainer, { opacity: toastFadeAnim }]}>
          <ThemedText style={styles.toastMessage}>{toastMessage}</ThemedText>
          <Pressable onPress={handleUndo} style={styles.toastUndoBtn}>
            <ThemedText style={styles.toastUndoText}>UNDO</ThemedText>
          </Pressable>
        </Animated.View>
      )}

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  headerContainer: {
    backgroundColor: "#1E293B",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1.5,
    borderBottomColor: "#334155",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hamburgerBtn: {
    padding: 6,
  },
  headerTitleArea: {
    flex: 1,
    marginLeft: 12,
  },
  headerDate: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 1.2,
  },
  headerSiteName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#F8FAFC",
    marginTop: 2,
  },
  primeBadge: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  primeBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#0F172A",
  },
  upgradeBadge: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  upgradeBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  headerSummaryBar: {
    backgroundColor: "#0F172A",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 10,
    alignItems: "center",
  },
  summaryBarText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 110,
  },
  streakBannerRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: Spacing.md,
  },
  streakCard: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: "center",
  },
  streakText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#F59E0B",
  },
  insightCard: {
    flex: 1,
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  insightText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#E2E8F0",
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  cardSectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  emptyStateCard: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    borderWidth: 1.5,
    borderRadius: 16,
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginVertical: Spacing.xs,
  },
  emptyStateText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#EF4444",
  },
  emptyStateBtn: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyStateBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  unifiedCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#334155",
    marginVertical: Spacing.xs,
  },
  unifiedGradient: {
    padding: Spacing.lg,
  },
  unifiedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  unifiedSiteTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F8FAFC",
  },
  unifiedSiteSub: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  rateCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#3B82F6",
  },
  ratePercent: {
    fontSize: 14,
    fontWeight: "900",
    color: "#F8FAFC",
  },
  rateLabel: {
    fontSize: 8,
    color: "#94A3B8",
    fontWeight: "700",
  },
  barBg: {
    height: 8,
    backgroundColor: "#334155",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 16,
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  statsSummaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderRadius: 10,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    marginBottom: 12,
  },
  statsBox: {
    flex: 1,
    alignItems: "center",
  },
  statsNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: "#F8FAFC",
  },
  statsLabel: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "700",
    marginTop: 2,
  },
  siteInfoFooter: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerText: {
    fontSize: 11,
    color: "#94A3B8",
  },
  primaryMarkBtn: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  primaryMarkBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryActionsGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: Spacing.md,
  },
  secondaryActionBtn: {
    flex: 1,
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#E2E8F0",
  },
  gpsRow: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  gpsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  gpsDesc: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 1,
  },
  workerListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  bulkMarkBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },
  bulkMarkText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#3B82F6",
  },
  emptyWorkersContainer: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: Spacing.lg,
  },
  emptyWorkersText: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
  },
  workersListCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#334155",
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  workerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1.2,
  },
  workerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
  },
  workerAvatarText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  workerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  workerName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F8FAFC",
  },
  workerCategory: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94A3B8",
    marginTop: 2,
  },
  attendanceStatusContainer: {
    paddingLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  checkboxEmpty: {
    padding: 4,
  },
  chartCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#334155",
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  barsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 120,
    paddingTop: 16,
  },
  barItem: {
    alignItems: "center",
    width: 40,
  },
  barWrapper: {
    height: 80,
    width: 14,
    backgroundColor: "#334155",
    borderRadius: 7,
    justifyContent: "flex-end",
    position: "relative",
  },
  bar: {
    width: "100%",
    borderRadius: 7,
  },
  barPercentage: {
    position: "absolute",
    top: -16,
    fontSize: 8,
    fontWeight: "800",
    color: "#F8FAFC",
    alignSelf: "center",
  },
  barDayText: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 8,
    fontWeight: "700",
  },
  billingSection: {
    marginTop: Spacing.md,
  },
  historyCard: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 4,
    marginTop: 6,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  historyDate: {
    fontSize: 11,
    color: "#94A3B8",
  },
  historyDesc: {
    fontSize: 12,
    color: "#F8FAFC",
    fontWeight: "600",
    flex: 1,
    marginLeft: 8,
  },
  historyAmount: {
    fontSize: 12,
    color: "#F8FAFC",
    fontWeight: "700",
  },
  razorpayHeader: {
    height: Platform.OS === 'ios' ? 90 : 60,
    paddingTop: Platform.OS === 'ios' ? 40 : 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },
  razorpayTitle: {
    fontWeight: "700",
    fontSize: 16,
    color: "#0F172A",
  },
  subModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  subModalContent: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#334155",
    maxHeight: "85%",
    overflow: "hidden",
  },
  subHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  subTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#F8FAFC",
  },
  planSelectorLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    textTransform: "uppercase",
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  planGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: Spacing.md,
  },
  planOption: {
    flex: 1,
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  planOptionActive: {
    borderColor: "#F59E0B",
  },
  planOptionName: {
    fontSize: 12,
    fontWeight: "800",
    color: "#94A3B8",
  },
  planOptionPrice: {
    fontSize: 16,
    fontWeight: "900",
    color: "#F8FAFC",
    marginVertical: 4,
  },
  planOptionSub: {
    fontSize: 8,
    color: "#64748B",
    textAlign: "center",
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  benefitText: {
    fontSize: 12,
    fontWeight: "500",
  },
  checkoutBtn: {
    backgroundColor: "#F59E0B",
    borderRadius: 10,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  checkoutBtnText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
  },
  toastContainer: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: "#1E293B",
    borderColor: "#3B82F6",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 10,
  },
  toastMessage: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F8FAFC",
    flex: 1,
  },
  toastUndoBtn: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  toastUndoText: {
    color: "#3B82F6",
    fontWeight: "800",
    fontSize: 12,
  },
});
