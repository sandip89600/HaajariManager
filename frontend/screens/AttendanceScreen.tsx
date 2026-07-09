import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  Image,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import {
  captureLocation,
  requestLocationPermission,
  GPSLocation,
} from "@/utils/gps";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { translateWorkerName } from "@/utils/transliteration";
import {
  storage,
  Worker,
  AttendanceRecord,
  AttendanceValue,
  getDaysInMonth,
} from "@/utils/storage";
import { appContextTracker } from "@/utils/appContextTracker";
import { DeviceEventEmitter } from "react-native";
import { Spacing, BorderRadius, Colors, Shadows } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as WebBrowser from "expo-web-browser";

const CELL_SIZE = 56;
const NAME_COLUMN_WIDTH = 130;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AttendanceCellProps {
  record: AttendanceRecord | null;
  onPress: () => void;
  theme: typeof Colors.light;
  isDark: boolean;
}

function AttendanceCell({
  record,
  onPress,
  theme,
  isDark,
}: AttendanceCellProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const value = record?.value ?? null;
  const customWage = record?.customWage ?? null;
  const overtimeWage = record?.overtimeWage ?? null;

  const hasExtra = (customWage !== null && customWage !== undefined && customWage > 0) ||
                    (overtimeWage !== null && overtimeWage !== undefined && overtimeWage > 0);

  const getCellStyle = () => {
    if (value === "P") return { backgroundColor: "#22C55E" }; // Present Green
    if (value === "A") return { backgroundColor: "#EF4444" }; // Absent Red
    if (value === "H") return { backgroundColor: "#F59E0B" }; // Half Day Amber
    if (value === "OT") return { backgroundColor: "#A855F7" }; // Overtime Purple
    if (customWage !== null && customWage !== undefined) {
      return { backgroundColor: "#3B82F6" }; // Advance Blue
    }
    if (typeof value === "number") return { backgroundColor: "#3B82F6" }; // Advance Blue
    return {
      backgroundColor: isDark
        ? "rgba(255, 255, 255, 0.03)"
        : "rgba(0,0,0,0.02)",
      borderColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
      borderWidth: 1,
    };
  };

  const getCellText = () => {
    if (value === "P") return "P";
    if (value === "A") return "A";
    if (value === "H") return "½";
    if (value === "OT") return "OT";
    if (customWage !== null && customWage !== undefined) {
      return `₹${customWage}`;
    }
    if (typeof value === "number") return `₹${value}`;
    return "";
  };

  const getTextColor = () => {
    if (
      value === "P" ||
      value === "A" ||
      value === "H" ||
      value === "OT" ||
      customWage !== null ||
      typeof value === "number"
    ) {
      return "#FFFFFF";
    }
    return theme.textSecondary;
  };

  return (
    <View style={styles.cellWrapper}>
      <AnimatedPressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={() => {
          scale.value = withSpring(0.9, { damping: 10 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 10 });
        }}
        style={[styles.cell, getCellStyle(), animatedStyle]}
      >
        <ThemedText
          type="small"
          style={[
            styles.cellText,
            { color: getTextColor(), fontWeight: "800" },
          ]}
        >
          {getCellText()}
        </ThemedText>
        {hasExtra && (
          <View
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              width: 5,
              height: 5,
              borderRadius: 2.5,
              backgroundColor: "#FF8C35",
            }}
          />
        )}
      </AnimatedPressable>
    </View>
  );
}

// ─── REUSABLE MODERN DIALOG ──────────────────────────────────────────────────
function GlassModal({
  visible,
  onClose,
  title,
  children,
  theme,
  isDark,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  theme: typeof Colors.light;
  isDark: boolean;
}) {
  const content = (
    <Pressable
      style={[
        styles.modalContentCard,
        {
          backgroundColor:
            Platform.OS === "ios"
              ? "transparent"
              : isDark
                ? "rgba(15, 23, 42, 0.96)"
                : "rgba(255, 255, 255, 0.98)",
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.08)"
            : "rgba(0, 0, 0, 0.08)",
          borderWidth: Platform.OS === "ios" ? 0 : 1,
        },
      ]}
      onPress={(e) => e.stopPropagation()}
    >
      <ThemedText type="h3" style={styles.modalTitleText}>
        {title}
      </ThemedText>
      {children}
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Animated.View
          entering={FadeInDown.duration(250)}
          style={styles.modalContainer}
        >
          {Platform.OS === "ios" ? (
            <BlurView
              intensity={95}
              tint={isDark ? "dark" : "light"}
              style={[
                styles.modalBlur,
                {
                  borderColor: isDark
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.08)",
                  borderWidth: 1,
                },
              ]}
            >
              {content}
            </BlurView>
          ) : (
            content
          )}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ─── MAIN ATTENDANCE SCREEN ──────────────────────────────────────────────────
