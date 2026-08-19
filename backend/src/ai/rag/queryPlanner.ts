export type IntentType =
  | "WORKER_LOOKUP"
  | "ATTENDANCE_SUMMARY"
  | "PAYMENT_SUMMARY"
  | "SALARY_CALCULATION"
  | "PROJECT_SUMMARY"
  | "COMPANY_MONTHLY_REPORT"
  | "ACTION_REQUEST"
  | "GENERAL_QUERY";

export interface QueryPlan {
  intent: IntentType;
  workerName?: string;
  projectName?: string;
  year: number;
  month: number;
  day?: number;
  dataSources: string[];
  calculations: string[];
  actionDetails?: {
    actionType: "mark_attendance" | "create_payment" | "add_worker" | "add_advance";
    targetWorker?: string;
    amount?: number;
    value?: string;
    requiresConfirmation: boolean;
  };
}

export class QueryPlanner {
  public static plan(userQuery: string, currentYear?: number, currentMonth?: number): QueryPlan {
    const q = userQuery.trim().toLowerCase();
    const now = new Date();
    const year = currentYear || now.getFullYear();
    const month = currentMonth || now.getMonth() + 1;

    // Detect month keywords in query (e.g. August, Aug, 8, etc.)
    const detectedMonth = QueryPlanner.extractMonth(q) || month;
    const detectedYear = QueryPlanner.extractYear(q) || year;

    // Detect worker name candidates (e.g. Ramesh, Suresh, etc.)
    const workerName = QueryPlanner.extractWorkerName(userQuery);

    // 1. ACTION REQUESTS
    if (
      q.includes("payment kar do") ||
      q.includes("pay kar do") ||
      q.includes("advance de do") ||
      q.includes("mark attendance") ||
      q.includes("present lagao") ||
      q.includes("absent lagao")
    ) {
      let actionType: "mark_attendance" | "create_payment" | "add_worker" | "add_advance" = "create_payment";
      if (q.includes("attendance") || q.includes("lagao")) {
        actionType = "mark_attendance";
      } else if (q.includes("advance")) {
        actionType = "add_advance";
      }

      return {
        intent: "ACTION_REQUEST",
        workerName,
        year: detectedYear,
        month: detectedMonth,
        dataSources: ["workers", "attendance", "payments"],
        calculations: ["pendingAmount"],
        actionDetails: {
          actionType,
          targetWorker: workerName,
          requiresConfirmation: true,
        },
      };
    }

    // 2. PAYMENT & SALARY / WAGE QUERIES
    if (
      q.includes("payment") ||
      q.includes("paisa") ||
      q.includes("hisab") ||
      q.includes("pending") ||
      q.includes("salary") ||
      q.includes("wage") ||
      q.includes("kitna banta hai") ||
      q.includes("kitna banta h") ||
      q.includes("due")
    ) {
      return {
        intent: workerName ? "SALARY_CALCULATION" : "PAYMENT_SUMMARY",
        workerName,
        year: detectedYear,
        month: detectedMonth,
        dataSources: ["workers", "attendance", "payments"],
        calculations: ["presentDays", "halfDays", "overtimeDays", "grossSalary", "totalPaid", "pendingAmount"],
      };
    }

    // 3. ATTENDANCE QUERIES
    if (
      q.includes("attendance") ||
      q.includes("haajari") ||
      q.includes("hajiri") ||
      q.includes("kitne din") ||
      q.includes("days") ||
      q.includes("present") ||
      q.includes("absent") ||
      q.includes("half day") ||
      q.includes("overtime")
    ) {
      return {
        intent: "ATTENDANCE_SUMMARY",
        workerName,
        year: detectedYear,
        month: detectedMonth,
        dataSources: ["workers", "attendance"],
        calculations: ["presentDays", "halfDays", "absentDays", "overtimeDays", "totalWorkingDays"],
      };
    }

    // 4. PROJECT QUERIES
    if (q.includes("project") || q.includes("site") || q.includes("location")) {
      return {
        intent: "PROJECT_SUMMARY",
        year: detectedYear,
        month: detectedMonth,
        dataSources: ["projects", "workers"],
        calculations: ["workerCount"],
      };
    }

    // 5. MONTHLY COMPANY REPORT / REPORT QUERIES
    if (q.includes("report") || q.includes("summary") || q.includes("total cost") || q.includes("company")) {
      return {
        intent: "COMPANY_MONTHLY_REPORT",
        year: detectedYear,
        month: detectedMonth,
        dataSources: ["workers", "attendance", "payments"],
        calculations: ["totalGrossSalary", "totalPaid", "totalPending", "totalWorkers"],
      };
    }

    // 6. WORKER LOOKUP
    if (q.includes("worker") || q.includes("kamgar") || q.includes("labour") || workerName) {
      return {
        intent: "WORKER_LOOKUP",
        workerName,
        year: detectedYear,
        month: detectedMonth,
        dataSources: ["workers"],
        calculations: [],
      };
    }

    // DEFAULT
    return {
      intent: "GENERAL_QUERY",
      year: detectedYear,
      month: detectedMonth,
      dataSources: ["workers", "attendance", "payments"],
      calculations: [],
    };
  }

  private static extractMonth(q: string): number | null {
    const monthsMap: { [key: string]: number } = {
      january: 1, jan: 1,
      february: 2, feb: 2,
      march: 3, mar: 3,
      april: 4, apr: 4,
      may: 5,
      june: 6, jun: 6,
      july: 7, jul: 7,
      august: 8, aug: 8,
      september: 9, sep: 9, sept: 9,
      october: 10, oct: 10,
      november: 11, nov: 11,
      december: 12, dec: 12,
    };

    for (const [name, num] of Object.entries(monthsMap)) {
      if (q.includes(name)) return num;
    }
    return null;
  }

  private static extractYear(q: string): number | null {
    const match = q.match(/\b(202[0-9])\b/);
    return match ? parseInt(match[1]) : null;
  }

  private static extractWorkerName(q: string): string | undefined {
    // Basic entity extraction pattern for common names in construction queries
    const stopWords = [
      "how", "many", "days", "did", "work", "this", "month", "last", "what", "is", "the",
      "ka", "ki", "ke", "ne", "ko", "in", "mein", "me", "se", "kitna", "kitne", "din",
      "paisa", "payment", "pending", "banta", "hai", "h", "bhai", "sab", "open", "show",
      "reports", "attendance", "salary", "wage", "haajari", "hajiri", "par", "ko", "par"
    ];

    const words = q.replace(/[^\w\s]/gi, "").split(/\s+/);
    for (const word of words) {
      if (word.length > 2 && !stopWords.includes(word.toLowerCase()) && !/\d/.test(word)) {
        // Capitalize candidate word
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
    }
    return undefined;
  }
}
