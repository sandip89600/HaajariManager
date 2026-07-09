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
exports.deletePayment = exports.addPayment = exports.getPaymentsForMonth = void 0;
var models_1 = require("../models");
var socket_1 = require("../utils/socket");
var getPaymentsForMonth = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, _a, year, month, payments, error_1;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 2, , 3]);
                tenantId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.tenantId;
                _a = req.query, year = _a.year, month = _a.month;
                if (!year || !month) {
                    return [2 /*return*/, res.status(400).json({ error: "Missing year or month parameters" })];
                }
                return [4 /*yield*/, models_1.Payment.find({
                        tenantId: tenantId,
                        year: parseInt(year),
                        month: parseInt(month),
                    }).populate("createdBy", "name")];
            case 1:
                payments = _c.sent();
                res.json(payments);
                return [3 /*break*/, 3];
            case 2:
                error_1 = _c.sent();
                res.status(500).json({ error: error_1.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getPaymentsForMonth = getPaymentsForMonth;
var addPayment = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, userId, _a, workerId, year, month, amount, note, method, payment, auditLog, error_2;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 4, , 5]);
                tenantId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.tenantId;
                userId = (_c = req.user) === null || _c === void 0 ? void 0 : _c.id;
                _a = req.body, workerId = _a.workerId, year = _a.year, month = _a.month, amount = _a.amount, note = _a.note, method = _a.method;
                if (!workerId || year === undefined || month === undefined || amount === undefined) {
                    return [2 /*return*/, res.status(400).json({ error: "Missing required fields" })];
                }
                payment = new models_1.Payment({
                    tenantId: tenantId,
                    workerId: workerId,
                    year: year,
                    month: month,
                    amount: amount,
                    note: note,
                    method: method || "Cash",
                    createdBy: userId,
                });
                return [4 /*yield*/, payment.save()];
            case 1:
                _d.sent();
                return [4 /*yield*/, payment.populate("createdBy", "name")];
            case 2:
                _d.sent();
                auditLog = new models_1.AuditLog({
                    tenantId: tenantId,
                    userId: userId,
                    action: "CREATE",
                    targetType: "PAYMENT",
                    targetId: payment._id.toString(),
                    changes: { after: payment.toObject() },
                });
                return [4 /*yield*/, auditLog.save()];
            case 3:
                _d.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                res.status(201).json(payment);
                return [3 /*break*/, 5];
            case 4:
                error_2 = _d.sent();
                res.status(500).json({ error: error_2.message });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.addPayment = addPayment;
var deletePayment = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, userId, id, payment, before, auditLog, error_3;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 4, , 5]);
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
                id = req.params.id;
                return [4 /*yield*/, models_1.Payment.findOne({ _id: id, tenantId: tenantId })];
            case 1:
                payment = _c.sent();
                if (!payment) {
                    return [2 /*return*/, res.status(404).json({ error: "Payment record not found" })];
                }
                before = payment.toObject();
                return [4 /*yield*/, models_1.Payment.deleteOne({ _id: id, tenantId: tenantId })];
            case 2:
                _c.sent();
                auditLog = new models_1.AuditLog({
                    tenantId: tenantId,
                    userId: userId,
                    action: "DELETE",
                    targetType: "PAYMENT",
                    targetId: id,
                    changes: { before: before },
                });
                return [4 /*yield*/, auditLog.save()];
            case 3:
                _c.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                res.json({ success: true, message: "Payment record deleted successfully" });
                return [3 /*break*/, 5];
            case 4:
                error_3 = _c.sent();
                res.status(500).json({ error: error_3.message });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.deletePayment = deletePayment;
