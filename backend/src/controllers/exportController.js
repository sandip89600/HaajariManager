"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrintHTML = exports.getCSV = exports.getPaymentSummaryPDF = exports.getAttendancePDF = void 0;
var models_1 = require("../models");
var pdfkit_1 = require("pdfkit");
// Helper to gather all data for a given tenant, year, and month
var getExportData = function (tenantId, year, month) { return __awaiter(void 0, void 0, void 0, function () {
    var workers, workerIds, attendance, payments, tenant;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, models_1.Worker.find({ tenantId: tenantId, isArchived: false })];
            case 1:
                workers = _a.sent();
                workerIds = workers.map(function (w) { return w._id; });
                return [4 /*yield*/, models_1.Attendance.find({
                        tenantId: tenantId,
                        workerId: { $in: workerIds },
                        year: year,
                        month: month
                    })];
            case 2:
                attendance = _a.sent();
                return [4 /*yield*/, models_1.Payment.find({
                        tenantId: tenantId,
                        workerId: { $in: workerIds },
                        year: year,
                        month: month
                    })];
            case 3:
                payments = _a.sent();
                return [4 /*yield*/, models_1.Tenant.findById(tenantId)];
            case 4:
                tenant = _a.sent();
                return [2 /*return*/, { workers: workers, attendance: attendance, payments: payments, tenant: tenant }];
        }
    });
}); };
// Helper for MERN payroll calculations
var calculateWorkerSummary = function (workerId, attendance, dailyRate) {
    var workerAttendance = attendance.filter(function (a) { return a.workerId.toString() === workerId.toString(); });
    var presentDays = 0;
    var halfDays = 0;
    var absentDays = 0;
    var overtimeDays = 0;
    var customDays = 0;
    var customAmount = 0;
    var totalAmount = 0;
    workerAttendance.forEach(function (record) {
        var rate = record.dailyRate !== undefined && record.dailyRate !== null ? record.dailyRate : dailyRate;
        var extra = (record.customWage !== undefined && record.customWage !== null) ? record.customWage : 0;
        var recordPay = 0;
        if (record.value === "P" || record.value === "OT") {
            recordPay = rate + extra;
        }
        else if (record.value === "H") {
            recordPay = (rate / 2) + extra;
        }
        else if (record.value === "A") {
            recordPay = extra;
        }
        else if (typeof record.value === "number") {
            recordPay = record.value;
        }
        else {
            recordPay = extra;
        }
        totalAmount += recordPay;
        if (record.value === "P") {
            presentDays++;
        }
        else if (record.value === "A") {
            absentDays++;
        }
        else if (record.value === "H") {
            halfDays++;
        }
        else if (record.value === "OT") {
            overtimeDays++;
        }
        else if (typeof record.value === "number") {
            customDays++;
            customAmount += record.value;
        }
        if (record.customWage !== undefined && record.customWage !== null) {
            customDays++;
            customAmount += record.customWage;
        }
    });
    return { presentDays: presentDays, halfDays: halfDays, absentDays: absentDays, overtimeDays: overtimeDays, customDays: customDays, customAmount: customAmount, totalAmount: totalAmount };
};
// 1. Generate Attendance Report PDF
var getAttendancePDF = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var year, month, tenantId, _a, workers, attendance_1, payments_1, tenant, monthNames, monthName, filename, doc_1, startX_1, startY_1, colWidths_1, colNames_1, drawHeader_1, pages, i, error_1;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 2, , 3]);
                year = parseInt(req.query.year);
                month = parseInt(req.query.month);
                if (isNaN(year) || isNaN(month)) {
                    return [2 /*return*/, res.status(400).json({ error: "Missing or invalid year or month parameters." })];
                }
                tenantId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.tenantId;
                if (!tenantId)
                    return [2 /*return*/, res.status(401).json({ error: "Unauthorized" })];
                return [4 /*yield*/, getExportData(tenantId.toString(), year, month)];
            case 1:
                _a = _c.sent(), workers = _a.workers, attendance_1 = _a.attendance, payments_1 = _a.payments, tenant = _a.tenant;
                if (attendance_1.length === 0) {
                    return [2 /*return*/, res.status(400).json({ error: "No attendance data available for export." })];
                }
                monthNames = [
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"
                ];
                monthName = monthNames[month];
                filename = "Attendance_Report_".concat(monthName, "_").concat(year, ".pdf");
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("Content-Disposition", "attachment; filename=\"".concat(filename, "\""));
                doc_1 = new pdfkit_1.default({ margin: 30, size: "A4", layout: "landscape" });
                doc_1.pipe(res);
                // Header styling
                doc_1.font("Helvetica-Bold").fontSize(18).fillColor("#1E3A5F").text((tenant === null || tenant === void 0 ? void 0 : tenant.name) || "Haajari App Report", 30, 30);
                doc_1.font("Helvetica").fontSize(12).fillColor("#555555").text("Attendance Report \u2014 ".concat(monthName, " ").concat(year), 30, 52);
                doc_1.fontSize(9).text("Generated Date: ".concat(new Date().toLocaleDateString()), 30, 68);
                startX_1 = 30;
                startY_1 = 90;
                colWidths_1 = [130, 70, 60, 60, 60, 60, 80, 90, 80, 90];
                colNames_1 = ["Worker Name", "Daily Rate", "Present", "Half Day", "Absent", "Overtime", "Custom Wage", "Total Salary", "Paid", "Due"];
                drawHeader_1 = function (y) {
                    doc_1.rect(startX_1, y, 780, 20).fill("#1E3A5F");
                    doc_1.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9);
                    var currentX = startX_1;
                    colNames_1.forEach(function (name, i) {
                        var align = i >= 7 ? "right" : i === 0 ? "left" : "center";
                        doc_1.text(name, currentX + (align === "right" ? -5 : align === "left" ? 5 : 0), y + 6, {
                            width: colWidths_1[i],
                            align: align
                        });
                        currentX += colWidths_1[i];
                    });
                };
                drawHeader_1(startY_1);
                startY_1 += 20;
                doc_1.font("Helvetica").fontSize(9).fillColor("#000000");
                workers.forEach(function (worker, wIndex) {
                    if (startY_1 > 500) {
                        doc_1.addPage({ margin: 30, size: "A4", layout: "landscape" });
                        startY_1 = 40;
                        drawHeader_1(startY_1);
                        startY_1 += 20;
                        doc_1.font("Helvetica").fontSize(9).fillColor("#000000");
                    }
                    var summary = calculateWorkerSummary(worker._id.toString(), attendance_1, worker.dailyRate);
                    var workerPayments = payments_1.filter(function (p) { return p.workerId.toString() === worker._id.toString(); });
                    var totalPaid = workerPayments.reduce(function (sum, p) { return sum + p.amount; }, 0);
                    var balance = Math.max(0, summary.totalAmount - totalPaid);
                    if (wIndex % 2 === 1) {
                        doc_1.rect(startX_1, startY_1, 780, 20).fill("#F9F9F9");
                    }
                    doc_1.fillColor("#000000");
                    doc_1.rect(startX_1, startY_1, 780, 20).stroke("#EAEAEA");
                    var values = [
                        worker.name,
                        "Rs. ".concat(worker.dailyRate),
                        summary.presentDays.toString(),
                        summary.halfDays.toString(),
                        summary.absentDays.toString(),
                        summary.overtimeDays.toString(),
                        "Rs. ".concat(summary.customAmount.toFixed(0)),
                        "Rs. ".concat(summary.totalAmount.toFixed(0)),
                        "Rs. ".concat(totalPaid.toFixed(0)),
                        "Rs. ".concat(balance.toFixed(0))
                    ];
                    var currentX = startX_1;
                    values.forEach(function (val, i) {
                        var align = i >= 7 ? "right" : i === 0 ? "left" : "center";
                        doc_1.text(val, currentX + (align === "right" ? -5 : align === "left" ? 5 : 0), startY_1 + 6, {
                            width: colWidths_1[i],
                            align: align
                        });
                        currentX += colWidths_1[i];
                    });
                    startY_1 += 20;
                });
                pages = doc_1.bufferedPageRange();
                for (i = 0; i < pages.count; i++) {
                    doc_1.switchToPage(i);
                    doc_1.fillColor("#777777").fontSize(8);
                    doc_1.text("Generated by Haajari App", 30, 565);
                    doc_1.text("Page ".concat(i + 1, " of ").concat(pages.count), 750, 565, { align: "right" });
                }
                doc_1.end();
                return [3 /*break*/, 3];
            case 2:
                error_1 = _c.sent();
                res.status(500).json({ error: error_1.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getAttendancePDF = getAttendancePDF;
// 2. Generate Payment Summary PDF
var getPaymentSummaryPDF = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var year, month, tenantId, _a, workers, attendance_2, payments_2, tenant, monthNames, monthName, filename, doc_2, startX_2, startY_2, colWidths_2, colNames_2, drawHeader_2, grandTotalSalary_1, grandPaidAmount_1, grandDueAmount_1, pages, i, error_2;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 2, , 3]);
                year = parseInt(req.query.year);
                month = parseInt(req.query.month);
                if (isNaN(year) || isNaN(month)) {
                    return [2 /*return*/, res.status(400).json({ error: "Missing or invalid year or month parameters." })];
                }
                tenantId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.tenantId;
                if (!tenantId)
                    return [2 /*return*/, res.status(401).json({ error: "Unauthorized" })];
                return [4 /*yield*/, getExportData(tenantId.toString(), year, month)];
            case 1:
                _a = _c.sent(), workers = _a.workers, attendance_2 = _a.attendance, payments_2 = _a.payments, tenant = _a.tenant;
                if (attendance_2.length === 0) {
                    return [2 /*return*/, res.status(400).json({ error: "No attendance data available for export." })];
                }
                monthNames = [
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"
                ];
                monthName = monthNames[month];
                filename = "Payment_Summary_".concat(monthName, "_").concat(year, ".pdf");
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("Content-Disposition", "attachment; filename=\"".concat(filename, "\""));
                doc_2 = new pdfkit_1.default({ margin: 30, size: "A4", layout: "portrait" });
                doc_2.pipe(res);
                // Header styling
                doc_2.font("Helvetica-Bold").fontSize(18).fillColor("#1E3A5F").text((tenant === null || tenant === void 0 ? void 0 : tenant.name) || "Haajari App Report", 30, 30);
                doc_2.font("Helvetica").fontSize(12).fillColor("#555555").text("Payment Summary \u2014 ".concat(monthName, " ").concat(year), 30, 52);
                doc_2.fontSize(9).text("Generated Date: ".concat(new Date().toLocaleDateString()), 30, 68);
                startX_2 = 30;
                startY_2 = 90;
                colWidths_2 = [125, 60, 40, 40, 60, 70, 70, 70];
                colNames_2 = ["Worker Name", "Rate", "Pres", "Half", "Custom", "Salary", "Paid", "Due"];
                drawHeader_2 = function (y) {
                    doc_2.rect(startX_2, y, 535, 20).fill("#1E3A5F");
                    doc_2.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9);
                    var currentX = startX_2;
                    colNames_2.forEach(function (name, i) {
                        var align = i >= 5 ? "right" : i === 0 ? "left" : "center";
                        doc_2.text(name, currentX + (align === "right" ? -5 : align === "left" ? 5 : 0), y + 6, {
                            width: colWidths_2[i],
                            align: align
                        });
                        currentX += colWidths_2[i];
                    });
                };
                drawHeader_2(startY_2);
                startY_2 += 20;
                grandTotalSalary_1 = 0;
                grandPaidAmount_1 = 0;
                grandDueAmount_1 = 0;
                doc_2.font("Helvetica").fontSize(9).fillColor("#000000");
                workers.forEach(function (worker, wIndex) {
                    if (startY_2 > 750) {
                        doc_2.addPage({ margin: 30, size: "A4", layout: "portrait" });
                        startY_2 = 40;
                        drawHeader_2(startY_2);
                        startY_2 += 20;
                        doc_2.font("Helvetica").fontSize(9).fillColor("#000000");
                    }
                    var summary = calculateWorkerSummary(worker._id.toString(), attendance_2, worker.dailyRate);
                    var workerPayments = payments_2.filter(function (p) { return p.workerId.toString() === worker._id.toString(); });
                    var totalPaid = workerPayments.reduce(function (sum, p) { return sum + p.amount; }, 0);
                    var balance = Math.max(0, summary.totalAmount - totalPaid);
                    grandTotalSalary_1 += summary.totalAmount;
                    grandPaidAmount_1 += totalPaid;
                    grandDueAmount_1 += balance;
                    if (wIndex % 2 === 1) {
                        doc_2.rect(startX_2, startY_2, 535, 20).fill("#F9F9F9");
                    }
                    doc_2.fillColor("#000000");
                    doc_2.rect(startX_2, startY_2, 535, 20).stroke("#EAEAEA");
                    var values = [
                        worker.name,
                        "Rs. ".concat(worker.dailyRate),
                        summary.presentDays.toString(),
                        summary.halfDays.toString(),
                        "Rs. ".concat(summary.customAmount.toFixed(0)),
                        "Rs. ".concat(summary.totalAmount.toFixed(0)),
                        "Rs. ".concat(totalPaid.toFixed(0)),
                        "Rs. ".concat(balance.toFixed(0))
                    ];
                    var currentX = startX_2;
                    values.forEach(function (val, i) {
                        var align = i >= 5 ? "right" : i === 0 ? "left" : "center";
                        doc_2.text(val, currentX + (align === "right" ? -5 : align === "left" ? 5 : 0), startY_2 + 6, {
                            width: colWidths_2[i],
                            align: align
                        });
                        currentX += colWidths_2[i];
                    });
                    startY_2 += 20;
                });
                // Grand Total Row
                if (startY_2 > 750) {
                    doc_2.addPage({ margin: 30, size: "A4", layout: "portrait" });
                    startY_2 = 40;
                }
                doc_2.rect(startX_2, startY_2, 535, 22).fill("#FF6B35");
                doc_2.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9);
                doc_2.text("Grand Total", startX_2 + 5, startY_2 + 7, { width: 125 });
                doc_2.text("Rs. ".concat(grandTotalSalary_1.toFixed(0)), startX_2 + 125 + 60 + 40 + 40 + 60, startY_2 + 7, { width: 70, align: "right" });
                doc_2.text("Rs. ".concat(grandPaidAmount_1.toFixed(0)), startX_2 + 125 + 60 + 40 + 40 + 60 + 70, startY_2 + 7, { width: 70, align: "right" });
                doc_2.text("Rs. ".concat(grandDueAmount_1.toFixed(0)), startX_2 + 125 + 60 + 40 + 40 + 60 + 70 + 70, startY_2 + 7, { width: 70, align: "right" });
                pages = doc_2.bufferedPageRange();
                for (i = 0; i < pages.count; i++) {
                    doc_2.switchToPage(i);
                    doc_2.fillColor("#777777").fontSize(8);
                    doc_2.text("Generated by Haajari App", 30, 810);
                    doc_2.text("Page ".concat(i + 1, " of ").concat(pages.count), 500, 810, { align: "right" });
                }
                doc_2.end();
                return [3 /*break*/, 3];
            case 2:
                error_2 = _c.sent();
                res.status(500).json({ error: error_2.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getPaymentSummaryPDF = getPaymentSummaryPDF;
// 3. Export CSV
var getCSV = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var year_1, month, tenantId, _a, workers, attendance_3, payments_3, monthNames, monthName_1, headers, rows, error_3;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 2, , 3]);
                year_1 = parseInt(req.query.year);
                month = parseInt(req.query.month);
                if (isNaN(year_1) || isNaN(month)) {
                    return [2 /*return*/, res.status(400).json({ error: "Missing or invalid year or month parameters." })];
                }
                tenantId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.tenantId;
                if (!tenantId)
                    return [2 /*return*/, res.status(401).json({ error: "Unauthorized" })];
                return [4 /*yield*/, getExportData(tenantId.toString(), year_1, month)];
            case 1:
                _a = _c.sent(), workers = _a.workers, attendance_3 = _a.attendance, payments_3 = _a.payments;
                if (attendance_3.length === 0) {
                    return [2 /*return*/, res.status(400).json({ error: "No attendance data available for export." })];
                }
                monthNames = [
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"
                ];
                monthName_1 = monthNames[month];
                // Response headers for UTF-8 CSV download
                res.setHeader("Content-Type", "text/csv; charset=utf-8");
                res.setHeader("Content-Disposition", "attachment; filename=\"Attendance_Report.csv\"");
                headers = [
                    "Worker Name", "Mobile", "Daily Rate", "Present",
                    "Half Day", "Absent", "Overtime", "Custom Wage",
                    "Final Salary", "Paid", "Due", "Attendance %", "Date"
                ];
                rows = workers.map(function (worker) {
                    var summary = calculateWorkerSummary(worker._id.toString(), attendance_3, worker.dailyRate);
                    var workerPayments = payments_3.filter(function (p) { return p.workerId.toString() === worker._id.toString(); });
                    var totalPaid = workerPayments.reduce(function (sum, p) { return sum + p.amount; }, 0);
                    var balance = Math.max(0, summary.totalAmount - totalPaid);
                    var totalMarked = summary.presentDays + summary.halfDays + summary.absentDays + summary.overtimeDays;
                    var attendancePercent = totalMarked > 0
                        ? (((summary.presentDays + summary.overtimeDays + summary.halfDays * 0.5) / totalMarked) * 100).toFixed(0) + "%"
                        : "0%";
                    return [
                        "\"".concat(worker.name.replace(/"/g, '""'), "\""),
                        "\"".concat(worker.phone || '', "\""),
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
                        "\"".concat(monthName_1, " ").concat(year_1, "\"")
                    ];
                });
                // Write UTF-8 BOM so Excel opens non-ASCII characters cleanly
                res.write("\ufeff");
                res.write(__spreadArray([headers.join(",")], rows.map(function (r) { return r.join(","); }), true).join("\n"));
                res.end();
                return [3 /*break*/, 3];
            case 2:
                error_3 = _c.sent();
                res.status(500).json({ error: error_3.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getCSV = getCSV;
// 4. Print Sheet (returns HTML payload)
var getPrintHTML = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var year, month, tenantId, _a, workers, attendance_4, payments_4, tenant, monthNames, monthName, workerRows, grandTotal, htmlContent, error_4;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 2, , 3]);
                year = parseInt(req.query.year);
                month = parseInt(req.query.month);
                if (isNaN(year) || isNaN(month)) {
                    return [2 /*return*/, res.status(400).json({ error: "Missing or invalid year or month parameters." })];
                }
                tenantId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.tenantId;
                if (!tenantId)
                    return [2 /*return*/, res.status(401).json({ error: "Unauthorized" })];
                return [4 /*yield*/, getExportData(tenantId.toString(), year, month)];
            case 1:
                _a = _c.sent(), workers = _a.workers, attendance_4 = _a.attendance, payments_4 = _a.payments, tenant = _a.tenant;
                if (attendance_4.length === 0) {
                    return [2 /*return*/, res.status(400).json({ error: "No attendance data available for export." })];
                }
                monthNames = [
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"
                ];
                monthName = monthNames[month];
                workerRows = workers.map(function (worker, idx) {
                    var summary = calculateWorkerSummary(worker._id.toString(), attendance_4, worker.dailyRate);
                    var workerPayments = payments_4.filter(function (p) { return p.workerId.toString() === worker._id.toString(); });
                    var totalPaid = workerPayments.reduce(function (sum, p) { return sum + p.amount; }, 0);
                    var balance = Math.max(0, summary.totalAmount - totalPaid);
                    return "\n        <tr style=\"background:".concat(idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC", ";\">\n          <td style=\"padding:10px;border-bottom:1px solid #E2E8F0;font-weight:600;\">").concat(worker.name, "</td>\n          <td style=\"padding:10px;border-bottom:1px solid #E2E8F0;text-align:center;\">Rs. ").concat(worker.dailyRate, "</td>\n          <td style=\"padding:10px;border-bottom:1px solid #E2E8F0;text-align:center;color:#10B981;font-weight:700;\">").concat(summary.presentDays, "</td>\n          <td style=\"padding:10px;border-bottom:1px solid #E2E8F0;text-align:center;color:#F59E0B;font-weight:700;\">").concat(summary.halfDays, "</td>\n          <td style=\"padding:10px;border-bottom:1px solid #E2E8F0;text-align:center;color:#EF4444;font-weight:700;\">").concat(summary.absentDays, "</td>\n          <td style=\"padding:10px;border-bottom:1px solid #E2E8F0;text-align:center;color:#3B82F6;font-weight:700;\">").concat(summary.overtimeDays, "</td>\n          <td style=\"padding:10px;border-bottom:1px solid #E2E8F0;text-align:center;color:#FF6B35;font-weight:700;\">Rs. ").concat(summary.customAmount.toFixed(0), "</td>\n          <td style=\"padding:10px;border-bottom:1px solid #E2E8F0;text-align:right;font-weight:700;\">Rs. ").concat(summary.totalAmount.toFixed(0), "</td>\n          <td style=\"padding:10px;border-bottom:1px solid #E2E8F0;text-align:right;color:#10B981;font-weight:700;\">Rs. ").concat(totalPaid.toFixed(0), "</td>\n          <td style=\"padding:10px;border-bottom:1px solid #E2E8F0;text-align:right;color:#EF4444;font-weight:700;\">Rs. ").concat(balance.toFixed(0), "</td>\n        </tr>\n      ");
                }).join("");
                grandTotal = workers.reduce(function (sum, w) {
                    var summary = calculateWorkerSummary(w._id.toString(), attendance_4, w.dailyRate);
                    return sum + summary.totalAmount;
                }, 0);
                htmlContent = "\n      <!DOCTYPE html>\n      <html>\n      <head>\n        <meta charset=\"utf-8\">\n        <title>Haajari Print Sheet</title>\n        <style>\n          @media print {\n            @page { size: landscape; margin: 1cm; }\n            body { font-size: 11px; margin: 0; padding: 0; -webkit-print-color-adjust: exact; }\n          }\n          body { font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #1E293B; }\n          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1E3A5F; padding-bottom: 12px; margin-bottom: 20px; }\n          .header h1 { font-size: 24px; color: #1E3A5F; margin: 0; }\n          .header h2 { font-size: 16px; color: #FF6B35; margin: 4px 0 0 0; }\n          .meta-info { font-size: 11px; color: #64748B; text-align: right; }\n          table { width: 100%; border-collapse: collapse; margin-top: 10px; }\n          th { background-color: #1E3A5F; color: white; padding: 10px; text-align: left; font-size: 11px; font-weight: 700; }\n          .grand-total { background-color: #FF6B35; color: white; font-weight: 700; font-size: 13px; }\n          .grand-total td { padding: 12px 10px; color: white !important; }\n        </style>\n      </head>\n      <body>\n        <div class=\"header\">\n          <div>\n            <h1>".concat((tenant === null || tenant === void 0 ? void 0 : tenant.name) || "Haajari App", "</h1>\n            <h2>Attendance & Payments Summary \u2014 ").concat(monthName, " ").concat(year, "</h2>\n          </div>\n          <div class=\"meta-info\">\n            <p>Generated by: Haajari App</p>\n            <p>Date: ").concat(new Date().toLocaleDateString(), "</p>\n          </div>\n        </div>\n\n        <table>\n          <thead>\n            <tr>\n              <th style=\"border-top-left-radius: 4px; border-bottom-left-radius: 4px;\">Worker Name</th>\n              <th style=\"text-align:center;\">Daily Rate</th>\n              <th style=\"text-align:center;\">Present</th>\n              <th style=\"text-align:center;\">Half Day</th>\n              <th style=\"text-align:center;\">Absent</th>\n              <th style=\"text-align:center;\">Overtime</th>\n              <th style=\"text-align:center;\">Custom Wage</th>\n              <th style=\"text-align:right;\">Total Salary</th>\n              <th style=\"text-align:right;\">Paid</th>\n              <th style=\"border-top-right-radius: 4px; border-bottom-right-radius: 4px; text-align:right;\">Due</th>\n            </tr>\n          </thead>\n          <tbody>\n            ").concat(workerRows, "\n            <tr class=\"grand-total\">\n              <td colspan=\"7\" style=\"border-top-left-radius: 4px; border-bottom-left-radius: 4px;\">GRAND TOTAL</td>\n              <td colspan=\"3\" style=\"text-align:right; border-top-right-radius: 4px; border-bottom-right-radius: 4px; font-weight:800; font-size:14px;\">Rs. ").concat(grandTotal.toFixed(0), "</td>\n            </tr>\n          </tbody>\n        </table>\n      </body>\n      </html>\n    ");
                res.setHeader("Content-Type", "text/html");
                res.send(htmlContent);
                return [3 /*break*/, 3];
            case 2:
                error_4 = _c.sent();
                res.status(500).json({ error: error_4.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getPrintHTML = getPrintHTML;
