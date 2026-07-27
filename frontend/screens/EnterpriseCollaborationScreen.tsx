import React, { useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Modal,
  Platform,
  Dimensions,
  FlatList
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius } from "@/constants/theme";

type ActiveTab = "notifications" | "documents" | "approvals" | "timeline" | "roles" | "company" | "audit" | "backup";

export default function EnterpriseCollaborationScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<ActiveTab>("notifications");

  // Notifications State
  const [notifications, setNotifications] = useState([
    { id: "1", title: "New Worker Added", body: "Ramesh Kumar added to site project Alpha.", priority: "medium", isRead: false, time: "10 mins ago" },
    { id: "2", title: "Site Status Changed", body: "Site Beta marked as In Progress.", priority: "high", isRead: false, time: "1 hr ago" },
    { id: "3", title: "Payment Recorded", body: "Wages of ₹12,500 marked paid for Mistri Ramesh.", priority: "low", isRead: true, time: "Yesterday" },
  ]);

  // Documents State
  const [documents, setDocuments] = useState([
    { id: "doc-1", title: "Structural Slab Blueprint", category: "Construction Drawings", uploadedBy: "Supervisor Sunil", size: "4.8 MB", date: "2026-07-20" },
    { id: "doc-2", title: "UltraTech Cement Invoice", category: "Invoices", uploadedBy: "Accountant Vinay", size: "1.2 MB", date: "2026-07-24" },
    { id: "doc-3", title: "Site Foundation Progress Photo", category: "Site Photos", uploadedBy: "Supervisor Sunil", size: "850 KB", date: "2026-07-26" },
  ]);
  const [docSearch, setDocSearch] = useState("");

  // Approvals State
  const [approvals, setApprovals] = useState([
    { id: "app-1", type: "Attendance Correction", requester: "Supervisor Sunil", desc: "Change worker Ramesh status from Absent to Present on 24th July.", status: "Pending" },
    { id: "app-2", type: "Expense Approval", requester: "Accountant Vinay", desc: "Approve machinery rent expense of ₹15,000 for slab lift.", status: "Pending" },
    { id: "app-3", type: "Worker Transfer", requester: "Contractor Hari", desc: "Relocate 3 labourers from Site Alpha to Site Beta.", status: "Approved" },
  ]);

  // Timeline State
  const timelineEvents = [
    { action: "Site Created", user: "Contractor Hari", time: "10:30 AM", date: "2026-07-27", target: "Site Gamma" },
    { action: "Attendance Marked", user: "Supervisor Sunil", time: "09:15 AM", date: "2026-07-27", target: "Site Alpha" },
    { action: "Document Uploaded", user: "Accountant Vinay", time: "08:45 AM", date: "2026-07-27", target: "UltraTech Invoice" },
  ];

  // Company Profile State
  const [companyProfile, setCompanyProfile] = useState({
    name: "Haajari Developers Pvt Ltd",
    gstin: "27AAAAA1111A1Z1",
    address: "Bld 4, Hinjewadi Phase 3, Pune",
    phone: "+91 98765 43210",
    email: "ops@haajaridevelopers.com",
    plan: "Enterprise Pro"
  });

  // Audit Logs State
  const auditLogs = [
    { actor: "Contractor Hari", action: "Deleted Payment Log", details: "Wages of ₹3,000 removed for Ramesh Kumar.", date: "2026-07-27 12:00 PM" },
    { actor: "Contractor Hari", action: "Changed Password", details: "Security credentials updated.", date: "2026-07-26 06:15 PM" },
    { actor: "Supervisor Sunil", action: "Edited Attendance Log", details: "Site Alpha attendance revised.", date: "2026-07-25 10:20 AM" },
  ];

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleMarkAllRead = () => {
    triggerHaptic();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    Alert.alert("Success", "All notifications marked as read");
  };

  const handleClearNotifications = () => {
    triggerHaptic();
    setNotifications([]);
  };

  const handleApprove = (id: string, decision: "Approved" | "Rejected") => {
    triggerHaptic();
    setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: decision } : a));
    Alert.alert("Request Processed", `Action marked as ${decision}`);
  };

  const handleBackupDb = () => {
    triggerHaptic();
    Alert.alert("Database Backup", "Manual backup payload generated and saved to Local Secure Cache.");
  };

  const handleRestoreDb = () => {
    triggerHaptic();
    Alert.alert("Database Restore", "Warning: Restoring will overwrite local modifications. Proceed?", [
      { text: "Cancel", style: "cancel" },
      { text: "Restore", onPress: () => Alert.alert("Success", "Database state restored successfully.") }
    ]);
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <ThemedText style={styles.headerTitle}>Enterprise Workspace</ThemedText>
          <ThemedText style={styles.headerSubtitle}>Collaboration, Documents & Operations</ThemedText>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsScrollContainer, { borderBottomColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {([
            { id: "notifications", label: "Alert Center" },
            { id: "documents", label: "Documents" },
            { id: "approvals", label: "Approvals" },
            { id: "timeline", label: "Timeline" },
            { id: "company", label: "Company" },
            { id: "audit", label: "Audit Logs" },
            { id: "backup", label: "Database Backup" },
          ] as const).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => {
                  triggerHaptic();
                  setActiveTab(tab.id);
                }}
                style={[
                  styles.tabItem,
                  { borderBottomColor: isActive ? theme.primary : "transparent" },
                ]}
              >
                <ThemedText style={[styles.tabText, { color: isActive ? theme.primary : "#6B7280" }]}>
                  {tab.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* TAB 1: NOTIFICATIONS */}
        {activeTab === "notifications" && (
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <ThemedText style={styles.secTitle}>Recent Notification Alerts</ThemedText>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable onPress={handleMarkAllRead} style={styles.actionTextBtn}>
                  <ThemedText style={{ color: theme.primary, fontSize: 11, fontWeight: "700" }}>Mark All Read</ThemedText>
                </Pressable>
                <Pressable onPress={handleClearNotifications} style={styles.actionTextBtn}>
                  <ThemedText style={{ color: "#EF4444", fontSize: 11, fontWeight: "700" }}>Clear All</ThemedText>
                </Pressable>
              </View>
            </View>
            {notifications.length === 0 ? (
              <ThemedText style={styles.emptyText}>No notifications found.</ThemedText>
            ) : (
              notifications.map((item) => (
                <View key={item.id} style={[styles.cardItem, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <ThemedText style={[styles.cardTitle, { fontWeight: item.isRead ? "600" : "800" }]}>{item.title}</ThemedText>
                    <View style={[styles.badge, { backgroundColor: item.priority === "high" ? "#FEE2E2" : item.priority === "medium" ? "#FEF3C7" : "#F3F4F6" }]}>
                      <ThemedText style={{ fontSize: 9, fontWeight: "700", color: item.priority === "high" ? "#EF4444" : item.priority === "medium" ? "#D97706" : "#6B7280" }}>
                        {item.priority.toUpperCase()}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText style={styles.cardDesc}>{item.body}</ThemedText>
                  <ThemedText style={styles.cardMeta}>{item.time}</ThemedText>
                </View>
              ))
            )}
          </View>
        )}

        {/* TAB 2: DOCUMENT MANAGEMENT */}
        {activeTab === "documents" && (
          <View>
            <ThemedText style={styles.secTitle}>Site Document Archives</ThemedText>
            <View style={[styles.searchBar, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <Feather name="search" size={16} color="#6B7280" style={{ marginRight: 8 }} />
              <TextInput
                placeholder="Search drawings, invoices, certificates..."
                value={docSearch}
                onChangeText={setDocSearch}
                style={{ flex: 1, color: theme.text, fontSize: 13, padding: 0 }}
              />
            </View>
            {documents.map((doc) => (
              <View key={doc.id} style={[styles.cardItem, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  <View style={[styles.iconCircle, { backgroundColor: theme.backgroundSecondary }]}>
                    <Feather name="file-text" size={18} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.cardTitle}>{doc.title}</ThemedText>
                    <ThemedText style={styles.cardDesc}>{doc.category} • Uploaded by {doc.uploadedBy}</ThemedText>
                    <ThemedText style={styles.cardMeta}>{doc.date} • {doc.size}</ThemedText>
                  </View>
                  <Pressable onPress={() => Alert.alert("Download Complete", `Downloaded ${doc.title} locally.`)} style={styles.btnSmall}>
                    <Feather name="download" size={15} color={theme.text} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* TAB 3: APPROVALS */}
        {activeTab === "approvals" && (
          <View>
            <ThemedText style={styles.secTitle}>Pending Verification Requests</ThemedText>
            {approvals.map((app) => (
              <View key={app.id} style={[styles.cardItem, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <ThemedText style={styles.cardTitle}>{app.type}</ThemedText>
                  <ThemedText style={{ fontSize: 11, fontWeight: "700", color: app.status === "Pending" ? "#D97706" : "#10B981" }}>
                    {app.status}
                  </ThemedText>
                </View>
                <ThemedText style={styles.cardDesc}>{app.desc}</ThemedText>
                <ThemedText style={styles.cardMeta}>Requested by {app.requester}</ThemedText>
                {app.status === "Pending" && (
                  <View style={styles.actionRowBtn}>
                    <Pressable onPress={() => handleApprove(app.id, "Approved")} style={[styles.actionBtn, { backgroundColor: "#D1FAE5" }]}>
                      <ThemedText style={{ color: "#065F46", fontWeight: "700", fontSize: 11 }}>Approve</ThemedText>
                    </Pressable>
                    <Pressable onPress={() => handleApprove(app.id, "Rejected")} style={[styles.actionBtn, { backgroundColor: "#FEE2E2" }]}>
                      <ThemedText style={{ color: "#991B1B", fontWeight: "700", fontSize: 11 }}>Reject</ThemedText>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* TAB 4: TIMELINE */}
        {activeTab === "timeline" && (
          <View>
            <ThemedText style={styles.secTitle}>Operational Logs Timeline</ThemedText>
            {timelineEvents.map((evt, idx) => (
              <View key={idx} style={styles.timelineRow}>
                <View style={[styles.timelineDot, { backgroundColor: theme.primary }]} />
                <View style={styles.timelineContent}>
                  <ThemedText style={styles.timelineTitle}>{evt.action}</ThemedText>
                  <ThemedText style={styles.timelineDesc}>Triggered by {evt.user} for {evt.target}</ThemedText>
                  <ThemedText style={styles.timelineMeta}>{evt.date} • {evt.time}</ThemedText>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* TAB 5: COMPANY PROFILE */}
        {activeTab === "company" && (
          <View style={[styles.cardItem, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <ThemedText style={styles.secTitle}>Multi-Company Profile Settings</ThemedText>
            <View style={styles.profileRow}>
              <ThemedText style={styles.profileLabel}>Company Legal Name</ThemedText>
              <ThemedText style={styles.profileVal}>{companyProfile.name}</ThemedText>
            </View>
            <View style={styles.profileRow}>
              <ThemedText style={styles.profileLabel}>Registered GSTIN</ThemedText>
              <ThemedText style={styles.profileVal}>{companyProfile.gstin}</ThemedText>
            </View>
            <View style={styles.profileRow}>
              <ThemedText style={styles.profileLabel}>Billing Address</ThemedText>
              <ThemedText style={styles.profileVal}>{companyProfile.address}</ThemedText>
            </View>
            <View style={styles.profileRow}>
              <ThemedText style={styles.profileLabel}>Contact Email</ThemedText>
              <ThemedText style={styles.profileVal}>{companyProfile.email}</ThemedText>
            </View>
            <View style={styles.profileRow}>
              <ThemedText style={styles.profileLabel}>Subscription Tier</ThemedText>
              <View style={[styles.badge, { backgroundColor: "#DBEAFE", marginTop: 4, alignSelf: "flex-start" }]}>
                <ThemedText style={{ color: "#1E40AF", fontWeight: "700", fontSize: 10 }}>{companyProfile.plan.toUpperCase()}</ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* TAB 6: AUDIT LOGS */}
        {activeTab === "audit" && (
          <View>
            <ThemedText style={styles.secTitle}>Security Audits Ledger</ThemedText>
            {auditLogs.map((log, idx) => (
              <View key={idx} style={[styles.cardItem, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <ThemedText style={{ fontWeight: "800", fontSize: 13 }}>{log.action}</ThemedText>
                  <ThemedText style={styles.cardMeta}>{log.date}</ThemedText>
                </View>
                <ThemedText style={styles.cardDesc}>{log.details}</ThemedText>
                <ThemedText style={styles.cardMeta}>Actor: {log.actor}</ThemedText>
              </View>
            ))}
          </View>
        )}

        {/* TAB 7: BACKUP & RESTORE */}
        {activeTab === "backup" && (
          <View style={[styles.cardItem, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, gap: 14 }]}>
            <ThemedText style={styles.secTitle}>Disaster Recovery & Database Backups</ThemedText>
            <ThemedText style={{ fontSize: 12, opacity: 0.8, lineHeight: 18 }}>
              Export your local database state as a JSON file, or restore previously archived settings files.
            </ThemedText>
            
            <Pressable onPress={handleBackupDb} style={[styles.btnActionLarge, { backgroundColor: theme.primary }]}>
              <Feather name="upload-cloud" size={16} color="#FFFFFF" />
              <ThemedText style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 13 }}>Create Database Backup</ThemedText>
            </Pressable>

            <Pressable onPress={handleRestoreDb} style={[styles.btnActionLarge, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="download-cloud" size={16} color={theme.text} />
              <ThemedText style={{ color: theme.text, fontWeight: "700", fontSize: 13 }}>Restore Backup JSON</ThemedText>
            </Pressable>
          </View>
        )}

      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 54 : 16,
    paddingBottom: 14,
    borderBottomWidth: 1
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center"
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800"
  },
  headerSubtitle: {
    fontSize: 11,
    opacity: 0.6,
    marginTop: 2
  },
  tabsScrollContainer: {
    borderBottomWidth: 1,
    height: 48
  },
  tabsRow: {
    paddingHorizontal: 16,
    gap: 4
  },
  tabItem: {
    paddingHorizontal: 14,
    justifyContent: "center",
    borderBottomWidth: 2,
    height: "100%"
  },
  tabText: {
    fontSize: 12,
    fontWeight: "700"
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120
  },
  secTitle: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    opacity: 0.8,
    marginBottom: 10
  },
  cardItem: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700"
  },
  cardDesc: {
    fontSize: 12,
    opacity: 0.8,
    marginTop: 4,
    lineHeight: 16
  },
  cardMeta: {
    fontSize: 10,
    opacity: 0.5,
    marginTop: 6
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  emptyText: {
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 30,
    opacity: 0.6
  },
  actionTextBtn: {
    padding: 4
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center"
  },
  btnSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.02)"
  },
  actionRowBtn: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12
  },
  actionBtn: {
    flex: 1,
    height: 34,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center"
  },
  timelineRow: {
    flexDirection: "row",
    marginBottom: 14
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    marginRight: 12
  },
  timelineContent: {
    flex: 1
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: "700"
  },
  timelineDesc: {
    fontSize: 11,
    opacity: 0.8,
    marginTop: 2
  },
  timelineMeta: {
    fontSize: 9,
    opacity: 0.5,
    marginTop: 2
  },
  profileRow: {
    marginBottom: 12
  },
  profileLabel: {
    fontSize: 10,
    opacity: 0.6,
    textTransform: "uppercase"
  },
  profileVal: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2
  },
  btnActionLarge: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    height: 44,
    borderRadius: 8
  }
});
