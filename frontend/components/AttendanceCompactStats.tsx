import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";

export interface AttendanceStatsData {
  present: number;
  absent: number;
  halfDay: number;
  totalAttendance: number;
  activeWorkers: number;
  onLeaveWorkers: number;
  newWorkersThisMonth: number;
}

interface AttendanceCompactStatsProps {
  stats: AttendanceStatsData;
}

export const AttendanceCompactStats: React.FC<AttendanceCompactStatsProps> = ({ stats }) => {
  const { isDark } = useTheme();

  const cardBg = isDark ? "#1E293B" : "#FFFFFF";
  const borderCol = isDark ? "#334155" : "#E2E8F0";
  const textPrimary = isDark ? "#F8FAFC" : "#0F172A";
  const textMuted = isDark ? "#94A3B8" : "#64748B";

  return (
    <View style={[styles.container, { backgroundColor: cardBg, borderColor: borderCol }]}>
      {/* GROUP 1: Attendance Overview */}
      <View style={styles.groupSection}>
        <Text style={[styles.groupLabel, { color: textMuted }]}>ATTENDANCE</Text>
        <View style={styles.chipRow}>
          {/* Present */}
          <View style={[styles.chip, { backgroundColor: isDark ? "rgba(34, 197, 94, 0.15)" : "#DCFCE7", borderColor: "rgba(34, 197, 94, 0.3)" }]}>
            <View style={[styles.badge, { backgroundColor: "#22C55E" }]}>
              <Text style={styles.badgeText}>P</Text>
            </View>
            <Text style={[styles.chipValue, { color: textPrimary }]}>{stats.present}</Text>
          </View>

          {/* Absent */}
          <View style={[styles.chip, { backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#FEE2E2", borderColor: "rgba(239, 68, 68, 0.3)" }]}>
            <View style={[styles.badge, { backgroundColor: "#EF4444" }]}>
              <Text style={styles.badgeText}>A</Text>
            </View>
            <Text style={[styles.chipValue, { color: textPrimary }]}>{stats.absent}</Text>
          </View>

          {/* Half Day */}
          <View style={[styles.chip, { backgroundColor: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7", borderColor: "rgba(245, 158, 11, 0.3)" }]}>
            <View style={[styles.badge, { backgroundColor: "#F59E0B" }]}>
              <Text style={styles.badgeText}>1/2</Text>
            </View>
            <Text style={[styles.chipValue, { color: textPrimary }]}>{stats.halfDay}</Text>
          </View>

          {/* Total */}
          <View style={[styles.chip, { backgroundColor: isDark ? "rgba(59, 130, 246, 0.15)" : "#DBEAFE", borderColor: "rgba(59, 130, 246, 0.3)" }]}>
            <Text style={[styles.labelText, { color: "#3B82F6" }]}>Total</Text>
            <Text style={[styles.chipValue, { color: textPrimary }]}>{stats.totalAttendance}</Text>
          </View>
        </View>
      </View>

      {/* GROUP 2: Workers */}
      <View style={styles.groupSection}>
        <Text style={[styles.groupLabel, { color: textMuted }]}>WORKERS</Text>
        <View style={styles.chipRow}>
          {/* Active */}
          <View style={[styles.chip, { backgroundColor: isDark ? "rgba(16, 185, 129, 0.15)" : "#D1FAE5", borderColor: "rgba(16, 185, 129, 0.3)" }]}>
            <Feather name="check-circle" size={12} color="#10B981" style={{ marginRight: 4 }} />
            <Text style={[styles.labelText, { color: "#10B981" }]}>Active</Text>
            <Text style={[styles.chipValue, { color: textPrimary }]}>{stats.activeWorkers}</Text>
          </View>

          {/* On Leave */}
          <View style={[styles.chip, { backgroundColor: isDark ? "rgba(245, 158, 11, 0.15)" : "#FEF3C7", borderColor: "rgba(245, 158, 11, 0.3)" }]}>
            <Feather name="clock" size={12} color="#F59E0B" style={{ marginRight: 4 }} />
            <Text style={[styles.labelText, { color: "#F59E0B" }]}>Leave</Text>
            <Text style={[styles.chipValue, { color: textPrimary }]}>{stats.onLeaveWorkers}</Text>
          </View>

          {/* New This Month */}
          <View style={[styles.chip, { backgroundColor: isDark ? "rgba(139, 92, 246, 0.15)" : "#EDE9FE", borderColor: "rgba(139, 92, 246, 0.3)" }]}>
            <Feather name="user-plus" size={12} color="#8B5CF6" style={{ marginRight: 4 }} />
            <Text style={[styles.labelText, { color: "#8B5CF6" }]}>New</Text>
            <Text style={[styles.chipValue, { color: textPrimary }]}>{stats.newWorkersThisMonth}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginVertical: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  groupSection: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginRight: 4,
    minWidth: 70,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 28,
  },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  labelText: {
    fontSize: 11,
    fontWeight: "600",
    marginRight: 4,
  },
  chipValue: {
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 2,
  },
});
