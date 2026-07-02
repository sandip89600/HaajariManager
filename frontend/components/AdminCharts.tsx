import React, { useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";

const CHART_COLORS = {
  primary: "#FF6B35", // Orange
  success: "#10B981", // Teal Green
  warning: "#FFC107", // Yellow
  purple: "#8B5CF6", // Purple
  blue: "#3B82F6", // Sky Blue
  danger: "#EF4444", // Red
  border: "#212030",
  textSecondary: "#8E8E9F",
  bgDefault: "#12121A",
};

interface ChartDataPoint {
  month: string;
  count?: number;
  amount?: number;
}

// 1. User Growth Trend Chart
export function UserGrowthChart({ data }: { data: ChartDataPoint[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.count || 0), 10);

  return (
    <View style={styles.chartCard}>
      <ThemedText type="h3" style={styles.chartTitle}>
        User Growth (Monthly Registrations)
      </ThemedText>

      <View style={styles.chartPlotArea}>
        {/* Grid lines */}
        <View style={styles.gridLinesContainer}>
          <View style={[styles.gridLine, { borderTopWidth: 1 }]} />
          <View style={[styles.gridLine, { borderTopWidth: 1 }]} />
          <View style={[styles.gridLine, { borderTopWidth: 1 }]} />
        </View>

        {/* Columns */}
        <View style={styles.columnsContainer}>
          {data.map((item, idx) => {
            const heightPct = ((item.count || 0) / maxVal) * 100;
            const isHovered = activeIdx === idx;

            return (
              <Pressable
                key={idx}
                onPressIn={() => setActiveIdx(idx)}
                onPressOut={() => setActiveIdx(null)}
                style={styles.columnWrapper}
              >
                {isHovered && (
                  <View style={styles.tooltip}>
                    <ThemedText type="small" style={styles.tooltipText}>
                      +{item.count} users
                    </ThemedText>
                  </View>
                )}

                <View
                  style={[
                    styles.columnBar,
                    {
                      height: `${Math.max(heightPct, 5)}%`,
                      backgroundColor: isHovered
                        ? CHART_COLORS.primary
                        : CHART_COLORS.primary + "CC",
                    },
                  ]}
                />

                <ThemedText type="small" style={styles.xAxisLabel}>
                  {item.month}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// 2. Revenue Trend Chart
export function RevenueTrendChart({ data }: { data: ChartDataPoint[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.amount || 0), 1000);

  return (
    <View style={styles.chartCard}>
      <ThemedText type="h3" style={styles.chartTitle}>
        Monthly Recurring Revenue (MRR)
      </ThemedText>

      <View style={styles.chartPlotArea}>
        <View style={styles.gridLinesContainer}>
          <View style={styles.gridLine} />
          <View style={styles.gridLine} />
          <View style={styles.gridLine} />
        </View>

        <View style={styles.columnsContainer}>
          {data.map((item, idx) => {
            const heightPct = ((item.amount || 0) / maxVal) * 100;
            const isHovered = activeIdx === idx;

            return (
              <Pressable
                key={idx}
                onPressIn={() => setActiveIdx(idx)}
                onPressOut={() => setActiveIdx(null)}
                style={styles.columnWrapper}
              >
                {isHovered && (
                  <View style={styles.tooltip}>
                    <ThemedText type="small" style={styles.tooltipText}>
                      ₹{item.amount}
                    </ThemedText>
                  </View>
                )}

                <View
                  style={[
                    styles.columnBar,
                    {
                      height: `${Math.max(heightPct, 5)}%`,
                      backgroundColor: isHovered
                        ? CHART_COLORS.success
                        : CHART_COLORS.success + "CC",
                    },
                  ]}
                />

                <ThemedText type="small" style={styles.xAxisLabel}>
                  {item.month}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// 3. Subscription Distribution Chart (Pie representation using beautiful stacked bars)
export function SubscriptionPieChart({
  free,
  pro,
  business,
}: {
  free: number;
  pro: number;
  business: number;
}) {
  const total = free + pro + business || 1;
  const freePct = (free / total) * 100;
  const proPct = (pro / total) * 100;
  const busPct = (business / total) * 100;

  return (
    <View style={styles.chartCard}>
      <ThemedText type="h3" style={styles.chartTitle}>
        Plan Enrollment Share
      </ThemedText>

      {/* Percentage Bar */}
      <View style={styles.horizontalProgressBarContainer}>
        <View
          style={[
            styles.progressSegment,
            {
              width: `${freePct}%`,
              backgroundColor: CHART_COLORS.textSecondary,
            },
          ]}
        />
        <View
          style={[
            styles.progressSegment,
            { width: `${proPct}%`, backgroundColor: CHART_COLORS.success },
          ]}
        />
        <View
          style={[
            styles.progressSegment,
            { width: `${busPct}%`, backgroundColor: CHART_COLORS.primary },
          ]}
        />
      </View>

      {/* Legends */}
      <View style={styles.legendGrid}>
        <View style={styles.legendRow}>
          <View
            style={[
              styles.legendDot,
              { backgroundColor: CHART_COLORS.primary },
            ]}
          />
          <ThemedText type="body" style={styles.legendLabel}>
            Business (₹999):
          </ThemedText>
          <ThemedText type="body" style={styles.legendValue}>
            {business} ({busPct.toFixed(0)}%)
          </ThemedText>
        </View>
        <View style={styles.legendRow}>
          <View
            style={[
              styles.legendDot,
              { backgroundColor: CHART_COLORS.success },
            ]}
          />
          <ThemedText type="body" style={styles.legendLabel}>
            Professional (₹299):
          </ThemedText>
          <ThemedText type="body" style={styles.legendValue}>
            {pro} ({proPct.toFixed(0)}%)
          </ThemedText>
        </View>
        <View style={styles.legendRow}>
          <View
            style={[
              styles.legendDot,
              { backgroundColor: CHART_COLORS.textSecondary },
            ]}
          />
          <ThemedText type="body" style={styles.legendLabel}>
            Free (₹0):
          </ThemedText>
          <ThemedText type="body" style={styles.legendValue}>
            {free} ({freePct.toFixed(0)}%)
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

// 4. Workforce Distribution by Company Chart
export function WorkforceBarChart({
  data,
}: {
  data: Record<string, number> | null;
}) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <View style={styles.chartCard}>
        <ThemedText type="h3" style={styles.chartTitle}>
          Workforce by Company
        </ThemedText>
        <ThemedText type="body" style={styles.noDataText}>
          No company workforce data available.
        </ThemedText>
      </View>
    );
  }

  const entries = Object.entries(data);
  const maxVal = Math.max(...entries.map(([_, v]) => v), 5);

  return (
    <View style={styles.chartCard}>
      <ThemedText type="h3" style={styles.chartTitle}>
        Workforce by Company
      </ThemedText>
      <View style={{ gap: Spacing.md, marginTop: Spacing.sm }}>
        {entries.map(([companyName, count], idx) => {
          const pct = (count / maxVal) * 100;
          return (
            <View key={idx} style={styles.horizontalBarRow}>
              <View style={{ flex: 1 }}>
                <ThemedText
                  type="small"
                  style={styles.legendLabel}
                  numberOfLines={1}
                >
                  {companyName}
                </ThemedText>
              </View>
              <View style={styles.horizontalBarTrack}>
                <View
                  style={[
                    styles.horizontalBarFill,
                    { width: `${pct}%`, backgroundColor: CHART_COLORS.purple },
                  ]}
                />
              </View>
              <ThemedText type="body" style={styles.horizontalValueText}>
                {count}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// 5. Attendance Breakdown Chart
export function AttendanceBarChart({
  present,
  absent,
  halfDay,
}: {
  present: number;
  absent: number;
  halfDay: number;
}) {
  const maxVal = Math.max(present, absent, halfDay, 5);

  const stats = [
    { label: "Present", value: present, color: CHART_COLORS.success },
    { label: "Absent", value: absent, color: CHART_COLORS.danger },
    { label: "Half Day", value: halfDay, color: CHART_COLORS.warning },
  ];

  return (
    <View style={styles.chartCard}>
      <ThemedText type="h3" style={styles.chartTitle}>
        Attendance Type Share
      </ThemedText>

      <View style={styles.chartPlotArea}>
        <View style={styles.gridLinesContainer}>
          <View style={styles.gridLine} />
          <View style={styles.gridLine} />
          <View style={styles.gridLine} />
        </View>

        <View
          style={[styles.columnsContainer, { justifyContent: "space-around" }]}
        >
          {stats.map((item, idx) => {
            const heightPct = (item.value / maxVal) * 100;
            return (
              <View key={idx} style={styles.columnWrapper}>
                <View
                  style={[
                    styles.columnBar,
                    {
                      height: `${Math.max(heightPct, 5)}%`,
                      backgroundColor: item.color,
                      width: 32,
                    },
                  ]}
                />
                <ThemedText type="small" style={styles.xAxisLabel}>
                  {item.label}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{
                    color: CHART_COLORS.textSecondary,
                    fontWeight: "bold",
                    marginTop: 2,
                  }}
                >
                  {item.value}
                </ThemedText>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// 6. Payroll Trend Chart
export function PayrollTrendChart({ data }: { data: ChartDataPoint[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.amount || 0), 1000);

  return (
    <View style={styles.chartCard}>
      <ThemedText type="h3" style={styles.chartTitle}>
        Monthly Payroll Level (₹)
      </ThemedText>

      <View style={styles.chartPlotArea}>
        <View style={styles.gridLinesContainer}>
          <View style={styles.gridLine} />
          <View style={styles.gridLine} />
          <View style={styles.gridLine} />
        </View>

        <View style={styles.columnsContainer}>
          {data.map((item, idx) => {
            const heightPct = ((item.amount || 0) / maxVal) * 100;
            const isHovered = activeIdx === idx;

            return (
              <Pressable
                key={idx}
                onPressIn={() => setActiveIdx(idx)}
                onPressOut={() => setActiveIdx(null)}
                style={styles.columnWrapper}
              >
                {isHovered && (
                  <View style={styles.tooltip}>
                    <ThemedText type="small" style={styles.tooltipText}>
                      ₹{item.amount}
                    </ThemedText>
                  </View>
                )}

                <View
                  style={[
                    styles.columnBar,
                    {
                      height: `${Math.max(heightPct, 5)}%`,
                      backgroundColor: isHovered
                        ? CHART_COLORS.warning
                        : CHART_COLORS.warning + "CC",
                    },
                  ]}
                />

                <ThemedText type="small" style={styles.xAxisLabel}>
                  {item.month}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartCard: {
    backgroundColor: CHART_COLORS.bgDefault,
    borderWidth: 1,
    borderColor: CHART_COLORS.border,
    borderRadius: 16,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: Spacing.lg,
  },
  chartPlotArea: {
    height: 180,
    position: "relative",
    justifyContent: "flex-end",
  },
  gridLinesContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 30,
    justifyContent: "space-between",
  },
  gridLine: {
    height: 1,
    borderColor: CHART_COLORS.border + "55",
    borderStyle: "dashed",
    borderTopWidth: 1,
    width: "100%",
  },
  columnsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: "100%",
    paddingHorizontal: Spacing.sm,
    zIndex: 1,
  },
  columnWrapper: {
    alignItems: "center",
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
    position: "relative",
  },
  columnBar: {
    width: 16,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  xAxisLabel: {
    marginTop: Spacing.sm,
    color: CHART_COLORS.textSecondary,
    fontSize: 10,
    fontWeight: "600",
  },
  tooltip: {
    position: "absolute",
    top: -24,
    backgroundColor: "#1E1E2A",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3A3A4A",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  tooltipText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  horizontalProgressBarContainer: {
    height: 12,
    width: "100%",
    backgroundColor: CHART_COLORS.border,
    borderRadius: BorderRadius.full,
    flexDirection: "row",
    overflow: "hidden",
    marginVertical: Spacing.md,
  },
  progressSegment: {
    height: "100%",
  },
  legendGrid: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.md,
  },
  legendLabel: {
    color: CHART_COLORS.textSecondary,
    fontSize: 13,
  },
  legendValue: {
    color: "#FFFFFF",
    fontWeight: "700",
    marginLeft: Spacing.xs,
    fontSize: 13,
  },
  noDataText: {
    color: CHART_COLORS.textSecondary,
    textAlign: "center",
    paddingVertical: Spacing.xl,
  },
  horizontalBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  horizontalBarTrack: {
    flex: 2,
    height: 10,
    backgroundColor: CHART_COLORS.border,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  horizontalBarFill: {
    height: "100%",
    borderRadius: BorderRadius.full,
  },
  horizontalValueText: {
    width: 30,
    textAlign: "right",
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
