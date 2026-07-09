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
exports.disableSuspiciousDevice = exports.forceLogoutUser = exports.getActiveSessions = exports.getSecurityLogs = exports.deleteFeedbackAdmin = exports.getAllFeedbackAdmin = exports.deleteProblemAdmin = exports.resolveProblemAdmin = exports.getAllProblemsAdmin = exports.deletePaymentAdmin = exports.updatePaymentAdmin = exports.getAllPayments = exports.deleteAttendanceAdmin = exports.updateAttendanceAdmin = exports.getAllAttendance = exports.deleteWorkerAdmin = exports.updateWorkerInfo = exports.getAllWorkers = exports.getAdminAnalytics = exports.updateTenantPlan = exports.deleteUser = exports.toggleUserStatus = exports.updateUserInfo = exports.getAllUsers = void 0;
var bcryptjs_1 = require("bcryptjs");
var models_1 = require("../models");
var socket_1 = require("../utils/socket");
// Helper to format audit logs
var formatAuditLog = function (log) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
    var userName = ((_a = log.userId) === null || _a === void 0 ? void 0 : _a.name) || "Someone";
    var userRole = ((_b = log.userId) === null || _b === void 0 ? void 0 : _b.role) || "";
    var tenantName = ((_c = log.tenantId) === null || _c === void 0 ? void 0 : _c.name) || "their organization";
    var action = log.action;
    var targetType = log.targetType;
    switch (action) {
        case "USER_SIGNUP":
            return "".concat(userName, " (").concat(userRole, ") signed up for a new account.");
        case "USER_LOGIN":
            return "".concat(userName, " logged in.");
        case "UPDATE_PROFILE":
            return "".concat(userName, " updated their profile details.");
        case "CHANGE_PASSWORD":
            return "".concat(userName, " updated their password.");
        case "PLAN_UPGRADE": {
            var plan = ((_e = (_d = log.changes) === null || _d === void 0 ? void 0 : _d.after) === null || _e === void 0 ? void 0 : _e.plan) || "unknown";
            return "".concat(tenantName, " upgraded to the ").concat(plan.toUpperCase(), " plan.");
        }
        case "CREATE":
            if (targetType === "WORKER") {
                var workerName = ((_g = (_f = log.changes) === null || _f === void 0 ? void 0 : _f.after) === null || _g === void 0 ? void 0 : _g.name) || "a worker";
                return "".concat(userName, " added worker \"").concat(workerName, "\".");
            }
            if (targetType === "ATTENDANCE") {
                return "".concat(userName, " marked attendance.");
            }
            if (targetType === "PAYMENT") {
                var amount = ((_j = (_h = log.changes) === null || _h === void 0 ? void 0 : _h.after) === null || _j === void 0 ? void 0 : _j.amount) || 0;
                return "".concat(userName, " recorded a payment of \u20B9").concat(amount, ".");
            }
            if (targetType === "PROJECT") {
                var projName = ((_l = (_k = log.changes) === null || _k === void 0 ? void 0 : _k.after) === null || _l === void 0 ? void 0 : _l.name) || "a project";
                return "".concat(userName, " created project \"").concat(projName, "\".");
            }
            return "".concat(userName, " created a new ").concat(targetType.toLowerCase(), ".");
        case "UPDATE":
            if (targetType === "WORKER") {
                var workerName = ((_o = (_m = log.changes) === null || _m === void 0 ? void 0 : _m.after) === null || _o === void 0 ? void 0 : _o.name) || "a worker";
                return "".concat(userName, " updated worker details for \"").concat(workerName, "\".");
            }
            if (targetType === "ATTENDANCE") {
                return "".concat(userName, " modified attendance records.");
            }
            return "".concat(userName, " modified a ").concat(targetType.toLowerCase(), ".");
        case "SOFT_DELETE":
            if (targetType === "WORKER") {
                var workerName = ((_q = (_p = log.changes) === null || _p === void 0 ? void 0 : _p.before) === null || _q === void 0 ? void 0 : _q.name) || "a worker";
                return "".concat(userName, " deleted worker \"").concat(workerName, "\".");
            }
            return "".concat(userName, " deleted a ").concat(targetType.toLowerCase(), ".");
        case "DELETE":
            if (targetType === "PAYMENT") {
                var amount = ((_s = (_r = log.changes) === null || _r === void 0 ? void 0 : _r.before) === null || _s === void 0 ? void 0 : _s.amount) || 0;
                return "".concat(userName, " deleted a payment of \u20B9").concat(amount, ".");
            }
            return "".concat(userName, " deleted a ").concat(targetType.toLowerCase(), ".");
        case "ADMIN_USER_UPDATE":
            return "".concat(userName, " updated system user details.");
        case "ADMIN_USER_DELETE":
            return "".concat(userName, " permanently deleted a user.");
        case "ADMIN_WORKER_UPDATE":
            return "".concat(userName, " modified worker credentials.");
        case "ADMIN_WORKER_DELETE":
            return "".concat(userName, " permanently deleted worker.");
        case "ADMIN_ATTENDANCE_UPDATE":
            return "".concat(userName, " modified worker attendance record.");
        case "ADMIN_ATTENDANCE_DELETE":
            return "".concat(userName, " deleted worker attendance record.");
        case "ADMIN_PAYMENT_UPDATE":
            return "".concat(userName, " modified payroll transaction.");
        case "ADMIN_PAYMENT_DELETE":
            return "".concat(userName, " deleted payroll transaction.");
        default:
            return "".concat(userName, " performed action: ").concat(action, " on ").concat(targetType, ".");
    }
};
// 1. Get all users with tenant info
var getAllUsers = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var users, usersWithWorkerCount, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, models_1.User.find({ role: { $ne: "admin" } })
                        .populate("tenantId")
                        .select("-passwordHash -refreshTokens")
                        .sort({ createdAt: -1 })];
            case 1:
                users = _a.sent();
                console.log("Users Returned:", users.length);
                console.log("[Admin Audit Log] getAllUsers: Found non-admin users in DB count:", users.length);
                return [4 /*yield*/, Promise.all(users.map(function (user) { return __awaiter(void 0, void 0, void 0, function () {
                        var userObj, tenantId, workerCount, plan, limitViolation, limit;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    userObj = user.toObject();
                                    if (!user.tenantId) return [3 /*break*/, 2];
                                    tenantId = user.tenantId._id;
                                    return [4 /*yield*/, models_1.Worker.countDocuments({ tenantId: tenantId, isArchived: false })];
                                case 1:
                                    workerCount = _a.sent();
                                    userObj.workerCount = workerCount;
                                    plan = user.tenantId.plan || "free";
                                    limitViolation = false;
                                    limit = Infinity;
                                    if (plan === "free") {
                                        limit = 15;
                                        limitViolation = workerCount > 15;
                                    }
                                    else if (plan === "professional") {
                                        limit = 100;
                                        limitViolation = workerCount > 100;
                                    }
                                    userObj.limitViolation = limitViolation;
                                    userObj.planLimit = limit;
                                    return [3 /*break*/, 3];
                                case 2:
                                    userObj.workerCount = 0;
                                    userObj.limitViolation = false;
                                    userObj.planLimit = Infinity;
                                    _a.label = 3;
                                case 3: return [2 /*return*/, userObj];
                            }
                        });
                    }); }))];
            case 2:
                usersWithWorkerCount = _a.sent();
                res.json(usersWithWorkerCount);
                return [3 /*break*/, 4];
            case 3:
                error_1 = _a.sent();
                res.status(500).json({ error: error_1.message });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.getAllUsers = getAllUsers;
