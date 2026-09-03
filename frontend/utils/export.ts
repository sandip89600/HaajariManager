import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { Platform, Alert } from "react-native";
import {
  Worker,
  AttendanceRecord,
  AttendanceValue,
  calculateWorkerSummary,
  getDaysInMonth,
  API_URL,
  storage,
  authenticatedFetch,
} from "./storage";

interface ExportData {
  workers: Worker[];
  attendance: AttendanceRecord[];
  year: number;
  month: number;
  monthName: string;
  currency: string;
  translations: any;
}

function getAttendanceDisplayValue(
  record: AttendanceRecord | null,
  t: any,
): string {
  if (!record) return "-";
  const value = record.value;
  if (value === "P") return t.attendance.present || "P";
  if (value === "A") return t.attendance.absent || "A";
  if (value === "H") return t.attendance.halfDay || "½";
  if (value === "OT") return t.attendance.overtime || "OT";
  if (record.customWage !== undefined && record.customWage !== null) {
    return `₹${record.customWage}`;
  }
  if (typeof value === "number") return `₹${value}`;
  return "-";
}

function getAttendanceCellColor(record: AttendanceRecord | null): string {
  if (!record) return "#FFFFFF";
  const value = record.value;
  if (value === "P") return "#4CAF50"; // Green
  if (value === "A") return "#F44336"; // Red
  if (value === "H") return "#FFC107"; // Yellow
  if (value === "OT") return "#3B82F6"; // Blue
  if (record.customWage !== undefined && record.customWage !== null) {
    return "#FF6B35"; // Orange for custom wage/advance fallback
  }
  if (typeof value === "number") return "#FF6B35"; // Old custom wage - Orange
  return "#FFFFFF";
}

function getAttendanceTextColor(record: AttendanceRecord | null): string {
  if (!record) return "#757575";
  return "#FFFFFF";
}

