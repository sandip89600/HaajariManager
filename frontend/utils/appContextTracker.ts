import { DeviceEventEmitter } from "react-native";

class AppContextTracker {
  private currentScreen: string = "Unknown";
  private selectedWorkerId: string | null = null;
  private selectedWorkerName: string | null = null;
  private selectedMonth: number | null = null;
  private selectedYear: number | null = null;
  private selectedPaymentId: string | null = null;
  private selectedReportType: string | null = null;
  private activeDialog: string | null = null;
  private activeBottomSheet: string | null = null;
  private callbacks: Record<string, Function> = {};

  setContext(data: Partial<Omit<AppContextTracker, "callbacks" | "registerCallback" | "unregisterCallback" | "triggerCallback" | "getContext" | "setContext">>) {
    Object.assign(this, data);
    DeviceEventEmitter.emit("appContextChanged", this.getContext());
  }

  getContext() {
    return {
      currentScreen: this.currentScreen,
      selectedWorkerId: this.selectedWorkerId,
      selectedWorkerName: this.selectedWorkerName,
      selectedMonth: this.selectedMonth,
      selectedYear: this.selectedYear,
      selectedPaymentId: this.selectedPaymentId,
      selectedReportType: this.selectedReportType,
      activeDialog: this.activeDialog,
      activeBottomSheet: this.activeBottomSheet,
    };
  }

  registerCallback(name: string, cb: Function) {
    this.callbacks[name] = cb;
  }

  unregisterCallback(name: string) {
    delete this.callbacks[name];
  }

  triggerCallback(name: string, ...args: any[]) {
    if (this.callbacks[name]) {
      return this.callbacks[name](...args);
    }
    return null;
  }
}

export const appContextTracker = new AppContextTracker();
