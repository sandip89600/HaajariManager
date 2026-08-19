/**
 * RAG Structured Logger
 * Logs RAG pipeline activity, intent, execution metrics, and latency safely.
 */

export interface RAGLogPayload {
  userId?: string;
  tenantId?: string;
  intent?: string;
  toolsUsed?: string[];
  retrievalDurationMs?: number;
  aiDurationMs?: number;
  totalDurationMs?: number;
  success: boolean;
  errorCategory?: string;
}

export class RAGLogger {
  public static log(payload: RAGLogPayload): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type: "SMART_RAG_EXECUTION",
      userId: payload.userId || "anonymous",
      tenantId: payload.tenantId || "unknown",
      intent: payload.intent || "unspecified",
      toolsUsed: payload.toolsUsed || [],
      retrievalMs: payload.retrievalDurationMs || 0,
      aiMs: payload.aiDurationMs || 0,
      totalMs: payload.totalDurationMs || 0,
      success: payload.success,
      ...(payload.errorCategory ? { errorCategory: payload.errorCategory } : {}),
    };

    if (process.env.NODE_ENV !== "production") {
      console.log(`[RAG Logger] ${logEntry.intent} | Success: ${logEntry.success} | Duration: ${logEntry.totalMs}ms`);
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  public static logError(userId: string | undefined, tenantId: string | undefined, error: any): void {
    console.error(`[RAG Error] User: ${userId || "unknown"} | Tenant: ${tenantId || "unknown"} | Error:`, error?.message || error);
  }
}
