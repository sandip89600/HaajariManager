import { Platform } from "react-native";
import Constants from "expo-constants";

declare const process: any;

export const getApiUrl = (): string => {
  // 1. Environment Variable override has highest priority (e.g. from .env or EAS build)
  if (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) {
    const envUrl = process.env.EXPO_PUBLIC_API_URL.trim().replace(/\/$/, "");
    if (envUrl) {
      return envUrl;
    }
  }

  // 2. Web browser environment
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location
  ) {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:5000/api";
    }
  }

  // 3. In Local Development (__DEV__) fallback with Expo on physical device / LAN
  if (__DEV__) {
    const debuggerHost =
      Constants.expoConfig?.hostUri ||
      (Constants as any).manifest?.debuggerHost ||
      (Constants as any).experienceUrl;
    if (debuggerHost) {
      const ip = debuggerHost.split(":")[0];
      if (ip && ip !== "localhost" && ip !== "127.0.0.1") {
        return `http://${ip}:5000/api`;
      }
    }
  }

  // 4. Fallback production backend endpoint
  return "https://haajarimanager.onrender.com/api";
};

export const API_URL = getApiUrl();
