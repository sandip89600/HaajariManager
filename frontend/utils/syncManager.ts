import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import { API_URL, authenticatedFetch, storage } from "./storage";
import { uploadImageToServer } from "./upload";

export interface SyncQueueItem {
  id: string;
  type:
    | "RECORD_ATTENDANCE"
    | "DELETE_ATTENDANCE"
    | "CREATE_WORKER"
    | "UPDATE_WORKER"
    | "DELETE_WORKER"
    | "CREATE_PAYMENT"
    | "DELETE_PAYMENT"
    | "CREATE_SITE"
    | "UPDATE_SITE"
    | "CREATE_SITE_UPDATE";
  payload: any;
  createdAt: number;
  retryCount: number;
  status: "pending" | "syncing" | "failed";
  lastError?: string;
}

const SYNC_QUEUE_KEY = "@haajari/sync_queue";
let isProcessing = false;
let lastSyncedTime: number | null = null;

export const syncManager = {
  async getQueue(): Promise<SyncQueueItem[]> {
    try {
      const data = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async saveQueue(queue: SyncQueueItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
      DeviceEventEmitter.emit("sync:statusChanged", {
        isSyncing: isProcessing,
        pendingCount: queue.filter((q) => q.status === "pending" || q.status === "syncing").length,
        lastSyncTime: lastSyncedTime,
      });
    } catch (e) {
      console.warn("Failed to save sync queue:", e);
    }
  },

  async addToQueue(
    item: Omit<SyncQueueItem, "id" | "createdAt" | "retryCount" | "status">
  ): Promise<SyncQueueItem> {
    const queue = await this.getQueue();
    const id = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Deduplicate / coalesce attendance records for the same worker on the same date
    let updatedQueue = [...queue];
    if (item.type === "RECORD_ATTENDANCE" && item.payload) {
      const { workerId, year, month, day } = item.payload;
      updatedQueue = updatedQueue.filter((q) => {
        if (q.type === "RECORD_ATTENDANCE" && q.payload) {
          return !(
            q.payload.workerId === workerId &&
            q.payload.year === year &&
            q.payload.month === month &&
            q.payload.day === day
          );
        }
        return true;
      });
    }

    const newItem: SyncQueueItem = {
      id,
      type: item.type,
      payload: item.payload,
      createdAt: Date.now(),
      retryCount: 0,
      status: "pending",
    };

    updatedQueue.push(newItem);
    await this.saveQueue(updatedQueue);

    // Trigger processing in the background
    this.processSyncQueue().catch((err) => {
      console.log("Background sync trigger skipped or offline:", err?.message || err);
    });

    return newItem;
  },

  async removeFromQueue(id: string): Promise<void> {
    const queue = await this.getQueue();
    const filtered = queue.filter((q) => q.id !== id);
    await this.saveQueue(filtered);
  },

  async getPendingCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.filter((q) => q.status === "pending" || q.status === "syncing").length;
  },

  async processSyncQueue(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    if (isProcessing) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    const auth = await storage.getAuth();
    if (!auth?.token) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    const queue = await this.getQueue();
    const pendingItems = queue.filter((q) => q.status !== "failed" || q.retryCount < 5);
    if (pendingItems.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    isProcessing = true;
    DeviceEventEmitter.emit("sync:statusChanged", {
      isSyncing: true,
      pendingCount: pendingItems.length,
      lastSyncTime: lastSyncedTime,
    });

    let succeeded = 0;
    let failed = 0;
    let stopDueToNetwork = false;

    const remainingQueue: SyncQueueItem[] = [];

    for (const item of queue) {
      if (stopDueToNetwork) {
        remainingQueue.push(item);
        continue;
      }

      if (item.status === "failed" && item.retryCount >= 5) {
        remainingQueue.push(item);
        continue;
      }

      item.status = "syncing";
      try {
        await this.executeSyncItem(item);
        succeeded++;
      } catch (err: any) {
        console.warn(`Sync item ${item.type} (${item.id}) failed:`, err?.message || err);
        const isNetworkError =
          err?.message?.includes("Unable to connect") ||
          err?.message?.includes("Network request failed") ||
          err?.message?.includes("Request timed out") ||
          err?.name === "AbortError";

        if (isNetworkError) {
          stopDueToNetwork = true;
          item.status = "pending";
          remainingQueue.push(item);
        } else {
          item.retryCount = (item.retryCount || 0) + 1;
          item.status = item.retryCount >= 5 ? "failed" : "pending";
          item.lastError = err?.message || "Unknown sync error";
          failed++;
          remainingQueue.push(item);
        }
      }
    }

    isProcessing = false;
    if (succeeded > 0) {
      lastSyncedTime = Date.now();
      DeviceEventEmitter.emit("refreshData");
      DeviceEventEmitter.emit("attendanceUpdated");
    }

    await this.saveQueue(remainingQueue);

    DeviceEventEmitter.emit("sync:statusChanged", {
      isSyncing: false,
      pendingCount: remainingQueue.filter((q) => q.status === "pending" || q.status === "syncing").length,
      lastSyncTime: lastSyncedTime,
      justFinished: succeeded > 0 && remainingQueue.length === 0,
    });

    return {
      processed: succeeded + failed,
      succeeded,
      failed,
    };
  },

  async executeSyncItem(item: SyncQueueItem): Promise<void> {
    const { type, payload } = item;

    switch (type) {
      case "RECORD_ATTENDANCE": {
        if (!payload || !payload.workerId || payload.workerId.length < 24) {
          throw new Error("Worker ID is not ready for attendance sync");
        }
        const res = await authenticatedFetch(`${API_URL}/attendance/record`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Attendance record sync failed (${res.status})`);
        }
        break;
      }

      case "CREATE_WORKER": {
        let photoUri = payload.photoUri;
        if (photoUri && !photoUri.startsWith("http://") && !photoUri.startsWith("https://")) {
          try {
            photoUri = await uploadImageToServer(photoUri);
          } catch {
            // Keep local URI
          }
        }

        const res = await authenticatedFetch(`${API_URL}/workers`, {
          method: "POST",
          body: JSON.stringify({ ...payload, photoUri }),
        });

        if (res.ok) {
          const saved = await res.json();
          const serverId = saved._id || saved.id;
          if (payload.id && serverId && payload.id !== serverId) {
            await storage.updateWorkerIdReferences(payload.id, serverId);
            const workers = await storage.getWorkers();
            const wIdx = workers.findIndex((w) => w.id === payload.id);
            if (wIdx !== -1) {
              workers[wIdx].id = serverId;
              if (photoUri) workers[wIdx].photoUri = photoUri;
              await storage.setWorkers(workers);
            }
          }
        } else if (res.status === 403) {
          throw new Error("LIMIT_EXCEEDED_WORKERS");
        } else {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Worker create sync failed (${res.status})`);
        }
        break;
      }

      case "UPDATE_WORKER": {
        if (!payload.id || payload.id.length < 24) {
          return;
        }

        let photoUri = payload.photoUri;
        if (photoUri && !photoUri.startsWith("http://") && !photoUri.startsWith("https://")) {
          try {
            photoUri = await uploadImageToServer(photoUri);
          } catch {
            // Keep local URI
          }
        }

        const res = await authenticatedFetch(`${API_URL}/workers/${payload.id}`, {
          method: "PUT",
          body: JSON.stringify({ ...payload, photoUri }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Worker update sync failed (${res.status})`);
        }
        break;
      }

      case "DELETE_WORKER": {
        if (!payload.workerId || payload.workerId.length < 24) {
          return;
        }
        const res = await authenticatedFetch(`${API_URL}/workers/${payload.workerId}`, {
          method: "DELETE",
        });
        if (!res.ok && res.status !== 404) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Worker delete sync failed (${res.status})`);
        }
        break;
      }

      case "CREATE_PAYMENT": {
        if (!payload.workerId || payload.workerId.length < 24) {
          throw new Error("Worker ID not ready for payment sync");
        }
        const res = await authenticatedFetch(`${API_URL}/payments`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const saved = await res.json();
          if (payload.id && (saved._id || saved.id)) {
            const serverId = saved._id || saved.id;
            const payments = await storage.getPayments();
            const pIdx = payments.findIndex((p) => p.id === payload.id);
            if (pIdx !== -1) {
              payments[pIdx].id = serverId;
              await AsyncStorage.setItem("@haajari/payments", JSON.stringify(payments));
            }
          }
        } else {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Payment create sync failed (${res.status})`);
        }
        break;
      }

      case "DELETE_PAYMENT": {
        if (!payload.paymentId || payload.paymentId.length < 24) {
          return;
        }
        const res = await authenticatedFetch(`${API_URL}/payments/${payload.paymentId}`, {
          method: "DELETE",
        });
        if (!res.ok && res.status !== 404) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Payment delete sync failed (${res.status})`);
        }
        break;
      }

      case "CREATE_SITE": {
        const res = await authenticatedFetch(`${API_URL}/sites`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const saved = await res.json();
          const serverId = saved._id || saved.id;
          if (payload.id && serverId && payload.id !== serverId) {
            const { sites } = await storage.getSites();
            const sIdx = sites.findIndex((s) => s.id === payload.id);
            if (sIdx !== -1) {
              sites[sIdx].id = serverId;
              await AsyncStorage.setItem("@haajari/sites", JSON.stringify(sites));
            }
          }
        } else {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Site create sync failed (${res.status})`);
        }
        break;
      }

      case "UPDATE_SITE": {
        if (!payload.siteId || payload.siteId.length < 24) {
          return;
        }
        const res = await authenticatedFetch(`${API_URL}/sites/${payload.siteId}`, {
          method: "PUT",
          body: JSON.stringify(payload.data),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Site update sync failed (${res.status})`);
        }
        break;
      }

      case "CREATE_SITE_UPDATE": {
        if (!payload.siteId || payload.siteId.length < 24) {
          return;
        }
        const res = await authenticatedFetch(`${API_URL}/sites/${payload.siteId}/updates`, {
          method: "POST",
          body: JSON.stringify(payload.data),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Site update logging sync failed (${res.status})`);
        }
        break;
      }

      default:
        console.warn(`Unknown sync item type: ${type}`);
    }
  },
};