export function generateAttendanceHTML(data: ExportData): string {
  const {
    workers,
    attendance,
    year,
    month,
    monthName,
    currency,
    translations: t,
  } = data;
  const daysInMonth = getDaysInMonth(year, month);

  const headerCells = Array.from(
    { length: daysInMonth },
    (_, i) =>
      `<th style="background:#1E3A5F;color:white;padding:8px 4px;min-width:35px;font-size:12px;">${i + 1}</th>`,
  ).join("");

  const workerRows = workers
    .map((worker) => {
      const summary = calculateWorkerSummary(
        worker.id,
        attendance,
        worker.dailyRate,
      );

      const dayCells = Array.from({ length: daysInMonth }, (_, i) => {
        const record =
          attendance.find(
            (a) =>
              a.workerId === worker.id &&
              a.year === year &&
              a.month === month &&
              a.day === i + 1,
          ) || null;
        const bgColor = getAttendanceCellColor(record);
        const textColor = getAttendanceTextColor(record);
        const displayValue = getAttendanceDisplayValue(record, t);

        return `<td style="background:${bgColor};color:${textColor};text-align:center;padding:6px 4px;font-size:11px;font-weight:600;">${displayValue}</td>`;
      }).join("");

      return `
      <tr>
        <td style="background:#E6E6E6;padding:8px;font-weight:600;white-space:nowrap;">${worker.name}</td>
        ${dayCells}
        <td style="background:#E8F5E9;text-align:center;font-weight:600;">${summary.presentDays}</td>
        <td style="background:#FFF8E1;text-align:center;font-weight:600;">${summary.halfDays}</td>
        <td style="background:#FFEBEE;text-align:center;font-weight:600;">${summary.absentDays}</td>
        <td style="background:#E3F2FD;text-align:right;padding-right:8px;font-weight:700;">${currency} ${summary.totalAmount.toFixed(0)}</td>
      </tr>
    `;
    })
    .join("");

  const grandTotal = workers.reduce((sum, worker) => {
    const summary = calculateWorkerSummary(
      worker.id,
      attendance,
      worker.dailyRate,
    );
    return sum + summary.totalAmount;
  }, 0);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${t.app.name} - ${t.export.attendanceReport}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { color: #1E3A5F; font-size: 24px; margin-bottom: 4px; }
        .header h2 { color: #FF6B35; font-size: 18px; font-weight: normal; }
        .legend { display: flex; justify-content: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; }
        .legend-color { width: 16px; height: 16px; border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #E0E0E0; }
        th { background: #1E3A5F; color: white; padding: 10px 8px; }
        .footer { margin-top: 20px; text-align: right; }
        .footer .total { font-size: 20px; font-weight: 700; color: #FF6B35; }
        @media print { body { padding: 10px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${t.app.name}</h1>
        <h2>${t.export.attendanceReport} - ${monthName} ${year}</h2>
      </div>
      
      <div class="legend">
        <div class="legend-item"><div class="legend-color" style="background:#4CAF50;"></div> ${t.summary.totalPresent}</div>
        <div class="legend-item"><div class="legend-color" style="background:#F44336;"></div> ${t.summary.totalAbsent}</div>
        <div class="legend-item"><div class="legend-color" style="background:#FFC107;"></div> ${t.summary.totalHalfDays}</div>
        <div class="legend-item"><div class="legend-color" style="background:#2196F3;"></div> ${t.common.currency}</div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th style="min-width:120px;">${t.workers.name}</th>
            ${headerCells}
            <th style="background:#4CAF50;">${t.attendance.present}</th>
            <th style="background:#FFC107;color:#333;">${t.attendance.halfDay}</th>
            <th style="background:#F44336;">${t.attendance.absent}</th>
            <th style="background:#2196F3;min-width:80px;">${t.summary.totalAmount}</th>
          </tr>
        </thead>
        <tbody>
          ${workerRows}
        </tbody>
      </table>
      
      <div class="footer">
        <p>${t.summary.totalAmount}: <span class="total">${currency} ${grandTotal.toFixed(0)}</span></p>
      </div>
    </body>
    </html>
  `;
}

export function generateSummaryHTML(data: ExportData): string {
  const {
    workers,
    attendance,
    year,
    month,
    monthName,
    currency,
    translations: t,
  } = data;

  const workerRows = workers
    .map((worker, index) => {
      const summary = calculateWorkerSummary(
        worker.id,
        attendance,
        worker.dailyRate,
      );

      return `
      <tr style="background:${index % 2 === 0 ? "#FFFFFF" : "#F5F5F5"};">
        <td style="padding:12px;">${worker.name}</td>
        <td style="padding:12px;text-align:center;">${t.categories[worker.category]}</td>
        <td style="padding:12px;text-align:center;">${currency} ${worker.dailyRate}</td>
        <td style="padding:12px;text-align:center;color:#4CAF50;font-weight:600;">${summary.presentDays}</td>
        <td style="padding:12px;text-align:center;color:#FFC107;font-weight:600;">${summary.halfDays}</td>
        <td style="padding:12px;text-align:center;color:#F44336;font-weight:600;">${summary.absentDays}</td>
        <td style="padding:12px;text-align:right;font-weight:700;color:#1E3A5F;">${currency} ${summary.totalAmount.toFixed(0)}</td>
      </tr>
    `;
    })
    .join("");

  const grandTotal = workers.reduce((sum, worker) => {
    const summary = calculateWorkerSummary(
      worker.id,
      attendance,
      worker.dailyRate,
    );
    return sum + summary.totalAmount;
  }, 0);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${t.app.name} - ${t.export.summaryReport}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
        .header { text-align: center; margin-bottom: 24px; }
        .header h1 { color: #1E3A5F; font-size: 28px; margin-bottom: 4px; }
        .header h2 { color: #FF6B35; font-size: 20px; font-weight: normal; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #1E3A5F; color: white; padding: 12px; text-align: left; }
        td { border-bottom: 1px solid #E0E0E0; }
        .total-row { background: #FF6B35 !important; }
        .total-row td { color: white; font-weight: 700; font-size: 16px; padding: 16px 12px; }
        @media print { body { padding: 10px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${t.app.name}</h1>
        <h2>${t.export.summaryReport} - ${monthName} ${year}</h2>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>${t.workers.name}</th>
            <th style="text-align:center;">${t.workers.category}</th>
            <th style="text-align:center;">${t.workers.dailyRate}</th>
            <th style="text-align:center;">${t.summary.totalPresent}</th>
            <th style="text-align:center;">${t.summary.totalHalfDays}</th>
            <th style="text-align:center;">${t.summary.totalAbsent}</th>
            <th style="text-align:right;">${t.summary.totalAmount}</th>
          </tr>
        </thead>
        <tbody>
          ${workerRows}
          <tr class="total-row">
            <td colspan="6">${t.summary.totalAmount}</td>
            <td style="text-align:right;">${currency} ${grandTotal.toFixed(0)}</td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;
}

export function generateCSV(data: ExportData): string {
  const { workers, attendance, year, month, currency, translations: t } = data;
  const daysInMonth = getDaysInMonth(year, month);

  const headers = [
    t.workers.name,
    t.workers.category,
    t.workers.dailyRate,
    ...Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`),
    t.summary.totalPresent,
    t.summary.totalHalfDays,
    t.summary.totalAbsent,
    t.summary.totalAmount,
  ];

  const rows = workers.map((worker) => {
    const summary = calculateWorkerSummary(
      worker.id,
      attendance,
      worker.dailyRate,
    );

    const dayValues = Array.from({ length: daysInMonth }, (_, i) => {
      const record =
        attendance.find(
          (a) =>
            a.workerId === worker.id &&
            a.year === year &&
            a.month === month &&
            a.day === i + 1,
        ) || null;
      return getAttendanceDisplayValue(record, t);
    });

    return [
      `"${worker.name}"`,
      t.categories[worker.category],
      worker.dailyRate.toString(),
      ...dayValues,
      summary.presentDays.toString(),
      summary.halfDays.toString(),
      summary.absentDays.toString(),
      summary.totalAmount.toFixed(0),
    ];
  });

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

export async function exportToPDF(
  html: string,
  filename: string,
): Promise<boolean> {
  try {
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    if (Platform.OS === "web") {
      await Print.printAsync({ html });
      return true;
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: filename,
        UTI: "com.adobe.pdf",
      });
      return true;
    } else {
      Alert.alert("Sharing not available", "Cannot share on this device");
      return false;
    }
  } catch (error) {
    console.error("Export to PDF failed:", error);
    return false;
  }
}

export async function printHTML(html: string): Promise<boolean> {
  try {
    await Print.printAsync({ html });
    return true;
  } catch (error) {
    console.error("Print failed:", error);
    return false;
  }
}

export async function shareCSV(
  csvContent: string,
  filename: string,
): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      return true;
    }

    const htmlWrapper = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body>
        <h2>CSV Export</h2>
        <p>CSV export is best viewed by downloading. Use PDF export for better mobile viewing.</p>
        <pre style="white-space:pre-wrap;font-size:10px;">${csvContent}</pre>
      </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html: htmlWrapper });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        mimeType: "text/csv",
        dialogTitle: filename,
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error("Share CSV failed:", error);
    return false;
  }
}

