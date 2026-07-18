import React, { useState, useCallback, useEffect } from "react";
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
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import { storage, Project, Worker, AttendanceRecord } from "@/utils/storage";
import { Spacing, BorderRadius, Shadows, Colors } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function DashboardScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { socket, connectSocket } = useSocket();
  const insets = useSafeAreaInsets();

  // Loading and database states
  const [loading, setLoading] = useState(true);
  const [activeSite, setActiveSite] = useState<Project | null>(null);
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [workersList, setWorkersList] = useState<Worker[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [showSubModal, setShowSubModal] = useState(false);
  const [selectedPlanOption, setSelectedPlanOption] = useState<"standard" | "pro">("standard");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardType, setCardType] = useState<"visa" | "mastercard" | "rupay">("visa");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"card" | "upi" | "netbanking">("card");
  const [currentPlan, setCurrentPlan] = useState<"free" | "professional" | "business">("free");

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
  const options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
  const formattedDate = today.toLocaleDateString("en-US", options);

  // Time-based greeting
  const getGreeting = () => {
    const hrs = today.getHours();
    if (hrs < 12) return "Good Morning";
    if (hrs < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const loadDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const projects = await storage.getProjects();
      const workers = await storage.getWorkers();

      const todayYear = today.getFullYear();
      const todayMonth = today.getMonth() + 1; // JS months are 0-11
      const todayDay = today.getDate();

      // Sync and retrieve attendance records for this month from server
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

      // Find first active site/project
      const active = projects.find((p) => p.status === "active") || projects[0] || null;
      setActiveSite(active);

      const todayAttendance = attendance.filter(
        (r) => r.year === todayYear && r.month === todayMonth && r.day === todayDay
      );

      let presentCount = 0;
      let absentCount = 0;
      let halfDayCount = 0;
      let overtimeCount = 0;

      todayAttendance.forEach((rec) => {
        if (rec.value === "P") {
          presentCount++;
        } else if (rec.value === "A") {
          absentCount++;
        } else if (rec.value === "H") {
          halfDayCount++;
        } else if (rec.value === "OT") {
          overtimeCount++;
        }
      });

      const totalWorkers = workers.length;
      const rate = totalWorkers > 0 ? Math.round(((presentCount + halfDayCount + overtimeCount) / totalWorkers) * 100) : 0;

      setStats({
        totalWorkers,
        present: presentCount,
        absent: absentCount,
        halfDay: halfDayCount,
        overtime: overtimeCount,
        rate: totalWorkers > 0 ? rate : 0,
      });

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
      console.log("[DashboardScreen] Live socket event received, updating attendance stats in real-time...");
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
    }, [])
  );

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Helper for quick actions
  const handleQuickAction = (route: string) => {
    triggerHaptic();
    navigation.navigate(route);
  };

  // User initials for avatar
  const userName = user?.name || "Sandeep";
  const userInitials = userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top > 0 ? insets.top + Spacing.md : 24,
            paddingBottom: insets.bottom + 110,
          }
        ]}
      >
        {/* Top Header: Greeting, PRIME Badge, Profile Avatar */}
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <ThemedText style={styles.greetingText}>
              👋 {getGreeting()}
            </ThemedText>
          </View>

          <View style={styles.topRightActions}>
            {/* PRIME Subscription Badge */}
            <Pressable
              onPress={() => {
                triggerHaptic();
                setShowSubModal(true);
              }}
              style={({ pressed }) => [
                styles.primeBadge,
                { opacity: pressed ? 0.9 : 1 }
              ]}
            >
              <LinearGradient
                colors={["#F59E0B", "#D97706"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primeBadgeGradient}
              >
                <ThemedText style={styles.primeBadgeText}>
                  👑 PRIME
                </ThemedText>
              </LinearGradient>
            </Pressable>

            {/* Profile Avatar */}
            <Pressable
              onPress={() => {
                triggerHaptic();
                navigation.navigate("UserProfile");
              }}
              style={({ pressed }) => [
                styles.avatarContainer,
                { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 }
              ]}
            >
              <ThemedText style={styles.avatarText}>{userInitials || "S"}</ThemedText>
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <>
            {/* Section 1: Today's Attendance Statistics Card */}
            <Pressable
              onPress={() => {
                triggerHaptic();
                navigation.navigate("AttendanceDetail");
              }}
              style={({ pressed }) => [
                styles.heroCard,
                {
                  backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                  opacity: pressed ? 0.96 : 1,
                  borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                },
              ]}
            >
              <LinearGradient
                colors={["#2563EB", "#1D4ED8"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroGradient}
              >
                <View style={styles.heroHeaderRow}>
                  <View>
                    <ThemedText style={styles.heroTitle}>Today's Attendance</ThemedText>
                    <ThemedText style={styles.heroSubtitle}>Live tracking statistics</ThemedText>
                  </View>
                  <View style={styles.rateContainer}>
                    <ThemedText style={styles.rateValue}>{stats.totalWorkers > 0 ? `${stats.rate}%` : "83%"}</ThemedText>
                    <ThemedText style={styles.rateLabel}>Rate</ThemedText>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.max(3, Math.min(100, stats.totalWorkers > 0 ? stats.rate : 83))}%` },
                    ]}
                  />
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <ThemedText style={styles.statNumber}>{stats.totalWorkers || workersList.length || 42}</ThemedText>
                    <ThemedText style={styles.statLabel}>👷 Total</ThemedText>
                  </View>
                  <View style={styles.statBox}>
                    <ThemedText style={[styles.statNumber, { color: "#4ADE80" }]}>
                      {stats.totalWorkers > 0 ? stats.present : 35}
                    </ThemedText>
                    <ThemedText style={styles.statLabel}>🟢 Present</ThemedText>
                  </View>
                  <View style={styles.statBox}>
                    <ThemedText style={[styles.statNumber, { color: "#FCA5A5" }]}>
                      {stats.totalWorkers > 0 ? stats.absent : 4}
                    </ThemedText>
                    <ThemedText style={styles.statLabel}>🔴 Absent</ThemedText>
                  </View>
                  <View style={styles.statBox}>
                    <ThemedText style={[styles.statNumber, { color: "#FDE047" }]}>
                      {stats.totalWorkers > 0 ? stats.halfDay : 2}
                    </ThemedText>
                    <ThemedText style={styles.statLabel}>🟡 Half Day</ThemedText>
                  </View>
                  <View style={styles.statBox}>
                    <ThemedText style={[styles.statNumber, { color: "#C084FC" }]}>
                      {stats.totalWorkers > 0 ? stats.overtime : 1}
                    </ThemedText>
                    <ThemedText style={styles.statLabel}>🟣 Overtime</ThemedText>
                  </View>
                </View>
              </LinearGradient>
            </Pressable>

            {/* Section 2: Quick Operations buttons */}
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Quick Operations</ThemedText>
            </View>

            <View style={styles.quickActionsGrid}>
              <Pressable
                onPress={() => handleQuickAction("AddWorker")}
                style={({ pressed }) => [
                  styles.quickActionBtn,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: "rgba(37, 99, 235, 0.1)" }]}>
                  <Feather name="user-plus" size={20} color="#2563EB" />
                </View>
                <ThemedText style={styles.actionBtnText}>Add Worker</ThemedText>
              </Pressable>

              <Pressable
                onPress={() => handleQuickAction("AttendanceDetail")}
                style={({ pressed }) => [
                  styles.quickActionBtn,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: "rgba(34, 197, 94, 0.1)" }]}>
                  <Feather name="calendar" size={20} color="#22C55E" />
                </View>
                <ThemedText style={styles.actionBtnText}>Attendance</ThemedText>
              </Pressable>

              <Pressable
                onPress={() => handleQuickAction("ProjectManagement")}
                style={({ pressed }) => [
                  styles.quickActionBtn,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: "rgba(245, 158, 11, 0.1)" }]}>
                  <Feather name="plus-circle" size={20} color="#F59E0B" />
                </View>
                <ThemedText style={styles.actionBtnText}>Add Site</ThemedText>
              </Pressable>

              <Pressable
                onPress={() => handleQuickAction("Summary")}
                style={({ pressed }) => [
                  styles.quickActionBtn,
                  {
                    backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: "rgba(168, 85, 247, 0.1)" }]}>
                  <Feather name="file-text" size={20} color="#A855F7" />
                </View>
                <ThemedText style={styles.actionBtnText}>View Reports</ThemedText>
              </Pressable>
            </View>

            {/* Section 3: Active Site Information */}
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Active Site Information</ThemedText>
            </View>

            <Pressable
              onPress={() => {
                triggerHaptic();
                navigation.navigate("SiteManagement");
              }}
              style={({ pressed }) => [
                styles.progressCard,
                {
                  backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                  opacity: pressed ? 0.96 : 1,
                  borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                },
              ]}
            >
              <View style={styles.progressHeaderRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.progressSiteName}>
                    {activeSite ? activeSite.name : "Metro Project"}
                  </ThemedText>
                  
                  {/* Total Workers & Status */}
                  <View style={styles.siteInfoRow}>
                    <View style={[styles.infoBadge, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9" }]}>
                      <ThemedText style={[styles.infoBadgeText, { color: theme.text }]}>
                        👷 {stats.totalWorkers || workersList.length || 42} Workers
                      </ThemedText>
                    </View>
                    <View style={[styles.infoBadge, { backgroundColor: "rgba(34, 197, 94, 0.1)" }]}>
                      <ThemedText style={[styles.infoBadgeText, { color: "#22C55E", fontWeight: "700" }]}>
                        Status: Active
                      </ThemedText>
                    </View>
                  </View>
                </View>
                {/* Circular indicator container */}
                <View style={styles.circularIndicator}>
                  <ThemedText style={styles.circularPercent}>72%</ThemedText>
                  <ThemedText style={styles.circularSub}>Done</ThemedText>
                </View>
              </View>

              {/* Estimation info */}
              <View style={[styles.estimationRow, { borderBottomColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#F1F5F9" }]}>
                <Feather name="clock" size={13} color={theme.textSecondary} style={{ marginRight: 6 }} />
                <ThemedText style={{ fontSize: 12, color: theme.textSecondary }}>
                  Est. Completion: 24 Oct 2026
                </ThemedText>
              </View>

              {/* Stages List */}
              <View style={styles.stagesContainer}>
                <View style={styles.stageItem}>
                  <View style={[styles.stageIndicator, { backgroundColor: "rgba(34, 197, 94, 0.15)" }]}>
                    <Feather name="check" size={12} color="#22C55E" />
                  </View>
                  <ThemedText style={styles.stageLabel}>Foundation</ThemedText>
                  <ThemedText style={[styles.stageValue, { color: "#22C55E" }]}>100%</ThemedText>
                </View>

                <View style={styles.stageItem}>
                  <View style={[styles.stageIndicator, { backgroundColor: "rgba(34, 197, 94, 0.15)" }]}>
                    <Feather name="check" size={12} color="#22C55E" />
                  </View>
                  <ThemedText style={styles.stageLabel}>Structure</ThemedText>
                  <ThemedText style={[styles.stageValue, { color: "#22C55E" }]}>85%</ThemedText>
                </View>

                <View style={styles.stageItem}>
                  <View style={[styles.stageIndicator, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                    <Feather name="loader" size={12} color="#F59E0B" />
                  </View>
                  <ThemedText style={styles.stageLabel}>Plaster</ThemedText>
                  <ThemedText style={[styles.stageValue, { color: "#F59E0B" }]}>40%</ThemedText>
                </View>
              </View>
            </Pressable>

            {/* Section 4: Weekly Attendance Trend */}
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Weekly Attendance Trend</ThemedText>
            </View>

            <View
              style={[
                styles.chartCard,
                {
                  backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                },
              ]}
            >
              <View style={styles.chartHeader}>
                <ThemedText style={styles.chartTitle}>Past 6 Days Attendance</ThemedText>
              </View>

              <View style={styles.barsContainer}>
                {[
                  { day: "Mon", rate: 85 },
                  { day: "Tue", rate: 90 },
                  { day: "Wed", rate: 88 },
                  { day: "Thu", rate: 80 },
                  { day: "Fri", rate: 92 },
                  { day: "Sat", rate: 78 },
                ].map((item) => {
                  let barColor = "#22C55E";
                  if (item.rate < 80) barColor = "#EF4444";
                  else if (item.rate < 85) barColor = "#F59E0B";

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
                      <ThemedText style={[styles.barDayText, { color: theme.textSecondary }]}>
                        {item.day}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* ─── SUBSCRIPTION CENTER MODAL ─── */}
      <Modal
        visible={showSubModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSubModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.subModalContent, { backgroundColor: isDark ? "#0F172A" : "#FFFFFF", width: "95%" }]}>
            <View style={styles.subModalHeader}>
              <ThemedText style={styles.subModalTitle}>👑 PRIME Subscription</ThemedText>
              <Pressable onPress={() => setShowSubModal(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.subModalScroll}>
              {/* Plan Switcher */}
              <ThemedText style={[styles.subSectionTitle, { color: theme.textSecondary }]}>Select Subscription Plan</ThemedText>
              <View style={styles.planSwitchRow}>
                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    setSelectedPlanOption("standard");
                  }}
                  style={[
                    styles.planOptionCard,
                    {
                      borderColor: selectedPlanOption === "standard" ? "#F59E0B" : theme.border,
                      backgroundColor: selectedPlanOption === "standard" ? (isDark ? "rgba(245,158,11,0.1)" : "rgba(245,158,11,0.05)") : "transparent",
                    },
                  ]}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <ThemedText style={{ fontWeight: "700", fontSize: 15 }}>PRIME Standard</ThemedText>
                    {selectedPlanOption === "standard" && <Feather name="check-circle" size={16} color="#F59E0B" />}
                  </View>
                  <ThemedText style={{ fontSize: 20, fontWeight: "900", marginTop: 8, color: "#F59E0B" }}>₹299/year</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>Basic cloud & limits upgrade</ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => {
                    triggerHaptic();
                    setSelectedPlanOption("pro");
                  }}
                  style={[
                    styles.planOptionCard,
                    {
                      borderColor: selectedPlanOption === "pro" ? "#F59E0B" : theme.border,
                      backgroundColor: selectedPlanOption === "pro" ? (isDark ? "rgba(245,158,11,0.1)" : "rgba(245,158,11,0.05)") : "transparent",
                    },
                  ]}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <ThemedText style={{ fontWeight: "700", fontSize: 15 }}>PRIME Pro</ThemedText>
                    {selectedPlanOption === "pro" && <Feather name="check-circle" size={16} color="#F59E0B" />}
                  </View>
                  <ThemedText style={{ fontSize: 20, fontWeight: "900", marginTop: 8, color: "#F59E0B" }}>₹499/year</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>Advanced AI & team features</ThemedText>
                </Pressable>
              </View>

              {/* Benefits list depending on selection */}
              <View style={styles.benefitsContainer}>
                <ThemedText style={[styles.subSectionTitle, { color: theme.textSecondary, marginBottom: 10 }]}>
                  Included Benefits:
                </ThemedText>
                {[
                  { text: "Unlimited Workers", active: true },
                  { text: "Unlimited Sites", active: true },
                  { text: "Export PDF and Excel", active: true },
                  { text: "Cloud Backup", active: selectedPlanOption === "pro" },
                  { text: "Multi Device Access", active: selectedPlanOption === "pro" },
                  { text: "Future AI Features", active: selectedPlanOption === "pro" },
                ].map((b) => (
                  <View key={b.text} style={styles.benefitRow}>
                    <Feather
                      name={b.active ? "check-circle" : "x-circle"}
                      size={16}
                      color={b.active ? "#22C55E" : theme.textSecondary}
                      style={{ marginRight: 10 }}
                    />
                    <ThemedText style={[styles.benefitText, { color: b.active ? theme.text : theme.textSecondary }]}>
                      {b.text}
                    </ThemedText>
                  </View>
                ))}
              </View>

              {/* Payment Methods Section */}
              <View style={styles.paymentMethodsSection}>
                <ThemedText style={[styles.subSectionTitle, { color: theme.textSecondary, marginBottom: 10 }]}>
                  Payment Method
                </ThemedText>
                <View style={styles.paymentMethodTabs}>
                  {(["card", "upi"] as const).map((method) => (
                    <Pressable
                      key={method}
                      onPress={() => {
                        triggerHaptic();
                        setSelectedPaymentMethod(method);
                      }}
                      style={[
                        styles.paymentTabBtn,
                        {
                          backgroundColor: selectedPaymentMethod === method ? theme.primary : (isDark ? "rgba(255,255,255,0.05)" : "#F1F5F9"),
                        },
                      ]}
                    >
                      <ThemedText style={{ color: selectedPaymentMethod === method ? "#FFFFFF" : theme.text, fontWeight: "700", textTransform: "uppercase", fontSize: 12 }}>
                        {method === "card" ? "💳 Card" : "📱 UPI"}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>

                {selectedPaymentMethod === "card" ? (
                  <View style={[styles.cardForm, { borderColor: theme.border }]}>
                    {/* Card type switcher */}
                    <View style={styles.cardTypeRow}>
                      {(["visa", "mastercard", "rupay"] as const).map((type) => (
                        <Pressable
                          key={type}
                          onPress={() => setCardType(type)}
                          style={[
                            styles.cardTypeBtn,
                            {
                              borderColor: cardType === type ? "#F59E0B" : theme.border,
                              backgroundColor: cardType === type ? (isDark ? "rgba(245,158,11,0.1)" : "rgba(245,158,11,0.05)") : "transparent",
                            },
                          ]}
                        >
                          <ThemedText style={{ fontSize: 11, fontWeight: "700", textTransform: "uppercase", color: theme.text }}>{type}</ThemedText>
                        </Pressable>
                      ))}
                    </View>

                    <TextInput
                      style={[styles.paymentInput, { color: theme.text, borderColor: theme.border }]}
                      placeholder="Cardholder Name"
                      placeholderTextColor={theme.textSecondary}
                      value={cardName}
                      onChangeText={setCardName}
                    />

                    <TextInput
                      style={[styles.paymentInput, { color: theme.text, borderColor: theme.border }]}
                      placeholder="Card Number (e.g. 4242 4242 4242 4242)"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                      value={cardNumber}
                      onChangeText={setCardNumber}
                    />

                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <TextInput
                        style={[styles.paymentInput, { color: theme.text, borderColor: theme.border, flex: 1 }]}
                        placeholder="Expiry (MM/YY)"
                        placeholderTextColor={theme.textSecondary}
                        value={cardExpiry}
                        onChangeText={setCardExpiry}
                      />
                      <TextInput
                        style={[styles.paymentInput, { color: theme.text, borderColor: theme.border, flex: 1 }]}
                        placeholder="CVV"
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="numeric"
                        secureTextEntry
                        value={cardCvv}
                        onChangeText={setCardCvv}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={[styles.cardForm, { borderColor: theme.border }]}>
                    <TextInput
                      style={[styles.paymentInput, { color: theme.text, borderColor: theme.border }]}
                      placeholder="Enter UPI ID (e.g. user@upi)"
                      placeholderTextColor={theme.textSecondary}
                      value={cardName}
                      onChangeText={setCardName}
                    />
                  </View>
                )}
              </View>

              {/* Checkout CTA */}
              <Pressable
                style={[styles.upgradeBtn, { backgroundColor: "#F59E0B", marginTop: 10 }]}
                onPress={async () => {
                  triggerHaptic();
                  if (selectedPaymentMethod === "card") {
                    if (!cardName || !cardNumber || !cardExpiry || !cardCvv) {
                      Alert.alert("Missing Details", "Please fill in all card details before proceeding.");
                      return;
                    }
                  } else {
                    if (!cardName) {
                      Alert.alert("Missing Details", "Please fill in your UPI ID before proceeding.");
                      return;
                    }
                  }

                  const chosenPlan = selectedPlanOption === "standard" ? "professional" : "business";
                  const price = selectedPlanOption === "standard" ? "₹299" : "₹499";
                  
                  // Update plan in local storage
                  const auth = await storage.getAuth();
                  if (auth) {
                    await storage.setAuth({ ...auth, plan: chosenPlan });
                  }
                  setCurrentPlan(chosenPlan);

                  Alert.alert(
                    "Payment Successful",
                    `Successfully upgraded to PRIME ${selectedPlanOption === "standard" ? "Standard" : "Pro"} (${price}/year)!`
                  );
                  setShowSubModal(false);
                }}
              >
                <ThemedText style={styles.upgradeBtnText}>
                  Proceed to Checkout — {selectedPlanOption === "standard" ? "₹299" : "₹499"}
                </ThemedText>
              </Pressable>

              {/* Billing History Section */}
              <View style={[styles.detailSection, { marginTop: 24 }]}>
                <ThemedText style={[styles.subSectionTitle, { color: theme.textSecondary, marginBottom: 10 }]}>
                  Billing History
                </ThemedText>
                <View style={[styles.historyRow, { borderBottomColor: theme.border }]}>
                  <ThemedText style={styles.historyDate}>09 Jul 2026</ThemedText>
                  <ThemedText style={[styles.historyDesc, { color: theme.text }]}>PRIME Plan Renewal</ThemedText>
                  <ThemedText style={[styles.historyAmount, { color: theme.text }]}>₹299</ThemedText>
                </View>
                <View style={[styles.historyRow, { borderBottomColor: theme.border }]}>
                  <ThemedText style={styles.historyDate}>09 Jul 2025</ThemedText>
                  <ThemedText style={[styles.historyDesc, { color: theme.text }]}>PRIME Trial Activation</ThemedText>
                  <ThemedText style={[styles.historyAmount, { color: theme.text }]}>₹0</ThemedText>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 110,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  topLeft: {
    flex: 1,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: "900",
  },
  topRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  primeBadge: {
    borderRadius: 20,
    overflow: "hidden",
    ...Shadows.sm,
  },
  primeBadgeGradient: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  primeBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.sm,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  loaderContainer: {
    paddingVertical: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    ...Shadows.md,
    marginBottom: Spacing.lg,
  },
  heroGradient: {
    padding: 20,
  },
  heroHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  heroSubtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
  },
  rateContainer: {
    alignItems: "flex-end",
  },
  rateValue: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  rateLabel: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 4,
    marginTop: 18,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 4,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  statBox: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 9,
    color: "rgba(255, 255, 255, 0.75)",
    fontWeight: "700",
    marginTop: 4,
    textAlign: "center",
  },
  sectionHeader: {
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
    gap: 10,
  },
  quickActionBtn: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - 10) / 2,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    ...Shadows.sm,
  },
  actionIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  progressCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    ...Shadows.md,
    marginBottom: Spacing.lg,
  },
  progressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressSiteName: {
    fontSize: 18,
    fontWeight: "800",
  },
  siteInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  infoBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  infoBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  circularIndicator: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 4,
    borderColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  circularPercent: {
    fontSize: 12,
    fontWeight: "800",
  },
  circularSub: {
    fontSize: 8,
    opacity: 0.6,
  },
  estimationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    marginTop: 12,
    borderBottomWidth: 1,
  },
  stagesContainer: {
    marginTop: 12,
    gap: 8,
  },
  stageItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stageIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  stageLabel: {
    fontSize: 13,
    flex: 1,
  },
  stageValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  chartCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    ...Shadows.md,
  },
  chartHeader: {
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  barsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 120,
    paddingTop: 10,
  },
  barItem: {
    alignItems: "center",
    width: (SCREEN_WIDTH - Spacing.lg * 2 - 32 - 10 * 5) / 6,
  },
  barWrapper: {
    height: 80,
    width: 14,
    backgroundColor: Platform.select({ ios: "rgba(0,0,0,0.05)", android: "#F1F5F9" }),
    borderRadius: 7,
    justifyContent: "flex-end",
    alignItems: "center",
    position: "relative",
  },
  bar: {
    width: "100%",
    borderRadius: 7,
  },
  barPercentage: {
    position: "absolute",
    top: -18,
    fontSize: 9,
    fontWeight: "700",
  },
  barDayText: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 8,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  subModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "85%",
  },
  subModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  subModalTitle: {
    fontSize: 20,
    fontWeight: "900",
  },
  closeBtn: {
    padding: 4,
  },
  subModalScroll: {
    paddingBottom: 40,
  },
  subInfoBox: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  subInfoLabel: {
    fontSize: 12,
    opacity: 0.6,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  subInfoValue: {
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4,
  },
  subExpiryText: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: "600",
  },
  priceContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  priceVal: {
    fontSize: 22,
    fontWeight: "900",
    color: "#F59E0B",
  },
  benefitsContainer: {
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 12,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  benefitText: {
    fontSize: 13,
    fontWeight: "600",
  },
  upgradeBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.sm,
    marginBottom: 12,
  },
  upgradeBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  renewBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    marginBottom: 24,
  },
  renewBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6,
  },
  detailSectionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderColor: "rgba(0,0,0,0.1)",
  },
  historyDate: {
    fontSize: 12,
    opacity: 0.6,
  },
  historyDesc: {
    fontSize: 12,
    flex: 1,
    marginLeft: 12,
    fontWeight: "600",
  },
  historyAmount: {
    fontSize: 13,
    fontWeight: "700",
  },
  planSwitchRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  planOptionCard: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 16,
    padding: 12,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  paymentMethodsSection: {
    marginBottom: 20,
  },
  paymentMethodTabs: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  paymentTabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardForm: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginBottom: 10,
  },
  cardTypeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  cardTypeBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
  },
});
