import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import { API_URL } from "./apiConfig";
import { getDeviceHeaders } from "./device";
import { networkManager } from "./networkManager";

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export async function authenticatedFetch(
  url: string,
  options: RequestInit & { _retry?: boolean; timeoutMs?: number } = {},
): Promise<Response> {
  let fullUrl = url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    const endpoint = url.startsWith("/") ? url : `/${url}`;
    fullUrl = `${API_URL}${endpoint}`;
  }

  const authDataRaw = await AsyncStorage.getItem("@haajari/auth").catch(() => null);
  const auth = authDataRaw ? JSON.parse(authDataRaw) : null;
  const deviceHeaders = await getDeviceHeaders().catch(
    () => ({}) as Record<string, string>,
  );

  const headers = {
    ...deviceHeaders,
    ...((options.headers || {}) as Record<string, string>),
  };
  if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (auth?.token) {
    headers["Authorization"] = `Bearer ${auth.token}`;
  }
  options.headers = headers;

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || 15000;
  let didTimeout = false;
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  let res: Response;
  try {
    res = await fetch(fullUrl, {
      ...options,
      signal: options.signal || controller.signal,
    });
    networkManager.setOnline(true);
  } catch (netError: any) {
    clearTimeout(timeoutId);
    if (netError.name === "AbortError" && !didTimeout) {
      // Caller intentionally cancelled/aborted request (e.g., React Query unmount or focus change)
      throw netError;
    }
    networkManager.setOnline(false);
    if (didTimeout || netError.name === "AbortError") {
      console.warn(`Request to ${fullUrl} timed out after ${timeoutMs}ms`);
      throw new Error(
        "Request timed out. Please check network connection and try again.",
      );
    }
    console.warn(
      `[Network Warning] Could not reach backend server at ${fullUrl}:`,
      netError?.message || netError,
    );
    throw new Error(
      "Unable to connect to Haajari server. Please check internet connection.",
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401 && !options._retry) {
    if (auth?.token && auth?.refreshToken) {
      if (isRefreshing) {
        console.log("Queueing request during token refresh:", fullUrl);
        return new Promise<Response>((resolve, reject) => {
          subscribeTokenRefresh((newToken) => {
            const updatedHeaders = (options.headers || {}) as Record<
              string,
              string
            >;
            updatedHeaders["Authorization"] = `Bearer ${newToken}`;
            options.headers = updatedHeaders;
            options._retry = true;
            fetch(fullUrl, options).then(resolve).catch(reject);
          });
        });
      }

      isRefreshing = true;
      console.log("Token expired (401), attempting to refresh token...");

      try {
        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: auth.refreshToken }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const updatedAuth = {
            ...auth,
            token: refreshData.token,
            refreshToken: refreshData.refreshToken,
          };
          await AsyncStorage.setItem("@haajari/auth", JSON.stringify(updatedAuth));
          isRefreshing = false;

          onRefreshed(refreshData.token);

          headers["Authorization"] = `Bearer ${refreshData.token}`;
          options.headers = headers;
          options._retry = true;
          return fetch(fullUrl, options);
        } else if (
          refreshRes.status === 401 ||
          refreshRes.status === 403 ||
          refreshRes.status === 400
        ) {
          console.warn(
            "Refresh token rejected by server: status",
            refreshRes.status,
          );
          isRefreshing = false;
          onRefreshed("");
          await AsyncStorage.removeItem("@haajari/auth");
          DeviceEventEmitter.emit("unauthorized");
        } else {
          console.warn(
            "Temporary server error during token refresh: status",
            refreshRes.status,
          );
          isRefreshing = false;
          onRefreshed(auth.token);
        }
      } catch (err) {
        console.warn(
          "Network error during token refresh, keeping credentials:",
          err,
        );
        isRefreshing = false;
        onRefreshed(auth.token);
      }
    }
  }

  return res;
}
