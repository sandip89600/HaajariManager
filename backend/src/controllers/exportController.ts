import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { Worker, Attendance, Payment, Tenant } from "../models";
import PDFDocument from "pdfkit";

// Helper to gather all data for a given tenant, year, and month
const getExportData = async (tenantId: string, year: number, month: number) => {
  const workers = await Worker.find({ tenantId, isArchived: false });
  const workerIds = workers.map(w => w._id);

  const attendance = await Attendance.find({
    tenantId,
    workerId: { $in: workerIds },
    year,
    month
  });

  const payments = await Payment.find({
    tenantId,
    workerId: { $in: workerIds },
    year,
    month
  });

  const tenant = await Tenant.findById(tenantId);

  return { workers, attendance, payments, tenant };
};

// Helper for MERN payroll calculations
const calculateWorkerSummary = (
  workerId: string,
  attendance: any[],
  dailyRate: number,
) => {
  const workerAttendance = attendance.filter((a) => a.workerId.toString() === workerId.toString());

  let presentDays = 0;
  let halfDays = 0;
  let absentDays = 0;
  let overtimeDays = 0;
  let customDays = 0;
  let customAmount = 0;
  let totalAmount = 0;

  workerAttendance.forEach((record) => {
    const rate = record.dailyRate !== undefined && record.dailyRate !== null ? record.dailyRate : dailyRate;
    const extra = (record.customWage !== undefined && record.customWage !== null) ? record.customWage : 0;
    let recordPay = 0;

    if (record.value === "P" || record.value === "OT") {
      recordPay = rate + extra;
    } else if (record.value === "H") {
      recordPay = (rate / 2) + extra;
    } else if (record.value === "A") {
      recordPay = extra;
    } else if (typeof record.value === "number") {
      recordPay = record.value;
    } else {
      recordPay = extra;
    }
    totalAmount += recordPay;

    if (record.value === "P") {
      presentDays++;
    } else if (record.value === "A") {
      absentDays++;
    } else if (record.value === "H") {
      halfDays++;
    } else if (record.value === "OT") {
      overtimeDays++;
    } else if (typeof record.value === "number") {
      customDays++;
      customAmount += record.value;
    }

    if (record.customWage !== undefined && record.customWage !== null) {
      customDays++;
      customAmount += record.customWage;
    }
  });

  return { presentDays, halfDays, absentDays, overtimeDays, customDays, customAmount, totalAmount };
};