// Helper for 15-second request timeout guard
const WITH_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, timeoutMs = WITH_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Report generation timed out. Please try again.")), timeoutMs)
    ),
  ]);
}

export async function downloadAndSharePDF(
  url: string,
  filename: string,
): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      const response = await withTimeout(authenticatedFetch(url));
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        let errorMessage = `PDF API failed (HTTP ${response.status})`;
        try {
          const parsed = JSON.parse(errorText);
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {
          if (errorText) errorMessage += `: ${errorText.substring(0, 100)}`;
        }
        throw new Error(errorMessage);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(blobUrl);
      return true;
    }

    const auth = await storage.getAuth();
    const token = auth?.token;
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const safeFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
    const fileUri = `${FileSystem.documentDirectory}${safeFilename}`;

    const result = await withTimeout(FileSystem.downloadAsync(url, fileUri, { headers }));

    if (result.status >= 400) {
      let errorMessage = `PDF API failed (HTTP ${result.status})`;
      try {
        const errorContent = await FileSystem.readAsStringAsync(result.uri);
        const parsed = JSON.parse(errorContent);
        errorMessage = parsed.error || parsed.message || errorMessage;
      } catch {
        // Not JSON
      }
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
      throw new Error(errorMessage);
    }

    // Verify downloaded file is not empty
    const fileInfo = await FileSystem.getInfoAsync(result.uri);
    if (!fileInfo.exists || (fileInfo as any).size === 0) {
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
      throw new Error("Downloaded PDF file is empty or invalid.");
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(result.uri, {
        mimeType: "application/pdf",
        dialogTitle: safeFilename,
        UTI: "com.adobe.pdf",
      });
      return true;
    } else {
      Alert.alert("Sharing not available", "Cannot share files on this device.");
      return false;
    }
  } catch (error: any) {
    console.error("[ExportUtil] downloadAndSharePDF failed:", error);
    Alert.alert(
      "Export Error",
      error.message || "Failed to download and share PDF report.",
    );
    throw error;
  }
}

