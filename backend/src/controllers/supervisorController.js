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
exports.deleteSupervisor = exports.updateSupervisor = exports.createSupervisor = exports.getSupervisors = void 0;
var bcryptjs_1 = require("bcryptjs");
var models_1 = require("../models");
var socket_1 = require("../utils/socket");
var getSupervisors = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, supervisors, error_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                return [4 /*yield*/, models_1.User.find({ tenantId: tenantId, role: "supervisor" })
                        .populate("assignedProjects")
                        .select("-passwordHash -refreshTokens")];
            case 1:
                supervisors = _b.sent();
                res.json(supervisors);
                return [3 /*break*/, 3];
            case 2:
                error_1 = _b.sent();
                res.status(500).json({ error: error_1.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getSupervisors = getSupervisors;
var createSupervisor = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, _a, name, phone, password, assignedProjects, phoneTrimmed, existingUser, passwordHash, supervisor, auditLog, responseData, error_2;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 5, , 6]);
                tenantId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.tenantId;
                _a = req.body, name = _a.name, phone = _a.phone, password = _a.password, assignedProjects = _a.assignedProjects;
                if (!name || !phone || !password) {
                    return [2 /*return*/, res.status(400).json({ error: "Name, phone number, and password are required" })];
                }
                phoneTrimmed = phone.trim();
                return [4 /*yield*/, models_1.User.findOne({ phone: phoneTrimmed })];
            case 1:
                existingUser = _d.sent();
                if (existingUser) {
                    return [2 /*return*/, res.status(400).json({ error: "Mobile number already registered" })];
                }
                return [4 /*yield*/, bcryptjs_1.default.hash(password, 12)];
            case 2:
                passwordHash = _d.sent();
                supervisor = new models_1.User({
                    tenantId: tenantId,
                    name: name,
                    phone: phoneTrimmed,
                    passwordHash: passwordHash,
                    role: "supervisor",
                    assignedProjects: assignedProjects || [],
                    isActive: true,
                    isVerified: true,
                });
                return [4 /*yield*/, supervisor.save()];
            case 3:
                _d.sent();
                auditLog = new models_1.AuditLog({
                    tenantId: tenantId,
                    userId: (_c = req.user) === null || _c === void 0 ? void 0 : _c.id,
                    action: "USER_SIGNUP",
                    targetType: "User",
                    targetId: supervisor._id.toString(),
                    changes: { after: { name: supervisor.name, role: supervisor.role } }
                });
                return [4 /*yield*/, auditLog.save()];
            case 4:
                _d.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                responseData = supervisor.toObject();
                delete responseData.passwordHash;
                delete responseData.refreshTokens;
                res.status(201).json(responseData);
                return [3 /*break*/, 6];
            case 5:
                error_2 = _d.sent();
                res.status(500).json({ error: error_2.message });
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); };
exports.createSupervisor = createSupervisor;
var updateSupervisor = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, id, _a, name, phone, password, assignedProjects, isActive, supervisor, phoneTrimmed, existingUser, _b, auditLog, responseData, error_3;
    var _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _e.trys.push([0, 8, , 9]);
                tenantId = (_c = req.user) === null || _c === void 0 ? void 0 : _c.tenantId;
                id = req.params.id;
                _a = req.body, name = _a.name, phone = _a.phone, password = _a.password, assignedProjects = _a.assignedProjects, isActive = _a.isActive;
                return [4 /*yield*/, models_1.User.findOne({ _id: id, tenantId: tenantId, role: "supervisor" })];
            case 1:
                supervisor = _e.sent();
                if (!supervisor) {
                    return [2 /*return*/, res.status(404).json({ error: "Supervisor not found" })];
                }
                if (name)
                    supervisor.name = name;
                if (!phone) return [3 /*break*/, 3];
                phoneTrimmed = phone.trim();
                if (!(phoneTrimmed !== supervisor.phone)) return [3 /*break*/, 3];
                return [4 /*yield*/, models_1.User.findOne({ phone: phoneTrimmed })];
            case 2:
                existingUser = _e.sent();
                if (existingUser) {
                    return [2 /*return*/, res.status(400).json({ error: "Mobile number already registered" })];
                }
                supervisor.phone = phoneTrimmed;
                _e.label = 3;
            case 3:
                if (!password) return [3 /*break*/, 5];
                _b = supervisor;
                return [4 /*yield*/, bcryptjs_1.default.hash(password, 12)];
            case 4:
                _b.passwordHash = _e.sent();
                _e.label = 5;
            case 5:
                if (assignedProjects !== undefined) {
                    supervisor.assignedProjects = assignedProjects;
                }
                if (isActive !== undefined) {
                    supervisor.isActive = isActive;
                }
                return [4 /*yield*/, supervisor.save()];
            case 6:
                _e.sent();
                auditLog = new models_1.AuditLog({
                    tenantId: tenantId,
                    userId: (_d = req.user) === null || _d === void 0 ? void 0 : _d.id,
                    action: "UPDATE_PROFILE",
                    targetType: "User",
                    targetId: supervisor._id.toString(),
                    changes: { after: { name: supervisor.name, role: supervisor.role } }
                });
                return [4 /*yield*/, auditLog.save()];
            case 7:
                _e.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                responseData = supervisor.toObject();
                delete responseData.passwordHash;
                delete responseData.refreshTokens;
                res.json(responseData);
                return [3 /*break*/, 9];
            case 8:
                error_3 = _e.sent();
                res.status(500).json({ error: error_3.message });
                return [3 /*break*/, 9];
            case 9: return [2 /*return*/];
        }
    });
}); };
exports.updateSupervisor = updateSupervisor;
var deleteSupervisor = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, id, supervisor, auditLog, error_4;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 3, , 4]);
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                id = req.params.id;
                return [4 /*yield*/, models_1.User.findOneAndDelete({ _id: id, tenantId: tenantId, role: "supervisor" })];
            case 1:
                supervisor = _c.sent();
                if (!supervisor) {
                    return [2 /*return*/, res.status(404).json({ error: "Supervisor not found" })];
                }
                auditLog = new models_1.AuditLog({
                    tenantId: tenantId,
                    userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.id,
                    action: "DELETE",
                    targetType: "User",
                    targetId: id,
                    changes: { before: { name: supervisor.name, role: supervisor.role } }
                });
                return [4 /*yield*/, auditLog.save()];
            case 2:
                _c.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                res.json({ success: true, message: "Supervisor account deleted successfully" });
                return [3 /*break*/, 4];
            case 3:
                error_4 = _c.sent();
                res.status(500).json({ error: error_4.message });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.deleteSupervisor = deleteSupervisor;