export default function AttendanceScreen() {
  const { theme, isDark } = useTheme();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const rawHeaderHeight = useHeaderHeight();
  const headerHeight = rawHeaderHeight > 0 ? rawHeaderHeight : insets.top + Platform.select({ ios: 44, default: 56 });
  const navigation = useNavigation<any>();
  const tabBarHeight = insets.bottom + 60;
  const { user } = useAuth();
  const { socket, connectSocket } = useSocket();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        user?.role !== "supervisor" ? (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate("AddWorker");
            }}
            style={{ marginRight: Spacing.md, padding: 4 }}
          >
            <Feather name="user-plus" size={24} color={theme.primary} />
          </Pressable>
        ) : null,
    });
  }, [navigation, user?.role, theme.primary]);
  const [currentPlan, setCurrentPlan] = useState<
    "free" | "professional" | "business"
  >("free");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    workerId: string;
    day: number;
  } | null>(null);
  const [tempStatus, setTempStatus] = useState<AttendanceValue | null>(null);
  const [tempCustomWage, setTempCustomWage] = useState("");
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [tempOvertimeType, setTempOvertimeType] = useState<"1x" | "2x" | "custom" | "none">("none");
  const [tempOvertimeCustomAmount, setTempOvertimeCustomAmount] = useState("");
  const [capturedLocation, setCapturedLocation] = useState<GPSLocation | null>(
    null,
  );
  const [isCapturingGPS, setIsCapturingGPS] = useState(false);
  const [gridHeight, setGridHeight] = useState(0);

  // Refs for synchronized scrolling
  const namesScrollRef = useRef<ScrollView>(null);
  const cellsScrollRef = useRef<ScrollView>(null);

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const selectedWorker = selectedCell
    ? workers.find((w) => w.id === selectedCell.workerId)
    : null;

  useEffect(() => {
    appContextTracker.setContext({
      selectedWorkerId: selectedWorker?.id || null,
      selectedWorkerName: selectedWorker?.name || null,
    });
  }, [selectedWorker]);

  const monthNames = [
    t.months.january,
    t.months.february,
    t.months.march,
    t.months.april,
    t.months.may,
    t.months.june,
    t.months.july,
    t.months.august,
    t.months.september,
    t.months.october,
    t.months.november,
    t.months.december,
  ];

  const loadPlan = async () => {
    const auth = await storage.getAuth();
    setCurrentPlan(auth?.plan || "free");
  };

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      let loadedWorkers = await storage.getWorkers();
      const loadedAttendance = await storage.getAttendanceForMonth(
        selectedYear,
        selectedMonth,
      );
      if (user?.role === "supervisor") {
        const assignedProjects = user?.assignedProjects || [];
        loadedWorkers = loadedWorkers.filter(
          (w) => w.projectId && assignedProjects.includes(w.projectId),
        );
      }
      setWorkers(loadedWorkers);
      setAttendance(loadedAttendance);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPlan();
      loadData();
      appContextTracker.setContext({
        currentScreen: "Attendance",
        selectedWorkerId: null,
        selectedWorkerName: null,
        selectedMonth: selectedMonth,
        selectedYear: selectedYear,
      });
    }, [selectedMonth, selectedYear, user]),
  );

  useEffect(() => {
    connectSocket();
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      console.log("[AttendanceScreen] Live socket update received, reloading attendance data silently...");
      loadData(true);
    };

    socket.on("admin_dashboard_update", handleUpdate);
    socket.on("admin_activity", handleUpdate);

    const sub = DeviceEventEmitter.addListener("refreshData", () => {
      loadData();
    });

    return () => {
      socket.off("admin_dashboard_update", handleUpdate);
      socket.off("admin_activity", handleUpdate);
      sub.remove();
    };
  }, [socket]);

  const getAttendanceValue = (
    workerId: string,
    day: number,
  ): AttendanceValue | null => {
    const record = attendance.find(
      (a) =>
        a.workerId === workerId &&
        a.year === selectedYear &&
        a.month === selectedMonth &&
        a.day === day,
    );
    return record?.value ?? null;
  };

  const getAttendanceRecord = (
    workerId: string,
    day: number,
  ): AttendanceRecord | null => {
    const record = attendance.find(
      (a) =>
        a.workerId === workerId &&
        a.year === selectedYear &&
        a.month === selectedMonth &&
        a.day === day,
    );
    return record ?? null;
  };

  const handleCellPress = (workerId: string, day: number) => {
    setSelectedCell({ workerId, day });
    const record = getAttendanceRecord(workerId, day);
    if (record) {
      setTempStatus(record.value as any);
      setTempCustomWage(
        record.customWage !== undefined && record.customWage !== null
          ? record.customWage.toString()
          : "",
      );
      if (record.overtimeWage !== undefined && record.overtimeWage !== null) {
        if (record.overtimeHours === 1) {
          setTempOvertimeType("1x");
          setTempOvertimeCustomAmount("");
        } else if (record.overtimeHours === 2) {
          setTempOvertimeType("2x");
          setTempOvertimeCustomAmount("");
        } else {
          setTempOvertimeType("custom");
          setTempOvertimeCustomAmount(record.overtimeWage.toString());
        }
      } else {
        setTempOvertimeType("none");
        setTempOvertimeCustomAmount("");
      }
    } else {
      setTempStatus(null);
      setTempCustomWage("");
      setTempOvertimeType("none");
      setTempOvertimeCustomAmount("");
    }
    setShowInputModal(true);
    setCapturedLocation(null);
  };

  const captureGPSLocation = async () => {
    if (currentPlan === "free") {
      setShowUpgradeModal(true);
      return;
    }
    if (Platform.OS === "web") {
      Alert.alert("GPS", "Run in Expo Go to use GPS attendance.");
      return;
    }
    setIsCapturingGPS(true);
    try {
      const permission = await requestLocationPermission();
      if (permission !== "granted") {
        Alert.alert(t.gps.permissionDenied, t.gps.permissionRequired);
        return;
      }
      const loc = await captureLocation();
      if (loc) {
        setCapturedLocation(loc);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert(t.common.error, t.attendance.gpsFailed);
      }
    } catch {
      Alert.alert(t.common.error, t.attendance.gpsFailed);
    } finally {
      setIsCapturingGPS(false);
    }
  };

  const handleSelectAbsent = async () => {
    if (!selectedCell) return;

    const worker = workers.find((w) => w.id === selectedCell.workerId);
    const dailyRate = worker ? worker.dailyRate : 0;

    const record: AttendanceRecord = {
      workerId: selectedCell.workerId,
      year: selectedYear,
      month: selectedMonth,
      day: selectedCell.day,
      value: "A",
      dailyRate: dailyRate,
      customWage: undefined,
      finalPay: 0,
      location: capturedLocation ?? undefined,
      timestamp: Date.now(),
    };

    await storage.setAttendanceRecord(record);
    await loadData();
    setShowInputModal(false);
    setSelectedCell(null);
    setCapturedLocation(null);
    setTempStatus(null);
    setTempCustomWage("");
    setTempOvertimeType("none");
    setTempOvertimeCustomAmount("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleConfirmAttendance = async () => {
    if (!selectedCell || !tempStatus) return;

    const worker = workers.find((w) => w.id === selectedCell.workerId);
    const dailyRate = worker ? worker.dailyRate : 0;

    let customWage: number | undefined = undefined; // Advance
    let overtimeWage: number | undefined = undefined;
    let overtimeHours: number | undefined = undefined;
    let finalPay = 0;

    // Resolve Advance (customWage)
    if (tempStatus === "P" || tempStatus === "H" || tempStatus === "OT") {
      if (tempCustomWage.trim() !== "") {
        const amount = parseInt(tempCustomWage, 10);
        if (!isNaN(amount) && amount >= 0) {
          customWage = amount;
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(t.common.error, t.attendance.invalidAmount);
          return;
        }
      }
    }

    // Resolve Overtime
    if (tempStatus === "P" || tempStatus === "H" || tempStatus === "OT") {
      if (tempOvertimeType === "1x") {
        overtimeWage = dailyRate;
        overtimeHours = 1;
      } else if (tempOvertimeType === "2x") {
        overtimeWage = dailyRate * 2;
        overtimeHours = 2;
      } else if (tempOvertimeType === "custom") {
        const amount = parseInt(tempOvertimeCustomAmount, 10);
        if (!isNaN(amount) && amount >= 0) {
          overtimeWage = amount;
          overtimeHours = 0;
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(t.common.error, t.attendance.invalidAmount);
          return;
        }
      }
    }

    const advanceAmount = customWage ?? 0;
    const otAmount = overtimeWage ?? 0;

    if (tempStatus === "P" || tempStatus === "OT") {
      finalPay = dailyRate + advanceAmount + otAmount;
    } else if (tempStatus === "H") {
      finalPay = (dailyRate / 2) + advanceAmount + otAmount;
    } else if (tempStatus === "A") {
      finalPay = 0; // strictly 0 for Absent
      customWage = undefined; // reset fields for A status
      overtimeWage = undefined;
      overtimeHours = undefined;
    }

    const record: AttendanceRecord = {
      workerId: selectedCell.workerId,
      year: selectedYear,
      month: selectedMonth,
      day: selectedCell.day,
      value: tempStatus,
      dailyRate: dailyRate,
      customWage: customWage,
      finalPay: finalPay,
      overtimeHours: overtimeHours,
      overtimeWage: overtimeWage,
      location: capturedLocation ?? undefined,
      timestamp: Date.now(),
    };

    await storage.setAttendanceRecord(record);
    await loadData();
    setShowInputModal(false);
    setSelectedCell(null);
    setCapturedLocation(null);
    setTempStatus(null);
    setTempCustomWage("");
    setTempOvertimeType("none");
    setTempOvertimeCustomAmount("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleUpgrade = async (plan: "pro" | "business") => {
    const amount = plan === "pro" ? 299 : 999;
    const planName = plan === "pro" ? "Professional" : "Business";

    // Razorpay pre-configured payment links for each plan
    const paymentLinks = {
      pro: "https://rzp.io/rzp/6bP0p3Q", // Replace this with your Pro plan Razorpay link
      business: "https://rzp.io/rzp/6bP0p3Q", // Replace this with your Business plan Razorpay link
    };

    const baseLink = paymentLinks[plan];
    const emailStr = user?.phone || "";
    const paymentUrl = `${baseLink}?email=${encodeURIComponent(emailStr)}&name=${encodeURIComponent(user?.name || "")}`;

    try {
      setShowUpgradeModal(false);
      const result = await WebBrowser.openBrowserAsync(paymentUrl);

      if (result.type === "cancel") {
        Alert.alert(
          "Payment Cancelled",
          "You cancelled the subscription process.",
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Success",
          `Thank you for upgrading! Your Haajari ${planName} Plan is now active.`,
        );
      }
    } catch (error) {
      console.warn("Failed to open Razorpay:", error);
      Alert.alert(
        "Error",
        "Could not open payment checkout. Please try again.",
      );
    }
  };

  const handleVerticalScroll = (y: number) => {
    namesScrollRef.current?.scrollTo({ y, animated: false });
  };

  if (isLoading) {
    return (
      <ThemedView
        style={[
          styles.emptyContainer,
          { paddingTop: headerHeight + Spacing.xl },
        ]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  if (workers.length === 0) {
    return (
      <ThemedView
        style={[
          styles.emptyContainer,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
      >
        <Feather
          name="users"
          size={64}
          color={theme.textSecondary}
          style={styles.emptyIcon}
        />
        <ThemedText type="h3" style={styles.emptyTitle}>
          {t.attendance.noWorkers}
        </ThemedText>
        <ThemedText
          type="body"
          style={[styles.emptySubtitle, { color: theme.textSecondary }]}
        >
          {t.attendance.addWorkerFirst}
        </ThemedText>
      </ThemedView>
    );
  }

  const cellsHeight = gridHeight > 0 ? gridHeight - CELL_SIZE : undefined;
  const ORANGE = "#F97316";
  const EMERALD = "#22C55E";
  const AMBER = "#F59E0B";
  const RED = "#EF4444";

  return (
    <ThemedView style={styles.container}>
      {/* Month selector */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowMonthPicker(true);
        }}
        style={[
          styles.monthSelector,
          {
            top: headerHeight + Spacing.sm,
            backgroundColor: isDark
              ? "rgba(30, 41, 59, 0.45)"
              : "rgba(255, 255, 255, 0.9)",
            borderColor: isDark
              ? "rgba(255, 255, 255, 0.06)"
              : "rgba(0, 0, 0, 0.05)",
            borderWidth: 1,
          },
        ]}
      >
        <Feather name="calendar" size={16} color={theme.primary} />
        <ThemedText type="h4" style={{ fontWeight: "700" }}>
          {monthNames[selectedMonth]} {selectedYear}
        </ThemedText>
        <Feather name="chevron-down" size={16} color={theme.textSecondary} />
      </Pressable>

      {/* Grid container */}
      <View
        style={[
          styles.gridContainer,
          {
            marginTop: headerHeight + Spacing["4xl"] + Spacing.sm,
            marginBottom: tabBarHeight,
          },
        ]}
        onLayout={(e) => setGridHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.gridInner}>
          {/* ── Frozen left column (worker names) ── */}
          <View style={styles.frozenCol}>
            {/* Corner cell */}
            <View
              style={[
                styles.cornerCell,
                {
                  backgroundColor: theme.primaryDark,
                  borderColor: isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(255,255,255,0.15)",
                },
              ]}
            >
              <ThemedText style={styles.cornerText}>
                {t.workers.title}
              </ThemedText>
            </View>

            {/* Worker name cells — scroll controlled by right side */}
            <ScrollView
              ref={namesScrollRef}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              style={cellsHeight ? { height: cellsHeight } : { flex: 1 }}
            >
              {workers.map((worker) => (
                <View
                  key={worker.id}
                  style={[
                    styles.workerNameCell,
                    {
                      backgroundColor: isDark
                        ? "rgba(30, 41, 59, 0.3)"
                        : "#F8FAFC",
                      borderColor: isDark
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.05)",
                    },
                  ]}
                >
                  {worker.photoUri ? (
                    <Image
                      source={{ uri: worker.photoUri }}
                      style={styles.workerAvatar}
                    />
                  ) : (
                    <LinearGradient
                      colors={[theme.primary, "#FF8C35"]}
                      style={styles.workerAvatarPlaceholder}
                    >
                      <ThemedText style={styles.workerAvatarInitial}>
                        {(translateWorkerName(worker.name, language) || "?").charAt(0).toUpperCase()}
                      </ThemedText>
                    </LinearGradient>
                  )}
                  <ThemedText
                    type="small"
                    style={[styles.workerNameText, { color: theme.text }]}
                    numberOfLines={2}
                  >
                    {translateWorkerName(worker.name, language)}
                  </ThemedText>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* ── Right scrollable area (single horizontal ScrollView) ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            bounces={false}
            style={{ flex: 1 }}
          >
            <View>
              {/* Days header row — always visible at top */}
              <View style={styles.daysHeaderRow}>
                {Array.from({ length: daysInMonth }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dayCell,
                      {
                        backgroundColor: theme.primaryDark,
                        borderColor: isDark
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(255,255,255,0.15)",
                      },
                    ]}
                  >
                    <ThemedText style={styles.dayText}>{i + 1}</ThemedText>
                  </View>
                ))}
              </View>

              {/* Attendance cells — vertically scrollable, drives left column */}
              <ScrollView
                ref={cellsScrollRef}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                bounces={false}
                style={cellsHeight ? { height: cellsHeight } : { flex: 1 }}
                onScroll={(e) =>
                  handleVerticalScroll(e.nativeEvent.contentOffset.y)
                }
              >
                {workers.map((worker) => (
                  <View key={worker.id} style={styles.attendanceCellRow}>
                    {Array.from({ length: daysInMonth }, (_, i) => (
                      <AttendanceCell
                        key={i}
                        record={getAttendanceRecord(worker.id, i + 1)}
                        onPress={() => handleCellPress(worker.id, i + 1)}
                        theme={theme}
                        isDark={isDark}
                      />
                    ))}
                  </View>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* ── SELECT MONTH DIALOG ── */}
      <GlassModal
        visible={showMonthPicker}
        onClose={() => setShowMonthPicker(false)}
        title="Select Month"
        theme={theme}
        isDark={isDark}
      >
        <View style={styles.yearSelector}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedYear(selectedYear - 1);
            }}
            style={styles.yearArrow}
          >
            <Feather name="chevron-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h3" style={{ fontWeight: "700" }}>
            {selectedYear}
          </ThemedText>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedYear(selectedYear + 1);
            }}
            style={styles.yearArrow}
          >
            <Feather name="chevron-right" size={24} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.monthGrid}>
          {monthNames.map((month, index) => (
            <Pressable
              key={index}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedMonth(index);
                setShowMonthPicker(false);
              }}
              style={[
                styles.monthItem,
                {
                  backgroundColor:
                    selectedMonth === index ? theme.primary : "transparent",
                },
              ]}
            >
              <ThemedText
                type="small"
                style={{
                  color: selectedMonth === index ? "#FFFFFF" : theme.text,
                  fontWeight: selectedMonth === index ? "700" : "500",
                }}
              >
                {month.substring(0, 3)}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </GlassModal>

      {/* ── MARK ATTENDANCE INPUT DIALOG ── */}
      <GlassModal
        visible={showInputModal}
        onClose={() => setShowInputModal(false)}
        title={t.attendance.tapToMark}
        theme={theme}
        isDark={isDark}
      >
        {selectedWorker && (
          <View style={{ marginBottom: Spacing.md, alignItems: "center" }}>
            <ThemedText type="h3" style={{ fontWeight: "700" }}>
              {selectedWorker.name}
            </ThemedText>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {t.workers.dailyRate}:{" "}
              </ThemedText>
              <View
                style={{
                  backgroundColor: "#1E293B",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 6,
                }}
              >
                <ThemedText
                  type="small"
                  style={{ color: "#FFFFFF", fontWeight: "700" }}
                >
                  ₹{selectedWorker.dailyRate}
                </ThemedText>
              </View>
            </View>
          </View>
        )}
        <View style={styles.quickOptions}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTempStatus("P");
            }}
            style={[
              styles.quickOption,
              {
                backgroundColor:
                  tempStatus === "P"
                    ? EMERALD
                    : isDark
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(0,0,0,0.03)",
                borderColor: tempStatus === "P" ? EMERALD : theme.border,
                borderWidth: 1,
              },
            ]}
          >
            <Feather
              name="check"
              size={16}
              color={tempStatus === "P" ? "#FFFFFF" : theme.text}
              style={{ marginBottom: 4 }}
            />
            <ThemedText
              style={[
                styles.quickOptionText,
                { color: tempStatus === "P" ? "#FFFFFF" : theme.text },
              ]}
            >
              {t.attendance.present} (P)
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setTempStatus("A");
            }}
            style={[
              styles.quickOption,
              {
                backgroundColor:
                  tempStatus === "A"
                    ? RED
                    : isDark
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(0,0,0,0.03)",
                borderColor: tempStatus === "A" ? RED : theme.border,
                borderWidth: 1,
              },
            ]}
          >
            <Feather
              name="x"
              size={16}
              color={tempStatus === "A" ? "#FFFFFF" : theme.text}
              style={{ marginBottom: 4 }}
            />
            <ThemedText
              style={[
                styles.quickOptionText,
                { color: tempStatus === "A" ? "#FFFFFF" : theme.text },
              ]}
            >
              {t.attendance.absent} (A)
            </ThemedText>
          </Pressable>
        </View>

        <View style={[styles.quickOptions, { marginTop: Spacing.sm }]}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTempStatus("H");
            }}
            style={[
              styles.quickOption,
              {
                backgroundColor:
                  tempStatus === "H"
                    ? AMBER
                    : isDark
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(0,0,0,0.03)",
                borderColor: tempStatus === "H" ? AMBER : theme.border,
                borderWidth: 1,
              },
            ]}
          >
            <Feather
              name="clock"
              size={16}
              color={tempStatus === "H" ? "#FFFFFF" : theme.text}
              style={{ marginBottom: 4 }}
            />
            <ThemedText
              style={[
                styles.quickOptionText,
                { color: tempStatus === "H" ? "#FFFFFF" : theme.text },
              ]}
            >
              {t.attendance.halfDay} (1/2)
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTempStatus("OT");
              setTempOvertimeType("1x"); // Default to 1x
              setTempOvertimeCustomAmount("");
              setShowOvertimeModal(true); // Open overtime dialog immediately
            }}
            style={[
              styles.quickOption,
              {
                backgroundColor:
                  tempStatus === "OT"
                    ? "#A855F7"
                    : isDark
                      ? "rgba(255,255,255,0.05)"
                      : "rgba(0,0,0,0.03)",
                borderColor: tempStatus === "OT" ? "#A855F7" : theme.border,
                borderWidth: 1,
              },
            ]}
          >
            <Feather
              name="trending-up"
              size={16}
              color={tempStatus === "OT" ? "#FFFFFF" : theme.text}
              style={{ marginBottom: 4 }}
            />
            <ThemedText
              style={[
                styles.quickOptionText,
                { color: tempStatus === "OT" ? "#FFFFFF" : theme.text },
              ]}
            >
              Overtime (OT)
            </ThemedText>
          </Pressable>
        </View>

        {(tempStatus === "P" ||
          tempStatus === "H" ||
          tempStatus === "OT") && (
          <View
            style={[styles.customAmountContainer, { marginTop: Spacing.md }]}
          >
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, marginBottom: 6 }}
            >
              {t.payment.advance} (Optional)
            </ThemedText>
            <View
              style={[
                styles.customInputRow,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundSecondary,
                },
              ]}
            >
              <ThemedText
                type="body"
                style={{ color: theme.textSecondary, fontWeight: "700" }}
              >
                ₹
              </ThemedText>
              <TextInput
                style={[styles.customAmountInput, { color: theme.text }]}
                placeholder={t.payment.advance + " amount"}
                placeholderTextColor={theme.textSecondary}
                value={tempCustomWage}
                onChangeText={setTempCustomWage}
                keyboardType="numeric"
              />
            </View>
          </View>
        )}

        {(tempStatus === "P" ||
          tempStatus === "H" ||
          tempStatus === "OT") && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowOvertimeModal(true);
            }}
            style={[
              styles.customAmountContainer,
              {
                marginTop: Spacing.md,
                padding: Spacing.md,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.backgroundSecondary,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              },
            ]}
          >
            <View>
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, marginBottom: 2 }}
              >
                Overtime (Optional)
              </ThemedText>
              <ThemedText type="body" style={{ fontWeight: "700" }}>
                {tempOvertimeType === "none"
                  ? "No Overtime"
                  : tempOvertimeType === "1x"
                    ? `1× (₹${selectedWorker?.dailyRate})`
                    : tempOvertimeType === "2x"
                      ? `2× (₹${(selectedWorker?.dailyRate ?? 0) * 2})`
                      : `Custom (₹${tempOvertimeCustomAmount})`}
              </ThemedText>
            </View>
            <Feather name="edit-2" size={14} color="#FF6B35" />
          </Pressable>
        )}

        {tempStatus && (
          <View
            style={{
              marginTop: Spacing.md,
              padding: Spacing.md,
              borderRadius: 14,
              backgroundColor: isDark
                ? "rgba(255, 255, 255, 0.02)"
                : "rgba(0, 0, 0, 0.02)",
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Status:
              </ThemedText>
              <ThemedText
                type="small"
                style={{
                  fontWeight: "800",
                  color:
                    tempStatus === "P"
                      ? EMERALD
                      : tempStatus === "H"
                        ? AMBER
                        : tempStatus === "A"
                          ? RED
                          : "#A855F7",
                }}
              >
                {tempStatus === "P"
                  ? (t.summary.present || "Present")
                  : tempStatus === "H"
                    ? (t.summary.halfDay || "Half Day")
                    : tempStatus === "A"
                      ? (t.summary.absent || "Absent")
                      : (t.summary.overtime || "Overtime")}
              </ThemedText>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Daily Rate:
              </ThemedText>
              <View
                style={{
                  backgroundColor: "#1E293B",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 6,
                }}
              >
                <ThemedText
                  type="small"
                  style={{ fontWeight: "800", color: "#FFFFFF" }}
                >
                  ₹{selectedWorker?.dailyRate ?? 0}
                </ThemedText>
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {t.payment.advance}:
              </ThemedText>
              <ThemedText
                type="small"
                style={{
                  fontWeight: "800",
                  color:
                    tempCustomWage.trim() !== ""
                      ? "#FF6B35"
                      : theme.textSecondary,
                }}
              >
                {tempCustomWage.trim() !== ""
                  ? `₹${tempCustomWage}`
                  : "Not Applied"}
              </ThemedText>
            </View>

            {tempOvertimeType !== "none" && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Overtime Amount:
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{
                    fontWeight: "800",
                    color: "#A855F7",
                  }}
                >
                  ₹
                  {tempOvertimeType === "1x"
                    ? (selectedWorker?.dailyRate ?? 0)
                    : tempOvertimeType === "2x"
                      ? (selectedWorker?.dailyRate ?? 0) * 2
                      : tempOvertimeCustomAmount || "0"}
                </ThemedText>
              </View>
            )}

            <View
              style={{
                height: 1,
                backgroundColor: theme.border,
                marginVertical: 6,
              }}
            />

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, fontWeight: "700" }}
              >
                Final Today's Pay:
              </ThemedText>
              <ThemedText
                type="body"
                style={{ fontWeight: "800", color: "#10B981" }}
              >
                ₹
                {(() => {
                  const baseRate = selectedWorker?.dailyRate ?? 0;
                  let advance = 0;
                  if (tempCustomWage.trim() !== "") {
                    const parsed = parseInt(tempCustomWage, 10);
                    if (!isNaN(parsed) && parsed >= 0) {
                      advance = parsed;
                    }
                  }
                  let overtime = 0;
                  if (tempOvertimeType === "1x") {
                    overtime = baseRate;
                  } else if (tempOvertimeType === "2x") {
                    overtime = baseRate * 2;
                  } else if (tempOvertimeType === "custom") {
                    const parsed = parseInt(tempOvertimeCustomAmount, 10);
                    if (!isNaN(parsed) && parsed >= 0) {
                      overtime = parsed;
                    }
                  }

                  if (tempStatus === "P" || tempStatus === "OT") {
                    return baseRate + advance + overtime;
                  }
                  if (tempStatus === "H") {
                    return (baseRate / 2) + advance + overtime;
                  }
                  if (tempStatus === "A") {
                    return 0; // strictly 0 for Absent
                  }
                  return advance + overtime;
                })()}
              </ThemedText>
            </View>
          </View>
        )}

        <Pressable
          onPress={captureGPSLocation}
          disabled={currentPlan !== "free" && isCapturingGPS}
          style={[
            styles.gpsButton,
            {
              backgroundColor:
                currentPlan === "free"
                  ? isDark
                    ? "rgba(255,255,255,0.02)"
                    : "rgba(0,0,0,0.02)"
                  : capturedLocation
                    ? EMERALD + "10"
                    : theme.backgroundSecondary,
              borderColor:
                currentPlan === "free"
                  ? theme.border
                  : capturedLocation
                    ? EMERALD
                    : theme.border,
              opacity: currentPlan === "free" ? 0.75 : 1,
              marginTop: Spacing.md,
            },
          ]}
        >
          {currentPlan === "free" ? (
            <Feather name="lock" size={14} color={theme.textSecondary} />
          ) : (
            <Feather
              name="map-pin"
              size={14}
              color={capturedLocation ? EMERALD : theme.textSecondary}
            />
          )}
          <ThemedText
            type="small"
            style={{
              color:
                currentPlan === "free"
                  ? theme.textSecondary
                  : capturedLocation
                    ? EMERALD
                    : theme.textSecondary,
              marginLeft: 6,
              fontWeight: "600",
            }}
          >
            {currentPlan === "free"
              ? "GPS Capture (Premium)"
              : isCapturingGPS
                ? t.attendance.gpsCapturing
                : capturedLocation
                  ? t.attendance.gpsCaptured
                  : t.attendance.captureGPS}
          </ThemedText>
          {currentPlan === "free" ? (
            <Feather
              name="chevron-right"
              size={14}
              color={theme.textSecondary}
              style={{ marginLeft: "auto" }}
            />
          ) : isCapturingGPS ? (
            <ActivityIndicator
              size="small"
              color={theme.textSecondary}
              style={{ marginLeft: "auto" }}
            />
          ) : capturedLocation ? (
            <Feather
              name="check-circle"
              size={14}
              color={EMERALD}
              style={{ marginLeft: "auto" }}
            />
          ) : null}
        </Pressable>

        {tempStatus && (
          <Pressable
            onPress={handleConfirmAttendance}
            style={[
              styles.gpsButton,
              {
                backgroundColor: theme.primary,
                borderColor: theme.primary,
                marginTop: Spacing.md,
                justifyContent: "center",
              },
            ]}
          >
            <Feather
              name="check-circle"
              size={16}
              color="#FFFFFF"
              style={{ marginRight: 6 }}
            />
            <ThemedText
              type="body"
              style={{ color: "#FFFFFF", fontWeight: "700" }}
            >
              ✔ Confirm / Sign
            </ThemedText>
          </Pressable>
        )}
      </GlassModal>

      {/* ── OVERTIME DIALOG MODAL ── */}
      <Modal
        visible={showOvertimeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOvertimeModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowOvertimeModal(false)}
        >
          <Pressable
            style={[
              styles.modalContentCard,
              {
                backgroundColor: isDark ? "#1E1E2A" : "#FFFFFF",
                borderColor: theme.border,
                borderWidth: 1,
                width: 320,
                padding: Spacing.xl,
                borderRadius: 16,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText type="h3" style={{ marginBottom: Spacing.md, textAlign: "center", fontWeight: "700" }}>
              Select Overtime Option
            </ThemedText>

            {/* Option 1: 1x Overtime */}
            <Pressable
              onPress={() => {
                setTempOvertimeType("1x");
                setTempOvertimeCustomAmount("");
              }}
              style={[
                styles.overtimeOptionBtn,
                {
                  borderColor: tempOvertimeType === "1x" ? "#FF6B35" : theme.border,
                  backgroundColor: tempOvertimeType === "1x" ? "rgba(255, 107, 53, 0.1)" : "transparent",
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: Spacing.md,
                  marginBottom: Spacing.sm,
                },
              ]}
            >
              <ThemedText type="body" style={{ fontWeight: "700" }}>
                1× Overtime
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Amount: ₹{selectedWorker?.dailyRate ?? 0}
              </ThemedText>
            </Pressable>

            {/* Option 2: 2x Overtime */}
            <Pressable
              onPress={() => {
                setTempOvertimeType("2x");
                setTempOvertimeCustomAmount("");
              }}
              style={[
                styles.overtimeOptionBtn,
                {
                  borderColor: tempOvertimeType === "2x" ? "#FF6B35" : theme.border,
                  backgroundColor: tempOvertimeType === "2x" ? "rgba(255, 107, 53, 0.1)" : "transparent",
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: Spacing.md,
                  marginBottom: Spacing.sm,
                },
              ]}
            >
              <ThemedText type="body" style={{ fontWeight: "700" }}>
                2× Overtime
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Amount: ₹{(selectedWorker?.dailyRate ?? 0) * 2}
              </ThemedText>
            </Pressable>

            {/* Option 3: Custom Overtime */}
            <Pressable
              onPress={() => {
                setTempOvertimeType("custom");
              }}
              style={[
                styles.overtimeOptionBtn,
                {
                  borderColor: tempOvertimeType === "custom" ? "#FF6B35" : theme.border,
                  backgroundColor: tempOvertimeType === "custom" ? "rgba(255, 107, 53, 0.1)" : "transparent",
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: Spacing.md,
                  marginBottom: Spacing.sm,
                },
              ]}
            >
              <ThemedText type="body" style={{ fontWeight: "700", marginBottom: 4 }}>
                Custom Overtime
              </ThemedText>
              {tempOvertimeType === "custom" ? (
                <View style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#FF6B35", marginTop: 4 }}>
                  <ThemedText type="body" style={{ marginRight: 4, color: theme.text }}>₹</ThemedText>
                  <TextInput
                    style={{ flex: 1, height: 36, paddingHorizontal: 4, fontSize: 14, color: theme.text }}
                    placeholder="Enter manual amount"
                    placeholderTextColor={theme.textSecondary}
                    value={tempOvertimeCustomAmount}
                    onChangeText={setTempOvertimeCustomAmount}
                    keyboardType="numeric"
                    autoFocus
                  />
                </View>
              ) : (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Enter custom amount
                </ThemedText>
              )}
            </Pressable>

            {/* Option 4: None */}
            <Pressable
              onPress={() => {
                setTempOvertimeType("none");
                setTempOvertimeCustomAmount("");
              }}
              style={[
                styles.overtimeOptionBtn,
                {
                  borderColor: theme.border,
                  backgroundColor: tempOvertimeType === "none" ? "rgba(0, 0, 0, 0.05)" : "transparent",
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: Spacing.md,
                  marginBottom: Spacing.sm,
                  marginTop: Spacing.sm,
                },
              ]}
            >
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                No Overtime
              </ThemedText>
            </Pressable>

            {/* Actions */}
            <View style={{ flexDirection: "row", gap: Spacing.md, marginTop: Spacing.lg }}>
              <Pressable
                onPress={() => {
                  setShowOvertimeModal(false);
                  if (tempStatus === "OT" && tempOvertimeType === "none") {
                    setTempStatus("P");
                  }
                }}
                style={[styles.paymentCancelBtn, { flex: 1, height: 44, justifyContent: "center", alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: theme.border }]}
              >
                <ThemedText type="body">Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (tempOvertimeType === "custom") {
                    const amt = parseFloat(tempOvertimeCustomAmount);
                    if (isNaN(amt) || amt < 0) {
                      Alert.alert("Error", "Please enter a valid amount");
                      return;
                    }
                  }
                  setShowOvertimeModal(false);
                }}
                style={[{ flex: 1, backgroundColor: "#FF6B35", height: 44, justifyContent: "center", alignItems: "center", borderRadius: 10 }]}
              >
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "700" }}>
                  Confirm
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── UPGRADE PRICING MODAL ── */}
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
            {/* Header */}
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
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowUpgradeModal(false);
                }}
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

            {/* Scrollable Plan List */}
            <ScrollView
              contentContainerStyle={styles.planScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* PLAN 1: FREE */}
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
                      Free
                    </ThemedText>
                    <ThemedText
                      type="body"
                      style={{ color: theme.textSecondary, marginTop: 2 }}
                    >
                      For small teams
                    </ThemedText>
                  </View>
                  <ThemedText
                    type="h2"
                    style={{ fontWeight: "800", color: theme.text }}
                  >
                    ₹0
                  </ThemedText>
                </View>
                <View style={styles.featureDivider} />
                <View style={styles.featureList}>
                  <View style={styles.featureRow}>
                    <Feather name="check" size={14} color="#10B981" />
                    <ThemedText type="body" style={styles.featureText}>
                      5 workers limit
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
                  onPress={() => {
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success,
                    );
                    Alert.alert(
                      "Plan Activated",
                      "You are currently on the Free plan.",
                    );
                  }}
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

              {/* PLAN 2: PROFESSIONAL (RECOMMENDED) */}
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
                {/* Popular badge */}
                <View style={styles.popularBadge}>
                  <ThemedText style={styles.popularBadgeText}>
                    MOST POPULAR
                  </ThemedText>
                </View>
                <View style={styles.planCardHeader}>
                  <View>
                    <ThemedText
                      type="h3"
                      style={{ fontWeight: "700", color: "#7C3AED" }}
                    >
                      Professional
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
                      /month
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
                      Unlimited workers
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
                  <View style={styles.featureRow}>
                    <Feather name="check" size={14} color="#7C3AED" />
                    <ThemedText type="body" style={styles.featureText}>
                      Hindi & English languages
                    </ThemedText>
                  </View>
                  <View style={styles.featureRow}>
                    <Feather name="check" size={14} color="#7C3AED" />
                    <ThemedText type="body" style={styles.featureText}>
                      Dark mode interface
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

              {/* PLAN 3: BUSINESS */}
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
                      Business
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
                      ₹999
                    </ThemedText>
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary }}
                    >
                      /month
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.featureDivider} />
                <View style={styles.featureList}>
                  <View style={styles.featureRow}>
                    <Feather name="check" size={14} color="#FF6B35" />
                    <ThemedText type="body" style={styles.featureText}>
                      GPS location attendance
                    </ThemedText>
                  </View>
                  <View style={styles.featureRow}>
                    <Feather name="check" size={14} color="#FF6B35" />
                    <ThemedText type="body" style={styles.featureText}>
                      Real-time Cloud Sync & backup
                    </ThemedText>
                  </View>
                  <View style={styles.featureRow}>
                    <Feather name="check" size={14} color="#FF6B35" />
                    <ThemedText type="body" style={styles.featureText}>
                      Multi-device operation
                    </ThemedText>
                  </View>
                  <View style={styles.featureRow}>
                    <Feather name="check" size={14} color="#FF6B35" />
                    <ThemedText type="body" style={styles.featureText}>
                      Multi-user role management
                    </ThemedText>
                  </View>
                  <View style={styles.featureRow}>
                    <Feather name="check" size={14} color="#FF6B35" />
                    <ThemedText type="body" style={styles.featureText}>
                      Advanced business analytics
                    </ThemedText>
                  </View>
                  <View style={styles.featureRow}>
                    <Feather name="check" size={14} color="#FF6B35" />
                    <ThemedText type="body" style={styles.featureText}>
                      24/7 Priority VIP support
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
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    marginBottom: Spacing.lg,
    opacity: 0.5,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    textAlign: "center",
  },
  monthSelector: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 14,
    gap: Spacing.xs,
    zIndex: 10,
    height: 46,
  },

  // ─ Grid Layout ──────────────────────────────────────
  gridContainer: {
    flex: 1,
  },
  gridInner: {
    flex: 1,
    flexDirection: "row",
  },

  // ─ Frozen Left Column ───────────────────────────────
  frozenCol: {
    width: NAME_COLUMN_WIDTH,
  },
  cornerCell: {
    width: NAME_COLUMN_WIDTH,
    height: CELL_SIZE,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderBottomWidth: 1,
  },
  cornerText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  workerNameCell: {
    width: NAME_COLUMN_WIDTH,
    height: CELL_SIZE,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
    borderRightWidth: 1,
    borderBottomWidth: 1,
  },
  workerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    flexShrink: 0,
  },
  workerAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  workerAvatarInitial: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  workerNameText: {
    flex: 1,
    fontWeight: "600",
    fontSize: 11,
  },

  // ─ Days Header Row ──────────────────────────────────
  daysHeaderRow: {
    flexDirection: "row",
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderBottomWidth: 1,
  },
  dayText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // ─ Attendance Cell Grid ─────────────────────────────
  attendanceCellRow: {
    flexDirection: "row",
  },
  cellWrapper: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
  },
  cell: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cellText: {
    fontSize: 12,
  },

  // ─── Modal Sheet Styles ────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "90%",
    maxWidth: 350,
    borderRadius: 24,
    overflow: "hidden",
  },
  modalBlur: {
    borderRadius: 24,
  },
  modalContentCard: {
    padding: Spacing.xl,
  },
  modalTitleText: {
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.lg,
  },

  // ─ Month Picker ───────────────────
  yearSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  yearArrow: { padding: Spacing.sm },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  monthItem: {
    width: "30%",
    paddingVertical: Spacing.md,
    alignItems: "center",
    borderRadius: 10,
    marginBottom: Spacing.sm,
  },

  // ─ Input modal marking options ────
  quickOptions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  quickOption: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  quickOptionText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12.5,
  },
  customAmountContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    alignItems: "center",
  },
  customInputRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    height: 48,
    gap: Spacing.xs,
  },
  customAmountInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  customAmountBtnWrap: {
    borderRadius: 14,
    overflow: "hidden",
  },
  customAmountButton: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  gpsButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: 14,
    borderWidth: 1.5,
    marginTop: Spacing.xs,
    height: 48,
  },
  // ── Upgrade Modal ──────────────────
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
  overtimeOptionBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paymentCancelBtn: {},
});