// 1.b Update user metadata (Admin Control)
var updateUserInfo = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, _a, name, role, phone, email, password, isActive, user, before, _b, auditLog, error_2;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 6, , 7]);
                id = req.params.id;
                _a = req.body, name = _a.name, role = _a.role, phone = _a.phone, email = _a.email, password = _a.password, isActive = _a.isActive;
                return [4 /*yield*/, models_1.User.findById(id)];
            case 1:
                user = _d.sent();
                if (!user) {
                    return [2 /*return*/, res.status(404).json({ error: "User not found" })];
                }
                before = user.toObject();
                if (name !== undefined)
                    user.name = name;
                if (role !== undefined)
                    user.role = role;
                if (phone !== undefined)
                    user.phone = phone;
                if (email !== undefined)
                    user.email = email;
                if (isActive !== undefined)
                    user.isActive = isActive;
                if (!(password !== undefined && password.trim() !== "")) return [3 /*break*/, 3];
                _b = user;
                return [4 /*yield*/, bcryptjs_1.default.hash(password, 12)];
            case 2:
                _b.passwordHash = _d.sent();
                _d.label = 3;
            case 3: return [4 /*yield*/, user.save()];
            case 4:
                _d.sent();
                auditLog = new models_1.AuditLog({
                    tenantId: user.tenantId,
                    userId: (_c = req.user) === null || _c === void 0 ? void 0 : _c.id,
                    action: "ADMIN_USER_UPDATE",
                    targetType: "User",
                    targetId: user._id.toString(),
                    changes: { before: before, after: user.toObject() }
                });
                return [4 /*yield*/, auditLog.save()];
            case 5:
                _d.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                res.json({ success: true, message: "User updated successfully", user: user });
                return [3 /*break*/, 7];
            case 6:
                error_2 = _d.sent();
                res.status(500).json({ error: error_2.message });
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/];
        }
    });
}); };
exports.updateUserInfo = updateUserInfo;
// 2. Toggle user active status
var toggleUserStatus = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, isActive, user, before, auditLog, error_3;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 4, , 5]);
                id = req.params.id;
                isActive = req.body.isActive;
                if (isActive === undefined) {
                    return [2 /*return*/, res.status(400).json({ error: "isActive is required" })];
                }
                return [4 /*yield*/, models_1.User.findById(id)];
            case 1:
                user = _b.sent();
                if (!user) {
                    return [2 /*return*/, res.status(404).json({ error: "User not found" })];
                }
                before = user.toObject();
                user.isActive = isActive;
                return [4 /*yield*/, user.save()];
            case 2:
                _b.sent();
                auditLog = new models_1.AuditLog({
                    tenantId: user.tenantId,
                    userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                    action: "ADMIN_USER_UPDATE",
                    targetType: "User",
                    targetId: user._id.toString(),
                    changes: { before: before, after: user.toObject() }
                });
                return [4 /*yield*/, auditLog.save()];
            case 3:
                _b.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                res.json({ success: true, message: "User status updated to ".concat(isActive ? "active" : "inactive") });
                return [3 /*break*/, 5];
            case 4:
                error_3 = _b.sent();
                res.status(500).json({ error: error_3.message });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.toggleUserStatus = toggleUserStatus;
