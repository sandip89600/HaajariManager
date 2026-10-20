import { createNavigationContainerRef } from "@react-navigation/native";
import { AppState, AppStateStatus } from "react-native";

export const navigationRef = createNavigationContainerRef<any>();

let lastNavigatedWorkerId: string | null = null;
let lastNavigatedTime = 0;
let pendingWorkerIdForActive: string | null = null;

// Flush pending worker navigation when app becomes active
AppState.addEventListener("change", (state: AppStateStatus) => {
  if (state === "active" && pendingWorkerIdForActive) {
    const workerId = pendingWorkerIdForActive;
    pendingWorkerIdForActive = null;
    setTimeout(() => {
      navigateToUpdateWorker(workerId);
    }, 300);
  }
});

export function navigateToUpdateWorker(workerId: string) {
  if (!workerId) return;

  const now = Date.now();
  // Prevent duplicate rapid navigation within 4 seconds for the same worker ID
  if (lastNavigatedWorkerId === workerId && now - lastNavigatedTime < 4000) {
    return;
  }

  // If app is not currently in foreground, queue for when it returns to active
  if (AppState.currentState && AppState.currentState !== "active") {
    pendingWorkerIdForActive = workerId;
    return;
  }

  if (navigationRef.isReady()) {
    try {
      lastNavigatedWorkerId = workerId;
      lastNavigatedTime = now;
      navigationRef.navigate("AddWorker", { workerId });
    } catch (err) {
      console.warn("Navigation to AddWorker error:", err);
      pendingWorkerIdForActive = workerId;
    }
  } else {
    // Navigation container not yet ready, queue for retry
    pendingWorkerIdForActive = workerId;
    setTimeout(() => {
      if (navigationRef.isReady() && pendingWorkerIdForActive === workerId) {
        pendingWorkerIdForActive = null;
        lastNavigatedWorkerId = workerId;
        lastNavigatedTime = Date.now();
        navigationRef.navigate("AddWorker", { workerId });
      }
    }, 500);
  }
}
