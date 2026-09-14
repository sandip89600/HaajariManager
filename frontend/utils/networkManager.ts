import {
  DeviceEventEmitter,
  Platform,
  AppState,
  AppStateStatus,
} from "react-native";
import { API_URL } from "./apiConfig";

let isOnline = true;
let heartbeatInterval: any = null;
let lastPingTime = 0;

export const networkManager = {
  isOnline(): boolean {
    return isOnline;
  },

  setOnline(online: boolean): void {
    if (isOnline !== online) {
      isOnline = online;
      DeviceEventEmitter.emit("network:statusChanged", { isOnline });
    }
  },

  async checkConnectivity(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${API_URL}/health`, {
        method: "GET",
        signal: controller.signal,
      }).catch(async () => {
        // Fallback to pinging root URL if /health is not defined
        return fetch(`${API_URL}`, {
          method: "HEAD",
          signal: controller.signal,
        });
      });
      clearTimeout(timeoutId);

      const ok = Boolean(
        res &&
          (res.ok ||
            res.status === 404 ||
            res.status === 200 ||
            res.status === 304),
      );
      this.setOnline(ok);
      lastPingTime = Date.now();
      return ok;
    } catch {
      this.setOnline(false);
      lastPingTime = Date.now();
      return false;
    }
  },

  init(): () => void {
    // 1. Initial check
    this.checkConnectivity();

    // 2. Web network listeners
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const handleOnline = () => this.setOnline(true);
      const handleOffline = () => this.setOnline(false);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }

    // 3. AppState change listener (e.g. app returns from background)
    const appStateSub = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (nextAppState === "active") {
          this.checkConnectivity();
        }
      },
    );

    // 4. Background heartbeat
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      // Periodic check every 25 seconds
      this.checkConnectivity();
    }, 25000);

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      appStateSub.remove();
    };
  },
};
