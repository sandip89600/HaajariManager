import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";
import LoginScreen from "@/screens/LoginScreen";
import SignupScreen from "@/screens/SignupScreen";
import TermsAndConditionsScreen from "@/screens/TermsAndConditionsScreen";
import PrivacyPolicyScreen from "@/screens/PrivacyPolicyScreen";
import AdminLoginScreen from "@/screens/AdminLoginScreen";
import AdminDashboardScreen from "@/screens/AdminDashboardScreen";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import { View, ActivityIndicator, StyleSheet } from "react-native";

export type RootNavigatorParamList = {
  Login: undefined;
  Signup: undefined;
  TermsAndConditions: undefined;
  PrivacyPolicy: undefined;
  Main: undefined;
  AdminLogin: undefined;
  AdminDashboard: undefined;
};

const Stack = createNativeStackNavigator<RootNavigatorParamList>();

export default function RootNavigator() {
  const { isLoggedIn, isGuest, isLoading } = useAuth();
  const { theme, isDark } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const hasAccess = isLoggedIn || isGuest;

  return (
    <Stack.Navigator
      screenOptions={{
        ...getCommonScreenOptions({ theme, isDark, transparent: false }),
        headerShown: false,
      }}
    >
      {hasAccess ? (
        <Stack.Screen name="Main" component={MainTabNavigator} />
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
        </>
      )}
      <Stack.Screen
        name="TermsAndConditions"
        component={TermsAndConditionsScreen}
      />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
