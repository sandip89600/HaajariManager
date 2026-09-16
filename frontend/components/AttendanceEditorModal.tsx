import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  Dimensions,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  BackHandler,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { Worker, AttendanceRecord, AttendanceValue } from "@/utils/storage";
import { requestLocationPermission, captureLocation } from "@/utils/gps";
import { Colors } from "@/constants/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface AttendanceEditorModalProps {
  visible: boolean;
  worker: Worker | null;
  date: Date;
  projectId?: string;
  initialRecord: AttendanceRecord | null;
  onClose: () => void;
  onSave: (record: AttendanceRecord) => void;
  onClear: () => void;
}

export const AttendanceEditorModal: React.FC<AttendanceEditorModalProps> = ({
  visible,
  worker,
  date,
  projectId,
  initialRecord,
  onClose,
  onSave,
  onClear,
}) => {
  const { isDark } = useTheme();
  const { t } = useLanguage();

  // Form states
  const [modalStatus, setModalStatus] = useState<"P" | "A" | "H" | "OT" | "">(
    "",
  );
  const [modalAdvance, setModalAdvance] = useState("");
  const [modalOvertimeHours, setModalOvertimeHours] = useState("");
  const [modalOvertimeWage, setModalOvertimeWage] = useState("");
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
  } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");

  // Track initial values to detect changes (unsaved changes check)
  const getInitialStates = () => {
    if (!initialRecord) {
      return {
        status: "",
        advance: "",
        otHours: "",
        otWage: "",
        location: null,
      };
    }
    const val = initialRecord.value;
    const status =
      typeof val === "number" ? "" : (val as "P" | "A" | "H" | "OT") || "";
    const advance =
      initialRecord.customWage !== undefined &&
      initialRecord.customWage !== null
        ? String(initialRecord.customWage)
        : "";
    const otHours =
      initialRecord.overtimeHours !== undefined &&
      initialRecord.overtimeHours !== null
        ? String(initialRecord.overtimeHours)
        : "";
    const otWage =
      initialRecord.overtimeWage !== undefined &&
      initialRecord.overtimeWage !== null
        ? String(initialRecord.overtimeWage)
        : "";
    return {
      status,
      advance,
      otHours,
      otWage,
      location: initialRecord.location || null,
    };
  };

  // Initialize values when modal opens
  useEffect(() => {
    if (visible) {
      const initials = getInitialStates();
      setModalStatus(initials.status as any);
      setModalAdvance(initials.advance);
      setModalOvertimeHours(initials.otHours);
      setModalOvertimeWage(initials.otWage);

      if (initials.location && initials.location.latitude) {
        setLocation({
          latitude: initials.location.latitude,
          longitude: initials.location.longitude,
          accuracy: initials.location.accuracy,
          address: "Stored coordinates",
        });
        Location.reverseGeocodeAsync({
          latitude: initials.location.latitude,
          longitude: initials.location.longitude,
        })
          .then((res) => {
            if (res && res.length > 0) {
              const item = res[0];
              const parts = [
                item.name,
                item.street,
                item.city || item.subregion,
                item.region,
              ].filter(Boolean);
              setLocation((prev) =>
                prev ? { ...prev, address: parts.join(", ") } : null,
              );
            }
          })
          .catch(() => {});
      } else {
        setLocation(null);
      }
      setLocationError("");
    }
  }, [visible, initialRecord]);

  // Detect unsaved changes
  const checkIsModified = () => {
    const initials = getInitialStates();
    const statusChanged = modalStatus !== initials.status;
    const advanceChanged = modalAdvance !== initials.advance;
    const otHoursChanged = modalOvertimeHours !== initials.otHours;
    const otWageChanged = modalOvertimeWage !== initials.otWage;

    // Check if location was captured newly
    const hasInitialLoc = !!initials.location?.latitude;
    const hasCurrentLoc = !!location?.latitude;
    const locationChanged = hasCurrentLoc && !hasInitialLoc;

    return (
      statusChanged ||
      advanceChanged ||
      otHoursChanged ||
      otWageChanged ||
      overtimeHoursChanged() ||
      locationChanged
    );
  };

  // Helper check for overtime change
  const overtimeHoursChanged = () => {
    const initials = getInitialStates();
    if (modalStatus === "OT") {
      return (
        modalOvertimeHours !== initials.otHours ||
        modalOvertimeWage !== initials.otWage
      );
    }
    return false;
  };

  const handleDismiss = () => {
    if (checkIsModified()) {
      Alert.alert("Discard Changes", "Discard unsaved changes?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => onClose(),
        },
      ]);
    } else {
      onClose();
    }
  };

  // Intercept hardware back button on Android
  useEffect(() => {
    const onBackPress = () => {
      if (visible) {
        handleDismiss();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );
    return () => subscription.remove();
  }, [
    visible,
    modalStatus,
    modalAdvance,
    modalOvertimeHours,
    modalOvertimeWage,
    location,
  ]);

  const handleCaptureLocation = async () => {
    setLocationLoading(true);
    setLocationError("");
    try {
      const permission = await requestLocationPermission();
      if (permission !== "granted") {
        setLocationError(
          "Location permission is required to capture attendance location.",
        );
        setLocationLoading(false);
        return;
      }
      const loc = await captureLocation();
      if (loc) {
        const newLoc = {
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy,
          address: "Fetching address...",
        };
        setLocation(newLoc);

        try {
          const res = await Location.reverseGeocodeAsync({
            latitude: loc.latitude,
            longitude: loc.longitude,
          });
          if (res && res.length > 0) {
            const item = res[0];
            const parts = [
              item.name,
              item.street,
              item.city || item.subregion,
              item.region,
            ].filter(Boolean);
            setLocation((prev) =>
              prev ? { ...prev, address: parts.join(", ") } : null,
            );
          } else {
            setLocation((prev) =>
              prev ? { ...prev, address: "Coordinates captured" } : null,
            );
          }
        } catch {
          setLocation((prev) =>
            prev ? { ...prev, address: "Coordinates captured" } : null,
          );
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setLocationError(
          "Unable to capture location coordinates. Please verify GPS is enabled.",
        );
      }
    } catch (e: any) {
      setLocationError(e.message || "Failed to capture location.");
    } finally {
      setLocationLoading(false);
    }
  };

  const handleClear = () => {
    Alert.alert(
      t("attendance.clearAttendance", "Clear Attendance"),
      t(
        "attendance.clearAttendanceConfirm",
        "Clear attendance for this worker on this date?",
      ),
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("attendance.clearAttendance", "Clear Attendance"),
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onClear();
          },
        },
      ],
    );
  };

  const handleSave = () => {
    if (!worker) return;

    const dailyRate = worker.dailyRate ?? 0;
    if (!modalStatus) {
      Alert.alert(
        t("attendance.statusRequired", "Status Required"),
        t("attendance.selectStatusDesc", "Please select an attendance status."),
      );
      return;
    }

    const finalValue: AttendanceValue = modalStatus;
    const isOT = finalValue === "OT";
    const otHoursNum =
      isOT && modalOvertimeHours ? parseFloat(modalOvertimeHours) : undefined;
    const otWageNum =
      isOT && modalOvertimeWage ? parseFloat(modalOvertimeWage) : undefined;
    const advanceNum =
      finalValue === "A"
        ? undefined
        : modalAdvance
          ? parseFloat(modalAdvance)
          : undefined;

    let finalPay = 0;
    if (finalValue === "OT") {
      finalPay = dailyRate + (otWageNum || 0);
    } else if (finalValue === "P") {
      finalPay = dailyRate;
    } else if (finalValue === "H") {
      finalPay = dailyRate / 2;
    } else if (finalValue === "A") {
      finalPay = 0;
    } else if (typeof finalValue === "number") {
      finalPay = finalValue;
    }

    const record: AttendanceRecord = {
      workerId: worker.id,
      projectId: projectId || undefined,
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate(),
      value: finalValue,
      dailyRate,
      finalPay,
      customWage: advanceNum,
      overtimeHours: otHoursNum,
      overtimeWage: otWageNum,
      location: location
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
          }
        : undefined,
      timestamp: Date.now(),
    };

    onSave(record);
  };

  // Live summary values calculation
  const getLiveSummary = () => {
    const dailyRate = worker?.dailyRate ?? 0;
    const advanceNum = modalAdvance ? parseFloat(modalAdvance) : 0;
    const otWageNum = modalOvertimeWage ? parseFloat(modalOvertimeWage) : 0;

    let statusText = t("attendance.unmarked", "Unmarked");
    let finalPay = 0;

    if (modalStatus === "P") {
      statusText = t.translateAttendanceStatus("PRESENT");
      finalPay = dailyRate;
    } else if (modalStatus === "A") {
      statusText = t.translateAttendanceStatus("ABSENT");
      finalPay = 0;
    } else if (modalStatus === "H") {
      statusText = t.translateAttendanceStatus("HALF_DAY");
      finalPay = dailyRate / 2;
    } else if (modalStatus === "OT") {
      statusText = t.translateAttendanceStatus("OVERTIME");
      finalPay = dailyRate + otWageNum;
    }

    return {
      status: statusText,
      dailyRate: dailyRate,
      advance: advanceNum,
      finalPay: finalPay,
    };
  };

  const summary = getLiveSummary();
  const colors = isDark ? Colors.dark : Colors.light;
  const borderCol = colors.border;
  const bgInput = isDark ? "#0F172A" : "#F8FAFC";

  const formattedDate = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleDismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.modalBgPress} onPress={handleDismiss} />

        <View
          style={[
            styles.detailsModalCard,
            { backgroundColor: isDark ? "#0F172A" : "#FFFFFF" },
          ]}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandleContainer}>
            <View
              style={[
                styles.dragHandle,
                { backgroundColor: isDark ? "#334155" : "#CBD5E1" },
              ]}
            />
          </View>

          {/* Sticky Header Section */}
          <View
            style={[
              styles.detailsModalHeader,
              { borderBottomColor: borderCol },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.tapCellLabel, { color: colors.textSecondary }]}
              >
                {t("attendance.tapCellDesc", "Tap cell to mark attendance")}
              </Text>
              <ThemedText style={styles.detailsModalTitle} numberOfLines={1}>
                {worker?.name}
              </ThemedText>
              <Text
                style={[
                  styles.detailsModalSub,
                  { color: colors.textSecondary },
                ]}
              >
                {t("workers.dailyWage", "Daily Rate")}: ₹
                {worker?.dailyRate ?? 0} • {formattedDate}
              </Text>
            </View>
            <Pressable
              onPress={handleDismiss}
              style={[
                styles.detailsCloseBtn,
                { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" },
              ]}
            >
              <Feather
                name="x"
                size={20}
                color={isDark ? "#FFFFFF" : "#1E293B"}
              />
            </Pressable>
          </View>

          {/* Scrollable Form Body */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Attendance Status Section */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              {(t.attendance?.status || "ATTENDANCE STATUS").toUpperCase()}
            </Text>
            <View style={styles.statusGrid}>
              {/* Present (P) */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setModalStatus("P");
                  setModalOvertimeHours("");
                  setModalOvertimeWage("");
                }}
                style={[
                  styles.statusCell,
                  {
                    backgroundColor:
                      modalStatus === "P"
                        ? isDark
                          ? "rgba(34, 197, 94, 0.15)"
                          : "#F0FDF4"
                        : isDark
                          ? "#1E293B"
                          : "#F8FAFC",
                    borderColor:
                      modalStatus === "P" ? colors.presentGreen : borderCol,
                    borderWidth: modalStatus === "P" ? 2 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusCellCode,
                    {
                      color:
                        modalStatus === "P"
                          ? colors.presentGreen
                          : isDark
                            ? "#FFFFFF"
                            : "#1E293B",
                    },
                  ]}
                >
                  P
                </Text>
                <Text
                  style={[
                    styles.statusCellLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t.translateAttendanceStatus("PRESENT")}
                </Text>
              </Pressable>

              {/* Absent (A) */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setModalStatus("A");
                  setModalOvertimeHours("");
                  setModalOvertimeWage("");
                  setModalAdvance("");
                }}
                style={[
                  styles.statusCell,
                  {
                    backgroundColor:
                      modalStatus === "A"
                        ? isDark
                          ? "rgba(239, 68, 68, 0.15)"
                          : "#FEF2F2"
                        : isDark
                          ? "#1E293B"
                          : "#F8FAFC",
                    borderColor:
                      modalStatus === "A" ? colors.absentRed : borderCol,
                    borderWidth: modalStatus === "A" ? 2 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusCellCode,
                    {
                      color:
                        modalStatus === "A"
                          ? colors.absentRed
                          : isDark
                            ? "#FFFFFF"
                            : "#1E293B",
                    },
                  ]}
                >
                  A
                </Text>
                <Text
                  style={[
                    styles.statusCellLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t.translateAttendanceStatus("ABSENT")}
                </Text>
              </Pressable>

              {/* Half Day (1/2) */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setModalStatus("H");
                  setModalOvertimeHours("");
                  setModalOvertimeWage("");
                }}
                style={[
                  styles.statusCell,
                  {
                    backgroundColor:
                      modalStatus === "H"
                        ? isDark
                          ? "rgba(245, 158, 11, 0.15)"
                          : "#FFFBEB"
                        : isDark
                          ? "#1E293B"
                          : "#F8FAFC",
                    borderColor:
                      modalStatus === "H" ? colors.halfDayYellow : borderCol,
                    borderWidth: modalStatus === "H" ? 2 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusCellCode,
                    {
                      color:
                        modalStatus === "H"
                          ? colors.halfDayYellow
                          : isDark
                            ? "#FFFFFF"
                            : "#1E293B",
                    },
                  ]}
                >
                  1/2
                </Text>
                <Text
                  style={[
                    styles.statusCellLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t.translateAttendanceStatus("HALF_DAY")}
                </Text>
              </Pressable>

              {/* Overtime (OT) */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setModalStatus("OT");
                }}
                style={[
                  styles.statusCell,
                  {
                    backgroundColor:
                      modalStatus === "OT"
                        ? isDark
                          ? "rgba(168, 85, 247, 0.15)"
                          : "#FAF5FF"
                        : isDark
                          ? "#1E293B"
                          : "#F8FAFC",
                    borderColor:
                      modalStatus === "OT" ? colors.overtimePurple : borderCol,
                    borderWidth: modalStatus === "OT" ? 2 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusCellCode,
                    {
                      color:
                        modalStatus === "OT"
                          ? colors.overtimePurple
                          : isDark
                            ? "#FFFFFF"
                            : "#1E293B",
                    },
                  ]}
                >
                  OT
                </Text>
                <Text
                  style={[
                    styles.statusCellLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t.translateAttendanceStatus("OVERTIME")}
                </Text>
              </Pressable>
            </View>

            {/* Advance Payment Section */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              {(t.payment?.advance || "ADVANCE PAYMENT").toUpperCase()}
            </Text>
            <View style={styles.inputWrapper}>
              <View
                style={[
                  styles.inputContainer,
                  { borderColor: borderCol, backgroundColor: bgInput },
                ]}
              >
                <Text
                  style={[
                    styles.currencyPrefix,
                    { color: colors.textSecondary },
                  ]}
                >
                  ₹
                </Text>
                <TextInput
                  keyboardType="numeric"
                  placeholder={t(
                    "payment.advancePlaceholder",
                    "Advance amount (e.g. 500)",
                  )}
                  placeholderTextColor={isDark ? "#475569" : "#94A3B8"}
                  style={[
                    styles.modalInput,
                    { color: isDark ? "#FFFFFF" : "#1E293B" },
                  ]}
                  value={modalAdvance}
                  onChangeText={setModalAdvance}
                />
              </View>
            </View>

            {/* Overtime Sub-Section (OT Status selected only) */}
            {modalStatus === "OT" && (
              <View style={styles.overtimeSection}>
                <Text
                  style={[styles.fieldLabel, { color: colors.overtimePurple }]}
                >
                  {(
                    t.attendance?.overtime || "OVERTIME CONFIGURATION"
                  ).toUpperCase()}
                </Text>
                <View style={styles.wagesRow}>
                  {/* OT Hours */}
                  <View style={styles.inputWrapper}>
                    <Text
                      style={[
                        styles.inputLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t("attendance.otHours", "OT Hours")}
                    </Text>
                    <View
                      style={[
                        styles.inputContainer,
                        { borderColor: borderCol, backgroundColor: bgInput },
                      ]}
                    >
                      <TextInput
                        keyboardType="numeric"
                        placeholder="e.g. 2"
                        placeholderTextColor={isDark ? "#475569" : "#94A3B8"}
                        style={[
                          styles.modalInput,
                          {
                            color: isDark ? "#FFFFFF" : "#1E293B",
                            paddingLeft: 12,
                          },
                        ]}
                        value={modalOvertimeHours}
                        onChangeText={setModalOvertimeHours}
                      />
                    </View>
                  </View>

                  {/* OT Wage */}
                  <View style={styles.inputWrapper}>
                    <Text
                      style={[
                        styles.inputLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t("attendance.otWage", "OT Wage / Rate")}
                    </Text>
                    <View
                      style={[
                        styles.inputContainer,
                        { borderColor: borderCol, backgroundColor: bgInput },
                      ]}
                    >
                      <Text
                        style={[
                          styles.currencyPrefix,
                          { color: colors.textSecondary },
                        ]}
                      >
                        ₹
                      </Text>
                      <TextInput
                        keyboardType="numeric"
                        placeholder="e.g. 200"
                        placeholderTextColor={isDark ? "#475569" : "#94A3B8"}
                        style={[
                          styles.modalInput,
                          { color: isDark ? "#FFFFFF" : "#1E293B" },
                        ]}
                        value={modalOvertimeWage}
                        onChangeText={setModalOvertimeWage}
                      />
                    </View>
                  </View>
                </View>

                {/* Multiplier configuration */}
                <View style={{ marginTop: 12 }}>
                  <Text
                    style={[styles.inputLabel, { color: colors.textSecondary }]}
                  >
                    {t("attendance.otMultiplier", "OT Multiplier")}
                  </Text>
                  <View style={styles.multiplierRow}>
                    <View
                      style={[
                        styles.multiplierBtn,
                        styles.disabledBtn,
                        { borderColor: borderCol },
                      ]}
                    >
                      <Text
                        style={[
                          styles.multiplierText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        1X
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.multiplierBtn,
                        styles.disabledBtn,
                        { borderColor: borderCol },
                      ]}
                    >
                      <Text
                        style={[
                          styles.multiplierText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        2X
                      </Text>
                    </View>
                    <Text style={styles.multiplierNotice}>
                      {t(
                        "attendance.multiplierNotice",
                        "Standard rate multiplier",
                      )}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Today's Summary Section */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              {(t.summary?.title || "TODAY'S SUMMARY").toUpperCase()}
            </Text>
            <View
              style={[
                styles.summaryCard,
                {
                  borderColor: borderCol,
                  backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                },
              ]}
            >
              <View style={styles.summaryItemRow}>
                <Text
                  style={[
                    styles.summaryItemKey,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t.attendance?.status || "Status"}:
                </Text>
                <Text
                  style={[
                    styles.summaryItemVal,
                    {
                      color: isDark ? "#FFFFFF" : "#1E293B",
                      fontWeight: "700",
                    },
                  ]}
                >
                  {summary.status}
                </Text>
              </View>

              <View style={styles.summaryItemRow}>
                <Text
                  style={[
                    styles.summaryItemKey,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t.workers?.dailyWage || "Daily Rate"}:
                </Text>
                <Text
                  style={[
                    styles.summaryItemVal,
                    { color: isDark ? "#FFFFFF" : "#1E293B" },
                  ]}
                >
                  ₹{summary.dailyRate}
                </Text>
              </View>

              <View style={styles.summaryItemRow}>
                <Text
                  style={[
                    styles.summaryItemKey,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t.payment?.advance || "Advance"}:
                </Text>
                <Text
                  style={[
                    styles.summaryItemVal,
                    {
                      color:
                        summary.advance > 0
                          ? colors.amountBlue
                          : colors.textSecondary,
                    },
                  ]}
                >
                  {summary.advance > 0
                    ? `₹${summary.advance}`
                    : t("common.notApplied", "Not Applied")}
                </Text>
              </View>

              <View
                style={[styles.summaryDivider, { backgroundColor: borderCol }]}
              />

              <View style={styles.summaryItemRow}>
                <Text
                  style={[
                    styles.finalPayKey,
                    { color: isDark ? "#FFFFFF" : "#1E293B" },
                  ]}
                >
                  {t("attendance.finalPay", "Final Today's Pay")}:
                </Text>
                <Text
                  style={[styles.finalPayVal, { color: colors.presentGreen }]}
                >
                  ₹{summary.finalPay}
                </Text>
              </View>
            </View>

            {/* GPS / Location Section */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              {(t.sites?.captureLocation || "GPS LOCATION").toUpperCase()}
            </Text>
            <View
              style={[
                styles.locationCard,
                {
                  borderColor: borderCol,
                  backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                },
              ]}
            >
              <View style={styles.locationHeaderRow}>
                <Ionicons name="location" size={18} color="#F97316" />
                <Text
                  style={[
                    styles.locationTitle,
                    { color: isDark ? "#FFFFFF" : "#1E293B" },
                  ]}
                >
                  📍 {t("sites.captureLocation", "Capture Location")}
                </Text>
              </View>

              {locationLoading ? (
                <View style={styles.loadingWrapper}>
                  <ActivityIndicator size="small" color="#F97316" />
                  <Text
                    style={[
                      styles.locationDesc,
                      { marginLeft: 8, color: colors.textSecondary },
                    ]}
                  >
                    {t(
                      "sites.gettingLocation",
                      "Getting location coordinates...",
                    )}
                  </Text>
                </View>
              ) : (
                <View>
                  {location ? (
                    <View style={styles.locationDetails}>
                      <Text
                        style={[
                          styles.locationAddress,
                          { color: isDark ? "#E2E8F0" : "#1E293B" },
                        ]}
                        numberOfLines={2}
                      >
                        {location.address}
                      </Text>
                      <Text
                        style={[
                          styles.locationCoordinates,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Lat: {location.latitude.toFixed(6)} | Lon:{" "}
                        {location.longitude.toFixed(6)}
                      </Text>
                    </View>
                  ) : (
                    <Text
                      style={[
                        styles.locationDesc,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t(
                        "sites.noLocationData",
                        "No location data captured yet.",
                      )}
                    </Text>
                  )}
                </View>
              )}

              {locationError ? (
                <Text style={styles.locationErrorText}>{locationError}</Text>
              ) : null}

              <Pressable
                onPress={handleCaptureLocation}
                disabled={locationLoading}
                style={({ pressed }) => [
                  styles.captureBtn,
                  { opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Text style={styles.captureBtnText}>
                  {location
                    ? t("sites.refreshLocation", "Refresh Location")
                    : t("sites.captureLocation", "Capture Location")}
                </Text>
              </Pressable>
            </View>
          </ScrollView>

          {/* Sticky Bottom Actions Container */}
          <View
            style={[
              styles.stickyBottomContainer,
              { borderTopColor: borderCol },
            ]}
          >
            {initialRecord && (
              <Pressable
                onPress={handleClear}
                style={({ pressed }) => [
                  styles.clearBtn,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={styles.clearBtnText}>
                  {t("attendance.clearAttendance", "Clear Attendance")}
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [
                styles.saveBtn,
                { opacity: pressed ? 0.95 : 1 },
              ]}
            >
              <LinearGradient
                colors={["#F97316", "#EA580C"]}
                style={styles.saveBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.saveBtnText}>
                  ✓ {t("attendance.confirmSave", "Confirm / Save Attendance")}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalBgPress: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  detailsModalCard: {
    width: "100%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 24,
  },
  detailsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  tapCellLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailsModalTitle: {
    fontSize: 22,
    fontWeight: "900",
  },
  detailsModalSub: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: "600",
  },
  detailsCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 10,
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    width: "100%",
  },
  statusCell: {
    width: (SCREEN_WIDTH - 50) / 2,
    height: 80,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  statusCellCode: {
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  statusCellLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "center",
  },
  wagesRow: {
    flexDirection: "row",
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: "700",
    paddingLeft: 12,
    marginRight: -4,
  },
  modalInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: "700",
  },
  overtimeSection: {
    marginTop: 12,
    paddingTop: 8,
  },
  multiplierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  multiplierBtn: {
    width: 44,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  disabledBtn: {
    opacity: 0.5,
  },
  multiplierText: {
    fontSize: 12,
    fontWeight: "700",
  },
  multiplierNotice: {
    fontSize: 11,
    fontWeight: "600",
    color: "#EF4444",
    flex: 1,
    marginLeft: 4,
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  summaryItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryItemKey: {
    fontSize: 13,
    fontWeight: "600",
  },
  summaryItemVal: {
    fontSize: 13,
    fontWeight: "700",
  },
  summaryDivider: {
    height: 1,
    marginVertical: 4,
  },
  finalPayKey: {
    fontSize: 14,
    fontWeight: "800",
  },
  finalPayVal: {
    fontSize: 18,
    fontWeight: "900",
  },
  locationCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginTop: 4,
  },
  locationHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  locationTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginLeft: 6,
  },
  loadingWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 8,
  },
  locationDetails: {
    marginVertical: 4,
  },
  locationAddress: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  locationCoordinates: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: "600",
  },
  locationDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginVertical: 4,
    fontWeight: "600",
  },
  locationErrorText: {
    color: "#EF4444",
    fontSize: 11,
    marginTop: 6,
    fontWeight: "700",
  },
  captureBtn: {
    height: 36,
    backgroundColor: "#F97316",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  captureBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  stickyBottomContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  clearBtn: {
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    marginBottom: 8,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#EF4444",
  },
  saveBtn: {
    height: 48,
    borderRadius: 12,
    overflow: "hidden",
  },
  saveBtnGrad: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