export async function downloadAndShareCSV(
  url: string,
  filename: string,
): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      const response = await withTimeout(authenticatedFetch(url));
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        let errorMessage = `CSV API failed (HTTP ${response.status})`;
        try {
          const parsed = JSON.parse(errorText);
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {
          if (errorText) errorMessage += `: ${errorText.substring(0, 100)}`;
        }
        throw new Error(errorMessage);
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(blobUrl);
      return true;
    }

    const auth = await storage.getAuth();
    const token = auth?.token;
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const safeFilename = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    const fileUri = `${FileSystem.documentDirectory}${safeFilename}`;

    const result = await withTimeout(FileSystem.downloadAsync(url, fileUri, { headers }));

    if (result.status >= 400) {
      let errorMessage = `CSV API failed (HTTP ${result.status})`;
      try {
        const errorContent = await FileSystem.readAsStringAsync(result.uri);
        const parsed = JSON.parse(errorContent);
        errorMessage = parsed.error || parsed.message || errorMessage;
      } catch {
        // Not JSON
      }
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
      throw new Error(errorMessage);
    }

    // Verify downloaded file is not empty
    const fileInfo = await FileSystem.getInfoAsync(result.uri);
    if (!fileInfo.exists || (fileInfo as any).size === 0) {
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
      throw new Error("Downloaded CSV file is empty or invalid.");
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(result.uri, {
        mimeType: "text/csv",
        dialogTitle: safeFilename,
      });
      return true;
    } else {
      Alert.alert("Sharing not available", "Cannot share files on this device.");
      return false;
    }
  } catch (error: any) {
    console.error("[ExportUtil] downloadAndShareCSV failed:", error);
    Alert.alert(
      "Export Error",
      error.message || "Failed to download and share CSV report.",
    );
    throw error;
  }
}

export async function fetchAndPrintHTML(url: string): Promise<boolean> {
  try {
    const response = await withTimeout(authenticatedFetch(url));
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let errorMessage = `Print API failed (HTTP ${response.status})`;
      try {
        const parsed = JSON.parse(errorText);
        errorMessage = parsed.error || parsed.message || errorMessage;
      } catch {
        if (errorText) errorMessage += `: ${errorText.substring(0, 100)}`;
      }
      throw new Error(errorMessage);
    }

    const html = await response.text();
    if (!html || !html.trim()) {
      throw new Error("Print layout payload is empty.");
    }

    await Print.printAsync({ html });
    return true;
  } catch (error: any) {
    const errMessage = error?.message || "";
    const isUserCanceled =
      errMessage.toLowerCase().includes("cancel") ||
      errMessage.toLowerCase().includes("dismiss");

    if (isUserCanceled) {
      console.log("[ExportUtil] Print dialog canceled by user.");
      return false;
    }

    console.error("[ExportUtil] fetchAndPrintHTML failed:", error);
    Alert.alert(
      "Print Error",
      errMessage || "Failed to load and print HTML layout.",
    );
    throw error;
  }
}

