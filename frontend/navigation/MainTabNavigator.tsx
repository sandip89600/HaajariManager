import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import {
  Platform,
  StyleSheet,
  View,
  Pressable,
  Text,
  DeviceEventEmitter,
} from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import SecurityAlertModal from "@/components/SecurityAlertModal";
import SettingsDrawer from "@/components/SettingsDrawer";
import { QrScannerModal } from "@/components/QrScannerModal";
import { ThemedText } from "@/components/ThemedText";
import {
  getCommonScreenOptions,
  getCommonTabScreenOptions,
} from "@/navigation/screenOptions";
import { HeaderTitle } from "@/components/HeaderTitle";
import AttendanceScreen from "@/screens/AttendanceScreen";
import WorkersScreen from "@/screens/WorkersScreen";
import SummaryScreen from "@/screens/SummaryScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import AddWorkerScreen from "@/screens/AddWorkerScreen";
import SupervisorManagementScreen from "@/screens/SupervisorManagementScreen";
import UserProfileScreen from "@/screens/UserProfileScreen";
import SupportScreen from "@/screens/SupportScreen";
import PrivacySettingsScreen from "@/screens/PrivacySettingsScreen";
import DeviceManagementScreen from "@/screens/DeviceManagementScreen";
import SiteControlDashboardScreen from "@/screens/SiteControlDashboardScreen";
import SiteDetailControlScreen from "@/screens/SiteDetailControlScreen";
import DashboardScreen from "@/screens/DashboardScreen";
import SupervisorDashboardScreen from "@/screens/SupervisorDashboardScreen";
import WorkerDashboardScreen from "@/screens/WorkerDashboardScreen";
import WorkerCameraUpdateScreen from "@/screens/WorkerCameraUpdateScreen";
import WorkerSiteLogsScreen from "@/screens/WorkerSiteLogsScreen";
import WorkerSummaryScreen from "@/screens/WorkerSummaryScreen";
import SiteListScreen from "@/screens/SiteListScreen";
import CreateSiteScreen from "@/screens/CreateSiteScreen";
import EditSiteScreen from "@/screens/EditSiteScreen";
import SiteDetailsScreen from "@/screens/SiteDetailsScreen";
import EnterpriseCollaborationScreen from "@/screens/EnterpriseCollaborationScreen";
import SubscriptionScreen from "@/screens/SubscriptionScreen";
import PaymentStatusScreen from "@/screens/PaymentStatusScreen";
import BillingHistoryScreen from "@/screens/BillingHistoryScreen";
import PaymentHandoverMenuScreen from "@/screens/PaymentHandoverMenuScreen";
import SecureAccountScreen from "@/screens/SecureAccountScreen";
import NotificationScreen from "@/screens/NotificationScreen";
import RoleBottomNavigation from "@/components/RoleBottomNavigation";
import { getNormalizedRole } from "@/navigation/navigationConfig";

export type MainTabParamList = {
  DashboardTab: undefined;
  WorkersTab?: undefined;
  WorkerCameraTab?: undefined;
  SiteLogsTab?: undefined;
  ScanQRTab?: undefined;
  SummaryTab: undefined;
  ProfileTab?: undefined;
  SiteControlTab?: undefined;

  // Legacy tab aliases
  AttendanceTab?: undefined;
  AttendanceScreenTab?: undefined;
  ReportsTab?: undefined;
  SiteManagementTab?: undefined;
  SettingsTab?: undefined;
};