// 3. Delete user
var deleteUser = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, user, before, tenantId, workers, workerIds, auditLog, error_4;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 15, , 16]);
                id = req.params.id;
                return [4 /*yield*/, models_1.User.findById(id)];
            case 1:
                user = _b.sent();
                if (!user) {
                    return [2 /*return*/, res.status(404).json({ error: "User not found" })];
                }
                before = user.toObject();
                tenantId = user.tenantId;
                if (!(user.role === "contractor" || user.role === "builder")) return [3 /*break*/, 11];
                return [4 /*yield*/, models_1.Worker.find({ tenantId: tenantId })];
            case 2:
                workers = _b.sent();
                workerIds = workers.map(function (w) { return w._id; });
                return [4 /*yield*/, models_1.Attendance.deleteMany({ tenantId: tenantId })];
            case 3:
                _b.sent();
                return [4 /*yield*/, models_1.Payment.deleteMany({ tenantId: tenantId })];
            case 4:
                _b.sent();
                return [4 /*yield*/, models_1.WageHistory.deleteMany({ tenantId: tenantId })];
            case 5:
                _b.sent();
                return [4 /*yield*/, models_1.Worker.deleteMany({ tenantId: tenantId })];
            case 6:
                _b.sent();
                return [4 /*yield*/, models_1.Project.deleteMany({ tenantId: tenantId })];
            case 7:
                _b.sent();
                return [4 /*yield*/, models_1.AuditLog.deleteMany({ tenantId: tenantId })];
            case 8:
                _b.sent();
                return [4 /*yield*/, models_1.User.deleteMany({ tenantId: tenantId })];
            case 9:
                _b.sent(); // deletes all users including supervisors
                return [4 /*yield*/, models_1.Tenant.findByIdAndDelete(tenantId)];
            case 10:
                _b.sent();
                return [3 /*break*/, 13];
            case 11: 
            // Supervisor-only delete: just remove the user record
            return [4 /*yield*/, models_1.User.findByIdAndDelete(id)];
            case 12:
                // Supervisor-only delete: just remove the user record
                _b.sent();
                _b.label = 13;
            case 13:
                auditLog = new models_1.AuditLog({
                    tenantId: tenantId,
                    userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                    action: "ADMIN_USER_DELETE",
                    targetType: "User",
                    targetId: id,
                    changes: { before: before }
                });
                return [4 /*yield*/, auditLog.save()];
            case 14:
                _b.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                res.json({ success: true, message: "User deleted successfully" });
                return [3 /*break*/, 16];
            case 15:
                error_4 = _b.sent();
                res.status(500).json({ error: error_4.message });
                return [3 /*break*/, 16];
            case 16: return [2 /*return*/];
        }
    });
}); };
exports.deleteUser = deleteUser;
// 4. Update tenant plan
var updateTenantPlan = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, _a, plan, durationDays, tenant, before, days, auditLog, error_5;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 4, , 5]);
                tenantId = req.params.tenantId;
                _a = req.body, plan = _a.plan, durationDays = _a.durationDays;
                if (!plan || !["free", "professional", "business"].includes(plan)) {
                    return [2 /*return*/, res.status(400).json({ error: "Invalid plan type" })];
                }
                return [4 /*yield*/, models_1.Tenant.findById(tenantId)];
            case 1:
                tenant = _c.sent();
                if (!tenant) {
                    return [2 /*return*/, res.status(404).json({ error: "Tenant not found" })];
                }
                before = tenant.toObject();
                tenant.plan = plan;
                if (plan !== "free") {
                    days = durationDays || 30;
                    tenant.planExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
                }
                else {
                    tenant.planExpiresAt = undefined;
                }
                return [4 /*yield*/, tenant.save()];
            case 2:
                _c.sent();
                auditLog = new models_1.AuditLog({
                    tenantId: tenant._id,
                    userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.id,
                    action: "PLAN_UPGRADE",
                    targetType: "Tenant",
                    targetId: tenant._id.toString(),
                    changes: { before: before, after: tenant.toObject() },
                });
                return [4 /*yield*/, auditLog.save()];
            case 3:
                _c.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                res.json({ success: true, message: "Tenant plan updated to ".concat(plan) });
                return [3 /*break*/, 5];
            case 4:
                error_5 = _c.sent();
                res.status(500).json({ error: error_5.message });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.updateTenantPlan = updateTenantPlan;
