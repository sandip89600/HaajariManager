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
process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://localhost:27017/haajari_test";
var supertest_1 = require("supertest");
var mongoose_1 = require("mongoose");
var index_1 = require("../src/index");
var models_1 = require("../src/models");
var isMongoAvailable = true;
beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
    var err_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!(mongoose_1.default.connection.readyState === 0)) return [3 /*break*/, 4];
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, mongoose_1.default.connect(process.env.MONGO_URI, {
                        serverSelectionTimeoutMS: 2000,
                    })];
            case 2:
                _a.sent();
                return [3 /*break*/, 4];
            case 3:
                err_1 = _a.sent();
                console.warn("\n⚠️  WARNING: Local MongoDB is not reachable on port 27017.");
                console.warn("Skipping auth integration tests. Start MongoDB to run these tests.\n");
                isMongoAvailable = false;
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
afterAll(function () { return __awaiter(void 0, void 0, void 0, function () {
    var err_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!!isMongoAvailable) return [3 /*break*/, 2];
                return [4 /*yield*/, mongoose_1.default.disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
            case 2:
                _a.trys.push([2, 4, , 5]);
                return [4 /*yield*/, mongoose_1.default.connection.dropDatabase()];
            case 3:
                _a.sent();
                return [3 /*break*/, 5];
            case 4:
                err_2 = _a.sent();
                console.warn("Failed to drop test database:", err_2);
                return [3 /*break*/, 5];
            case 5: return [4 /*yield*/, mongoose_1.default.disconnect()];
            case 6:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!isMongoAvailable)
                    return [2 /*return*/];
                return [4 /*yield*/, models_1.User.deleteMany({})];
            case 1:
                _a.sent();
                return [4 /*yield*/, models_1.Tenant.deleteMany({})];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
describe("Auth Controller Tests", function () {
    var testUser = {
        password: "securepassword123",
        name: "Test Worker",
        phone: "9876543210",
        role: "contractor",
        companyName: "Test Org",
    };
    test("signup - should successfully register user and organization", function () { return __awaiter(void 0, void 0, void 0, function () {
        var res, userInDb, tenantInDb;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!isMongoAvailable)
                        return [2 /*return*/];
                    return [4 /*yield*/, (0, supertest_1.default)(index_1.app)
                            .post("/api/auth/signup")
                            .send(testUser)];
                case 1:
                    res = _a.sent();
                    expect(res.status).toBe(201);
                    expect(res.body).toHaveProperty("token");
                    expect(res.body).toHaveProperty("refreshToken");
                    expect(res.body.user).toHaveProperty("id");
                    expect(res.body.user.phone).toBe(testUser.phone);
                    expect(res.body.user.isVerified).toBe(true);
                    return [4 /*yield*/, models_1.User.findOne({ phone: testUser.phone })];
                case 2:
                    userInDb = _a.sent();
                    expect(userInDb).toBeDefined();
                    expect(userInDb.name).toBe(testUser.name);
                    return [4 /*yield*/, models_1.Tenant.findById(userInDb.tenantId)];
                case 3:
                    tenantInDb = _a.sent();
                    expect(tenantInDb).toBeDefined();
                    expect(tenantInDb.name).toBe(testUser.companyName);
                    return [2 /*return*/];
            }
        });
    }); });
    test("signup - should fail on duplicate phone", function () { return __awaiter(void 0, void 0, void 0, function () {
        var res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!isMongoAvailable)
                        return [2 /*return*/];
                    // Register first user
                    return [4 /*yield*/, (0, supertest_1.default)(index_1.app).post("/api/auth/signup").send(testUser)];
                case 1:
                    // Register first user
                    _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(index_1.app).post("/api/auth/signup").send(testUser)];
                case 2:
                    res = _a.sent();
                    expect(res.status).toBe(400);
                    expect(res.body).toHaveProperty("error", "Mobile number already registered");
                    return [2 /*return*/];
            }
        });
    }); });
    test("login - should login successfully and rotate tokens", function () { return __awaiter(void 0, void 0, void 0, function () {
        var res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!isMongoAvailable)
                        return [2 /*return*/];
                    // Signup first
                    return [4 /*yield*/, (0, supertest_1.default)(index_1.app).post("/api/auth/signup").send(testUser)];
                case 1:
                    // Signup first
                    _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(index_1.app)
                            .post("/api/auth/login")
                            .send({
                            phone: testUser.phone,
                            password: testUser.password,
                        })];
                case 2:
                    res = _a.sent();
                    expect(res.status).toBe(200);
                    expect(res.body).toHaveProperty("token");
                    expect(res.body).toHaveProperty("refreshToken");
                    expect(res.body.user.phone).toBe(testUser.phone);
                    return [2 /*return*/];
            }
        });
    }); });
    test("login - should reject invalid credentials", function () { return __awaiter(void 0, void 0, void 0, function () {
        var res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!isMongoAvailable)
                        return [2 /*return*/];
                    // Signup first
                    return [4 /*yield*/, (0, supertest_1.default)(index_1.app).post("/api/auth/signup").send(testUser)];
                case 1:
                    // Signup first
                    _a.sent();
                    return [4 /*yield*/, (0, supertest_1.default)(index_1.app)
                            .post("/api/auth/login")
                            .send({
                            phone: testUser.phone,
                            password: "wrongpassword",
                        })];
                case 2:
                    res = _a.sent();
                    expect(res.status).toBe(400);
                    expect(res.body).toHaveProperty("error", "Invalid credentials");
                    return [2 /*return*/];
            }
        });
    }); });
    test("refresh - should rotate refresh token and issue new access token", function () { return __awaiter(void 0, void 0, void 0, function () {
        var signupRes, firstRefreshToken, res, oldRefreshRes;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!isMongoAvailable)
                        return [2 /*return*/];
                    return [4 /*yield*/, (0, supertest_1.default)(index_1.app).post("/api/auth/signup").send(testUser)];
                case 1:
                    signupRes = _a.sent();
                    firstRefreshToken = signupRes.body.refreshToken;
                    expect(firstRefreshToken).toBeDefined();
                    return [4 /*yield*/, (0, supertest_1.default)(index_1.app)
                            .post("/api/auth/refresh")
                            .send({ refreshToken: firstRefreshToken })];
                case 2:
                    res = _a.sent();
                    expect(res.status).toBe(200);
                    expect(res.body).toHaveProperty("token");
                    expect(res.body).toHaveProperty("refreshToken");
                    expect(res.body.refreshToken).not.toBe(firstRefreshToken); // Must be rotated
                    return [4 /*yield*/, (0, supertest_1.default)(index_1.app)
                            .post("/api/auth/refresh")
                            .send({ refreshToken: firstRefreshToken })];
                case 3:
                    oldRefreshRes = _a.sent();
                    expect(oldRefreshRes.status).toBe(403);
                    return [2 /*return*/];
            }
        });
    }); });
});