export type AttendanceStackParamList = {
  Dashboard: undefined;
  AttendanceDetail: { siteId?: string } | undefined;
  Workers: undefined;
  Summary: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  AddWorker: { workerId?: string } | undefined;
  ProjectManagement: undefined;
  SupervisorManagement: undefined;
  UserProfile: undefined;
  Support: undefined;
  PrivacySettings: undefined;
  DeviceManagement: undefined;
  SiteManagement: undefined;
  SiteDetailControl: { siteId: string };
  SiteList: undefined;
  CreateSite: undefined;
  AddSite: undefined;
  EditSite: { siteId: string };
  SiteDetails: { siteId: string };
  EnterpriseCollaboration: undefined;
  Subscription: undefined;
  PaymentStatus: {
    status: "success" | "failed" | "pending";
    planName?: string;
    transactionId?: string;
  };
  BillingHistory: undefined;
  PaymentHandoverMenu: undefined;
  SecureAccount: { deviceInfo?: any } | undefined;
  Notifications: undefined;

  // Root stack fallbacks & tab alias mappings
  Dashboard: undefined;
  AttendanceDetail: { siteId?: string } | undefined;
  Workers: undefined;
  Summary: undefined;
  DashboardTab: any;
  AttendanceTab: any;
  AttendanceScreenTab: any;
  ScanQRTab: any;
  WorkersTab: any;
  SettingsTab: any;
  SiteControlTab: any;
  SiteManagementTab: any;
  SummaryTab: any;
  ReportsTab: any;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();
const AttendanceStack = createNativeStackNavigator<AttendanceStackParamList>();

function AttendanceNavigator() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const { isSupervisor, isWorker } = useAuth();

  const DashboardComponent = isWorker
    ? WorkerDashboardScreen
    : isSupervisor
      ? SupervisorDashboardScreen
      : DashboardScreen;

  return (
    <AttendanceStack.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        ...getCommonScreenOptions({ theme, isDark }),
      }}
    >
      <AttendanceStack.Screen
        name="Dashboard"
        component={DashboardComponent}
        options={{
          headerShown: false,
        }}
      />
      <AttendanceStack.Screen
        name="AttendanceDetail"
        component={AttendanceScreen}
        options={{
          headerShown: false,
        }}
      />
      <AttendanceStack.Screen
        name="Workers"
        component={WorkersScreen}
        options={{
          headerTitle: t("nav.workers", t.workers.title),
        }}
      />
      <AttendanceStack.Screen
        name="Summary"
        component={SummaryScreen}
        options={{
          headerTitle: t("nav.summary", t.summary.title),
        }}
      />
    </AttendanceStack.Navigator>
  );
}

// Dummy screen for center action tab
const DummyScreen = () => <View style={{ flex: 1 }} />;