// 5. Get system metrics, charts datasets, and analytics
var getAdminAnalytics = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var totalUsers, count, activeUsers, inactiveUsers, totalContractors, totalBuilders, totalSupervisors, totalWorkers, totalAttendance, tenants, totalRevenue_1, freeCount_1, proCount_1, businessCount_1, tenantMap_1, allPayments, totalPayroll, activeWorkers, activeWorkerIds, allAttendance, attendanceMap_1, paymentsMap_1, outstandingAmount_1, workersByCategory_1, workersByCompany_1, startOfMonth_1, newWorkersThisMonth, today, currentYear, currentMonth, currentDay, todayAttendance, monthlyAttendance, monthAttendance, tenantAttendanceCount_1, topActiveCompanies, rawLogs, activityFeed, userGrowth, i, d, monthStart, monthEnd, count_1, revenueGrowth, _loop_1, i, attendanceBreakdown, payrollTrend, i, d, targetYear, targetMonth, targetPayments, amount, error_6;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 32, , 33]);
                return [4 /*yield*/, models_1.User.countDocuments({ role: { $ne: "admin" } })];
            case 1:
                totalUsers = _b.sent();
                count = totalUsers;
                console.log("Users Count:", count);
                return [4 /*yield*/, models_1.User.countDocuments({ role: { $ne: "admin" }, isActive: true })];
            case 2:
                activeUsers = _b.sent();
                return [4 /*yield*/, models_1.User.countDocuments({ role: { $ne: "admin" }, isActive: false })];
            case 3:
                inactiveUsers = _b.sent();
                return [4 /*yield*/, models_1.User.countDocuments({ role: "contractor" })];
            case 4:
                totalContractors = _b.sent();
                return [4 /*yield*/, models_1.User.countDocuments({ role: "builder" })];
            case 5:
                totalBuilders = _b.sent();
                return [4 /*yield*/, models_1.User.countDocuments({ role: "supervisor" })];
            case 6:
                totalSupervisors = _b.sent();
                return [4 /*yield*/, models_1.Worker.countDocuments({ isArchived: false })];
            case 7:
                totalWorkers = _b.sent();
                return [4 /*yield*/, models_1.Attendance.countDocuments()];
            case 8:
                totalAttendance = _b.sent();
                console.log("[Admin Audit Log] getAdminAnalytics: totalUsers:", totalUsers, "activeUsers:", activeUsers, "totalWorkers:", totalWorkers);
                return [4 /*yield*/, models_1.Tenant.find()];
            case 9:
                tenants = _b.sent();
                totalRevenue_1 = 0;
                freeCount_1 = 0;
                proCount_1 = 0;
                businessCount_1 = 0;
                tenantMap_1 = {};
                tenants.forEach(function (t) {
                    tenantMap_1[t._id.toString()] = t.name;
                    if (t.plan === "professional") {
                        proCount_1++;
                        totalRevenue_1 += 299;
                    }
                    else if (t.plan === "business") {
                        businessCount_1++;
                        totalRevenue_1 += 999;
                    }
                    else {
                        freeCount_1++;
                    }
                });
                return [4 /*yield*/, models_1.Payment.find()];
            case 10:
                allPayments = _b.sent();
                totalPayroll = allPayments.reduce(function (sum, p) { return sum + p.amount; }, 0);
                return [4 /*yield*/, models_1.Worker.find({ isArchived: false })];
            case 11:
                activeWorkers = _b.sent();
                activeWorkerIds = activeWorkers.map(function (w) { return w._id; });
                return [4 /*yield*/, models_1.Attendance.find({ workerId: { $in: activeWorkerIds } })];
            case 12:
                allAttendance = _b.sent();
                attendanceMap_1 = {};
                allAttendance.forEach(function (a) {
                    var wId = a.workerId.toString();
                    if (!attendanceMap_1[wId])
                        attendanceMap_1[wId] = [];
                    attendanceMap_1[wId].push(a);
                });
                paymentsMap_1 = {};
                allPayments.forEach(function (p) {
                    var wId = p.workerId.toString();
                    paymentsMap_1[wId] = (paymentsMap_1[wId] || 0) + p.amount;
                });
                outstandingAmount_1 = 0;
                activeWorkers.forEach(function (w) {
                    var wId = w._id.toString();
                    var records = attendanceMap_1[wId] || [];
                    var earnings = 0;
                    var advances = 0;
                    records.forEach(function (r) {
                        var rate = r.dailyRate !== undefined && r.dailyRate !== null ? r.dailyRate : w.dailyRate;
                        var extra = (r.customWage !== undefined && r.customWage !== null) ? r.customWage : 0;
                        var ot = (r.overtimeWage !== undefined && r.overtimeWage !== null) ? r.overtimeWage : 0;
                        var recordPay = 0;
                        if (r.value === "P" || r.value === "OT") {
                            recordPay = rate + extra + ot;
                        }
                        else if (r.value === "H") {
                            recordPay = (rate / 2) + extra + ot;
                        }
                        else if (r.value === "A") {
                            recordPay = 0;
                        }
                        else if (typeof r.value === "number") {
                            recordPay = r.value;
                        }
                        else {
                            recordPay = 0;
                        }
                        earnings += recordPay;
                        advances += extra;
                    });
                    var paid = paymentsMap_1[wId] || 0;
                    var balance = earnings - paid;
                    if (balance > 0) {
                        outstandingAmount_1 += balance;
                    }
                });
                workersByCategory_1 = {};
                workersByCompany_1 = {};
                activeWorkers.forEach(function (w) {
                    var cat = w.category || "Other";
                    workersByCategory_1[cat] = (workersByCategory_1[cat] || 0) + 1;
                    var comp = tenantMap_1[w.tenantId.toString()] || "Unknown Company";
                    workersByCompany_1[comp] = (workersByCompany_1[comp] || 0) + 1;
                });
                startOfMonth_1 = new Date();
                startOfMonth_1.setDate(1);
                startOfMonth_1.setHours(0, 0, 0, 0);
                newWorkersThisMonth = activeWorkers.filter(function (w) { return w.createdAt >= startOfMonth_1; }).length;
                today = new Date();
                currentYear = today.getFullYear();
                currentMonth = today.getMonth();
                currentDay = today.getDate();
                return [4 /*yield*/, models_1.Attendance.countDocuments({ year: currentYear, month: currentMonth, day: currentDay })];
            case 13:
                todayAttendance = _b.sent();
                return [4 /*yield*/, models_1.Attendance.countDocuments({ year: currentYear, month: currentMonth })];
            case 14:
                monthlyAttendance = _b.sent();
                return [4 /*yield*/, models_1.Attendance.find({ year: currentYear, month: currentMonth })];
            case 15:
                monthAttendance = _b.sent();
                tenantAttendanceCount_1 = {};
                monthAttendance.forEach(function (a) {
                    var tId = a.tenantId.toString();
                    tenantAttendanceCount_1[tId] = (tenantAttendanceCount_1[tId] || 0) + 1;
                });
                topActiveCompanies = Object.entries(tenantAttendanceCount_1)
                    .map(function (_a) {
                    var tenantId = _a[0], count = _a[1];
                    return ({
                        companyName: tenantMap_1[tenantId] || "Unknown Company",
                        attendanceCount: count,
                    });
                })
                    .sort(function (a, b) { return b.attendanceCount - a.attendanceCount; })
                    .slice(0, 5);
                return [4 /*yield*/, models_1.AuditLog.find()
                        .sort({ timestamp: -1 })
                        .limit(20)
                        .populate("userId", "name role")
                        .populate("tenantId", "name")];
            case 16:
                rawLogs = _b.sent();
                activityFeed = rawLogs.map(function (log) { return ({
                    id: log._id.toString(),
                    message: formatAuditLog(log),
                    timestamp: log.timestamp,
                }); });
                userGrowth = [];
                i = 5;
                _b.label = 17;
            case 17:
                if (!(i >= 0)) return [3 /*break*/, 20];
                d = new Date();
                d.setMonth(d.getMonth() - i);
                monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
                monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
                return [4 /*yield*/, models_1.User.countDocuments({
                        role: { $ne: "admin" },
                        createdAt: { $gte: monthStart, $lte: monthEnd }
                    })];
            case 18:
                count_1 = _b.sent();
                userGrowth.push({
                    month: d.toLocaleString("default", { month: "short" }),
                    count: count_1
                });
                _b.label = 19;
            case 19:
                i--;
                return [3 /*break*/, 17];
            case 20:
                revenueGrowth = [];
                _loop_1 = function (i) {
                    var d, monthEnd, activeTenants, monthlyRevenue;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                d = new Date();
                                d.setMonth(d.getMonth() - i);
                                monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
                                return [4 /*yield*/, models_1.Tenant.find({ createdAt: { $lte: monthEnd } })];
                            case 1:
                                activeTenants = _c.sent();
                                monthlyRevenue = 0;
                                activeTenants.forEach(function (t) {
                                    if (t.plan === "professional")
                                        monthlyRevenue += 299;
                                    else if (t.plan === "business")
                                        monthlyRevenue += 999;
                                });
                                revenueGrowth.push({
                                    month: d.toLocaleString("default", { month: "short" }),
                                    amount: monthlyRevenue
                                });
                                return [2 /*return*/];
                        }
                    });
                };
                i = 5;
                _b.label = 21;
            case 21:
                if (!(i >= 0)) return [3 /*break*/, 24];
                return [5 /*yield**/, _loop_1(i)];
            case 22:
                _b.sent();
                _b.label = 23;
            case 23:
                i--;
                return [3 /*break*/, 21];
            case 24:
                _a = {};
                return [4 /*yield*/, models_1.Attendance.countDocuments({ year: currentYear, month: currentMonth, value: "P" })];
            case 25:
                _a.present = _b.sent();
                return [4 /*yield*/, models_1.Attendance.countDocuments({ year: currentYear, month: currentMonth, value: "A" })];
            case 26:
                _a.absent = _b.sent();
                return [4 /*yield*/, models_1.Attendance.countDocuments({ year: currentYear, month: currentMonth, value: "H" })];
            case 27:
                attendanceBreakdown = (_a.halfDay = _b.sent(),
                    _a);
                payrollTrend = [];
                i = 5;
                _b.label = 28;
            case 28:
                if (!(i >= 0)) return [3 /*break*/, 31];
                d = new Date();
                d.setMonth(d.getMonth() - i);
                targetYear = d.getFullYear();
                targetMonth = d.getMonth();
                return [4 /*yield*/, models_1.Payment.find({ year: targetYear, month: targetMonth })];
            case 29:
                targetPayments = _b.sent();
                amount = targetPayments.reduce(function (sum, p) { return sum + p.amount; }, 0);
                payrollTrend.push({
                    month: d.toLocaleString("default", { month: "short" }),
                    amount: amount
                });
                _b.label = 30;
            case 30:
                i--;
                return [3 /*break*/, 28];
            case 31:
                res.json({
                    metrics: {
                        totalUsers: totalUsers,
                        activeUsers: activeUsers,
                        inactiveUsers: inactiveUsers,
                        totalContractors: totalContractors,
                        totalBuilders: totalBuilders,
                        totalSupervisors: totalSupervisors,
                        totalWorkers: totalWorkers,
                        totalAttendance: totalAttendance,
                        totalRevenue: totalRevenue_1,
                        totalPayroll: totalPayroll,
                        outstandingAmount: outstandingAmount_1,
                    },
                    plans: {
                        free: freeCount_1,
                        professional: proCount_1,
                        business: businessCount_1,
                    },
                    analytics: {
                        workersByCategory: workersByCategory_1,
                        workersByCompany: workersByCompany_1,
                        newWorkersThisMonth: newWorkersThisMonth,
                        todayAttendance: todayAttendance,
                        monthlyAttendance: monthlyAttendance,
                        topActiveCompanies: topActiveCompanies,
                        userGrowth: userGrowth,
                        revenueGrowth: revenueGrowth,
                        attendanceBreakdown: attendanceBreakdown,
                        payrollTrend: payrollTrend,
                    },
                    activityFeed: activityFeed,
                });
                return [3 /*break*/, 33];
            case 32:
                error_6 = _b.sent();
                res.status(500).json({ error: error_6.message });
                return [3 /*break*/, 33];
            case 33: return [2 /*return*/];
        }
    });
}); };
exports.getAdminAnalytics = getAdminAnalytics;
// 6. Worker Control (Admin Panel)
var getAllWorkers = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var workers, error_7;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, models_1.Worker.find()
                        .populate("tenantId", "name")
                        .sort({ createdAt: -1 })];
            case 1:
                workers = _a.sent();
                res.json(workers);
                return [3 /*break*/, 3];
            case 2:
                error_7 = _a.sent();
                res.status(500).json({ error: error_7.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getAllWorkers = getAllWorkers;
var updateWorkerInfo = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, _a, name, category, dailyRate, phone, address, notes, isArchived, worker, before, auditLog, error_8;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 4, , 5]);
                id = req.params.id;
                _a = req.body, name = _a.name, category = _a.category, dailyRate = _a.dailyRate, phone = _a.phone, address = _a.address, notes = _a.notes, isArchived = _a.isArchived;
                return [4 /*yield*/, models_1.Worker.findById(id)];
            case 1:
                worker = _c.sent();
                if (!worker) {
                    return [2 /*return*/, res.status(404).json({ error: "Worker not found" })];
                }
                before = worker.toObject();
                if (name !== undefined)
                    worker.name = name;
                if (category !== undefined)
                    worker.category = category;
                if (dailyRate !== undefined)
                    worker.dailyRate = dailyRate;
                if (phone !== undefined)
                    worker.phone = phone;
                if (address !== undefined)
                    worker.address = address;
                if (notes !== undefined)
                    worker.notes = notes;
                if (isArchived !== undefined)
                    worker.isArchived = isArchived;
                return [4 /*yield*/, worker.save()];
            case 2:
                _c.sent();
                auditLog = new models_1.AuditLog({
                    tenantId: worker.tenantId,
                    userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.id,
                    action: "ADMIN_WORKER_UPDATE",
                    targetType: "Worker",
                    targetId: worker._id.toString(),
                    changes: { before: before, after: worker.toObject() }
                });
                return [4 /*yield*/, auditLog.save()];
            case 3:
                _c.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                res.json({ success: true, message: "Worker updated successfully", worker: worker });
                return [3 /*break*/, 5];
            case 4:
                error_8 = _c.sent();
                res.status(500).json({ error: error_8.message });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.updateWorkerInfo = updateWorkerInfo;
