import React, { useState, useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";
import LoginScreen from "@/screens/LoginScreen";
import SignupScreen from "@/screens/SignupScreen";
import ForgotPasswordScreen from "@/screens/ForgotPasswordScreen";
import ResetPasswordScreen from "@/screens/ResetPasswordScreen";
import TermsAndConditionsScreen from "@/screens/TermsAndConditionsScreen";
import PrivacyPolicyScreen from "@/screens/PrivacyPolicyScreen";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import FirstTimeSetupScreen from "@/screens/FirstTimeSetupScreen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, ActivityIndicator, StyleSheet } from "react-native";

export type RootNavigatorParamList = {
  FirstTimeSetup: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string } | undefined;
  TermsAndConditions: undefined;
  PrivacyPolicy: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootNavigatorParamList>();

export default function RootNavigator() {
  const { isLoggedIn, isGuest, isLoading } = useAuth();
  const { theme, isDark } = useTheme();
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("@haajari/isFirstLaunchCompleted")
      .then((val) => {
        setIsFirstLaunch(val !== "true");
      })
      .catch(() => {
        setIsFirstLaunch(false);
      });
  }, []);

  if (isLoading || isFirstLaunch === null) {
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
      {isFirstLaunch ? (
        <Stack.Screen name="FirstTimeSetup">
          {(props) => (
            <FirstTimeSetupScreen
              {...props}
              onComplete={() => setIsFirstLaunch(false)}
            />
          )}
        </Stack.Screen>
      ) : hasAccess ? (
        <Stack.Screen name="Main" component={MainTabNavigator} />
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="Main" component={MainTabNavigator} />
        </>
      )}
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
      />
      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
      />
      <Stack.Screen
        name="TermsAndConditions"
        component={TermsAndConditionsScreen}
      />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
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