function MainTabs() {
  const { theme, isDark } = useTheme();
  const { isWorker, user, role } = useAuth();
  const normalizedRole = getNormalizedRole(user?.role || role);

  const [isScannerOpen, setIsScannerOpen] = React.useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    const subDrawer = DeviceEventEmitter.addListener(
      "OPEN_SETTINGS_DRAWER",
      () => {
        setIsDrawerOpen(true);
      },
    );
    const subScanner = DeviceEventEmitter.addListener("OPEN_QR_SCANNER", () => {
      setIsScannerOpen(true);
    });
    return () => {
      subDrawer.remove();
      subScanner.remove();
    };
  }, []);

  return (
    <>
      <Tab.Navigator
        initialRouteName="DashboardTab"
        tabBar={(props) => (
          <RoleBottomNavigation
            {...props}
            role={normalizedRole}
            onOpenQrScanner={() => setIsScannerOpen(true)}
          />
        )}
        screenOptions={{
          headerShown: false,
          ...getCommonTabScreenOptions({ theme, isDark }),
        }}
      >
        {/* 1. Home / Dashboard (All roles) */}
        <Tab.Screen
          name="DashboardTab"
          component={AttendanceNavigator}
          options={{ headerShown: false }}
        />

        {/* WORKER SPECIFIC TABS */}
        {isWorker && (
          <Tab.Screen
            name="WorkerCameraTab"
            component={WorkerCameraUpdateScreen}
            options={{ headerShown: false }}
          />
        )}

        {/* CONTRACTOR / SUPERVISOR SPECIFIC TABS */}
        {!isWorker && (
          <Tab.Screen
            name="WorkersTab"
            component={WorkersScreen}
            options={{ headerShown: false }}
          />
        )}

        {/* 3. Center QR Action (All roles: Contractor, Supervisor, Worker) */}
        <Tab.Screen
          name="ScanQRTab"
          component={DummyScreen}
          options={{ headerShown: false }}
        />

        {/* Summary Tab (Worker uses WorkerSummaryScreen, Contractor/Supervisor uses SummaryScreen) */}
        <Tab.Screen
          name="SummaryTab"
          component={isWorker ? WorkerSummaryScreen : SummaryScreen}
          options={{ headerShown: false }}
        />

        {/* Worker Profile Tab */}
        {isWorker && (
          <Tab.Screen
            name="ProfileTab"
            component={UserProfileScreen}
            options={{ headerShown: false }}
          />
        )}

        {/* Site Control (Contractor & Supervisor only) */}
        {!isWorker && (
          <Tab.Screen
            name="SiteControlTab"
            component={SiteControlDashboardScreen}
            options={{ headerShown: false }}
          />
        )}
      </Tab.Navigator>

      {/* Settings Drawer & QR Scanner Modals */}
      <SettingsDrawer
        visible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
      {isScannerOpen && (
        <QrScannerModal
          visible={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </>
  );
}

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const {
    newDeviceAlert,
    clearNewDeviceAlert,
    setNewDeviceAlert,
    userId,
    uniqueId,
    user,
  } = useAuth();
  const { socket } = useSocket();

  React.useEffect(() => {
    if (socket) {
      if (userId) {
        socket.emit("join_user_room", userId);
      }
      if (uniqueId || user?.uniqueId) {
        socket.emit("join_worker_room", uniqueId || user?.uniqueId);
      }
      if (user?.tenantId) {
        socket.emit("join_tenant_room", user.tenantId);
      }

      const handleAttendanceUpdate = (data: any) => {
        DeviceEventEmitter.emit("attendanceUpdated", data);
        DeviceEventEmitter.emit("refreshData", data);
      };

      socket.on("attendance:recorded", handleAttendanceUpdate);
      socket.on("attendance:updated", handleAttendanceUpdate);
      socket.on("attendance:cleared", handleAttendanceUpdate);
      socket.on("attendance:deleted", handleAttendanceUpdate);
      socket.on("admin_dashboard_update", handleAttendanceUpdate);

      const handleNewDeviceLogin = (data: any) => {
        if (data) {
          setNewDeviceAlert(data);
        }
      };

      socket.on("new_device_login", handleNewDeviceLogin);
      return () => {
        socket.off("attendance:recorded", handleAttendanceUpdate);
        socket.off("attendance:updated", handleAttendanceUpdate);
        socket.off("attendance:cleared", handleAttendanceUpdate);
        socket.off("attendance:deleted", handleAttendanceUpdate);
        socket.off("admin_dashboard_update", handleAttendanceUpdate);
        socket.off("new_device_login", handleNewDeviceLogin);
      };
    }
  }, [socket, userId, uniqueId, user?.uniqueId, user?.tenantId]);

  return (
    <>
      <Stack.Navigator
        screenOptions={{
          ...getCommonScreenOptions({ theme, isDark }),
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AddWorker"
          component={AddWorkerScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="ProjectManagement"
          component={SiteControlDashboardScreen}
          options={{
            headerTitle: "Site Management",
          }}
        />
        <Stack.Screen
          name="SupervisorManagement"
          component={SupervisorManagementScreen}
          options={{
            headerTitle: "Supervisor Management",
          }}
        />
        <Stack.Screen
          name="UserProfile"
          component={UserProfileScreen}
          options={{
            headerTitle: "My Profile",
          }}
        />
        <Stack.Screen
          name="Support"
          component={SupportScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="PrivacySettings"
          component={PrivacySettingsScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="DeviceManagement"
          component={DeviceManagementScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="SiteManagement"
          component={SiteControlDashboardScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="SiteDetailControl"
          component={SiteDetailControlScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="SiteList"
          component={SiteListScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="CreateSite"
          component={CreateSiteScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="AddSite"
          component={CreateSiteScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="EditSite"
          component={EditSiteScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="SiteDetails"
          component={SiteDetailsScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="EnterpriseCollaboration"
          component={EnterpriseCollaborationScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="Subscription"
          component={SubscriptionScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="PaymentStatus"
          component={PaymentStatusScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="BillingHistory"
          component={BillingHistoryScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="PaymentHandoverMenu"
          component={PaymentHandoverMenuScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="SecureAccount"
          component={SecureAccountScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationScreen}
          options={{
            headerShown: false,
          }}
        />

        {/* Fallback stack screen mappings */}
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="AttendanceDetail"
          component={AttendanceScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="Workers"
          component={WorkersScreen}
          options={{
            headerTitle: t.workers.title,
          }}
        />
        <Stack.Screen
          name="Summary"
          component={SummaryScreen}
          options={{
            headerTitle: t.summary.title,
          }}
        />
        {/* Fallback tab alias screen mappings */}
        <Stack.Screen
          name="DashboardTab"
          component={DashboardScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AttendanceTab"
          component={DashboardScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="WorkersTab"
          component={WorkersScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SettingsTab"
          component={SettingsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SiteControlTab"
          component={SiteControlDashboardScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SiteManagementTab"
          component={SiteControlDashboardScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SummaryTab"
          component={SummaryScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ReportsTab"
          component={SummaryScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ScanQRTab"
          component={DummyScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
      {newDeviceAlert && (
        <SecurityAlertModal
          visible={!!newDeviceAlert}
          deviceInfo={newDeviceAlert}
          onDismiss={clearNewDeviceAlert}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  centerQrContainer: {
    alignItems: "center",
    justifyContent: "center",
    top: -14,
  },
  centerQrBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  centerQrLabel: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 3,
  },
});
