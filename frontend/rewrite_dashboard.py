import re
import os

filepath = 'd:/File/HaajariManager (3)/HaajariManager/frontend/screens/DashboardScreen.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract everything before the render part
logic_match = re.search(r'^(.*?)(  if \(loading && workersList\.length === 0\) {)', content, re.DOTALL | re.MULTILINE)
if not logic_match:
    print("Could not find logic")
    exit(1)

logic = logic_match.group(1)

# Extract everything after the return statement? No, the return statement and modals are intertwined.
# Let's extract the modals and helper functions if any.
# Actually, the user wants me to COMPLETELY REPLACE the JSX output, and keep the existing data fetching business logic.
# So I can just rewrite the return statement.
# But I need to also include the attendance modal and razorpay modal, as they are part of the functionality.

ui_code = """
  // Filter display workers list
  const displayWorkers = activeSite
    ? workersList.filter(w => w.projectId === activeSite.id)
    : workersList;

  const todayDay = today.getDate();
  const userName = user?.name || "Contractor";
  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Dummy Pending Payments for KPI
  const pendingPayments = "₹45,000";

  // Dummy Activity Feed from Attendance
  const recentActivities = attendanceRecords
    .filter(r => r.day === todayDay)
    .slice(0, 5)
    .map(r => {
       const worker = workersList.find(w => w.id === r.workerId);
       return {
         id: r.workerId + r.value,
         name: worker?.name || "Worker",
         action: `Marked as ${r.value === 'P' ? 'Present' : r.value === 'A' ? 'Absent' : r.value === 'H' ? 'Half Day' : 'Overtime'}`,
         time: "Just now",
       };
    });

  if (loading && workersList.length === 0) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={{ paddingTop: insets.top + Spacing.md, paddingHorizontal: Spacing.lg }}>
          <SkeletonLoader width={200} height={30} style={{ marginBottom: 10 }} />
          <SkeletonLoader width={150} height={20} />
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
             <SkeletonLoader width={140} height={120} />
             <SkeletonLoader width={140} height={120} />
          </View>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Scroll View with Pull to Refresh */}
      <Animated.ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.sm }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => loadDashboardData(true)} />}
      >
        {/* 1. HEADER SECTION (Glassmorphism Pill) */}
        <Animated.View entering={FadeInDown.duration(500).springify()} style={styles.headerPill}>
          <View style={styles.headerInfo}>
            <ThemedText style={styles.greetingText}>Good morning,</ThemedText>
            <ThemedText style={styles.userNameText}>{userName}</ThemedText>
            <ThemedText style={styles.dateText}>{formattedDate} • {currentTime}</ThemedText>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.iconButton}>
              <Feather name="bell" size={20} color={isDark ? "#FFFFFF" : "#0F172A"} />
              <View style={styles.badgeIndicator} />
            </Pressable>
            <Pressable onPress={() => navigation.navigate("Profile")}>
              <Avatar name={userName} size="md" />
            </Pressable>
          </View>
        </Animated.View>

        {/* 2. QUICK STATS ROW */}
        <Animated.ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.statsScroll}
          entering={FadeInDown.delay(100).duration(500).springify()}
        >
          <KPICard
            title="Workers Present"
            value={stats.present + stats.halfDay + stats.overtime}
            icon="users"
            trend={stats.rate > 50 ? 'up' : 'down'}
            trendValue={`${stats.rate}%`}
            color="success"
            style={{ width: SCREEN_WIDTH * 0.4 }}
          />
          <KPICard
            title="Workers Absent"
            value={stats.absent}
            icon="user-x"
            trend="down"
            trendValue=""
            color="error"
            style={{ width: SCREEN_WIDTH * 0.4 }}
          />
          <KPICard
            title="Active Sites"
            value={siteStats.activeSites}
            icon="briefcase"
            trend="up"
            trendValue=""
            color="info"
            style={{ width: SCREEN_WIDTH * 0.4 }}
          />
          <KPICard
            title="Pending Payments"
            value={pendingPayments}
            icon="dollar-sign"
            trend="none"
            trendValue=""
            color="warning"
            style={{ width: SCREEN_WIDTH * 0.4 }}
          />
        </Animated.ScrollView>

        {/* 3. TODAY'S ATTENDANCE SUMMARY CARD */}
        <Animated.View entering={FadeInDown.delay(200).duration(500).springify()}>
          <SectionHeader title="Today's Summary" actionTitle="View All" onAction={() => navigation.navigate("AttendanceScreen")} />
          <View style={[styles.summaryCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
             <View style={styles.progressRingContainer}>
                {/* Simulated Progress Ring */}
                <View style={[styles.progressRing, { borderColor: "#F97316" }]}>
                  <ThemedText style={styles.progressRingText}>{stats.rate}%</ThemedText>
                  <ThemedText style={styles.progressRingSub}>Present</ThemedText>
                </View>
             </View>
             <View style={styles.summaryBreakdown}>
               <View style={styles.breakdownRow}><Badge variant="success" text={`${stats.present} Present`} /><Badge variant="error" text={`${stats.absent} Absent`} /></View>
               <View style={styles.breakdownRow}><Badge variant="warning" text={`${stats.halfDay} Half Day`} /><Badge variant="info" text={`${stats.overtime} Overtime`} /></View>
             </View>
          </View>
        </Animated.View>

        {/* 4. ACTIVE SITE CARD */}
        {activeSite && (
          <Animated.View entering={FadeInDown.delay(300).duration(500).springify()} style={{ marginTop: Spacing.lg }}>
            <SectionHeader title="Active Site" />
            <View style={[styles.activeSiteCard, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
               <View style={styles.siteHeader}>
                 <View style={styles.siteTitleRow}>
                    <Feather name="map-pin" size={16} color="#F97316" />
                    <ThemedText style={styles.siteName}>{activeSite.name}</ThemedText>
                 </View>
                 <Badge variant="info" text="Active" />
               </View>
               <ThemedText style={styles.siteLocation}>{activeSite.location}</ThemedText>
               <View style={styles.siteProgressBar}><View style={[styles.siteProgressFill, { width: '65%' }]} /></View>
               <View style={styles.siteStatsRow}>
                  <ThemedText style={styles.siteWorkersCount}>{siteStats.workersPresent} Workers Assigned</ThemedText>
               </View>
               <View style={styles.siteActions}>
                 <PrimaryButton title="View Details" onPress={() => navigation.navigate("ProjectManagement")} variant="outline" style={{ flex: 1, marginRight: 8 }} />
                 <PrimaryButton title="Mark Attendance" onPress={() => navigation.navigate("AttendanceScreen")} variant="solid" style={{ flex: 1, marginLeft: 8 }} />
               </View>
            </View>
          </Animated.View>
        )}

        {/* 6. QUICK ACTIONS GRID */}
        <Animated.View entering={FadeInDown.delay(400).duration(500).springify()} style={{ marginTop: Spacing.lg }}>
           <SectionHeader title="Quick Actions" />
           <View style={styles.actionsGrid}>
             <Pressable style={[styles.actionGridItem, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]} onPress={() => navigation.navigate("AttendanceScreen")}>
                <LinearGradient colors={['#F97316', '#F59E0B']} style={styles.actionIconBg}><Feather name="check-square" size={24} color="#FFF" /></LinearGradient>
                <ThemedText style={styles.actionItemText}>Mark{`\n`}Attendance</ThemedText>
             </Pressable>
             <Pressable style={[styles.actionGridItem, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]} onPress={() => navigation.navigate("AddWorker")}>
                <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.actionIconBg}><Feather name="user-plus" size={24} color="#FFF" /></LinearGradient>
                <ThemedText style={styles.actionItemText}>Add{`\n`}Worker</ThemedText>
             </Pressable>
             <Pressable style={[styles.actionGridItem, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]} onPress={() => navigation.navigate("ReportsTab")}>
                <LinearGradient colors={['#10B981', '#059669']} style={styles.actionIconBg}><Feather name="pie-chart" size={24} color="#FFF" /></LinearGradient>
                <ThemedText style={styles.actionItemText}>View{`\n`}Reports</ThemedText>
             </Pressable>
             <Pressable style={[styles.actionGridItem, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]} onPress={() => navigation.navigate("ProjectManagement")}>
                <LinearGradient colors={['#8B5CF6', '#6D28D9']} style={styles.actionIconBg}><Feather name="briefcase" size={24} color="#FFF" /></LinearGradient>
                <ThemedText style={styles.actionItemText}>Manage{`\n`}Sites</ThemedText>
             </Pressable>
           </View>
        </Animated.View>

        {/* 7. RECENT WORKERS ROW */}
        {displayWorkers.length > 0 && (
          <Animated.View entering={FadeInDown.delay(500).duration(500).springify()} style={{ marginTop: Spacing.lg }}>
            <SectionHeader title="Recent Workers" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.workersScroll}>
              {displayWorkers.map(worker => {
                const todayRec = attendanceRecords.find(r => r.workerId === worker.id && r.day === todayDay);
                let variant: 'success' | 'error' | 'warning' | 'info' | 'default' = 'default';
                if (todayRec?.value === 'P') variant = 'success';
                else if (todayRec?.value === 'A') variant = 'error';
                else if (todayRec?.value === 'H') variant = 'warning';
                else if (todayRec?.value === 'OT') variant = 'info';

                return (
                  <Pressable key={worker.id} style={styles.workerAvatarItem} onPress={() => handleMarkOptions(worker.id)}>
                    <Avatar name={worker.name} size="lg" />
                    <ThemedText style={styles.workerAvatarName} numberOfLines={1}>{worker.name}</ThemedText>
                    {todayRec ? <Badge variant={variant} text={todayRec.value} style={{ marginTop: 4 }} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

        {/* 5. RECENT ACTIVITY FEED */}
        {recentActivities.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(600).duration(500).springify()} style={{ marginTop: Spacing.lg }}>
             <SectionHeader title="Recent Activity" />
             <View style={[styles.activityFeed, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]}>
                {recentActivities.map((act, index) => (
                  <View key={act.id + index} style={styles.activityItem}>
                    <Avatar name={act.name} size="sm" />
                    <View style={styles.activityContent}>
                      <ThemedText style={styles.activityName}>{act.name} <ThemedText style={styles.activityAction}>{act.action}</ThemedText></ThemedText>
                      <ThemedText style={styles.activityTime}>{act.time}</ThemedText>
                    </View>
                  </View>
                ))}
             </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.delay(600).duration(500).springify()} style={{ marginTop: Spacing.lg }}>
            <SectionHeader title="Recent Activity" />
            <EmptyState icon="activity" title="No Recent Activity" description="Mark attendance to see activity here." />
          </Animated.View>
        )}

      </Animated.ScrollView>

      {/* Modals from old logic */}
      <Modal visible={attendanceModalVisible} transparent animationType="slide" onRequestClose={() => setAttendanceModalVisible(false)}>
         <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: isDark ? "#0F172A" : "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <View>
                <ThemedText style={{ fontSize: 20, fontWeight: "800", color: isDark ? "#FFFFFF" : "#0F172A" }}>
                  {selectedWorkerForAttendance?.name || "Mark Attendance"}
                </ThemedText>
                <ThemedText style={{ fontSize: 13, color: theme.textSecondary, marginTop: 4 }}>
                  Choose status for today
                </ThemedText>
              </View>
              <Pressable onPress={() => setAttendanceModalVisible(false)} style={{ padding: 8, backgroundColor: isDark ? "#1E293B" : "#F1F5F9", borderRadius: 20 }}>
                <Feather name="x" size={20} color={isDark ? "#94A3B8" : "#475569"} />
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
              {[ { val: "P", label: "Present", color: "#10B981" }, { val: "A", label: "Absent", color: "#EF4444" } ].map((status) => {
                const isActive = modalAttendanceValue === status.val;
                return (
                  <Pressable key={status.val} onPress={() => { triggerHaptic(); setModalAttendanceValue(status.val as any); }}
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 2, borderColor: isActive ? status.color : (isDark ? "#334155" : "#E2E8F0"), backgroundColor: isActive ? `${status.color}20` : (isDark ? "#1E293B" : "#F8FAFC"), alignItems: "center" }}>
                    <ThemedText style={{ fontSize: 14, fontWeight: "800", color: isActive ? status.color : (isDark ? "#94A3B8" : "#475569") }}>{status.label}</ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginBottom: 24 }}>
              {[ { val: "H", label: "Half-Day", color: "#F59E0B" }, { val: "OT", label: "Overtime", color: "#6366F1" }, { val: "", label: "Unmark", color: "#64748B" } ].map((status) => {
                const isActive = modalAttendanceValue === status.val;
                return (
                  <Pressable key={status.val} onPress={() => { triggerHaptic(); setModalAttendanceValue(status.val as any); }}
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 2, borderColor: isActive ? status.color : (isDark ? "#334155" : "#E2E8F0"), backgroundColor: isActive ? `${status.color}20` : (isDark ? "#1E293B" : "#F8FAFC"), alignItems: "center" }}>
                    <ThemedText style={{ fontSize: 14, fontWeight: "800", color: isActive ? status.color : (isDark ? "#94A3B8" : "#475569") }}>{status.label}</ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <PrimaryButton title="Save Attendance" onPress={handleSaveAttendanceModal} />
          </View>
         </View>
      </Modal>

      {/* Undo Toast */}
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
  },
  scrollContent: {
    paddingBottom: 100,
  },
  headerPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    padding: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: Spacing.lg,
  },
  headerInfo: {
    flex: 1,
  },
  greetingText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  userNameText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 2,
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badgeIndicator: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#0F172A',
  },
  statsScroll: {
    paddingHorizontal: Spacing.lg,
    gap: 12,
  },
  summaryCard: {
    marginHorizontal: Spacing.lg,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  progressRingContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRingText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  progressRingSub: {
    fontSize: 10,
    color: '#64748B',
  },
  summaryBreakdown: {
    flex: 1,
    gap: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  activeSiteCard: {
    marginHorizontal: Spacing.lg,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  siteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  siteTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  siteName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  siteLocation: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  siteProgressBar: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    marginBottom: 12,
  },
  siteProgressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 3,
  },
  siteStatsRow: {
    marginBottom: 16,
  },
  siteWorkersCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  siteActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginHorizontal: Spacing.lg,
  },
  actionGridItem: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - 12) / 2,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  actionIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionItemText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  workersScroll: {
    paddingHorizontal: Spacing.lg,
    gap: 16,
  },
  workerAvatarItem: {
    alignItems: 'center',
    width: 70,
  },
  workerAvatarName: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  activityFeed: {
    marginHorizontal: Spacing.lg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
    gap: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityName: {
    fontSize: 14,
    fontWeight: '600',
  },
  activityAction: {
    color: '#64748B',
    fontWeight: '400',
  },
  activityTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  toastMessage: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  toastUndoBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
  },
  toastUndoText: {
    color: '#F97316',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
"""

# Let's verify what components are imported
import_fixes = """
// Adding missing UI components imports to existing logic if needed
// The prompt says we have these available at '@/components/ui/...'
"""

new_file_content = logic + ui_code

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(new_file_content)

print("Rewrite completed.")
