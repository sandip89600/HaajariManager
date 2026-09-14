import { useState, useEffect } from "react";
import { DeviceEventEmitter } from "react-native";
import { networkManager } from "@/utils/networkManager";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(networkManager.isOnline());

  useEffect(() => {
    const netSub = DeviceEventEmitter.addListener(
      "network:statusChanged",
      (event: { isOnline: boolean }) => {
        setIsOnline(event.isOnline);
      },
    );

    return () => {
      netSub.remove();
    };
  }, []);

  const checkConnectivity = () => {
    return networkManager.checkConnectivity();
  };

  return {
    isOnline,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    showSyncedBanner: false,
    triggerSync: checkConnectivity,
    checkConnectivity,
  };
}
