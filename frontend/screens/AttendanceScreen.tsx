import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
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
  Text,
  DeviceEventEmitter,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { AttendanceEditorModal } from "@/components/AttendanceEditorModal";
import { AttendanceCompactStats, AttendanceStatsData } from "@/components/AttendanceCompactStats";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import {
  storage,
  Project,
  Worker,
  AttendanceRecord,
  AttendanceValue,
  API_URL,
} from "@/utils/storage";
import { Spacing, BorderRadius, Shadows, Colors } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function AttendanceScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { socket, connectSocket } = useSocket();
  const insets = useSafeAreaInsets();

  // Route site/project param
  const passedSiteId = route.params?.siteId;

  // Refs for Scroll Sync
  const leftScrollRef = useRef<ScrollView>(null);
  const rightScrollRef = useRef<ScrollView>(null);
  const isScrollingRef = useRef<'left' | 'right' | null>(null);

  // States
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [activeSite, setActiveSite] = useState<Project | null>(null);

  // Month Picker Modal state
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(selectedDate.getFullYear());

  // Unified Cell Edit Modal state (merged tap + detailed)
  const [cellModalVisible, setCellModalVisible] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [selectedDayNum, setSelectedDayNum] = useState<number>(1);

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth(); // 0-indexed

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysInMonth = useMemo(() => {
    return new Date(year, month + 1, 0).getDate();
  }, [year, month]);

  // Load Data with Instant Cache + Parallel Revalidation
  const loadData = async (silent = false) => {
    try {
      if (!silent && workers.length === 0) setLoading(true);
      
      // Parallel fetch of independent requests instead of sequential waterfall
      const [sitesResult, loadedWorkers, monthAttendance] = await Promise.all([
        storage.getSites(),
        storage.getWorkers(),
        storage.getAttendanceForMonth(year, month),
      ]);

      const rawSites = sitesResult.sites || [];
      const projects: Project[] = rawSites.map((s: any) => ({
        id: s.id,
        name: s.name,
        location: s.address || s.location,
        status: (s.status === "Completed" || s.status === "On Hold") ? "inactive" : "active",
        startDate: s.startDate,
        endDate: s.endDate,
        clientName: s.clientName,
      })) as any[];

      const activeProj = passedSiteId 
        ? (projects.find((p) => p.id === passedSiteId) || projects[0] || null)
        : (projects.find((p) => p.status === "active") || projects[0] || null);
      
      setActiveSite(activeProj);

      // Filter workers assigned to the active site/project
      const siteWorkers = activeProj 
        ? loadedWorkers.filter((w) => w.projectId === activeProj.id)
        : loadedWorkers;

      setWorkers(siteWorkers);
      setAttendance(monthAttendance);
    } catch (e) {
      console.warn("Failed to load attendance grid data:", e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [selectedDate, passedSiteId, user?.id])
  );

  useEffect(() => {
    connectSocket();
    const handleUpdate = () => loadData(true);
    socket.on("admin_dashboard_update", handleUpdate);
    const sub = DeviceEventEmitter.addListener("refreshData", () => loadData(true));
    return () => {
      socket.off("admin_dashboard_update", handleUpdate);
      sub.remove();
    };
  }, [socket]);

  // Bidirectional scroll sync
  const handleRightScroll = (event: any) => {
    if (isScrollingRef.current === 'left') return;
    isScrollingRef.current = 'right';
    const y = event.nativeEvent.contentOffset.y;
    leftScrollRef.current?.scrollTo({ y, animated: false });
    // Reset after frame
    requestAnimationFrame(() => { isScrollingRef.current = null; });
  };

  const handleLeftScroll = (event: any) => {
    if (isScrollingRef.current === 'right') return;
    isScrollingRef.current = 'left';
    const y = event.nativeEvent.contentOffset.y;
    rightScrollRef.current?.scrollTo({ y, animated: false });
    requestAnimationFrame(() => { isScrollingRef.current = null; });
  };

  const getAttendanceValueForDay = (workerId: string, dayNum: number): AttendanceValue | null => {
    const rec = attendance.find(
      (r) => r.workerId === workerId && r.year === year && r.month === month && r.day === dayNum
    );
    return rec?.value ?? null;
  };

  const deleteAttendanceLocally = async (workerId: string, yr: number, mo: number, dy: number) => {
    const allRecords = await storage.getAttendance();
    const filtered = allRecords.filter(
      (r) => !(r.workerId === workerId && r.year === yr && r.month === mo && r.day === dy)
    );
    await storage.setAttendance(filtered);
  };

  // Cycle status: Unmarked -> P -> A -> H -> OT -> Unmarked
  const cycleAttendance = async (workerId: string, dayNum: number, currentVal: AttendanceValue | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let nextVal: AttendanceValue | null = null;
    if (currentVal === null) nextVal = "P";
    else if (currentVal === "P") nextVal = "A";
    else if (currentVal === "A") nextVal = "H";
    else if (currentVal === "H") nextVal = "OT";
    else if (currentVal === "OT") nextVal = null;

    try {
      const worker = workers.find((w) => w.id === workerId);
      const dailyRate = worker?.dailyRate ?? 0;
      let finalPay = 0;
      if (nextVal === "P" || nextVal === "OT") finalPay = dailyRate;
      else if (nextVal === "H") finalPay = dailyRate / 2;

      if (nextVal === null) {
        await deleteAttendanceLocally(workerId, year, month, dayNum);
        setAttendance((prev) =>
          prev.filter(
            (r) => !(r.workerId === workerId && r.year === year && r.month === month && r.day === dayNum)
          )
        );
      } else {
        const newRecord: AttendanceRecord = {
          workerId,
          projectId: activeSite?.id || undefined,
          year,
          month,
          day: dayNum,
          value: nextVal,
          dailyRate,
          finalPay,
          timestamp: Date.now(),
        };
        await storage.setAttendanceRecord(newRecord);

        setAttendance((prev) => {
          const idx = prev.findIndex(
            (r) => r.workerId === workerId && r.year === year && r.month === month && r.day === dayNum
          );
          const updated = [...prev];
          if (idx !== -1) {
            updated[idx] = newRecord;
          } else {
            updated.push(newRecord);
          }
          return updated;
        });
      }
    } catch (e) {
      console.warn("Failed to cycle attendance status:", e);
    }
  };



  // Open detailed popup modal
  const openDetailedModal = (worker: Worker, dayNum: number, currentVal: AttendanceValue | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedWorker(worker);
    setSelectedDayNum(dayNum);
    setCellModalVisible(true);
  };

  const handleSaveDetailedRecord = async (record: AttendanceRecord) => {
    try {
      await storage.setAttendanceRecord(record);
      setAttendance((prev) => {
        const idx = prev.findIndex(
          (r) => r.workerId === record.workerId && r.year === record.year && r.month === record.month && r.day === record.day
        );
        const updated = [...prev];
        if (idx !== -1) {
          updated[idx] = record;
        } else {
          updated.push(record);
        }
        return updated;
      });
      setCellModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.warn("Failed to save detailed cell info:", e);
    }
  };

  const handleClearDetailedRecord = async () => {
    if (!selectedWorker) return;
    try {
      await deleteAttendanceLocally(selectedWorker.id, year, month, selectedDayNum);
      setAttendance((prev) =>
        prev.filter(
          (r) => !(r.workerId === selectedWorker.id && r.year === year && r.month === month && r.day === selectedDayNum)
        )
      );
      setCellModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.warn("Failed to clear attendance:", e);
    }
  };

  // Filter workers by search query
  const filteredWorkers = useMemo(() => {
    if (!searchQuery) return workers;
    return workers.filter((w) => w.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [workers, searchQuery]);

  const statsData: AttendanceStatsData = useMemo(() => {
    let pCount = 0;
    let aCount = 0;
    let hCount = 0;
    let otCount = 0;

    const monthRecords = attendance.filter((r) => r.year === year && r.month === month);

    monthRecords.forEach((r) => {
      if (r.value === "P") pCount++;
      else if (r.value === "A") aCount++;
      else if (r.value === "H") hCount++;
      else if (r.value === "OT") otCount++;
    });

    const activeW = workers.filter((w) => (w as any).status !== "inactive").length;

    return {
      present: pCount + otCount,
      absent: aCount,
      halfDay: hCount,
      totalAttendance: pCount + aCount + hCount + otCount,
      activeWorkers: activeW,
      onLeaveWorkers: otCount,
      newWorkersThisMonth: workers.length,
    };
  }, [attendance, workers, year, month]);

  // Colors
  const bgCard = isDark ? "#1E293B" : "#FFFFFF";
  const bgRoot = isDark ? "#0F172A" : "#F8FAFC";
  const borderCol = isDark ? "#334155" : "#E2E8F0";

  return (
    <View style={[styles.root, { backgroundColor: bgRoot }]}>
      {/* 1. Header (Matches design rules: back icon left, title center, action right) */}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: isDark ? "#0F172A" : "#F97316" }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBackBtn}>
          <Feather name="arrow-left" size={22} color="#FFFFFF" />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Attendance</ThemedText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Pressable onPress={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(''); }} style={styles.headerAddBtn}>
            <Feather name={showSearch ? "x" : "search"} size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable onPress={() => navigation.navigate("Workers")} style={styles.headerAddBtn}>
            <Feather name="user-plus" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {/* 2. Calendar Month Selector banner */}
      <View style={styles.monthSelectorWrap}>
        <Pressable
          onPress={() => {
            setPickerYear(year);
            setShowMonthPicker(true);
          }}
          style={[styles.monthSelectorBtn, { backgroundColor: bgCard, borderColor: borderCol }]}
        >
          <Feather name="calendar" size={18} color="#F97316" style={{ marginRight: 10 }} />
          <ThemedText style={[styles.monthText, { color: isDark ? "#FFFFFF" : "#1E293B" }]}>
            {MONTHS[month]} {year}
          </ThemedText>
          <Feather name="chevron-down" size={16} color={isDark ? "#94A3B8" : "#64748B"} style={{ marginLeft: 8 }} />
        </Pressable>
      </View>

      {/* 2.1 Compact Attendance & Worker Statistics Banner */}
      <AttendanceCompactStats stats={statsData} />

      {/* 3. Inline Search (toggle from header) */}
      {showSearch && (
        <View style={styles.searchBarContainer}>
          <View style={[styles.searchBarWrap, { backgroundColor: bgCard, borderColor: borderCol }]}>
            <Feather name="search" size={15} color={isDark ? "#94A3B8" : "#64748B"} style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search worker by name..."
              placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
              style={[styles.searchInput, { color: isDark ? "#FFFFFF" : "#1E293B" }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")}>
                <Feather name="x" size={14} color={isDark ? "#94A3B8" : "#64748B"} />
              </Pressable>
            ) : null}
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#F97316" />
        </View>
      ) : (
        /* 4. Grid register sheet */
        <View style={[styles.gridContainer, { backgroundColor: isDark ? "#0F172A" : "#FFFFFF" }]}>
          {/* Left frozen column (Worker Names) */}
          <View style={[styles.frozenColumn, { borderRightColor: isDark ? "rgba(255,255,255,0.08)" : borderCol }]}>
            {/* Frozen Orange Column Header */}
            <View style={[styles.columnHeader, { backgroundColor: "#EA580C", borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.15)" }]}>
              <Text style={styles.columnHeaderText}>WORKERS</Text>
            </View>

            <ScrollView
              ref={leftScrollRef}
              scrollEnabled={true}
              onScroll={handleLeftScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
            >
              {filteredWorkers.map((worker, idx) => {
                const initials = (worker.name || "W")
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                const avatarBg = ["#F97316", "#EA580C", "#F59E0B", "#F97316"][idx % 4];
                return (
                  <View
                    key={worker.id}
                    style={[
                      styles.frozenRow,
                      {
                        borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : borderCol,
                        backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
                      },
                    ]}
                  >
                    <View style={[styles.avatarCircle, { backgroundColor: avatarBg }]}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <ThemedText numberOfLines={1} style={[styles.workerNameText, { color: isDark ? "#FFFFFF" : "#1E293B" }]}>
                      {worker.name}
                    </ThemedText>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {/* Right scrollable grid cells (Date cells horizontally + vertically scrollable) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={true} bounces={false}>
            <View>
              {/* Days Header Orange Row */}
              <View style={{ flexDirection: "row", height: 44, backgroundColor: "#EA580C" }}>
                {Array.from({ length: daysInMonth }, (_, i) => (
                  <View key={i} style={[styles.dayHeaderCell, { borderRightColor: "rgba(255,255,255,0.15)" }]}>
                    <Text style={styles.dayHeaderText}>{i + 1}</Text>
                  </View>
                ))}
              </View>

              {/* Grid cells vertical ScrollView */}
              <ScrollView
                ref={rightScrollRef}
                onScroll={handleRightScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
              >
                {filteredWorkers.map((worker) => (
                  <View key={worker.id} style={{ flexDirection: "row", height: 56 }}>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const dayNum = i + 1;
                      const value = getAttendanceValueForDay(worker.id, dayNum);

                      let bg = isDark ? "#131F37" : "#F1F5F9";
                      let textLabel = "";
                      let boxBorder = isDark ? "rgba(255,255,255,0.06)" : "#E2E8F0";

                      if (value === "P") { bg = "#22C55E"; textLabel = "P"; boxBorder = "#22C55E"; }
                      else if (value === "A") { bg = "#EF4444"; textLabel = "A"; boxBorder = "#EF4444"; }
                      else if (value === "H") { bg = "#F59E0B"; textLabel = "1/2"; boxBorder = "#F59E0B"; }
                      else if (value === "OT") { bg = "#A855F7"; textLabel = "OT"; boxBorder = "#A855F7"; }

                      return (
                        <Pressable
                          key={i}
                          onPress={() => openDetailedModal(worker, dayNum, value)}
                          style={[
                            styles.gridCell,
                            {
                              borderRightColor: isDark ? "rgba(255,255,255,0.06)" : borderCol,
                              borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : borderCol,
                            },
                          ]}
                        >
                          <View style={[styles.statusBox, { backgroundColor: bg, borderColor: boxBorder }]}>
                            <Text
                              style={[
                                styles.statusBoxText,
                                {
                                  color: value ? "#FFFFFF" : (isDark ? "#64748B" : "#94A3B8"),
                                  fontSize: value ? 13 : 11,
                                },
                              ]}
                            >
                              {textLabel}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      )}



      {/* ── Month Selector Modal ────────────────────────────────────── */}
      <Modal
        visible={showMonthPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBgPress} onPress={() => setShowMonthPicker(false)} />
          <View style={[styles.monthPickerCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]}>
            <View style={styles.pickerHeader}>
              <Pressable onPress={() => setPickerYear(pickerYear - 1)} style={styles.pickerYearArrow}>
                <Feather name="chevron-left" size={20} color={isDark ? "#FFFFFF" : "#1E293B"} />
              </Pressable>
              <ThemedText style={styles.pickerYearText}>{pickerYear}</ThemedText>
              <Pressable onPress={() => setPickerYear(pickerYear + 1)} style={styles.pickerYearArrow}>
                <Feather name="chevron-right" size={20} color={isDark ? "#FFFFFF" : "#1E293B"} />
              </Pressable>
            </View>

            <View style={styles.monthsGrid}>
              {MONTHS.map((m, idx) => {
                const isSelected = selectedDate.getMonth() === idx && selectedDate.getFullYear() === pickerYear;
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedDate(new Date(pickerYear, idx, 1));
                      setShowMonthPicker(false);
                    }}
                    style={[
                      styles.monthGridBtn,
                      { borderColor: borderCol },
                      isSelected && { backgroundColor: "#F97316" }
                    ]}
                  >
                    <Text style={[styles.monthGridText, { color: isSelected ? "#FFFFFF" : (isDark ? "#FFFFFF" : "#1E293B") }]}>
                      {m.substring(0, 3)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Unified Attendance Editor Modal ─────────────────────────── */}
      <AttendanceEditorModal
        visible={cellModalVisible}
        worker={selectedWorker}
        date={new Date(year, month, selectedDayNum)}
        projectId={activeSite?.id}
        initialRecord={
          selectedWorker
            ? attendance.find(
                (r) =>
                  r.workerId === selectedWorker.id &&
                  r.year === year &&
                  r.month === month &&
                  r.day === selectedDayNum
              ) || null
            : null
        }
        onClose={() => setCellModalVisible(false)}
        onSave={handleSaveDetailedRecord}
        onClear={handleClearDetailedRecord}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header styling (orange in light mode, dark slate in dark mode)
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    height: Platform.OS === "ios" ? 90 : 80,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },
  headerAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "flex-end",
  },

  // Month selector card
  monthSelectorWrap: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  monthSelectorBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  monthText: {
    fontSize: 15,
    fontWeight: "700",
  },

  // Search input
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 4,
  },

  // Grid Register layout container
  gridContainer: {
    flex: 1,
    flexDirection: "row",
  },

  // Left frozen names list column
  frozenColumn: {
    width: 135,
    borderRightWidth: 1,
    zIndex: 10,
  },
  columnHeader: {
    height: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  columnHeaderText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  frozenRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  workerNameText: {
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },

  // Day columns (horizontally scrollable cells)
  dayHeaderCell: {
    width: 50,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  gridCell: {
    width: 50,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderBottomWidth: 1,
  },
  statusBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  statusBoxText: {
    fontSize: 12,
    fontWeight: "800",
  },

  // Picker Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalBgPress: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  monthPickerCard: {
    width: SCREEN_WIDTH - 48,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  pickerYearArrow: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(150,150,150,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  pickerYearText: {
    fontSize: 17,
    fontWeight: "800",
  },
  monthsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  monthGridBtn: {
    width: (SCREEN_WIDTH - 112) / 3,
    height: 42,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  monthGridText: {
    fontSize: 13,
    fontWeight: "700",
  },

  // Detailed marks modal styles (Image 2)
  detailsModalCard: {
    width: SCREEN_WIDTH - 32,
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  detailsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  detailsModalTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  detailsModalSub: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  detailsCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(150,150,150,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 16,
    letterSpacing: 0.3,
  },
  statusButtonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  statusToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusToggleText: {
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
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
  },
  ctaButtonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    width: "100%",
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  saveBtn: {
    flex: 1.5,
    height: 46,
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
    fontWeight: "700",
  },

});