// 1. Generate Attendance Report PDF
export const getAttendancePDF = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = parseInt(req.query.year as string);
    const month = parseInt(req.query.month as string);

    if (isNaN(year) || isNaN(month)) {
      return res.status(400).json({ error: "Missing or invalid year or month parameters." });
    }

    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

    const { workers, attendance, payments, tenant } = await getExportData(tenantId.toString(), year, month);

    if (attendance.length === 0) {
      return res.status(400).json({ error: "No attendance data available for export." });
    }

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthName = monthNames[month];
    const filename = `Attendance_Report_${monthName}_${year}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
    doc.pipe(res);

    // Header styling
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#1E3A5F").text(tenant?.name || "Haajari App Report", 30, 30);
    doc.font("Helvetica").fontSize(12).fillColor("#555555").text(`Attendance Report — ${monthName} ${year}`, 30, 52);
    doc.fontSize(9).text(`Generated Date: ${new Date().toLocaleDateString()}`, 30, 68);

    const startX = 30;
    let startY = 90;
    const colWidths = [130, 70, 60, 60, 60, 60, 80, 90, 80, 90];
    const colNames = ["Worker Name", "Daily Rate", "Present", "Half Day", "Absent", "Overtime", "Custom Wage", "Total Salary", "Paid", "Due"];

    const drawHeader = (y: number) => {
      doc.rect(startX, y, 780, 20).fill("#1E3A5F");
      doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9);
      let currentX = startX;
      colNames.forEach((name, i) => {
        const align = i >= 7 ? "right" : i === 0 ? "left" : "center";
        doc.text(name, currentX + (align === "right" ? -5 : align === "left" ? 5 : 0), y + 6, {
          width: colWidths[i],
          align: align
        });
        currentX += colWidths[i];
      });
    };

    drawHeader(startY);
    startY += 20;

    doc.font("Helvetica").fontSize(9).fillColor("#000000");
    workers.forEach((worker, wIndex) => {
      if (startY > 500) {
        doc.addPage({ margin: 30, size: "A4", layout: "landscape" });
        startY = 40;
        drawHeader(startY);
        startY += 20;
        doc.font("Helvetica").fontSize(9).fillColor("#000000");
      }

      const summary = calculateWorkerSummary(worker._id.toString(), attendance, worker.dailyRate);
      const workerPayments = payments.filter(p => p.workerId.toString() === worker._id.toString());
      const totalPaid = workerPayments.reduce((sum, p) => sum + p.amount, 0);
      const balance = Math.max(0, summary.totalAmount - totalPaid);

      if (wIndex % 2 === 1) {
        doc.rect(startX, startY, 780, 20).fill("#F9F9F9");
      }
      doc.fillColor("#000000");
      doc.rect(startX, startY, 780, 20).stroke("#EAEAEA");

      const values = [
        worker.name,
        `Rs. ${worker.dailyRate}`,
        summary.presentDays.toString(),
        summary.halfDays.toString(),
        summary.absentDays.toString(),
        summary.overtimeDays.toString(),
        `Rs. ${summary.customAmount.toFixed(0)}`,
        `Rs. ${summary.totalAmount.toFixed(0)}`,
        `Rs. ${totalPaid.toFixed(0)}`,
        `Rs. ${balance.toFixed(0)}`
      ];

      let currentX = startX;
      values.forEach((val, i) => {
        const align = i >= 7 ? "right" : i === 0 ? "left" : "center";
        doc.text(val, currentX + (align === "right" ? -5 : align === "left" ? 5 : 0), startY + 6, {
          width: colWidths[i],
          align: align
        });
        currentX += colWidths[i];
      });

      startY += 20;
    });

    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fillColor("#777777").fontSize(8);
      doc.text("Generated by Haajari App", 30, 565);
      doc.text(`Page ${i + 1} of ${pages.count}`, 750, 565, { align: "right" });
    }

    doc.end();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Generate Payment Summary PDF
export const getPaymentSummaryPDF = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = parseInt(req.query.year as string);
    const month = parseInt(req.query.month as string);

    if (isNaN(year) || isNaN(month)) {
      return res.status(400).json({ error: "Missing or invalid year or month parameters." });
    }

    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

    const { workers, attendance, payments, tenant } = await getExportData(tenantId.toString(), year, month);

    if (attendance.length === 0) {
      return res.status(400).json({ error: "No attendance data available for export." });
    }

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthName = monthNames[month];
    const filename = `Payment_Summary_${monthName}_${year}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 30, size: "A4", layout: "portrait" });
    doc.pipe(res);

    // Header styling
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#1E3A5F").text(tenant?.name || "Haajari App Report", 30, 30);
    doc.font("Helvetica").fontSize(12).fillColor("#555555").text(`Payment Summary — ${monthName} ${year}`, 30, 52);
    doc.fontSize(9).text(`Generated Date: ${new Date().toLocaleDateString()}`, 30, 68);

    const startX = 30;
    let startY = 90;
    const colWidths = [125, 60, 40, 40, 60, 70, 70, 70];
    const colNames = ["Worker Name", "Rate", "Pres", "Half", "Custom", "Salary", "Paid", "Due"];

    const drawHeader = (y: number) => {
      doc.rect(startX, y, 535, 20).fill("#1E3A5F");
      doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9);
      let currentX = startX;
      colNames.forEach((name, i) => {
        const align = i >= 5 ? "right" : i === 0 ? "left" : "center";
        doc.text(name, currentX + (align === "right" ? -5 : align === "left" ? 5 : 0), y + 6, {
          width: colWidths[i],
          align: align
        });
        currentX += colWidths[i];
      });
    };

    drawHeader(startY);
    startY += 20;

    let grandTotalSalary = 0;
    let grandPaidAmount = 0;
    let grandDueAmount = 0;

    doc.font("Helvetica").fontSize(9).fillColor("#000000");
    workers.forEach((worker, wIndex) => {
      if (startY > 750) {
        doc.addPage({ margin: 30, size: "A4", layout: "portrait" });
        startY = 40;
        drawHeader(startY);
        startY += 20;
        doc.font("Helvetica").fontSize(9).fillColor("#000000");
      }

      const summary = calculateWorkerSummary(worker._id.toString(), attendance, worker.dailyRate);
      const workerPayments = payments.filter(p => p.workerId.toString() === worker._id.toString());
      const totalPaid = workerPayments.reduce((sum, p) => sum + p.amount, 0);
      const balance = Math.max(0, summary.totalAmount - totalPaid);

      grandTotalSalary += summary.totalAmount;
      grandPaidAmount += totalPaid;
      grandDueAmount += balance;

      if (wIndex % 2 === 1) {
        doc.rect(startX, startY, 535, 20).fill("#F9F9F9");
      }
      doc.fillColor("#000000");
      doc.rect(startX, startY, 535, 20).stroke("#EAEAEA");

      const values = [
        worker.name,
        `Rs. ${worker.dailyRate}`,
        summary.presentDays.toString(),
        summary.halfDays.toString(),
        `Rs. ${summary.customAmount.toFixed(0)}`,
        `Rs. ${summary.totalAmount.toFixed(0)}`,
        `Rs. ${totalPaid.toFixed(0)}`,
        `Rs. ${balance.toFixed(0)}`
      ];

      let currentX = startX;
      values.forEach((val, i) => {
        const align = i >= 5 ? "right" : i === 0 ? "left" : "center";
        doc.text(val, currentX + (align === "right" ? -5 : align === "left" ? 5 : 0), startY + 6, {
          width: colWidths[i],
          align: align
        });
        currentX += colWidths[i];
      });

      startY += 20;
    });

    // Grand Total Row
    if (startY > 750) {
      doc.addPage({ margin: 30, size: "A4", layout: "portrait" });
      startY = 40;
    }
    doc.rect(startX, startY, 535, 22).fill("#FF6B35");
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9);
    doc.text("Grand Total", startX + 5, startY + 7, { width: 125 });
    doc.text(`Rs. ${grandTotalSalary.toFixed(0)}`, startX + 125 + 60 + 40 + 40 + 60, startY + 7, { width: 70, align: "right" });
    doc.text(`Rs. ${grandPaidAmount.toFixed(0)}`, startX + 125 + 60 + 40 + 40 + 60 + 70, startY + 7, { width: 70, align: "right" });
    doc.text(`Rs. ${grandDueAmount.toFixed(0)}`, startX + 125 + 60 + 40 + 40 + 60 + 70 + 70, startY + 7, { width: 70, align: "right" });

    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fillColor("#777777").fontSize(8);
      doc.text("Generated by Haajari App", 30, 810);
      doc.text(`Page ${i + 1} of ${pages.count}`, 500, 810, { align: "right" });
    }

    doc.end();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Export CSV
