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

export type MainTabParamList = {
  AttendanceTab: undefined;
  WorkersTab: undefined;
  SummaryTab: undefined;
  SettingsTab: undefined;
  UserProfileTab: undefined;
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
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  const { theme, isDark } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();

  const role = user?.role; // contractor, builder, supervisor

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
        component={AttendanceScreen}
        options={{
          title: t.tabs.attendance,
          headerTitle: () => <HeaderTitle title={t.app.name} />,
          tabBarIcon: ({ color, size }) => (
            <Feather name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="WorkersTab"
        component={WorkersScreen}
        options={{
          title: t.tabs.workers,
          headerTitle: t.workers.title,
          tabBarIcon: ({ color, size }) => (
            <Feather name="users" size={size} color={color} />
          ),
        }}
      />
      {role !== "supervisor" && (
        <Tab.Screen
          name="SummaryTab"
          component={SummaryScreen}
          options={{
            title: t.tabs.summary,
            headerTitle: t.summary.title,
            tabBarIcon: ({ color, size }) => (
              <Feather name="bar-chart-2" size={size} color={color} />
            ),
          }}
        />
      )}
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
          presentation: "modal",
          headerTitle: t.workers.addWorker,
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
    </Stack.Navigator>
  );
}
