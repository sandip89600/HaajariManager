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
var generative_ai_1 = require("@google/generative-ai");
var dotenv = require("dotenv");
var path = require("path");
// Load env variables
dotenv.config({ path: path.join(__dirname, "../../.env") });
function testGemini() {
    return __awaiter(this, void 0, void 0, function () {
        var apiKey, ai, models, _i, models_1, m, model, result, err_1, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    apiKey = process.env.GEMINI_API_KEY;
                    console.log("Using API Key:", apiKey ? "".concat(apiKey.substring(0, 8), "...") : "UNDEFINED");
                    if (!apiKey) {
                        console.error("GEMINI_API_KEY is not defined in env!");
                        return [2 /*return*/];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 8, , 9]);
                    ai = new generative_ai_1.GoogleGenerativeAI(apiKey);
                    models = ["gemini-3.5-flash", "gemini-3.1-flash", "gemini-3.0-flash", "gemini-1.5-flash-8b"];
                    _i = 0, models_1 = models;
                    _a.label = 2;
                case 2:
                    if (!(_i < models_1.length)) return [3 /*break*/, 7];
                    m = models_1[_i];
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    console.log("Trying model: ".concat(m, "..."));
                    model = ai.getGenerativeModel({ model: m });
                    return [4 /*yield*/, model.generateContent("Hello, are you online? Respond with 'YES'.")];
                case 4:
                    result = _a.sent();
                    console.log("SUCCESS with model: ".concat(m, "! Response: ").concat(result.response.text().trim()));
                    return [2 /*return*/];
                case 5:
                    err_1 = _a.sent();
                    console.log("Failed for ".concat(m, ": ").concat(err_1.message));
                    return [3 /*break*/, 6];
                case 6:
                    _i++;
                    return [3 /*break*/, 2];
                case 7: return [3 /*break*/, 9];
                case 8:
                    error_1 = _a.sent();
                    console.error("General failure:");
                    console.error("Error Code/Message:", error_1.message);
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    });
}
testGemini();
