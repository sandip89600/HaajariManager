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
exports.checkPlanLimit = exports.getTenantPlan = void 0;
var models_1 = require("../models");
var getTenantPlan = function (tenantId) { return __awaiter(void 0, void 0, void 0, function () {
    var tenant;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, models_1.Tenant.findById(tenantId)];
            case 1:
                tenant = _a.sent();
                if (!tenant) {
                    return [2 /*return*/, { plan: "free" }];
                }
                return [2 /*return*/, {
                        plan: tenant.plan || "free",
                        planExpiresAt: tenant.planExpiresAt,
                    }];
        }
    });
}); };
exports.getTenantPlan = getTenantPlan;
var checkPlanLimit = function (resourceType) {
    return function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
        var tenantId, plan, count, count, count, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 10, , 11]);
                    tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                    if (!tenantId) {
                        return [2 /*return*/, res.status(401).json({ error: "Unauthorized: No tenant ID found" })];
                    }
                    return [4 /*yield*/, (0, exports.getTenantPlan)(tenantId)];
                case 1:
                    plan = (_b.sent()).plan;
                    if (!(resourceType === "workers")) return [3 /*break*/, 3];
                    return [4 /*yield*/, models_1.Worker.countDocuments({ tenantId: tenantId, isArchived: false })];
                case 2:
                    count = _b.sent();
                    if (plan === "free") {
                        if (count >= 15) {
                            return [2 /*return*/, res.status(403).json({
                                    success: false,
                                    message: "Worker limit reached. Upgrade your plan to add more workers."
                                })];
                        }
                    }
                    else if (plan === "professional") {
                        if (count >= 100) {
                            return [2 /*return*/, res.status(403).json({
                                    success: false,
                                    message: "Worker limit reached. Upgrade your plan to add more workers."
                                })];
                        }
                    }
                    return [3 /*break*/, 9];
                case 3:
                    if (!(resourceType === "projects")) return [3 /*break*/, 6];
                    if (!(plan === "free")) return [3 /*break*/, 5];
                    return [4 /*yield*/, models_1.Project.countDocuments({ tenantId: tenantId })];
                case 4:
                    count = _b.sent();
                    if (count >= 1) {
                        return [2 /*return*/, res.status(403).json({
                                error: "Project limit reached. Upgrade to Professional Plan to unlock this feature.",
                                limitExceeded: true,
                                limit: 1,
                                plan: plan,
                            })];
                    }
                    _b.label = 5;
                case 5: return [3 /*break*/, 9];
                case 6:
                    if (!(resourceType === "supervisors")) return [3 /*break*/, 8];
                    return [4 /*yield*/, models_1.User.countDocuments({ tenantId: tenantId, role: "supervisor" })];
                case 7:
                    count = _b.sent();
                    if (plan === "free") {
                        return [2 /*return*/, res.status(403).json({
                                error: "Supervisor accounts are not available on the Free Plan. Upgrade to Professional Plan to unlock this feature.",
                                limitExceeded: true,
                                limit: 0,
                                plan: plan,
                            })];
                    }
                    else if (plan === "professional") {
                        if (count >= 2) {
                            return [2 /*return*/, res.status(403).json({
                                    error: "Supervisor limit reached (max 2). Upgrade to Business Plan to unlock unlimited supervisors.",
                                    limitExceeded: true,
                                    limit: 2,
                                    plan: plan,
                                })];
                        }
                    }
                    return [3 /*break*/, 9];
                case 8:
                    if (resourceType === "gps") {
                        if (plan === "free") {
                            return [2 /*return*/, res.status(403).json({
                                    error: "GPS attendance is not available on the Free Plan. Upgrade to Professional Plan to unlock this feature.",
                                    limitExceeded: true,
                                    plan: plan,
                                })];
                        }
                    }
                    _b.label = 9;
                case 9:
                    next();
                    return [3 /*break*/, 11];
                case 10:
                    error_1 = _b.sent();
                    res.status(500).json({ error: error_1.message });
                    return [3 /*break*/, 11];
                case 11: return [2 /*return*/];
            }
        });
    }); };
};
exports.checkPlanLimit = checkPlanLimit;
