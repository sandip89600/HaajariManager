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
  if (record.customWage !== undefined && record.customWage !== null) {
    return `₹${record.customWage}`;
  }
  const value = record.value;
  if (value === "P") return t.attendance.present;
  if (value === "A") return t.attendance.absent;
  if (value === "H") return t.attendance.halfDay;
  if (value === "OT") return t.attendance.overtime || "OT";
  if (typeof value === "number") return `₹${value}`;
  return "-";
}

function getAttendanceCellColor(record: AttendanceRecord | null): string {
  if (!record) return "#FFFFFF";
  if (record.customWage !== undefined && record.customWage !== null) {
    return "#FF6B35"; // Orange
  }
  const value = record.value;
  if (value === "P") return "#4CAF50"; // Green
  if (value === "A") return "#F44336"; // Red
  if (value === "H") return "#FFC107"; // Yellow
  if (value === "OT") return "#3B82F6"; // Blue
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

export async function downloadAndSharePDF(
  url: string,
  filename: string,
): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      const response = await authenticatedFetch(url);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to download PDF.");
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

    const fileUri = `${FileSystem.documentDirectory}${filename}`;
    const result = await FileSystem.downloadAsync(url, fileUri, { headers });

    if (result.status >= 400) {
      let errorMessage = "Failed to download PDF.";
      try {
        const errorContent = await FileSystem.readAsStringAsync(result.uri);
        const parsed = JSON.parse(errorContent);
        errorMessage = parsed.error || errorMessage;
      } catch (e) {
        // Not JSON or failed to read
      }
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
      throw new Error(errorMessage);
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(result.uri, {
        mimeType: "application/pdf",
        dialogTitle: filename,
        UTI: "com.adobe.pdf",
      });
      return true;
    } else {
      Alert.alert("Sharing not available", "Cannot share on this device");
      return false;
    }
  } catch (error: any) {
    console.error("downloadAndSharePDF failed:", error);
    Alert.alert(
      "Export Error",
      error.message || "Failed to download and share PDF.",
    );
    return false;
  }
}

export async function downloadAndShareCSV(
  url: string,
  filename: string,
): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      const response = await authenticatedFetch(url);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to download CSV.");
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

    const fileUri = `${FileSystem.documentDirectory}${filename}`;
    const result = await FileSystem.downloadAsync(url, fileUri, { headers });

    if (result.status >= 400) {
      let errorMessage = "Failed to download CSV.";
      try {
        const errorContent = await FileSystem.readAsStringAsync(result.uri);
        const parsed = JSON.parse(errorContent);
        errorMessage = parsed.error || errorMessage;
      } catch (e) {
        // Not JSON or failed to read
      }
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
      throw new Error(errorMessage);
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(result.uri, {
        mimeType: "text/csv",
        dialogTitle: filename,
      });
      return true;
    } else {
      Alert.alert("Sharing not available", "Cannot share on this device");
      return false;
    }
  } catch (error: any) {
    console.error("downloadAndShareCSV failed:", error);
    Alert.alert(
      "Export Error",
      error.message || "Failed to download and share CSV.",
    );
    return false;
  }
}

export async function fetchAndPrintHTML(url: string): Promise<boolean> {
  try {
    const response = await authenticatedFetch(url);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to fetch print layout.");
    }
    const html = await response.text();
    await Print.printAsync({ html });
    return true;
  } catch (error: any) {
    console.error("fetchAndPrintHTML failed:", error);
    Alert.alert(
      "Print Error",
      error.message || "Failed to load and print HTML layout.",
    );
    return false;
  }
}
