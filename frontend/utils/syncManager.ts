/**
 * DEPRECATED: Offline sync queue system has been rolled back to clean online-first architecture.
 * This stub ensures backward compatibility with zero runtime overhead or circular dependencies.
 */

export interface SyncQueueItem {
  id: string;
  type: string;
  payload: any;
  createdAt: number;
  retryCount: number;
  status: "pending" | "syncing" | "failed";
  lastError?: string;
}

export const syncManager = {
  async getQueue(): Promise<SyncQueueItem[]> {
    return [];
  },

  async saveQueue(_queue: SyncQueueItem[]): Promise<void> {},

  async addToQueue(item: any): Promise<any> {
    return { id: "noop", ...item, status: "pending" };
  },

  async removeFromQueue(_id: string): Promise<void> {},

  async getPendingCount(): Promise<number> {
    return 0;
  },

  async processSyncQueue(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    return { processed: 0, succeeded: 0, failed: 0 };
  },
};
