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
exports.deleteWorker = exports.updateWorker = exports.addWorker = exports.getWorkers = void 0;
var models_1 = require("../models");
var socket_1 = require("../utils/socket");
var getWorkers = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, userId, role, query, supervisor, assignedProjects, workers, error_1;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 5, , 6]);
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
                role = (_c = req.user) === null || _c === void 0 ? void 0 : _c.role;
                query = { tenantId: tenantId, isArchived: false };
                if (!(role === "supervisor")) return [3 /*break*/, 2];
                return [4 /*yield*/, models_1.User.findById(userId)];
            case 1:
                supervisor = _d.sent();
                assignedProjects = (supervisor === null || supervisor === void 0 ? void 0 : supervisor.assignedProjects) || [];
                query.projectId = { $in: assignedProjects };
                return [3 /*break*/, 3];
            case 2:
                if (req.query.projectId) {
                    query.projectId = req.query.projectId;
                }
                _d.label = 3;
            case 3: return [4 /*yield*/, models_1.Worker.find(query)];
            case 4:
                workers = _d.sent();
                res.json(workers);
                return [3 /*break*/, 6];
            case 5:
                error_1 = _d.sent();
                res.status(500).json({ error: error_1.message });
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); };
exports.getWorkers = getWorkers;
var addWorker = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, userId, _a, name, category, dailyRate, phone, address, notes, photoUri, projectId, worker, wageHistory, auditLog, error_2;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 4, , 5]);
                tenantId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.tenantId;
                userId = (_c = req.user) === null || _c === void 0 ? void 0 : _c.id;
                _a = req.body, name = _a.name, category = _a.category, dailyRate = _a.dailyRate, phone = _a.phone, address = _a.address, notes = _a.notes, photoUri = _a.photoUri, projectId = _a.projectId;
                if (!name || !category || dailyRate === undefined) {
                    return [2 /*return*/, res.status(400).json({ error: "Missing required fields" })];
                }
                worker = new models_1.Worker({
                    tenantId: tenantId,
                    projectId: projectId,
                    name: name,
                    category: category,
                    dailyRate: dailyRate,
                    phone: phone,
                    address: address,
                    notes: notes,
                    photoUri: photoUri,
                });
                return [4 /*yield*/, worker.save()];
            case 1:
                _d.sent();
                wageHistory = new models_1.WageHistory({
                    tenantId: tenantId,
                    workerId: worker._id,
                    dailyRate: dailyRate,
                    startDate: new Date(),
                    updatedBy: userId,
                });
                return [4 /*yield*/, wageHistory.save()];
            case 2:
                _d.sent();
                auditLog = new models_1.AuditLog({
                    tenantId: tenantId,
                    userId: userId,
                    action: "CREATE",
                    targetType: "WORKER",
                    targetId: worker._id.toString(),
                    changes: { after: worker.toObject() },
                });
                return [4 /*yield*/, auditLog.save()];
            case 3:
                _d.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                res.status(201).json(worker);
                return [3 /*break*/, 5];
            case 4:
                error_2 = _d.sent();
                res.status(500).json({ error: error_2.message });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.addWorker = addWorker;
var updateWorker = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, userId, id, _a, name, category, dailyRate, phone, address, notes, photoUri, projectId, worker, before, wageHistory, auditLog, error_3;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 7, , 8]);
                tenantId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.tenantId;
                userId = (_c = req.user) === null || _c === void 0 ? void 0 : _c.id;
                id = req.params.id;
                _a = req.body, name = _a.name, category = _a.category, dailyRate = _a.dailyRate, phone = _a.phone, address = _a.address, notes = _a.notes, photoUri = _a.photoUri, projectId = _a.projectId;
                return [4 /*yield*/, models_1.Worker.findOne({ _id: id, tenantId: tenantId })];
            case 1:
                worker = _d.sent();
                if (!worker) {
                    return [2 /*return*/, res.status(404).json({ error: "Worker not found" })];
                }
                before = worker.toObject();
                if (!(dailyRate !== undefined && dailyRate !== worker.dailyRate)) return [3 /*break*/, 4];
                return [4 /*yield*/, models_1.WageHistory.findOneAndUpdate({ tenantId: tenantId, workerId: worker._id, endDate: { $exists: false } }, { endDate: new Date() })];
            case 2:
                _d.sent();
                wageHistory = new models_1.WageHistory({
                    tenantId: tenantId,
                    workerId: worker._id,
                    dailyRate: dailyRate,
                    startDate: new Date(),
                    updatedBy: userId,
                });
                return [4 /*yield*/, wageHistory.save()];
            case 3:
                _d.sent();
                worker.dailyRate = dailyRate;
                _d.label = 4;
            case 4:
                if (name)
                    worker.name = name;
                if (category)
                    worker.category = category;
                if (phone !== undefined)
                    worker.phone = phone;
                if (address !== undefined)
                    worker.address = address;
                if (notes !== undefined)
                    worker.notes = notes;
                if (photoUri !== undefined)
                    worker.photoUri = photoUri;
                if (projectId !== undefined)
                    worker.projectId = projectId;
                return [4 /*yield*/, worker.save()];
            case 5:
                _d.sent();
                auditLog = new models_1.AuditLog({
                    tenantId: tenantId,
                    userId: userId,
                    action: "UPDATE",
                    targetType: "WORKER",
                    targetId: worker._id.toString(),
                    changes: { before: before, after: worker.toObject() },
                });
                return [4 /*yield*/, auditLog.save()];
            case 6:
                _d.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                res.json(worker);
                return [3 /*break*/, 8];
            case 7:
                error_3 = _d.sent();
                res.status(500).json({ error: error_3.message });
                return [3 /*break*/, 8];
            case 8: return [2 /*return*/];
        }
    });
}); };
exports.updateWorker = updateWorker;
var deleteWorker = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, userId, id, worker, before, auditLog, error_4;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 4, , 5]);
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
                id = req.params.id;
                return [4 /*yield*/, models_1.Worker.findOne({ _id: id, tenantId: tenantId })];
            case 1:
                worker = _c.sent();
                if (!worker) {
                    return [2 /*return*/, res.status(404).json({ error: "Worker not found" })];
                }
                before = worker.toObject();
                worker.isArchived = true;
                return [4 /*yield*/, worker.save()];
            case 2:
                _c.sent();
                auditLog = new models_1.AuditLog({
                    tenantId: tenantId,
                    userId: userId,
                    action: "SOFT_DELETE",
                    targetType: "WORKER",
                    targetId: worker._id.toString(),
                    changes: { before: before, after: worker.toObject() },
                });
                return [4 /*yield*/, auditLog.save()];
            case 3:
                _c.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                res.json({ success: true, message: "Worker soft deleted successfully" });
                return [3 /*break*/, 5];
            case 4:
                error_4 = _c.sent();
                res.status(500).json({ error: error_4.message });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.deleteWorker = deleteWorker;
