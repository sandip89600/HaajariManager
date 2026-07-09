import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
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
import ProjectManagementScreen from "@/screens/ProjectManagementScreen";
import SupervisorManagementScreen from "@/screens/SupervisorManagementScreen";
import UserProfileScreen from "@/screens/UserProfileScreen";
import SupportScreen from "@/screens/SupportScreen";
import PrivacySettingsScreen from "@/screens/PrivacySettingsScreen";
import DeviceManagementScreen from "@/screens/DeviceManagementScreen";
import SiteManagementScreen from "@/screens/SiteManagementScreen";
import DashboardScreen from "@/screens/DashboardScreen";

export type MainTabParamList = {
  AttendanceTab: undefined;
  SiteManagementTab: undefined;
  SettingsTab: undefined;
};

export type AttendanceStackParamList = {
  Dashboard: undefined;
  AttendanceDetail: undefined;
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

  // Root stack fallbacks
  AttendanceDetail: undefined;
  Workers: undefined;
  Summary: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();
const AttendanceStack = createNativeStackNavigator<AttendanceStackParamList>();

function AttendanceNavigator() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();

  return (
    <AttendanceStack.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        ...getCommonScreenOptions({ theme, isDark }),
      }}
    >
      <AttendanceStack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          headerShown: false,
        }}
      />
      <AttendanceStack.Screen
        name="AttendanceDetail"
        component={AttendanceScreen}
        options={{
          headerTitle: t.attendance.title,
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

function MainTabs() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();

  const tabBarStyle = {
    position: "absolute" as const,
    backgroundColor: Platform.select({
      ios: "transparent",
      android: theme.backgroundRoot,
    }),
    borderTopWidth: 0,
    elevation: 0,
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
    <Tab.Navigator
      initialRouteName="AttendanceTab"
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle,
        tabBarBackground: tabBackground,
        ...getCommonTabScreenOptions({ theme, isDark }),
      }}
    >
      <Tab.Screen
        name="AttendanceTab"
        component={AttendanceNavigator}
        options={{
          title: t.tabs.attendance,
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Feather name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SiteManagementTab"
        component={SiteManagementScreen}
        options={{
          title: "Site Management",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Feather name="layers" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          title: t.tabs.settings,
          headerTitle: t.settings.title,
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();

  return (
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
        component={ProjectManagementScreen}
        options={{
          headerTitle: "Project Management",
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
        component={SiteManagementScreen}
        options={{
          headerShown: false,
        }}
      />
      
      {/* Fallback stack screen mappings */}
      <Stack.Screen
        name="AttendanceDetail"
        component={AttendanceScreen}
        options={{
          headerTitle: t.attendance.title,
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
    </Stack.Navigator>
  );
}

