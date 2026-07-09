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
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAttendanceRecord = exports.syncAttendance = exports.setAttendanceRecord = exports.getAttendanceForMonth = void 0;
var models_1 = require("../models");
var socket_1 = require("../utils/socket");
var getAttendanceForMonth = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, _a, year, month, query, supervisor, assignedProjects, workers, workerIds, records, error_1;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 5, , 6]);
                tenantId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.tenantId;
                _a = req.query, year = _a.year, month = _a.month;
                if (!year || !month) {
                    return [2 /*return*/, res.status(400).json({ error: "Missing year or month parameters" })];
                }
                query = {
                    tenantId: tenantId,
                    year: parseInt(year),
                    month: parseInt(month),
                };
                if (!(((_c = req.user) === null || _c === void 0 ? void 0 : _c.role) === "supervisor")) return [3 /*break*/, 3];
                return [4 /*yield*/, models_1.User.findById(req.user.id)];
            case 1:
                supervisor = _d.sent();
                assignedProjects = (supervisor === null || supervisor === void 0 ? void 0 : supervisor.assignedProjects) || [];
                return [4 /*yield*/, models_1.Worker.find({ tenantId: tenantId, isArchived: false, projectId: { $in: assignedProjects } })];
            case 2:
                workers = _d.sent();
                workerIds = workers.map(function (w) { return w._id; });
                query.workerId = { $in: workerIds };
                _d.label = 3;
            case 3: return [4 /*yield*/, models_1.Attendance.find(query)];
            case 4:
                records = _d.sent();
                res.json(records);
                return [3 /*break*/, 6];
            case 5:
                error_1 = _d.sent();
                res.status(500).json({ error: error_1.message });
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); };
exports.getAttendanceForMonth = getAttendanceForMonth;
var setAttendanceRecord = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, userId, _a, workerId, year, month, day, value, location, projectId, overtimeHours, overtimeWage, tenant, worker, workerDailyRate, dailyRateResolved, customWageResolved, overtimeWageResolved, overtimeHoursResolved, finalPayResolved, advanceAmount, otAmount, filter, update, beforeRecord, before, record, auditLog, error_2;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 7, , 8]);
                tenantId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.tenantId;
                userId = (_c = req.user) === null || _c === void 0 ? void 0 : _c.id;
                _a = req.body, workerId = _a.workerId, year = _a.year, month = _a.month, day = _a.day, value = _a.value, location = _a.location, projectId = _a.projectId, overtimeHours = _a.overtimeHours, overtimeWage = _a.overtimeWage;
                if (!workerId || year === undefined || month === undefined || day === undefined || value === undefined) {
                    return [2 /*return*/, res.status(400).json({ error: "Missing required fields" })];
                }
                if (!(location && (location.latitude || location.longitude))) return [3 /*break*/, 2];
                return [4 /*yield*/, models_1.Tenant.findById(tenantId)];
            case 1:
                tenant = _d.sent();
                if ((tenant === null || tenant === void 0 ? void 0 : tenant.plan) === "free") {
                    return [2 /*return*/, res.status(403).json({
                            error: "GPS attendance is not available on the Free Plan. Upgrade to Professional Plan to unlock this feature.",
                            limitExceeded: true,
                            plan: "free"
                        })];
                }
                _d.label = 2;
            case 2: return [4 /*yield*/, models_1.Worker.findById(workerId)];
            case 3:
                worker = _d.sent();
                workerDailyRate = worker ? worker.dailyRate : 0;
                dailyRateResolved = req.body.dailyRate !== undefined ? req.body.dailyRate : workerDailyRate;
                customWageResolved = req.body.customWage;
                overtimeWageResolved = overtimeWage;
                overtimeHoursResolved = overtimeHours;
                finalPayResolved = 0;
                advanceAmount = (customWageResolved !== undefined && customWageResolved !== null) ? customWageResolved : 0;
                otAmount = (overtimeWageResolved !== undefined && overtimeWageResolved !== null) ? overtimeWageResolved : 0;
                if (value === "P" || value === "OT") {
                    finalPayResolved = dailyRateResolved + advanceAmount + otAmount;
                }
                else if (value === "H") {
                    finalPayResolved = (dailyRateResolved / 2) + advanceAmount + otAmount;
                }
                else if (value === "A") {
                    finalPayResolved = 0;
                    customWageResolved = undefined;
                    overtimeWageResolved = undefined;
                    overtimeHoursResolved = undefined;
                }
                else if (typeof value === "number") {
                    finalPayResolved = value;
                }
                else {
                    finalPayResolved = 0;
                }
                filter = { tenantId: tenantId, workerId: workerId, year: year, month: month, day: day };
                update = {
                    tenantId: tenantId,
                    workerId: workerId,
                    projectId: projectId,
                    year: year,
                    month: month,
                    day: day,
                    value: value,
                    dailyRate: dailyRateResolved,
                    customWage: customWageResolved,
                    finalPay: finalPayResolved,
                    overtimeHours: overtimeHoursResolved,
                    overtimeWage: overtimeWageResolved,
                    location: location,
                    timestamp: new Date(),
                };
                return [4 /*yield*/, models_1.Attendance.findOne(filter)];
            case 4:
                beforeRecord = _d.sent();
                before = beforeRecord ? beforeRecord.toObject() : null;
                return [4 /*yield*/, models_1.Attendance.findOneAndUpdate(filter, update, { new: true, upsert: true })];
            case 5:
                record = _d.sent();
                auditLog = new models_1.AuditLog({
                    tenantId: tenantId,
                    userId: userId,
                    action: before ? "UPDATE" : "CREATE",
                    targetType: "ATTENDANCE",
                    targetId: record._id.toString(),
                    changes: { before: before, after: record.toObject() },
                });
                return [4 /*yield*/, auditLog.save()];
            case 6:
                _d.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                res.json(record);
                return [3 /*break*/, 8];
            case 7:
                error_2 = _d.sent();
                res.status(500).json({ error: error_2.message });
                return [3 /*break*/, 8];
            case 8: return [2 /*return*/];
        }
    });
}); };
exports.setAttendanceRecord = setAttendanceRecord;
var syncAttendance = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, records, hasLocation, tenant, results, _i, records_1, record, workerId, year, month, day, value, location, timestamp, projectId, overtimeHours, overtimeWage, dailyRate, customWage, finalPay, worker, workerDailyRate, dailyRateResolved, customWageResolved, overtimeWageResolved, overtimeHoursResolved, finalPayResolved, advanceAmount, otAmount, filter, update, result, error_3;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 8, , 9]);
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                records = req.body.records;
                if (!Array.isArray(records)) {
                    return [2 /*return*/, res.status(400).json({ error: "Records must be an array" })];
                }
                hasLocation = records.some(function (r) { return r.location && (r.location.latitude || r.location.longitude); });
                if (!hasLocation) return [3 /*break*/, 2];
                return [4 /*yield*/, models_1.Tenant.findById(tenantId)];
            case 1:
                tenant = _b.sent();
                if ((tenant === null || tenant === void 0 ? void 0 : tenant.plan) === "free") {
                    return [2 /*return*/, res.status(403).json({
                            error: "GPS attendance is not available on the Free Plan. Upgrade to Professional Plan to unlock this feature.",
                            limitExceeded: true,
                            plan: "free"
                        })];
                }
                _b.label = 2;
            case 2:
                results = [];
                _i = 0, records_1 = records;
                _b.label = 3;
            case 3:
                if (!(_i < records_1.length)) return [3 /*break*/, 7];
                record = records_1[_i];
                workerId = record.workerId, year = record.year, month = record.month, day = record.day, value = record.value, location = record.location, timestamp = record.timestamp, projectId = record.projectId, overtimeHours = record.overtimeHours, overtimeWage = record.overtimeWage, dailyRate = record.dailyRate, customWage = record.customWage, finalPay = record.finalPay;
                return [4 /*yield*/, models_1.Worker.findById(workerId)];
            case 4:
                worker = _b.sent();
                workerDailyRate = worker ? worker.dailyRate : 0;
                dailyRateResolved = dailyRate !== undefined ? dailyRate : workerDailyRate;
                customWageResolved = customWage;
                overtimeWageResolved = overtimeWage;
                overtimeHoursResolved = overtimeHours;
                finalPayResolved = 0;
                advanceAmount = (customWageResolved !== undefined && customWageResolved !== null) ? customWageResolved : 0;
                otAmount = (overtimeWageResolved !== undefined && overtimeWageResolved !== null) ? overtimeWageResolved : 0;
                if (value === "P" || value === "OT") {
                    finalPayResolved = dailyRateResolved + advanceAmount + otAmount;
                }
                else if (value === "H") {
                    finalPayResolved = (dailyRateResolved / 2) + advanceAmount + otAmount;
                }
                else if (value === "A") {
                    finalPayResolved = 0;
                    customWageResolved = undefined;
                    overtimeWageResolved = undefined;
                    overtimeHoursResolved = undefined;
                }
                else if (typeof value === "number") {
                    finalPayResolved = value;
                }
                else {
                    finalPayResolved = 0;
                }
                filter = { tenantId: tenantId, workerId: workerId, year: year, month: month, day: day };
                update = {
                    tenantId: tenantId,
                    workerId: workerId,
                    projectId: projectId,
                    year: year,
                    month: month,
                    day: day,
                    value: value,
                    dailyRate: dailyRateResolved,
                    customWage: customWageResolved,
                    finalPay: finalPayResolved,
                    overtimeHours: overtimeHoursResolved,
                    overtimeWage: overtimeWageResolved,
                    location: location,
                    timestamp: timestamp ? new Date(timestamp) : new Date(),
                };
                return [4 /*yield*/, models_1.Attendance.findOneAndUpdate(filter, update, { new: true, upsert: true })];
            case 5:
                result = _b.sent();
                results.push(result);
                _b.label = 6;
            case 6:
                _i++;
                return [3 /*break*/, 3];
            case 7:
                res.json({ success: true, count: results.length });
                return [3 /*break*/, 9];
            case 8:
                error_3 = _b.sent();
                res.status(500).json({ error: error_3.message });
                return [3 /*break*/, 9];
            case 9: return [2 /*return*/];
        }
    });
}); };
exports.syncAttendance = syncAttendance;
var deleteAttendanceRecord = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, userId, id, attendance, before, auditLog, error_4;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 4, , 5]);
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
                id = req.params.id;
                return [4 /*yield*/, models_1.Attendance.findOne({ _id: id, tenantId: tenantId })];
            case 1:
                attendance = _c.sent();
                if (!attendance) {
                    return [2 /*return*/, res.status(404).json({ error: "Attendance record not found" })];
                }
                before = attendance.toObject();
                return [4 /*yield*/, models_1.Attendance.findByIdAndDelete(id)];
            case 2:
                _c.sent();
                auditLog = new models_1.AuditLog({
                    tenantId: tenantId,
                    userId: userId,
                    action: "DELETE",
                    targetType: "ATTENDANCE",
                    targetId: id,
                    changes: { before: before },
                });
                return [4 /*yield*/, auditLog.save()];
            case 3:
                _c.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                res.json({ success: true, message: "Attendance record deleted successfully" });
                return [3 /*break*/, 5];
            case 4:
                error_4 = _c.sent();
                res.status(500).json({ error: error_4.message });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.deleteAttendanceRecord = deleteAttendanceRecord;