export const getCSV = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = parseInt(req.query.year as string);
    const month = parseInt(req.query.month as string);

    if (isNaN(year) || isNaN(month)) {
      return res.status(400).json({ error: "Missing or invalid year or month parameters." });
    }

    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

    const { workers, attendance, payments } = await getExportData(tenantId.toString(), year, month);

    if (attendance.length === 0) {
      return res.status(400).json({ error: "No attendance data available for export." });
    }

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthName = monthNames[month];

    // Response headers for UTF-8 CSV download
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="Attendance_Report.csv"`);

    const headers = [
      "Worker Name", "Mobile", "Daily Rate", "Present",
      "Half Day", "Absent", "Overtime", "Custom Wage",
      "Final Salary", "Paid", "Due", "Attendance %", "Date"
    ];

    const rows = workers.map(worker => {
      const summary = calculateWorkerSummary(worker._id.toString(), attendance, worker.dailyRate);
      const workerPayments = payments.filter(p => p.workerId.toString() === worker._id.toString());
      const totalPaid = workerPayments.reduce((sum, p) => sum + p.amount, 0);
      const balance = Math.max(0, summary.totalAmount - totalPaid);

      const totalMarked = summary.presentDays + summary.halfDays + summary.absentDays + summary.overtimeDays;
      const attendancePercent = totalMarked > 0 
        ? (((summary.presentDays + summary.overtimeDays + summary.halfDays * 0.5) / totalMarked) * 100).toFixed(0) + "%"
        : "0%";

      return [
        `"${worker.name.replace(/"/g, '""')}"`,
        `"${worker.phone || ''}"`,
        worker.dailyRate.toString(),
        summary.presentDays.toString(),
        summary.halfDays.toString(),
        summary.absentDays.toString(),
        summary.overtimeDays.toString(),
        summary.customAmount.toString(),
        summary.totalAmount.toString(),
        totalPaid.toString(),
        balance.toString(),
        attendancePercent,
        `"${monthName} ${year}"`
      ];
    });

    // Write UTF-8 BOM so Excel opens non-ASCII characters cleanly
    res.write("\ufeff");
    res.write([headers.join(","), ...rows.map(r => r.join(","))].join("\n"));
    res.end();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Print Sheet (returns HTML payload)
