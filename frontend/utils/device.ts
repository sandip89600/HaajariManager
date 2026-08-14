import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const DEVICE_ID_KEY = "@haajari_persistent_device_id_v2";

export async function getOrCreateDeviceId(): Promise<string> {
  try {
    // 1. Try SecureStore
    if (Platform.OS !== "web") {
      let storedId = await SecureStore.getItemAsync(DEVICE_ID_KEY).catch(() => null);
      if (storedId) return storedId;
    }

    // 2. Try AsyncStorage
    let storedId = await AsyncStorage.getItem(DEVICE_ID_KEY).catch(() => null);
    if (storedId) {
      if (Platform.OS !== "web") {
        await SecureStore.setItemAsync(DEVICE_ID_KEY, storedId).catch(() => {});
      }
      return storedId;
    }

    // 3. Generate new persistent ID
    const randomHex = Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
    const newDeviceId = `dev_${randomHex}`;

    if (Platform.OS !== "web") {
      await SecureStore.setItemAsync(DEVICE_ID_KEY, newDeviceId).catch(() => {});
    }
    await AsyncStorage.setItem(DEVICE_ID_KEY, newDeviceId).catch(() => {});

    return newDeviceId;
  } catch {
    return `dev_temp_${Date.now()}`;
  }
}

export function getDeviceDetails() {
  const platform = Platform.OS === "ios" ? "iOS" : Platform.OS === "android" ? "Android" : "Web";
  let deviceName = Platform.OS === "ios" ? "iPhone" : Platform.OS === "android" ? "Android Device" : "Web Browser";
  let browser = Platform.OS === "web" ? "Web Browser" : "Haajari Mobile App";

  return {
    platform,
    deviceName,
    browser,
  };
}

export async function getDeviceHeaders(): Promise<Record<string, string>> {
  const deviceId = await getOrCreateDeviceId();
  const { platform, deviceName, browser } = getDeviceDetails();

  return {
    "x-device-id": deviceId,
    "x-device-name": deviceName,
    "x-platform": platform,
    "x-browser": browser,
  };
}
