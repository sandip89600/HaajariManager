import { useState, useEffect } from "react";
import { DeviceEventEmitter } from "react-native";
import { networkManager } from "@/utils/networkManager";
import { syncManager } from "@/utils/syncManager";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(networkManager.isOnline());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [showSyncedBanner, setShowSyncedBanner] = useState<boolean>(false);

  useEffect(() => {
    // Read initial pending count
    syncManager.getPendingCount().then(setPendingCount).catch(() => {});

    const netSub = DeviceEventEmitter.addListener(
      "network:statusChanged",
      (event: { isOnline: boolean }) => {
        setIsOnline(event.isOnline);
      }
    );

    const syncSub = DeviceEventEmitter.addListener(
      "sync:statusChanged",
      (event: {
        isSyncing: boolean;
        pendingCount: number;
        lastSyncTime?: number | null;
        justFinished?: boolean;
      }) => {
        setIsSyncing(event.isSyncing);
        setPendingCount(event.pendingCount);
        if (event.lastSyncTime) setLastSyncTime(event.lastSyncTime);
        if (event.justFinished) {
          setShowSyncedBanner(true);
          setTimeout(() => {
            setShowSyncedBanner(false);
          }, 3000);
        }
      }
    );

    return () => {
      netSub.remove();
      syncSub.remove();
    };
  }, []);

  const triggerSync = () => {
    return syncManager.processSyncQueue();
  };

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncTime,
    showSyncedBanner,
    triggerSync,
  };
}