export async function generateAndSharePaymentReceipt(
  payment: any,
  workerName: string,
  companyName: string,
  t: any,
): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Receipt</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 30px; color: #1E293B; background: #F8FAFC; }
        .receipt-box { border: 1px solid #E2E8F0; padding: 30px; border-radius: 16px; max-width: 500px; margin: auto; background: #FFFFFF; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); }
        .header { text-align: center; border-bottom: 2px solid #F1F5F9; padding-bottom: 20px; margin-bottom: 20px; }
        .header h1 { font-size: 22px; color: #0F172A; margin: 0; font-weight: 800; }
        .header p { font-size: 13px; color: #64748B; margin: 6px 0 0 0; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
        .row { display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 14px; line-height: 20px; }
        .row .label { color: #64748B; font-weight: 500; }
        .row .value { color: #0F172A; font-weight: 700; }
        .amount-box { background: #FFF7ED; border: 1px solid #FFEDD5; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
        .amount-title { font-size: 11px; color: #EA580C; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
        .amount-val { font-size: 32px; color: #EA580C; font-weight: 900; }
        .footer { text-align: center; font-size: 11px; color: #94A3B8; margin-top: 30px; border-top: 1px solid #F1F5F9; padding-top: 16px; font-weight: 500; }
      </style>
    </head>
    <body>
      <div class="receipt-box">
        <div class="header">
          <h1>${companyName || "Haajari Manager"}</h1>
          <p>Payment Receipt / भुगतान रसीद</p>
        </div>
        
        <div class="row">
          <span class="label">Worker Name:</span>
          <span class="value">${workerName}</span>
        </div>
        <div class="row">
          <span class="label">Date:</span>
          <span class="value">${new Date(payment.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
        <div class="row">
          <span class="label">Payment Method:</span>
          <span class="value">${payment.method || "Cash"}</span>
        </div>
        ${payment.transactionId ? `
        <div class="row">
          <span class="label">Transaction ID:</span>
          <span class="value">${payment.transactionId}</span>
        </div>
        ` : ""}
        ${payment.referenceNumber ? `
        <div class="row">
          <span class="label">Ref Number:</span>
          <span class="value">${payment.referenceNumber}</span>
        </div>
        ` : ""}
        ${payment.paidByName ? `
        <div class="row">
          <span class="label">Paid By:</span>
          <span class="value">${payment.paidByName}</span>
        </div>
        ` : ""}
        ${payment.receivedByName ? `
        <div class="row">
          <span class="label">Received By:</span>
          <span class="value">${payment.receivedByName}</span>
        </div>
        ` : ""}
        <div class="row">
          <span class="label">Status:</span>
          <span class="value" style="color: ${payment.status === "Failed" ? "#EF4444" : payment.status === "Pending" ? "#F59E0B" : "#10B981"}">${payment.status || "Completed"}</span>
        </div>

        <div class="amount-box">
          <div class="amount-title">Amount Paid</div>
          <div class="amount-val">₹ ${payment.amount}</div>
        </div>

        ${payment.note ? `
        <div style="font-size: 13px; color: #475569; background: #F8FAFC; padding: 12px; border-radius: 8px; margin-top: 16px; border: 1px solid #E2E8F0; line-height: 18px;">
          <strong>Notes:</strong> ${payment.note}
        </div>
        ` : ""}

        <div class="footer">
          Generated via Haajari Manager — AI-Powered Construction Site Assistant.
        </div>
      </div>
    </body>
    </html>
  `;
  return exportToPDF(html, `receipt_${payment.id || Date.now()}.pdf`);
}
