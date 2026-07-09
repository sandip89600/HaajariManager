"use strict";
/**
 * Haajari App – Database Reset Script
 *
 * This script will:
 * 1. Drop ALL documents from every collection
 * 2. Recreate the admin user (haajari896 / 1234)
 * 3. Log the results
 *
 * Run with: npx ts-node src/scripts/reset.ts
 */
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
var mongoose_1 = require("mongoose");
var bcryptjs_1 = require("bcryptjs");
var dotenv_1 = require("dotenv");
var path_1 = require("path");
// Load env
dotenv_1.default.config({ path: path_1.default.join(__dirname, "../../.env") });
var MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/haajari";
function resetDatabase() {
    return __awaiter(this, void 0, void 0, function () {
        var db, collections, _i, collections_1, col, result, e_1, tenantResult, tenantId, passwordHash, adminResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("\n======================================");
                    console.log("  HAAJARI DATABASE RESET SCRIPT");
                    console.log("======================================\n");
                    console.log("Connecting to: ".concat(MONGO_URI.split("@").pop() || MONGO_URI));
                    return [4 /*yield*/, mongoose_1.default.connect(MONGO_URI)];
                case 1:
                    _a.sent();
                    console.log("✅ Connected to MongoDB\n");
                    db = mongoose_1.default.connection.db;
                    if (!db) {
                        throw new Error("Database connection not established");
                    }
                    collections = [
                        "users",
                        "tenants",
                        "workers",
                        "attendances",
                        "payments",
                        "wagehistories",
                        "auditlogs",
                        "projects",
                    ];
                    console.log("🗑️  Wiping all collections...");
                    _i = 0, collections_1 = collections;
                    _a.label = 2;
                case 2:
                    if (!(_i < collections_1.length)) return [3 /*break*/, 7];
                    col = collections_1[_i];
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, db.collection(col).deleteMany({})];
                case 4:
                    result = _a.sent();
                    console.log("   ".concat(col, ": deleted ").concat(result.deletedCount, " documents"));
                    return [3 /*break*/, 6];
                case 5:
                    e_1 = _a.sent();
                    console.log("   ".concat(col, ": collection not found or already empty (").concat(e_1.message, ")"));
                    return [3 /*break*/, 6];
                case 6:
                    _i++;
                    return [3 /*break*/, 2];
                case 7:
                    console.log("\n✅ All collections wiped.\n");
                    // Create admin tenant
                    console.log("🏗️  Creating System Admin tenant...");
                    return [4 /*yield*/, db.collection("tenants").insertOne({
                            name: "System Admin Org",
                            code: "SYSADMIN",
                            plan: "business",
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        })];
                case 8:
                    tenantResult = _a.sent();
                    tenantId = tenantResult.insertedId;
                    console.log("   Tenant created: ".concat(tenantId));
                    // Create admin user
                    console.log("👤 Creating Admin user (haajari896 / 1234)...");
                    return [4 /*yield*/, bcryptjs_1.default.hash("1234", 12)];
                case 9:
                    passwordHash = _a.sent();
                    return [4 /*yield*/, db.collection("users").insertOne({
                            tenantId: tenantId,
                            name: "System Admin",
                            phone: "haajari896",
                            passwordHash: passwordHash,
                            role: "admin",
                            isActive: true,
                            isVerified: true,
                            refreshTokens: [],
                            assignedProjects: [],
                            avatarColor: "#FF6B35",
                            createdAt: new Date(),
                        })];
                case 10:
                    adminResult = _a.sent();
                    console.log("   Admin user created: ".concat(adminResult.insertedId));
                    console.log("\n======================================");
                    console.log("  RESET COMPLETE");
                    console.log("======================================");
                    console.log("  Admin Username : haajari896");
                    console.log("  Admin Password : 1234");
                    console.log("  All other data : DELETED");
                    console.log("======================================\n");
                    return [4 /*yield*/, mongoose_1.default.disconnect()];
                case 11:
                    _a.sent();
                    console.log("✅ Disconnected from MongoDB. Done.\n");
                    return [2 /*return*/];
            }
        });
    });
}
resetDatabase().catch(function (err) {
    console.error("\n❌ RESET FAILED:", err.message);
    process.exit(1);
});
