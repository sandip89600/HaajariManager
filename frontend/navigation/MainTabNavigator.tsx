import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import SecurityAlertModal from "@/components/SecurityAlertModal";
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

export type MainTabParamList = {
  AttendanceTab: undefined;
  AttendanceScreenTab: undefined;
  ScanQRTab: undefined;
  ReportsTab: undefined;
  SiteManagementTab: undefined;
  WorkersTab?: undefined;
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
  AttendanceTab: any;
  AttendanceScreenTab: any;
  ScanQRTab: any;
  WorkersTab: any;
  SettingsTab: any;
  SiteManagementTab: any;
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
          headerTitle: t.workers.title,
        }}
      />
      <AttendanceStack.Screen
        name="Summary"
        component={SummaryScreen}
        options={{
          headerTitle: t.summary.title,
        }}
      />
    </AttendanceStack.Navigator>
  );
}

// Dummy screen for center tab
const DummyScreen = () => <View style={{ flex: 1 }} />;

function MainTabs() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const { isSupervisor, isWorker } = useAuth();
  const { isModuleVisible } = useFeatureAccess();

  const [isScannerOpen, setIsScannerOpen] = React.useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    const subDrawer = require("react-native").DeviceEventEmitter.addListener(
      "OPEN_SETTINGS_DRAWER",
      () => {
        setIsDrawerOpen(true);
      }
    );
    const subScanner = require("react-native").DeviceEventEmitter.addListener(
      "OPEN_QR_SCANNER",
      () => {
        setIsScannerOpen(true);
      }
    );
    return () => {
      subDrawer.remove();
      subScanner.remove();
    };
  }, []);

  const isDashboardVisible = isModuleVisible("dashboard");
  const isSiteControlVisible = isModuleVisible("siteControl");
  const isReportsVisible = isModuleVisible("reports");

  const tabBarStyle = {
    backgroundColor:
      Platform.OS === "ios" ? "transparent" : theme.backgroundSecondary,
    borderTopColor: theme.border,
    borderTopWidth: 1,
    height: Platform.OS === "ios" ? 85 : 68,
    paddingBottom: Platform.OS === "ios" ? 25 : 8,
    paddingTop: 6,
    elevation: 8,
  };

  const tabBackground = () =>
    Platform.OS === "ios" ? (
      <BlurView
        intensity={100}
        tint={isDark ? "dark" : "light"}
        style={StyleSheet.absoluteFill}
      />
    ) : null;

  return (
    <>
      <Tab.Navigator
        initialRouteName="AttendanceTab"
        screenOptions={{
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.tabIconDefault,
          tabBarStyle,
          tabBarBackground: tabBackground,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
            marginTop: 2,
          },
          ...getCommonTabScreenOptions({ theme, isDark }),
        }}
      >
        {/* TAB 1: Dashboard */}
        <Tab.Screen
          name="AttendanceTab"
          component={AttendanceNavigator}
          options={{
            title: t.tabs?.dashboard || t("tabs.dashboard", "Dashboard"),
            tabBarLabel: t.tabs?.dashboard || t("tabs.dashboard", "Dashboard"),
            headerShown: false,
            tabBarItemStyle: isDashboardVisible ? undefined : { display: "none" },
            tabBarIcon: ({ color, size }) => (
              <Feather name="grid" size={22} color={color} />
            ),
          }}
        />

        {/* TAB 2: Attendance */}
        <Tab.Screen
          name="AttendanceScreenTab"
          component={AttendanceScreen}
          options={{
            title: t.tabs?.attendance || t("tabs.attendance", "Attendance"),
            tabBarLabel: t.tabs?.attendance || t("tabs.attendance", "Attendance"),
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Feather name="check-square" size={22} color={color} />
            ),
          }}
        />

        {/* TAB 3: CENTER ACTION SCAN QR */}
        <Tab.Screen
          name="ScanQRTab"
          component={DummyScreen}
          options={{
            title: t("tabs.scanQr", "Scan QR"),
            tabBarLabel: t("tabs.scanQr", "Scan QR"),
            tabBarButton: () => (
              <View style={styles.centerQrContainer}>
                <Pressable
                  onPress={() => setIsScannerOpen(true)}
                  style={({ pressed }) => [
                    styles.centerQrBtn,
                    {
                      backgroundColor: theme.primary,
                      transform: [{ scale: pressed ? 0.94 : 1 }],
                    },
                  ]}
                >
                  <Feather name="maximize" size={24} color="#FFFFFF" />
                </Pressable>
                <ThemedText
                  style={[
                    styles.centerQrLabel,
                    { color: theme.tabIconDefault },
                  ]}
                >
                  {t("tabs.scanQr", "Scan QR")}
                </ThemedText>
              </View>
            ),
          }}
        />

        {/* TAB 4: Summary */}
        <Tab.Screen
          name="ReportsTab"
          component={SummaryScreen}
          options={{
            title: t.tabs?.summary || t("tabs.summary", "Summary"),
            tabBarLabel: t.tabs?.summary || t("tabs.summary", "Summary"),
            headerShown: false,
            tabBarItemStyle: isReportsVisible ? undefined : { display: "none" },
            tabBarIcon: ({ color, size }) => (
              <Feather name="bar-chart-2" size={22} color={color} />
            ),
          }}
        />

        {/* TAB 5: Site */}
        <Tab.Screen
          name="SiteManagementTab"
          component={isWorker ? SiteListScreen : SiteControlDashboardScreen}
          options={{
            title: isSupervisor
              ? t("supervisor.assignedSites", "मेरी साइट्स")
              : t.tabs?.siteControl || t("tabs.siteControl", "Site"),
            tabBarLabel: isSupervisor
              ? t("supervisor.assignedSites", "मेरी साइट्स")
              : t.tabs?.siteControl || t("tabs.siteControl", "Site"),
            headerShown: false,
            tabBarItemStyle: isSiteControlVisible ? undefined : { display: "none" },
            tabBarIcon: ({ color, size }) => (
              <Feather name="layers" size={22} color={color} />
            ),
          }}
        />
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
  const { newDeviceAlert, clearNewDeviceAlert, setNewDeviceAlert, userId } =
    useAuth();
  const { socket } = useSocket();

  React.useEffect(() => {
    if (socket && userId) {
      socket.emit("join_user_room", userId);

      const handleNewDeviceLogin = (data: any) => {
        if (data) {
          setNewDeviceAlert(data);
        }
      };

      socket.on("new_device_login", handleNewDeviceLogin);
      return () => {
        socket.off("new_device_login", handleNewDeviceLogin);
      };
    }
  }, [socket, userId]);

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
          name="SiteManagementTab"
          component={SiteControlDashboardScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="ReportsTab"
          component={SummaryScreen}
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