var deleteWorkerAdmin = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, worker, before, auditLog, error_9;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 7, , 8]);
                id = req.params.id;
                return [4 /*yield*/, models_1.Worker.findById(id)];
            case 1:
                worker = _b.sent();
                if (!worker) {
                    return [2 /*return*/, res.status(404).json({ error: "Worker not found" })];
                }
                before = worker.toObject();
                // Cascading delete: remove all related records
                console.log("[Admin Delete Worker] Cascading delete of associated records for worker: ".concat(id));
                return [4 /*yield*/, models_1.Attendance.deleteMany({ workerId: id })];
            case 2:
                _b.sent();
                return [4 /*yield*/, models_1.Payment.deleteMany({ workerId: id })];
            case 3:
                _b.sent();
                return [4 /*yield*/, models_1.WageHistory.deleteMany({ workerId: id })];
            case 4:
                _b.sent();
                return [4 /*yield*/, models_1.Worker.findByIdAndDelete(id)];
            case 5:
                _b.sent();
                auditLog = new models_1.AuditLog({
                    tenantId: worker.tenantId,
                    userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                    action: "ADMIN_WORKER_DELETE",
                    targetType: "Worker",
                    targetId: id,
                    changes: { before: before }
                });
                return [4 /*yield*/, auditLog.save()];
            case 6:
                _b.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                res.json({ success: true, message: "Worker deleted successfully" });
                return [3 /*break*/, 8];
            case 7:
                error_9 = _b.sent();
                res.status(500).json({ error: error_9.message });
                return [3 /*break*/, 8];
            case 8: return [2 /*return*/];
        }
    });
}); };
exports.deleteWorkerAdmin = deleteWorkerAdmin;
// 7. Attendance Control (Admin Panel)
var getAllAttendance = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var attendance, error_10;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, models_1.Attendance.find()
                        .populate("tenantId", "name")
                        .populate("workerId", "name")
                        .sort({ timestamp: -1 })
                        .limit(500)];
            case 1:
                attendance = _a.sent();
                res.json(attendance);
                return [3 /*break*/, 3];
            case 2:
                error_10 = _a.sent();
                res.status(500).json({ error: error_10.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getAllAttendance = getAllAttendance;
var updateAttendanceAdmin = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, value, attendance, before, auditLog, error_11;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 4, , 5]);
                id = req.params.id;
                value = req.body.value;
                return [4 /*yield*/, models_1.Attendance.findById(id)];
            case 1:
                attendance = _b.sent();
                if (!attendance) {
                    return [2 /*return*/, res.status(404).json({ error: "Attendance record not found" })];
                }
                before = attendance.toObject();
                attendance.value = value;
                return [4 /*yield*/, attendance.save()];
            case 2:
                _b.sent();
                auditLog = new models_1.AuditLog({
                    tenantId: attendance.tenantId,
                    userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                    action: "ADMIN_ATTENDANCE_UPDATE",
                    targetType: "Attendance",
                    targetId: attendance._id.toString(),
                    changes: { before: before, after: attendance.toObject() }
                });
                return [4 /*yield*/, auditLog.save()];
            case 3:
                _b.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                res.json({ success: true, message: "Attendance record updated successfully", attendance: attendance });
                return [3 /*break*/, 5];
            case 4:
                error_11 = _b.sent();
                res.status(500).json({ error: error_11.message });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.updateAttendanceAdmin = updateAttendanceAdmin;
