import { Platform } from "react-native";
import Constants from "expo-constants";

declare const process: any;

export const getApiUrl = (): string => {
  if (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "");
  }

  // 1. Web browser environment
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

  // 2. Development mode on Metro / Local simulator / LAN
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

  // 3. Fallback production backend endpoint
  return "https://haajarimanager.onrender.com/api";
};

export const API_URL = getApiUrl();