export const getPrintHTML = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const year = parseInt(req.query.year as string);
    const month = parseInt(req.query.month as string);

    if (isNaN(year) || isNaN(month)) {
      return res.status(400).json({ error: "Missing or invalid year or month parameters." });
    }

    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

    const { workers, attendance, payments, tenant } = await getExportData(tenantId.toString(), year, month);

    if (attendance.length === 0) {
      return res.status(400).json({ error: "No attendance data available for export." });
    }

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthName = monthNames[month];

    const workerRows = workers.map((worker, idx) => {
      const summary = calculateWorkerSummary(worker._id.toString(), attendance, worker.dailyRate);
      const workerPayments = payments.filter(p => p.workerId.toString() === worker._id.toString());
      const totalPaid = workerPayments.reduce((sum, p) => sum + p.amount, 0);
      const balance = Math.max(0, summary.totalAmount - totalPaid);

      return `
        <tr style="background:${idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC"};">
          <td style="padding:10px;border-bottom:1px solid #E2E8F0;font-weight:600;">${worker.name}</td>
          <td style="padding:10px;border-bottom:1px solid #E2E8F0;text-align:center;">Rs. ${worker.dailyRate}</td>
          <td style="padding:10px;border-bottom:1px solid #E2E8F0;text-align:center;color:#10B981;font-weight:700;">${summary.presentDays}</td>
          <td style="padding:10px;border-bottom:1px solid #E2E8F0;text-align:center;color:#F59E0B;font-weight:700;">${summary.halfDays}</td>
          <td style="padding:10px;border-bottom:1px solid #E2E8F0;text-align:center;color:#EF4444;font-weight:700;">${summary.absentDays}</td>
          <td style="padding:10px;border-bottom:1px solid #E2E8F0;text-align:center;color:#3B82F6;font-weight:700;">${summary.overtimeDays}</td>
          <td style="padding:10px;border-bottom:1px solid #E2E8F0;text-align:center;color:#FF6B35;font-weight:700;">Rs. ${summary.customAmount.toFixed(0)}</td>
          <td style="padding:10px;border-bottom:1px solid #E2E8F0;text-align:right;font-weight:700;">Rs. ${summary.totalAmount.toFixed(0)}</td>
          <td style="padding:10px;border-bottom:1px solid #E2E8F0;text-align:right;color:#10B981;font-weight:700;">Rs. ${totalPaid.toFixed(0)}</td>
          <td style="padding:10px;border-bottom:1px solid #E2E8F0;text-align:right;color:#EF4444;font-weight:700;">Rs. ${balance.toFixed(0)}</td>
        </tr>
      `;
    }).join("");

    const grandTotal = workers.reduce((sum, w) => {
      const summary = calculateWorkerSummary(w._id.toString(), attendance, w.dailyRate);
      return sum + summary.totalAmount;
    }, 0);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Haajari Print Sheet</title>
        <style>
          @media print {
            @page { size: landscape; margin: 1cm; }
            body { font-size: 11px; margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
          }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #1E293B; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1E3A5F; padding-bottom: 12px; margin-bottom: 20px; }
          .header h1 { font-size: 24px; color: #1E3A5F; margin: 0; }
          .header h2 { font-size: 16px; color: #FF6B35; margin: 4px 0 0 0; }
          .meta-info { font-size: 11px; color: #64748B; text-align: right; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background-color: #1E3A5F; color: white; padding: 10px; text-align: left; font-size: 11px; font-weight: 700; }
          .grand-total { background-color: #FF6B35; color: white; font-weight: 700; font-size: 13px; }
          .grand-total td { padding: 12px 10px; color: white !important; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${tenant?.name || "Haajari App"}</h1>
            <h2>Attendance & Payments Summary — ${monthName} ${year}</h2>
          </div>
          <div class="meta-info">
            <p>Generated by: Haajari App</p>
            <p>Date: ${new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="border-top-left-radius: 4px; border-bottom-left-radius: 4px;">Worker Name</th>
              <th style="text-align:center;">Daily Rate</th>
              <th style="text-align:center;">Present</th>
              <th style="text-align:center;">Half Day</th>
              <th style="text-align:center;">Absent</th>
              <th style="text-align:center;">Overtime</th>
              <th style="text-align:center;">Custom Wage</th>
              <th style="text-align:right;">Total Salary</th>
              <th style="text-align:right;">Paid</th>
              <th style="border-top-right-radius: 4px; border-bottom-right-radius: 4px; text-align:right;">Due</th>
            </tr>
          </thead>
          <tbody>
            ${workerRows}
            <tr class="grand-total">
              <td colspan="7" style="border-top-left-radius: 4px; border-bottom-left-radius: 4px;">GRAND TOTAL</td>
              <td colspan="3" style="text-align:right; border-top-right-radius: 4px; border-bottom-right-radius: 4px; font-weight:800; font-size:14px;">Rs. ${grandTotal.toFixed(0)}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    res.setHeader("Content-Type", "text/html");
    res.send(htmlContent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
