import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Share,
  DeviceEventEmitter,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { authenticatedFetch, API_URL } from "@/utils/storage";
import { Spacing, BorderRadius } from "@/constants/theme";
import TeamConnectionWidget from "@/components/TeamConnectionWidget";

export default function SupervisorDashboardScreen() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const { user, uniqueId, refreshUserProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [assignedSites, setAssignedSites] = useState<any[]>([]);
  const [assignedWorkers, setAssignedWorkers] = useState<any[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<{
    present: number;
    absent: number;
    halfDay: number;
    unmarked: number;
  }>({
    present: 0,
    absent: 0,
    halfDay: 0,
    unmarked: 0,
  });

  const isFetchingRef = React.useRef(false);

  const loadSupervisorData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      // 1. Fetch sites
      const sitesRes = await authenticatedFetch(`${API_URL}/sites`);
      let sitesList: any[] = [];
      if (sitesRes.ok) {
        const sitesData = await sitesRes.json();
        sitesList = Array.isArray(sitesData)
          ? sitesData
          : sitesData.sites || [];
        setAssignedSites(sitesList);
      }

      // 2. Fetch workers
      const workersRes = await authenticatedFetch(`${API_URL}/workers`);
      let workersList: any[] = [];
      if (workersRes.ok) {
        workersList = await workersRes.json();
        if (Array.isArray(workersList)) {
          setAssignedWorkers(workersList);
        }
      }

      // 3. Fetch today's attendance
      const now = new Date();
      const attRes = await authenticatedFetch(
        `${API_URL}/attendance/month?year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
      );
      if (attRes.ok) {
        const attData = await attRes.json();
        if (Array.isArray(attData)) {
          const today = now.getDate();
          const todayRecords = attData.filter((r: any) => r.day === today);
          let p = 0,
            a = 0,
            h = 0;
          for (const r of todayRecords) {
            if (r.value === "P" || r.value === "OT") p++;
            else if (r.value === "A") a++;
            else if (r.value === "H") h++;
          }
          const totalW = workersList.length;
          const unmarked = Math.max(0, totalW - (p + a + h));
          setTodayAttendance({ present: p, absent: a, halfDay: h, unmarked });
        }
      }
    } catch (error) {
      console.warn("Failed to load supervisor dashboard data:", error);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSupervisorData();
  }, [loadSupervisorData]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadSupervisorData();
  }, [loadSupervisorData]);

  const copyUniqueId = async () => {
    if (uniqueId) {
      await Clipboard.setStringAsync(uniqueId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const shareUniqueId = async () => {
    if (uniqueId) {
      try {
        await Share.share({
          message: `Haajari Manager Supervisor ID: ${uniqueId}\nName: ${user?.name || "Supervisor"}`,
        });
      } catch (err) {
        console.warn("Share error:", err);
      }
    }
  };

  const cardBg = isDark ? "#1E293B" : "#FFFFFF";
  const borderCol = isDark ? "#334155" : "#E2E8F0";

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 16) + 8,
            backgroundColor: theme.backgroundSecondary,
            borderBottomColor: borderCol,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                DeviceEventEmitter.emit("OPEN_SETTINGS_DRAWER");
              }}
              style={[
                styles.headerIconBtn,
                {
                  backgroundColor: isDark ? "#334155" : "#F1F5F9",
                  marginRight: 10,
                },
              ]}
            >
              <Feather name="menu" size={20} color={theme.text} />
            </Pressable>
            <View style={styles.headerUserInfo}>
              <Text style={[styles.greetingText, { color: theme.textSecondary }]}>
                {t("supervisor.dashboardGreeting", "नमस्ते, सुपरवाइजर")}
              </Text>
              <Text style={[styles.userNameText, { color: theme.text }]}>
                {user?.name || "Supervisor"}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => navigation.navigate("Notifications")}
            style={[
              styles.headerIconBtn,
              { backgroundColor: isDark ? "#334155" : "#F1F5F9" },
            ]}
          >
            <Feather name="bell" size={20} color={theme.text} />
          </Pressable>
        </View>

        {/* Unique ID Badge */}
        <View
          style={[
            styles.uniqueIdCard,
            {
              backgroundColor: isDark ? "#0F172A" : "#EFF6FF",
              borderColor: "#3B82F6",
            },
          ]}
        >
          <View style={styles.uniqueIdLeft}>
            <MaterialCommunityIcons
              name="shield-account"
              size={20}
              color="#3B82F6"
            />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.uniqueIdLabel}>
                {t("auth.uniqueId", "Supervisor ID")}
              </Text>
              <Text style={styles.uniqueIdValue}>
                {uniqueId || "HM-S-PENDING"}
              </Text>
            </View>
          </View>
          <View style={styles.uniqueIdActions}>
            <Pressable onPress={copyUniqueId} style={styles.idActionBtn}>
              <Feather name="copy" size={16} color="#3B82F6" />
            </Pressable>
            <Pressable
              onPress={shareUniqueId}
              style={[styles.idActionBtn, { marginLeft: 8 }]}
            >
              <Feather name="share-2" size={16} color="#3B82F6" />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 80 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Team Connection Widget */}
        <TeamConnectionWidget onRefreshParent={loadSupervisorData} />

        {/* Operational Stats Grid */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {t("supervisor.todayOverview", "आज की परिचालन स्थिति")}
        </Text>

        <View style={styles.statsGrid}>
          {/* Sites Count */}
          <View
            style={[
              styles.statBox,
              { backgroundColor: cardBg, borderColor: borderCol },
            ]}
          >
            <View style={[styles.statIconBox, { backgroundColor: "#EEF2FF" }]}>
              <Feather name="layers" size={18} color="#4F46E5" />
            </View>
            <Text style={[styles.statNum, { color: theme.text }]}>
              {assignedSites.length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              {t("supervisor.assignedSites", "Assigned Sites")}
            </Text>
          </View>

          {/* Workers Count */}
          <View
            style={[
              styles.statBox,
              { backgroundColor: cardBg, borderColor: borderCol },
            ]}
          >
            <View style={[styles.statIconBox, { backgroundColor: "#F0FDF4" }]}>
              <Feather name="users" size={18} color="#16A34A" />
            </View>
            <Text style={[styles.statNum, { color: theme.text }]}>
              {assignedWorkers.length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              {t("supervisor.assignedWorkers", "Assigned Workers")}
            </Text>
          </View>

          {/* Present Today */}
          <View
            style={[
              styles.statBox,
              { backgroundColor: cardBg, borderColor: borderCol },
            ]}
          >
            <View style={[styles.statIconBox, { backgroundColor: "#ECFDF5" }]}>
              <Feather name="check-circle" size={18} color="#059669" />
            </View>
            <Text style={[styles.statNum, { color: "#059669" }]}>
              {todayAttendance.present}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              {t("attendance.present", "Present")}
            </Text>
          </View>

          {/* Absent Today */}
          <View
            style={[
              styles.statBox,
              { backgroundColor: cardBg, borderColor: borderCol },
            ]}
          >
            <View style={[styles.statIconBox, { backgroundColor: "#FEF2F2" }]}>
              <Feather name="x-circle" size={18} color="#DC2626" />
            </View>
            <Text style={[styles.statNum, { color: "#DC2626" }]}>
              {todayAttendance.absent}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              {t("attendance.absent", "Absent")}
            </Text>
          </View>
        </View>

        {/* Assigned Sites List Section */}
        <View style={styles.sectionHeaderRow}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.text, marginBottom: 0 },
            ]}
          >
            {t("supervisor.myAssignedSites", "मेरी साइटें")}
          </Text>
          <Text
            style={[
              styles.badgeCount,
              { backgroundColor: theme.primary, color: "#FFFFFF" },
            ]}
          >
            {assignedSites.length}
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={theme.primary}
            style={{ marginVertical: 20 }}
          />
        ) : assignedSites.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              { backgroundColor: cardBg, borderColor: borderCol },
            ]}
          >
            <Feather name="inbox" size={32} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {t(
                "supervisor.noSitesAssignedDesc",
                "अभी आपके लिए कोई साइट असाइन नहीं की गई है।",
              )}
            </Text>
          </View>
        ) : (
          assignedSites.map((site: any) => (
            <Pressable
              key={site._id || site.id}
              onPress={() =>
                navigation.navigate("SiteDetailControl", {
                  siteId: site._id || site.id,
                })
              }
              style={[
                styles.siteCard,
                { backgroundColor: cardBg, borderColor: borderCol },
              ]}
            >
              <View style={styles.siteCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.siteName, { color: theme.text }]}>
                    {site.name}
                  </Text>
                  {!!site.location && (
                    <Text
                      style={[
                        styles.siteLocation,
                        { color: theme.textSecondary },
                      ]}
                    >
                      <Feather
                        name="map-pin"
                        size={13}
                        color={theme.textSecondary}
                      />{" "}
                      {site.location}
                    </Text>
                  )}
                </View>
                <View
                  style={[
                    styles.siteStatusPill,
                    { backgroundColor: isDark ? "#334155" : "#F1F5F9" },
                  ]}
                >
                  <Text
                    style={[styles.siteStatusText, { color: theme.primary }]}
                  >
                    {t.translateSiteStatus
                      ? t.translateSiteStatus(site.status)
                      : site.status || "Active"}
                  </Text>
                </View>
              </View>

              <View style={styles.siteCardActions}>
                <Pressable
                  onPress={() =>
                    navigation.navigate("SiteDetailControl", {
                      siteId: site._id || site.id,
                    })
                  }
                  style={[
                    styles.siteActionBtn,
                    { backgroundColor: theme.primary },
                  ]}
                >
                  <Feather name="edit-3" size={14} color="#FFFFFF" />
                  <Text style={styles.siteActionBtnText}>
                    {t("supervisor.dailyWorkUpdate", "Daily Work Update")}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerUserInfo: {
    flex: 1,
  },
  greetingText: {
    fontSize: 13,
    fontWeight: "500",
  },
  userNameText: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  uniqueIdCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  uniqueIdLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  uniqueIdLabel: {
    fontSize: 11,
    color: "#3B82F6",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  uniqueIdValue: {
    fontSize: 14,
    color: "#1D4ED8",
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  uniqueIdActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  idActionBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: "#DBEAFE",
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    padding: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  contractorIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2,
  },
  cardSubText: {
    fontSize: 12,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 12,
  },
  badgeCount: {
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: "hidden",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statBox: {
    width: "48%",
    padding: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: 10,
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statNum: {
    fontSize: 20,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  siteCard: {
    padding: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: 12,
  },
  siteCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  siteName: {
    fontSize: 15,
    fontWeight: "700",
  },
  siteLocation: {
    fontSize: 12,
    marginTop: 4,
  },
  siteStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  siteStatusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  siteCardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2E8F0",
    paddingTop: 10,
  },
  siteActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  siteActionBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 6,
  },
  emptyBox: {
    padding: 24,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },
  emptyText: {
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },
});