var deleteAttendanceAdmin = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, attendance, before, auditLog, error_12;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 4, , 5]);
                id = req.params.id;
                return [4 /*yield*/, models_1.Attendance.findById(id)];
            case 1:
                attendance = _b.sent();
                if (!attendance) {
                    return [2 /*return*/, res.status(404).json({ error: "Attendance record not found" })];
                }
                before = attendance.toObject();
                return [4 /*yield*/, models_1.Attendance.findByIdAndDelete(id)];
            case 2:
                _b.sent();
                auditLog = new models_1.AuditLog({
                    tenantId: attendance.tenantId,
                    userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                    action: "ADMIN_ATTENDANCE_DELETE",
                    targetType: "Attendance",
                    targetId: id,
                    changes: { before: before }
                });
                return [4 /*yield*/, auditLog.save()];
            case 3:
                _b.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                res.json({ success: true, message: "Attendance record deleted successfully" });
                return [3 /*break*/, 5];
            case 4:
                error_12 = _b.sent();
                res.status(500).json({ error: error_12.message });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.deleteAttendanceAdmin = deleteAttendanceAdmin;
// 8. Payment Control (Admin Panel)
var getAllPayments = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var payments, error_13;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, models_1.Payment.find()
                        .populate("tenantId", "name")
                        .populate("workerId", "name")
                        .sort({ paidAt: -1 })];
            case 1:
                payments = _a.sent();
                res.json(payments);
                return [3 /*break*/, 3];
            case 2:
                error_13 = _a.sent();
                res.status(500).json({ error: error_13.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getAllPayments = getAllPayments;
var updatePaymentAdmin = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, _a, amount, note, year, month, payment, before, auditLog, error_14;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 4, , 5]);
                id = req.params.id;
                _a = req.body, amount = _a.amount, note = _a.note, year = _a.year, month = _a.month;
                return [4 /*yield*/, models_1.Payment.findById(id)];
            case 1:
                payment = _c.sent();
                if (!payment) {
                    return [2 /*return*/, res.status(404).json({ error: "Payment record not found" })];
                }
                before = payment.toObject();
                if (amount !== undefined)
                    payment.amount = amount;
                if (note !== undefined)
                    payment.note = note;
                if (year !== undefined)
                    payment.year = year;
                if (month !== undefined)
                    payment.month = month;
                return [4 /*yield*/, payment.save()];
            case 2:
                _c.sent();
                auditLog = new models_1.AuditLog({
                    tenantId: payment.tenantId,
                    userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.id,
                    action: "ADMIN_PAYMENT_UPDATE",
                    targetType: "Payment",
                    targetId: payment._id.toString(),
                    changes: { before: before, after: payment.toObject() }
                });
                return [4 /*yield*/, auditLog.save()];
            case 3:
                _c.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                res.json({ success: true, message: "Payment record updated successfully", payment: payment });
                return [3 /*break*/, 5];
            case 4:
                error_14 = _c.sent();
                res.status(500).json({ error: error_14.message });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.updatePaymentAdmin = updatePaymentAdmin;
