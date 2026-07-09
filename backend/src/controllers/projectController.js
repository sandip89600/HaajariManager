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
exports.deleteProject = exports.updateProject = exports.createProject = exports.getProjects = void 0;
var models_1 = require("../models");
var socket_1 = require("../utils/socket");
var getProjects = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, projects, error_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                return [4 /*yield*/, models_1.Project.find({ tenantId: tenantId })];
            case 1:
                projects = _b.sent();
                res.json(projects);
                return [3 /*break*/, 3];
            case 2:
                error_1 = _b.sent();
                res.status(500).json({ error: error_1.message });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.getProjects = getProjects;
var createProject = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, _a, name, location, project, auditLog, error_2;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 3, , 4]);
                tenantId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.tenantId;
                _a = req.body, name = _a.name, location = _a.location;
                if (!name) {
                    return [2 /*return*/, res.status(400).json({ error: "Project name is required" })];
                }
                project = new models_1.Project({
                    tenantId: tenantId,
                    name: name,
                    location: location,
                    status: "active",
                });
                return [4 /*yield*/, project.save()];
            case 1:
                _d.sent();
                auditLog = new models_1.AuditLog({
                    tenantId: tenantId,
                    userId: (_c = req.user) === null || _c === void 0 ? void 0 : _c.id,
                    action: "CREATE_PROJECT",
                    targetType: "Project",
                    targetId: project._id.toString(),
                    changes: { after: { name: project.name } },
                });
                return [4 /*yield*/, auditLog.save()];
            case 2:
                _d.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                res.status(201).json(project);
                return [3 /*break*/, 4];
            case 3:
                error_2 = _d.sent();
                res.status(500).json({ error: error_2.message });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.createProject = createProject;
var updateProject = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, id, _a, name, location, status, project, error_3;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 3, , 4]);
                tenantId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.tenantId;
                id = req.params.id;
                _a = req.body, name = _a.name, location = _a.location, status = _a.status;
                return [4 /*yield*/, models_1.Project.findOne({ _id: id, tenantId: tenantId })];
            case 1:
                project = _c.sent();
                if (!project) {
                    return [2 /*return*/, res.status(404).json({ error: "Project not found" })];
                }
                if (name)
                    project.name = name;
                if (location !== undefined)
                    project.location = location;
                if (status)
                    project.status = status;
                return [4 /*yield*/, project.save()];
            case 2:
                _c.sent();
                res.json(project);
                return [3 /*break*/, 4];
            case 3:
                error_3 = _c.sent();
                res.status(500).json({ error: error_3.message });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.updateProject = updateProject;
var deleteProject = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tenantId, id, project, auditLog, error_4;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 5, , 6]);
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                id = req.params.id;
                return [4 /*yield*/, models_1.Project.findOneAndDelete({ _id: id, tenantId: tenantId })];
            case 1:
                project = _c.sent();
                if (!project) {
                    return [2 /*return*/, res.status(404).json({ error: "Project not found" })];
                }
                // Cascading: unassign workers that belong to this project
                return [4 /*yield*/, models_1.Worker.updateMany({ tenantId: tenantId, projectId: id }, { $unset: { projectId: "" } })];
            case 2:
                // Cascading: unassign workers that belong to this project
                _c.sent();
                // Cascading: remove project from supervisor's assignedProjects list
                return [4 /*yield*/, models_1.User.updateMany({ tenantId: tenantId, role: "supervisor", assignedProjects: id }, { $pull: { assignedProjects: id } })];
            case 3:
                // Cascading: remove project from supervisor's assignedProjects list
                _c.sent();
                auditLog = new models_1.AuditLog({
                    tenantId: tenantId,
                    userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.id,
                    action: "DELETE",
                    targetType: "PROJECT",
                    targetId: id,
                    changes: { before: { name: project.name } },
                });
                return [4 /*yield*/, auditLog.save()];
            case 4:
                _c.sent();
                (0, socket_1.broadcastAdminActivity)(auditLog);
                res.json({ success: true, message: "Project deleted successfully" });
                return [3 /*break*/, 6];
            case 5:
                error_4 = _c.sent();
                res.status(500).json({ error: error_4.message });
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); };
exports.deleteProject = deleteProject;
