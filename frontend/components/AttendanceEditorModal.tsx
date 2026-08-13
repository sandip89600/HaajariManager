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
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();

  // Form states
  const [modalStatus, setModalStatus] = useState<"P" | "A" | "H" | "OT" | "">("");
  const [modalCustomWage, setModalCustomWage] = useState("");
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
        customWage: "",
        advance: "",
        otHours: "",
        otWage: "",
        location: null,
      };
    }
    const val = initialRecord.value;
    const status = typeof val === "number" ? "" : ((val as "P" | "A" | "H" | "OT") || "");
    const customWage = typeof val === "number" ? String(val) : "";
    const advance =
      initialRecord.customWage !== undefined && initialRecord.customWage !== null
        ? String(initialRecord.customWage)
        : "";
    const otHours =
      initialRecord.overtimeHours !== undefined && initialRecord.overtimeHours !== null
        ? String(initialRecord.overtimeHours)
        : "";
    const otWage =
      initialRecord.overtimeWage !== undefined && initialRecord.overtimeWage !== null
        ? String(initialRecord.overtimeWage)
        : "";
    return { status, customWage, advance, otHours, otWage, location: initialRecord.location || null };
  };

  // Initialize values when modal opens
  useEffect(() => {
    if (visible) {
      const initials = getInitialStates();
      setModalStatus(initials.status as any);
      setModalCustomWage(initials.customWage);
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
              const parts = [item.name, item.street, item.city || item.subregion, item.region].filter(Boolean);
              setLocation((prev) => (prev ? { ...prev, address: parts.join(", ") } : null));
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
    const customWageChanged = modalCustomWage !== initials.customWage;
    const advanceChanged = modalAdvance !== initials.advance;
    const otHoursChanged = modalOvertimeHours !== initials.otHours;
    const otWageChanged = modalOvertimeWage !== initials.otWage;
    
    // Check if location was captured newly
    const hasInitialLoc = !!initials.location?.latitude;
    const hasCurrentLoc = !!location?.latitude;
    const locationChanged = hasCurrentLoc && !hasInitialLoc;

    return statusChanged || customWageChanged || advanceChanged || otHoursChanged || overtimeHoursChanged() || locationChanged;
  };

  // Helper check for overtime change
  const overtimeHoursChanged = () => {
    const initials = getInitialStates();
    if (modalStatus === "OT") {
      return modalOvertimeHours !== initials.otHours || modalOvertimeWage !== initials.otWage;
    }
    return false;
  };

  const handleDismiss = () => {
    if (checkIsModified()) {
      Alert.alert(
        "Discard Changes",
        "Discard unsaved changes?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => onClose(),
          },
        ]
      );
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

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [visible, modalStatus, modalCustomWage, modalAdvance, modalOvertimeHours, modalOvertimeWage, location]);

  const handleCaptureLocation = async () => {
    setLocationLoading(true);
    setLocationError("");
    try {
      const permission = await requestLocationPermission();
      if (permission !== "granted") {
        setLocationError("Location permission is required to capture attendance location.");
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
            setLocation((prev) => (prev ? { ...prev, address: parts.join(", ") } : null));
          } else {
            setLocation((prev) => (prev ? { ...prev, address: "Coordinates captured" } : null));
          }
        } catch {
          setLocation((prev) => (prev ? { ...prev, address: "Coordinates captured" } : null));
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setLocationError("Unable to capture location coordinates. Please verify GPS is enabled.");
      }
    } catch (e: any) {
      setLocationError(e.message || "Failed to capture location.");
    } finally {
      setLocationLoading(false);
    }
  };

  const handleClear = () => {
    Alert.alert(
      "Clear Attendance",
      `Clear attendance for this worker on this date?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Attendance",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onClear();
          },
        },
      ]
    );
  };

  const handleSave = () => {
    if (!worker) return;

    const dailyRate = worker.dailyRate ?? 0;
    const customWageNum = modalCustomWage ? parseFloat(modalCustomWage) : undefined;
    const advanceNum = modalAdvance ? parseFloat(modalAdvance) : undefined;
    const otHoursNum = modalOvertimeHours ? parseFloat(modalOvertimeHours) : undefined;
    const otWageNum = modalOvertimeWage ? parseFloat(modalOvertimeWage) : undefined;

    if (!modalStatus && (customWageNum === undefined || isNaN(customWageNum))) {
      Alert.alert("Status Required", "Please select an attendance status or enter a Custom Wage.");
      return;
    }

    // Resolve attendance value
    let finalValue: AttendanceValue = "P";
    if (customWageNum !== undefined && !isNaN(customWageNum)) {
      finalValue = customWageNum; // custom daily rate override
    } else if (modalStatus) {
      finalValue = modalStatus;
    }

    // Backend compatible wage calculation
    const dailyWageResolved = customWageNum !== undefined ? customWageNum : dailyRate;
    const advanceAmount = advanceNum || 0;
    const otAmount = otWageNum || 0;

    let finalPay = 0;
    if (finalValue === "P" || finalValue === "OT" || typeof finalValue === "number") {
      finalPay = dailyWageResolved + advanceAmount + otAmount;
    } else if (finalValue === "H") {
      finalPay = (dailyWageResolved / 2) + advanceAmount + otAmount;
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
      location: location ? {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      } : undefined,
      timestamp: Date.now(),
    };

    onSave(record);
  };

  // Live summary values calculation
  const getLiveSummary = () => {
    const dailyRate = worker?.dailyRate ?? 0;
    const customWageNum = modalCustomWage ? parseFloat(modalCustomWage) : NaN;
    const baseRate = !isNaN(customWageNum) ? customWageNum : dailyRate;
    const advanceNum = modalAdvance ? parseFloat(modalAdvance) : 0;
    const otWageNum = modalOvertimeWage ? parseFloat(modalOvertimeWage) : 0;

    let statusText = "Unmarked";
    let finalPay = 0;

    if (!isNaN(customWageNum)) {
      statusText = "Custom Wage Override";
      finalPay = customWageNum; // match backend's numeric value pay assignment
    } else if (modalStatus === "P") {
      statusText = "Present";
      finalPay = baseRate + advanceNum + otWageNum;
    } else if (modalStatus === "A") {
      statusText = "Absent";
      finalPay = 0;
    } else if (modalStatus === "H") {
      statusText = "Half Day";
      finalPay = (baseRate / 2) + advanceNum + otWageNum;
    } else if (modalStatus === "OT") {
      statusText = "Overtime";
      finalPay = baseRate + advanceNum + otWageNum;
    }

    return {
      status: statusText,
      dailyRate: dailyRate,
      customWage: !isNaN(customWageNum) ? customWageNum : null,
      advance: advanceNum,
      finalPay: finalPay,
    };
  };

  const summary = getLiveSummary();
  const colors = isDark ? Colors.dark : Colors.light;
  const borderCol = colors.border;
  const bgInput = isDark ? "#0F172A" : "#F8FAFC";

  const formattedDate = date.toLocaleDateString("en-US", {
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
        
        <View style={[styles.detailsModalCard, { backgroundColor: isDark ? "#0F172A" : "#FFFFFF" }]}>
          {/* Drag Handle */}
          <View style={styles.dragHandleContainer}>
            <View style={[styles.dragHandle, { backgroundColor: isDark ? "#334155" : "#CBD5E1" }]} />
          </View>

          {/* Sticky Header Section */}
          <View style={[styles.detailsModalHeader, { borderBottomColor: borderCol }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tapCellLabel, { color: colors.textSecondary }]}>
                Tap cell to mark attendance
              </Text>
              <ThemedText style={styles.detailsModalTitle} numberOfLines={1}>
                {worker?.name}
              </ThemedText>
              <Text style={[styles.detailsModalSub, { color: colors.textSecondary }]}>
                Daily Rate: ₹{worker?.dailyRate ?? 0}  •  {formattedDate}
              </Text>
            </View>
            <Pressable onPress={handleDismiss} style={[styles.detailsCloseBtn, { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }]}>
              <Feather name="x" size={20} color={isDark ? "#FFFFFF" : "#1E293B"} />
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
              ATTENDANCE STATUS
            </Text>
            <View style={styles.statusGrid}>
              {/* Present */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setModalStatus("P");
                  setModalCustomWage("");
                }}
                style={[
                  styles.statusCell,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    borderColor: modalStatus === "P" && !modalCustomWage ? colors.presentGreen : borderCol,
                    borderWidth: modalStatus === "P" && !modalCustomWage ? 2 : 1,
                  },
                ]}
              >
                <View style={styles.statusCellHeader}>
                  <Ionicons 
                    name="checkmark-circle" 
                    size={20} 
                    color={modalStatus === "P" && !modalCustomWage ? colors.presentGreen : colors.textSecondary} 
                  />
                  <Text style={[styles.statusCellCode, { color: isDark ? "#FFFFFF" : "#1E293B" }]}>P</Text>
                </View>
                <Text style={[styles.statusCellLabel, { color: colors.textSecondary }]}>Present</Text>
              </Pressable>

              {/* Absent */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setModalStatus("A");
                  setModalCustomWage("");
                }}
                style={[
                  styles.statusCell,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    borderColor: modalStatus === "A" && !modalCustomWage ? colors.absentRed : borderCol,
                    borderWidth: modalStatus === "A" && !modalCustomWage ? 2 : 1,
                  },
                ]}
              >
                <View style={styles.statusCellHeader}>
                  <Ionicons 
                    name="close-circle" 
                    size={20} 
                    color={modalStatus === "A" && !modalCustomWage ? colors.absentRed : colors.textSecondary} 
                  />
                  <Text style={[styles.statusCellCode, { color: isDark ? "#FFFFFF" : "#1E293B" }]}>A</Text>
                </View>
                <Text style={[styles.statusCellLabel, { color: colors.textSecondary }]}>Absent</Text>
              </Pressable>

              {/* Half Day */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setModalStatus("H");
                  setModalCustomWage("");
                }}
                style={[
                  styles.statusCell,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    borderColor: modalStatus === "H" && !modalCustomWage ? colors.halfDayYellow : borderCol,
                    borderWidth: modalStatus === "H" && !modalCustomWage ? 2 : 1,
                  },
                ]}
              >
                <View style={styles.statusCellHeader}>
                  <Ionicons 
                    name="time" 
                    size={20} 
                    color={modalStatus === "H" && !modalCustomWage ? colors.halfDayYellow : colors.textSecondary} 
                  />
                  <Text style={[styles.statusCellCode, { color: isDark ? "#FFFFFF" : "#1E293B" }]}>1/2</Text>
                </View>
                <Text style={[styles.statusCellLabel, { color: colors.textSecondary }]}>Half Day</Text>
              </Pressable>

              {/* Overtime */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setModalStatus("OT");
                  setModalCustomWage("");
                }}
                style={[
                  styles.statusCell,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
                    borderColor: modalStatus === "OT" && !modalCustomWage ? colors.overtimePurple : borderCol,
                    borderWidth: modalStatus === "OT" && !modalCustomWage ? 2 : 1,
                  },
                ]}
              >
                <View style={styles.statusCellHeader}>
                  <Ionicons 
                    name="flash" 
                    size={20} 
                    color={modalStatus === "OT" && !modalCustomWage ? colors.overtimePurple : colors.textSecondary} 
                  />
                  <Text style={[styles.statusCellCode, { color: isDark ? "#FFFFFF" : "#1E293B" }]}>OT</Text>
                </View>
                <Text style={[styles.statusCellLabel, { color: colors.textSecondary }]}>Overtime</Text>
              </Pressable>
            </View>

            {/* Wage & Payment Section */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              WAGE & PAYMENT
            </Text>
            <View style={styles.wagesRow}>
              {/* Custom Wage Input */}
              <View style={styles.inputWrapper}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Custom Wage (Override)</Text>
                <View style={[styles.inputContainer, { borderColor: borderCol, backgroundColor: bgInput }]}>
                  <Text style={[styles.currencyPrefix, { color: colors.textSecondary }]}>₹</Text>
                  <TextInput
                    keyboardType="numeric"
                    placeholder="Override rate"
                    placeholderTextColor={isDark ? "#475569" : "#94A3B8"}
                    style={[styles.modalInput, { color: isDark ? "#FFFFFF" : "#1E293B" }]}
                    value={modalCustomWage}
                    onChangeText={(val) => {
                      setModalCustomWage(val);
                      if (val) setModalStatus(""); // clear status icons if custom override value entered
                    }}
                  />
                </View>
              </View>

              {/* Advance Input */}
              <View style={styles.inputWrapper}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Advance Payment</Text>
                <View style={[styles.inputContainer, { borderColor: borderCol, backgroundColor: bgInput }]}>
                  <Text style={[styles.currencyPrefix, { color: colors.textSecondary }]}>₹</Text>
                  <TextInput
                    keyboardType="numeric"
                    placeholder="e.g. 500"
                    placeholderTextColor={isDark ? "#475569" : "#94A3B8"}
                    style={[styles.modalInput, { color: isDark ? "#FFFFFF" : "#1E293B" }]}
                    value={modalAdvance}
                    onChangeText={setModalAdvance}
                  />
                </View>
              </View>
            </View>

            {/* Overtime Sub-Section (OT Status selected only) */}
            {modalStatus === "OT" && (
              <View style={styles.overtimeSection}>
                <Text style={[styles.fieldLabel, { color: colors.overtimePurple }]}>
                  OVERTIME CONFIGURATION
                </Text>
                <View style={styles.wagesRow}>
                  {/* OT Hours */}
                  <View style={styles.inputWrapper}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>OT Hours</Text>
                    <View style={[styles.inputContainer, { borderColor: borderCol, backgroundColor: bgInput }]}>
                      <TextInput
                        keyboardType="numeric"
                        placeholder="e.g. 2"
                        placeholderTextColor={isDark ? "#475569" : "#94A3B8"}
                        style={[styles.modalInput, { color: isDark ? "#FFFFFF" : "#1E293B", paddingLeft: 12 }]}
                        value={modalOvertimeHours}
                        onChangeText={setModalOvertimeHours}
                      />
                    </View>
                  </View>

                  {/* OT Wage */}
                  <View style={styles.inputWrapper}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>OT Wage / Rate</Text>
                    <View style={[styles.inputContainer, { borderColor: borderCol, backgroundColor: bgInput }]}>
                      <Text style={[styles.currencyPrefix, { color: colors.textSecondary }]}>₹</Text>
                      <TextInput
                        keyboardType="numeric"
                        placeholder="e.g. 200"
                        placeholderTextColor={isDark ? "#475569" : "#94A3B8"}
                        style={[styles.modalInput, { color: isDark ? "#FFFFFF" : "#1E293B" }]}
                        value={modalOvertimeWage}
                        onChangeText={setModalOvertimeWage}
                      />
                    </View>
                  </View>
                </View>

                {/* Multiplier configuration */}
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>OT Multiplier</Text>
                  <View style={styles.multiplierRow}>
                    <View style={[styles.multiplierBtn, styles.disabledBtn, { borderColor: borderCol }]}>
                      <Text style={[styles.multiplierText, { color: colors.textSecondary }]}>1X</Text>
                    </View>
                    <View style={[styles.multiplierBtn, styles.disabledBtn, { borderColor: borderCol }]}>
                      <Text style={[styles.multiplierText, { color: colors.textSecondary }]}>2X</Text>
                    </View>
                    <Text style={styles.multiplierNotice}>
                      Backend support is required for this field.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Today's Summary Section */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              TODAY'S SUMMARY
            </Text>
            <View style={[styles.summaryCard, { borderColor: borderCol, backgroundColor: isDark ? "#1E293B" : "#F8FAFC" }]}>
              <View style={styles.summaryItemRow}>
                <Text style={[styles.summaryItemKey, { color: colors.textSecondary }]}>Status:</Text>
                <Text style={[styles.summaryItemVal, { color: isDark ? "#FFFFFF" : "#1E293B", fontWeight: "700" }]}>
                  {summary.status}
                </Text>
              </View>

              <View style={styles.summaryItemRow}>
                <Text style={[styles.summaryItemKey, { color: colors.textSecondary }]}>Daily Rate:</Text>
                <Text style={[styles.summaryItemVal, { color: isDark ? "#FFFFFF" : "#1E293B" }]}>
                  ₹{summary.dailyRate}
                </Text>
              </View>

              {summary.customWage !== null && (
                <View style={styles.summaryItemRow}>
                  <Text style={[styles.summaryItemKey, { color: colors.textSecondary }]}>Custom Wage:</Text>
                  <Text style={[styles.summaryItemVal, { color: colors.amountBlue }]}>
                    ₹{summary.customWage}
                  </Text>
                </View>
              )}

              <View style={styles.summaryItemRow}>
                <Text style={[styles.summaryItemKey, { color: colors.textSecondary }]}>Advance:</Text>
                <Text style={[styles.summaryItemVal, { color: summary.advance > 0 ? colors.amountBlue : colors.textSecondary }]}>
                  {summary.advance > 0 ? `₹${summary.advance}` : "Not Applied"}
                </Text>
              </View>

              <View style={[styles.summaryDivider, { backgroundColor: borderCol }]} />

              <View style={styles.summaryItemRow}>
                <Text style={[styles.finalPayKey, { color: isDark ? "#FFFFFF" : "#1E293B" }]}>Final Today's Pay:</Text>
                <Text style={[styles.finalPayVal, { color: colors.presentGreen }]}>
                  ₹{summary.finalPay}
                </Text>
              </View>
            </View>

            {/* GPS / Location Section */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              GPS LOCATION
            </Text>
            <View style={[styles.locationCard, { borderColor: borderCol, backgroundColor: isDark ? "#1E293B" : "#F8FAFC" }]}>
              <View style={styles.locationHeaderRow}>
                <Ionicons name="location" size={18} color="#F97316" />
                <Text style={[styles.locationTitle, { color: isDark ? "#FFFFFF" : "#1E293B" }]}>
                  📍 Capture Location
                </Text>
              </View>

              {locationLoading ? (
                <View style={styles.loadingWrapper}>
                  <ActivityIndicator size="small" color="#F97316" />
                  <Text style={[styles.locationDesc, { marginLeft: 8, color: colors.textSecondary }]}>
                    Getting location coordinate...
                  </Text>
                </View>
              ) : (
                <View>
                  {location ? (
                    <View style={styles.locationDetails}>
                      <Text style={[styles.locationAddress, { color: isDark ? "#E2E8F0" : "#1E293B" }]} numberOfLines={2}>
                        {location.address}
                      </Text>
                      <Text style={[styles.locationCoordinates, { color: colors.textSecondary }]}>
                        Lat: {location.latitude.toFixed(6)} | Lon: {location.longitude.toFixed(6)}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.locationDesc, { color: colors.textSecondary }]}>
                      No location data captured yet.
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
                  {location ? "Refresh Location" : "Capture Location"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>

          {/* Sticky Bottom Actions Container */}
          <View style={[styles.stickyBottomContainer, { borderTopColor: borderCol }]}>
            {initialRecord && (
              <Pressable
                onPress={handleClear}
                style={({ pressed }) => [
                  styles.clearBtn,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={styles.clearBtnText}>Clear Attendance</Text>
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
                <Text style={styles.saveBtnText}>✓ Confirm / Save Attendance</Text>
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
    maxHeight: SCREEN_HEIGHT * 0.90,
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
    height: 68,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  statusCellHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusCellCode: {
    fontSize: 18,
    fontWeight: "900",
  },
  statusCellLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
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
