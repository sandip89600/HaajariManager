import {
  DeviceEventEmitter,
  Platform,
  AppState,
  AppStateStatus,
} from "react-native";
import { API_URL } from "./apiConfig";

const KEEP_ALIVE_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes (Render sleeps after 15 minutes)
const PING_TIMEOUT_MS = 45000; // Allow Render cold start to complete without aborting prematurely
const FOREGROUND_PING_THROTTLE_MS = 30000;

let isOnline = true;
let isBackendAwake = false;
let keepAliveInterval: ReturnType<typeof setInterval> | null = null;
let lastPingTime = 0;
let inflightPing: Promise<boolean> | null = null;

async function fetchWithTimeout(
  url: string,
  method: "GET" | "HEAD",
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export const networkManager = {
  isOnline(): boolean {
    return isOnline;
  },

  isBackendReady(): boolean {
    return isBackendAwake;
  },

  setOnline(online: boolean): void {
    if (isOnline !== online) {
      isOnline = online;
      DeviceEventEmitter.emit("network:statusChanged", { isOnline });
    }
  },

  async pingServer(): Promise<boolean> {
    if (inflightPing) {
      return inflightPing;
    }

    inflightPing = (async () => {
      try {
        let res: Response | null = null;
        try {
          res = await fetchWithTimeout(`${API_URL}/ping`, "GET", PING_TIMEOUT_MS);
        } catch {
          res = await fetchWithTimeout(
            `${API_URL}/health`,
            "GET",
            PING_TIMEOUT_MS,
          ).catch(() => null);
        }

        const ok = Boolean(
          res &&
            (res.ok ||
              res.status === 200 ||
              res.status === 304 ||
              res.status === 404),
        );
        isBackendAwake = ok;
        lastPingTime = Date.now();
        if (ok) {
          DeviceEventEmitter.emit("network:backendAwake", { awake: true });
        }
        return ok;
      } catch {
        lastPingTime = Date.now();
        return false;
      } finally {
        inflightPing = null;
      }
    })();

    return inflightPing;
  },

  async checkConnectivity(): Promise<boolean> {
    return this.pingServer();
  },

  init(): () => void {
    // 1. Wake up backend immediately on app start
    this.pingServer();

    // 2. Web browser network listeners (only genuine browser offline state)
    let handleOnline: (() => void) | null = null;
    let handleOffline: (() => void) | null = null;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      handleOnline = () => {
        this.setOnline(true);
        this.pingServer();
      };
      handleOffline = () => this.setOnline(false);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }

    // 3. AppState change listener (wake backend when app returns from background)
    const appStateSub = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (
          nextAppState === "active" &&
          Date.now() - lastPingTime > FOREGROUND_PING_THROTTLE_MS
        ) {
          this.pingServer();
        }
      },
    );

    // 4. Keep-alive ping every 14 minutes while app is active
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    keepAliveInterval = setInterval(() => {
      this.pingServer();
    }, KEEP_ALIVE_INTERVAL_MS);

    return () => {
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
      appStateSub.remove();
      if (Platform.OS === "web" && typeof window !== "undefined") {
        if (handleOnline) window.removeEventListener("online", handleOnline);
        if (handleOffline) window.removeEventListener("offline", handleOffline);
      }
    };
  },
};
