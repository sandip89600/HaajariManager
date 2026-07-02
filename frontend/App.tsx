import React from "react";
import { StyleSheet, View, ActivityIndicator, Platform } from "react-native";
import {
  NavigationContainer,
  getStateFromPath,
  getPathFromState,
} from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import * as Linking from "expo-linking";
import RootNavigator from "@/navigation/RootNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LanguageContext, useLanguageProvider } from "@/hooks/useLanguage";
import { AuthContext, useAuthProvider } from "@/hooks/useAuth";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { Colors } from "@/constants/theme";
import { SocketProvider } from "@/context/SocketContext";
import VoiceAssistant from "@/components/VoiceAssistant";
import { navigationRef } from "@/navigation/navigationRef";

const prefix = Linking.createURL("/");

const linking = {
  prefixes: [prefix, "haajari://", "http://localhost:8081"],
  config: {
    screens: {
      AdminLogin: "haajariappadmin/login",
      AdminDashboard: "haajariappadmin/adminone",
      Login: "login",
      Signup: "signup",
      TermsAndConditions: "terms",
      Main: "",
    },
  },
  getStateFromPath(path: string, config: any) {
    if (Platform.OS === "web") {
      const hash = window.location.hash;
      if (hash && hash.startsWith("#/")) {
        return getStateFromPath(hash.substring(2), config);
      }
    }
    return getStateFromPath(path, config);
  },
  getPathFromState(state: any, config: any) {
    const path = getPathFromState(state, config);
    return Platform.OS === "web" ? `#${path}` : path;
  },
};

function AppInner() {
  const languageContext = useLanguageProvider();
  const authContext = useAuthProvider();
  const { theme, isDark } = useTheme();

  if (languageContext.isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <LanguageContext.Provider value={languageContext}>
      <AuthContext.Provider value={authContext}>
        <NavigationContainer ref={navigationRef} linking={linking}>
          <RootNavigator />
        </NavigationContainer>
        {authContext.isLoggedIn && <VoiceAssistant />}
        <StatusBar style={isDark ? "light" : "dark"} />
      </AuthContext.Provider>
    </LanguageContext.Provider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <KeyboardProvider>
          <ThemeProvider>
            <SocketProvider>
              <ErrorBoundary>
                <AppInner />
              </ErrorBoundary>
            </SocketProvider>
          </ThemeProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