var deletePaymentAdmin = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, payment, before, auditLog, error_15;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 4, , 5]);
                id = req.params.id;
                return [4 /*yield*/, models_1.Payment.findById(id)];
            case 1:
                payment = _b.sent();
                if (!payment) {
                    return [2 /*return*/, res.status(404).json({ error: "Payment record not found" })];
                }
                before = payment.toObject();
                return [4 /*yield*/, models_1.Payment.findByIdAndDelete(id)];
            case 2:
                _b.sent();
                auditLog = new models_1.AuditLog({
                    tenantId: payment.tenantId,
                    userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
                    action: "ADMIN_PAYMENT_DELETE",
                    targetType: "Payment",
                    targetId: id,
                    changes: { before: before }
                });
                return [4 /*yield*/, auditLog.save()];
            case 3:
                _b.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                res.json({ success: true, message: "Payment record deleted successfully" });
                return [3 /*break*/, 5];
            case 4:
                error_15 = _b.sent();
                res.status(500).json({ error: error_15.message });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.deletePaymentAdmin = deletePaymentAdmin;
var getAllProblemsAdmin = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, startDate, endDate, query, problems, error_16;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                _a = req.query, startDate = _a.startDate, endDate = _a.endDate;
                query = {};
                if (startDate || endDate) {
                    query.createdAt = {};
                    if (startDate) {
                        query.createdAt.$gte = new Date(startDate);
                    }
                    if (endDate) {
                        query.createdAt.$lte = new Date(endDate);
                    }
                }
                return [4 /*yield*/, models_1.SupportProblem.find(query).sort({ createdAt: -1 })];
            case 1:
                problems = _b.sent();
                res.json(problems);
                return [3 /*break*/, 3];
            case 2:
                error_16 = _b.sent();
                res.status(500).json({ error: error_16.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getAllProblemsAdmin = getAllProblemsAdmin;
var resolveProblemAdmin = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, problem, error_17;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                id = req.params.id;
                return [4 /*yield*/, models_1.SupportProblem.findByIdAndUpdate(id, { status: "resolved" }, { new: true })];
            case 1:
                problem = _a.sent();
                if (!problem) {
                    return [2 /*return*/, res.status(404).json({ error: "Problem report not found" })];
                }
                (0, socket_1.broadcastAdminActivity)({ action: "ADMIN_RESOLVE_PROBLEM" });
                res.json({ success: true, problem: problem });
                return [3 /*break*/, 3];
            case 2:
                error_17 = _a.sent();
                res.status(500).json({ error: error_17.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.resolveProblemAdmin = resolveProblemAdmin;
var deleteProblemAdmin = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, problem, error_18;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                id = req.params.id;
                return [4 /*yield*/, models_1.SupportProblem.findByIdAndDelete(id)];
            case 1:
                problem = _a.sent();
                if (!problem) {
                    return [2 /*return*/, res.status(404).json({ error: "Problem report not found" })];
                }
                (0, socket_1.broadcastAdminActivity)({ action: "ADMIN_DELETE_PROBLEM" });
                res.json({ success: true });
                return [3 /*break*/, 3];
            case 2:
                error_18 = _a.sent();
                res.status(500).json({ error: error_18.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.deleteProblemAdmin = deleteProblemAdmin;
var getAllFeedbackAdmin = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, startDate, endDate, rating, query, feedbacks, error_19;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                _a = req.query, startDate = _a.startDate, endDate = _a.endDate, rating = _a.rating;
                query = {};
                if (startDate || endDate) {
                    query.createdAt = {};
                    if (startDate) {
                        query.createdAt.$gte = new Date(startDate);
                    }
                    if (endDate) {
                        query.createdAt.$lte = new Date(endDate);
                    }
                }
                if (rating) {
                    query.rating = Number(rating);
                }
                return [4 /*yield*/, models_1.SupportFeedback.find(query).sort({ createdAt: -1 })];
            case 1:
                feedbacks = _b.sent();
                res.json(feedbacks);
                return [3 /*break*/, 3];
            case 2:
                error_19 = _b.sent();
                res.status(500).json({ error: error_19.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getAllFeedbackAdmin = getAllFeedbackAdmin;
var deleteFeedbackAdmin = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var id, feedback, error_20;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                id = req.params.id;
                return [4 /*yield*/, models_1.SupportFeedback.findByIdAndDelete(id)];
            case 1:
                feedback = _a.sent();
                if (!feedback) {
                    return [2 /*return*/, res.status(404).json({ error: "Feedback not found" })];
                }
                (0, socket_1.broadcastAdminActivity)({ action: "ADMIN_DELETE_FEEDBACK" });
                res.json({ success: true });
                return [3 /*break*/, 3];
            case 2:
                error_20 = _a.sent();
                res.status(500).json({ error: error_20.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.deleteFeedbackAdmin = deleteFeedbackAdmin;
// ─── ADMIN SECURITY CONTROLLERS ──────────────────────────────────────────────
// 1. Get all security logs aggregated
var getSecurityLogs = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var users, logs_1, error_21;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, models_1.User.find({ role: { $ne: "admin" } }).select("name phone securityLogs")];
            case 1:
                users = _a.sent();
                logs_1 = [];
                users.forEach(function (user) {
                    if (user.securityLogs && user.securityLogs.length > 0) {
                        user.securityLogs.forEach(function (log) {
                            logs_1.push({
                                userId: user._id,
                                userName: user.name,
                                userPhone: user.phone,
                                timestamp: log.timestamp,
                                eventType: log.eventType,
                                details: log.details,
                                ipAddress: log.ipAddress || "Unknown",
                                deviceId: log.deviceId || "Unknown"
                            });
                        });
                    }
                });
                // Sort by timestamp descending
                logs_1.sort(function (a, b) { return b.timestamp.getTime() - a.timestamp.getTime(); });
                res.json(logs_1);
                return [3 /*break*/, 3];
            case 2:
                error_21 = _a.sent();
                res.status(500).json({ error: error_21.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getSecurityLogs = getSecurityLogs;
// 2. Get all active user sessions
var getActiveSessions = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var users, sessions_1, error_22;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, models_1.User.find({ role: { $ne: "admin" } }).select("name phone trustedDevices otpEnabled biometricEnabled")];
            case 1:
                users = _a.sent();
                sessions_1 = [];
                users.forEach(function (user) {
                    if (user.trustedDevices && user.trustedDevices.length > 0) {
                        user.trustedDevices.forEach(function (device) {
                            sessions_1.push({
                                userId: user._id,
                                userName: user.name,
                                userPhone: user.phone,
                                otpEnabled: user.otpEnabled || false,
                                biometricEnabled: user.biometricEnabled || false,
                                deviceId: device.deviceId,
                                deviceName: device.deviceName,
                                deviceOs: device.deviceOs || "Unknown",
                                deviceBrowser: device.deviceBrowser || "Unknown",
                                ipAddress: device.ipAddress || "Unknown",
                                location: device.location || "Unknown",
                                lastActiveAt: device.lastActiveAt,
                                isSuspicious: device.isSuspicious || false
                            });
                        });
                    }
                });
                // Sort by last active desc
                sessions_1.sort(function (a, b) { return b.lastActiveAt.getTime() - a.lastActiveAt.getTime(); });
                res.json(sessions_1);
                return [3 /*break*/, 3];
            case 2:
                error_22 = _a.sent();
                res.status(500).json({ error: error_22.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getActiveSessions = getActiveSessions;
// 3. Force logout user (revokes all sessions)
var forceLogoutUser = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, user, error_23;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                userId = req.body.userId;
                if (!userId) {
                    return [2 /*return*/, res.status(400).json({ error: "User ID is required" })];
                }
                return [4 /*yield*/, models_1.User.findById(userId)];
            case 1:
                user = _a.sent();
                if (!user) {
                    return [2 /*return*/, res.status(404).json({ error: "User not found" })];
                }
                user.refreshTokens = [];
                user.trustedDevices = [];
                if (user.loginHistory) {
                    user.loginHistory.forEach(function (h) {
                        if (!h.logoutTime)
                            h.logoutTime = new Date();
                    });
                }
                if (!user.securityLogs)
                    user.securityLogs = [];
                user.securityLogs.push({
                    timestamp: new Date(),
                    eventType: "ADMIN_FORCE_LOGOUT",
                    details: "Force logged out by Administrator",
                    ipAddress: req.ip || "Admin Portal"
                });
                return [4 /*yield*/, user.save()];
            case 2:
                _a.sent();
                (0, socket_1.broadcastAdminActivity)({ action: "ADMIN_FORCE_LOGOUT", userId: userId });
                res.json({ success: true, message: "Successfully force logged out user ".concat(user.name) });
                return [3 /*break*/, 4];
            case 3:
                error_23 = _a.sent();
                res.status(500).json({ error: error_23.message });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.forceLogoutUser = forceLogoutUser;
// 4. Disable Suspicious Device
var disableSuspiciousDevice = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, userId, deviceId_1, user, active, error_24;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 4]);
                _a = req.body, userId = _a.userId, deviceId_1 = _a.deviceId;
                if (!userId || !deviceId_1) {
                    return [2 /*return*/, res.status(400).json({ error: "User ID and Device ID are required" })];
                }
                return [4 /*yield*/, models_1.User.findById(userId)];
            case 1:
                user = _b.sent();
                if (!user) {
                    return [2 /*return*/, res.status(404).json({ error: "User not found" })];
                }
                // Mark as suspicious/suspended or remove
                if (user.trustedDevices) {
                    user.trustedDevices = user.trustedDevices.filter(function (d) { return d.deviceId !== deviceId_1; });
                }
                if (user.loginHistory) {
                    active = user.loginHistory.filter(function (h) { return h.deviceId === deviceId_1 && !h.logoutTime; });
                    active.forEach(function (a) {
                        a.logoutTime = new Date();
                    });
                }
                if (!user.securityLogs)
                    user.securityLogs = [];
                user.securityLogs.push({
                    timestamp: new Date(),
                    eventType: "SUSPICIOUS_DEVICE_BLOCKED",
                    details: "Device suspended by Administrator. Device ID: ".concat(deviceId_1),
                    ipAddress: req.ip || "Admin Portal",
                    deviceId: deviceId_1
                });
                return [4 /*yield*/, user.save()];
            case 2:
                _b.sent();
                (0, socket_1.broadcastAdminActivity)({ action: "ADMIN_DISABLE_DEVICE", userId: userId, deviceId: deviceId_1 });
                res.json({ success: true, message: "Device successfully suspended and session revoked." });
                return [3 /*break*/, 4];
            case 3:
                error_24 = _b.sent();
                res.status(500).json({ error: error_24.message });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.disableSuspiciousDevice = disableSuspiciousDevice;
