"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.processVoiceCommand = exports.processVoice = void 0;
var generative_ai_1 = require("@google/generative-ai");
var models_1 = require("../models");
function extractBalancedJson(str) {
    var firstBrace = str.indexOf("{");
    if (firstBrace === -1)
        return str;
    var depth = 0;
    var inString = false;
    var escape = false;
    for (var i = firstBrace; i < str.length; i++) {
        var char = str[i];
        if (escape) {
            escape = false;
            continue;
        }
        if (char === "\\") {
            escape = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            continue;
        }
        if (!inString) {
            if (char === "{") {
                depth++;
            }
            else if (char === "}") {
                depth--;
                if (depth === 0) {
                    return str.substring(firstBrace, i + 1);
                }
            }
        }
    }
    return str;
}
function parseLocalCommand(text) {
    var t = text.toLowerCase().trim();
    if (!t)
        return null;
    // 1. OPEN SCREENS
    if (t === "open workers" || t === "workers kholo" || t === "workers list" || t === "show workers" || t === "workers screen" || t === "kamgar list") {
        return { intent: "OPEN_WORKERS", data: {}, response: "Workers opened." };
    }
    if (t === "open attendance" || t === "attendance kholo" || t === "attendance screen" || t === "haajari kholo" || t === "hajiri kholo") {
        return { intent: "OPEN_ATTENDANCE", data: {}, response: "Attendance opened." };
    }
    if (t === "open summary" || t === "summary kholo" || t === "summary screen" || t === "hisab kholo" || t === "hisab") {
        return { intent: "OPEN_SUMMARY", data: {}, response: "Summary opened." };
    }
    if (t === "open reports" || t === "report kholo" || t === "reports kholo" || t === "reports screen" || t === "reports") {
        return { intent: "OPEN_REPORTS", data: {}, response: "Summary opened." };
    }
    if (t === "open settings" || t === "settings kholo" || t === "setting kholo" || t === "settings screen" || t === "settings") {
        return { intent: "OPEN_SETTINGS", data: {}, response: "Settings opened." };
    }
    if (t === "open profile" || t === "profile kholo" || t === "profile screen" || t === "profile" || t === "my profile") {
        return { intent: "OPEN_PROFILE", data: {}, response: "Profile opened." };
    }
    if (t === "open dashboard" || t === "dashboard kholo" || t === "dashboard screen" || t === "dashboard" || t === "go home" || t === "home") {
        return { intent: "OPEN_DASHBOARD", data: {}, response: "Dashboard opened." };
    }
    if (t === "open subscription" || t === "subscription kholo" || t === "upgrade subscription" || t === "premium plans" || t === "upgrade plans") {
        return { intent: "OPEN_SETTINGS", data: { openUpgrade: true }, response: "Subscription opened." };
    }
    // 2. NAVIGATION
    if (t === "go back" || t === "back" || t === "piche" || t === "pichhe" || t === "wapas" || t === "go back screen") {
        return { intent: "GO_BACK", data: {}, response: "Going back." };
    }
    if (t === "go home" || t === "home" || t === "home screen") {
        return { intent: "OPEN_DASHBOARD", data: {}, response: "Dashboard opened." };
    }
    // 3. SETTINGS & LANGUAGE & THEME
    if (t === "change language to hindi" || t === "set language hindi" || t === "hindi language" || t === "hindi badlo") {
        return { intent: "CHANGE_LANGUAGE", data: { language: "hi" }, response: "Language updated." };
    }
    if (t === "change language to marathi" || t === "set language marathi" || t === "marathi language" || t === "marathi badlo") {
        return { intent: "CHANGE_LANGUAGE", data: { language: "mr" }, response: "Language updated." };
    }
    if (t === "change language to english" || t === "set language english" || t === "english language" || t === "english badlo") {
        return { intent: "CHANGE_LANGUAGE", data: { language: "en" }, response: "Language updated." };
    }
    if (t === "change theme to dark" || t === "theme to dark" || t === "dark theme" || t === "dark mode" || t === "theme dark" || t === "set dark theme") {
        return { intent: "CHANGE_THEME", data: { theme: "dark" }, response: "Theme updated." };
    }
    if (t === "change theme to light" || t === "theme to light" || t === "light theme" || t === "light mode" || t === "theme light" || t === "set light theme") {
        return { intent: "CHANGE_THEME", data: { theme: "light" }, response: "Theme updated." };
    }
    if (t === "logout" || t === "log out" || t === "sign out") {
        return { intent: "LOGOUT", data: {}, response: "Logged out." };
    }
    // 4. ATTENDANCE (MARK PRESENT/ABSENT/HALF DAY)
    var presentRegexes = [
        /^(?:mark\s+)?(.+?)\s+(?:as\s+)?present$/i,
        /^(?:mark\s+)?present\s+(?:for\s+)?(.+?)$/i,
        /^(.+?)\s+present\s+lagao$/i,
        /^(.+?)\s+ki\s+present$/i,
    ];
    for (var _i = 0, presentRegexes_1 = presentRegexes; _i < presentRegexes_1.length; _i++) {
        var regex = presentRegexes_1[_i];
        var match = t.match(regex);
        if (match && match[1]) {
            var name = match[1].trim();
            if (!["mark", "lagao", "attendance", "absent", "half day", "half-day", "overtime", "details"].includes(name)) {
                return {
                    intent: "MARK_PRESENT",
                    data: { name: name.charAt(0).toUpperCase() + name.slice(1) },
                    response: "Attendance marked."
                };
            }
        }
    }
    var absentRegexes = [
        /^(?:mark\s+)?(.+?)\s+(?:as\s+)?absent$/i,
        /^(?:mark\s+)?absent\s+(?:for\s+)?(.+?)$/i,
        /^(.+?)\s+absent\s+lagao$/i,
        /^(.+?)\s+ki\s+absent$/i,
    ];
    for (var _a = 0, absentRegexes_1 = absentRegexes; _a < absentRegexes_1.length; _a++) {
        var regex = absentRegexes_1[_a];
        var match = t.match(regex);
        if (match && match[1]) {
            var name = match[1].trim();
            if (!["mark", "lagao", "attendance", "present", "half day", "half-day", "overtime", "details"].includes(name)) {
                return {
                    intent: "MARK_ABSENT",
                    data: { name: name.charAt(0).toUpperCase() + name.slice(1) },
                    response: "Attendance marked."
                };
            }
        }
    }
    var halfDayRegexes = [
        /^(?:mark\s+)?(.+?)\s+(?:as\s+)?half\s*day$/i,
        /^(?:mark\s+)?half\s*day\s+(?:for\s+)?(.+?)$/i,
        /^(.+?)\s+half\s*day\s+lagao$/i,
        /^(.+?)\s+ki\s+half\s*day$/i,
    ];
    for (var _b = 0, halfDayRegexes_1 = halfDayRegexes; _b < halfDayRegexes_1.length; _b++) {
        var regex = halfDayRegexes_1[_b];
        var match = t.match(regex);
        if (match && match[1]) {
            var name = match[1].trim();
            if (!["mark", "lagao", "attendance", "present", "absent", "overtime", "details"].includes(name)) {
                return {
                    intent: "MARK_HALF_DAY",
                    data: { name: name.charAt(0).toUpperCase() + name.slice(1) },
                    response: "Attendance marked."
                };
            }
        }
    }
    if (t === "mark present" || t === "present lagao" || t === "present mark karo" || t === "present") {
        return { intent: "MARK_PRESENT", data: {}, response: "Attendance marked." };
    }
    if (t === "mark absent" || t === "absent lagao" || t === "absent mark karo" || t === "absent") {
        return { intent: "MARK_ABSENT", data: {}, response: "Attendance marked." };
    }
    if (t === "mark half day" || t === "half day lagao" || t === "half day mark karo" || t === "half day" || t === "half-day") {
        return { intent: "MARK_HALF_DAY", data: {}, response: "Attendance marked." };
    }
    // 5. OPEN WORKER DETAILS
    var detailsRegexes = [
        /^(?:open\s+|show\s+)?worker\s+details\s+(?:for\s+)?(.+?)$/i,
        /^details\s+(?:of\s+)?(.+?)$/i,
        /^show\s+worker\s+(.+?)$/i,
        /^(.+?)\s+details$/i,
    ];
    for (var _c = 0, detailsRegexes_1 = detailsRegexes; _c < detailsRegexes_1.length; _c++) {
        var regex = detailsRegexes_1[_c];
        var match = t.match(regex);
        if (match && match[1]) {
            var name = match[1].trim();
            return {
                intent: "SEARCH_WORKER",
                data: { query: name },
                response: "Worker details opened."
            };
        }
    }
    if (t === "open worker details" || t === "worker details" || t === "details") {
        return { intent: "OPEN_WORKERS", data: {}, response: "Workers opened." };
    }
    // 6. FINANCIALS (ADD PAYMENT & ADVANCE)
    var payRegexes = [
        /^(?:pay\s+|payment\s+of\s+|add\s+payment\s+of\s+)(\d+)\s+(?:to\s+)?(.+?)$/i,
        /^(?:pay\s+|payment\s+to\s+)(.+?)\s+(\d+)$/i,
        /^(?:pay\s+|payment\s+of\s+)(.+?)\s+rs\s*(\d+)$/i,
        /^(?:give\s+)?(.+?)\s+(?:pay\s+|payment\s+)?rs\s*(\d+)$/i,
    ];
    for (var _d = 0, payRegexes_1 = payRegexes; _d < payRegexes_1.length; _d++) {
        var regex = payRegexes_1[_d];
        var match = t.match(regex);
        if (match) {
            var amountStr = "";
            var name = "";
            if (isNaN(Number(match[1]))) {
                name = match[1].trim();
                amountStr = match[2];
            }
            else {
                amountStr = match[1];
                name = match[2].trim();
            }
            var amount = parseInt(amountStr);
            if (!isNaN(amount) && name) {
                return {
                    intent: "ADD_PAYMENT",
                    data: { amount: amount, name: name.charAt(0).toUpperCase() + name.slice(1) },
                    response: "Payment saved."
                };
            }
        }
    }
    var advanceRegexes = [
        /^(?:add\s+|give\s+)?advance\s+(?:of\s+)?(\d+)\s+(?:to\s+)?(.+?)$/i,
        /^(?:add\s+|give\s+)?advance\s+(?:to\s+)?(.+?)\s+(\d+)$/i,
        /^(?:give\s+)?(.+?)\s+(?:rs\s*)?(\d+)\s+advance$/i,
    ];
    for (var _e = 0, advanceRegexes_1 = advanceRegexes; _e < advanceRegexes_1.length; _e++) {
        var regex = advanceRegexes_1[_e];
        var match = t.match(regex);
        if (match) {
            var amountStr = "";
            var name = "";
            if (isNaN(Number(match[1]))) {
                name = match[1].trim();
                amountStr = match[2];
            }
            else {
                amountStr = match[1];
                name = match[2].trim();
            }
            var amount = parseInt(amountStr);
            if (!isNaN(amount) && name) {
                return {
                    intent: "ADD_ADVANCE",
                    data: { amount: amount, name: name.charAt(0).toUpperCase() + name.slice(1) },
                    response: "Advance recorded."
                };
            }
        }
    }
    if (t === "add payment" || t === "pay worker" || t === "payment") {
        return { intent: "ADD_PAYMENT", data: {}, response: "Payment saved." };
    }
    if (t === "add advance" || t === "give advance" || t === "advance") {
        return { intent: "ADD_ADVANCE", data: {}, response: "Advance recorded." };
    }
    return null;
}
var processVoice = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    // Helper to perform Gemini API call with 3-tier backoff retries for 503 Service Unavailable
    function callGeminiWithRetry(model_1, parts_1) {
        return __awaiter(this, arguments, void 0, function (model, parts, retries, delay) {
            var err_1, isRetryable;
            if (retries === void 0) { retries = 3; }
            if (delay === void 0) { delay = 2000; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(retries >= 0)) return [3 /*break*/, 8];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 7]);
                        return [4 /*yield*/, model.generateContent(parts)];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        err_1 = _a.sent();
                        isRetryable = err_1.status === 503 || err_1.status === 429 || (err_1.message && (err_1.message.includes("503") || err_1.message.includes("429") || err_1.message.includes("Service Unavailable") || err_1.message.includes("Too Many Requests")));
                        if (!(isRetryable && retries > 0)) return [3 /*break*/, 5];
                        console.warn("[Voice] Gemini retryable error encountered. Retrying in ".concat(delay / 1000, "s... (").concat(retries, " retries left)"));
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, delay); })];
                    case 4:
                        _a.sent();
                        retries--;
                        delay += 2000;
                        return [3 /*break*/, 6];
                    case 5: throw err_1;
                    case 6: return [3 /*break*/, 7];
                    case 7: return [3 /*break*/, 0];
                    case 8: return [2 /*return*/];
                }
            });
        });
    }
    function generateSarvamTTS(text, userLanguage) {
        return __awaiter(this, void 0, void 0, function () {
            var sarvamKey, languageMap, targetLang, ttsResponse, ttsResult, errTxt, ttsErr_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        sarvamKey = process.env.SARVAM_API_KEY || "";
                        if (!sarvamKey || !text || text.trim() === "")
                            return [2 /*return*/, ""];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 7, , 8]);
                        languageMap = {
                            hi: "hi-IN",
                            mr: "mr-IN",
                            en: "en-IN",
                            gu: "gu-IN",
                            ta: "ta-IN",
                            te: "te-IN",
                            kn: "kn-IN",
                            bn: "bn-IN",
                            pa: "pa-IN"
                        };
                        targetLang = languageMap[userLanguage] || "en-IN";
                        return [4 /*yield*/, fetch("https://api.sarvam.ai/text-to-speech", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "api-subscription-key": sarvamKey
                                },
                                body: JSON.stringify({
                                    text: text,
                                    speaker: "anushka",
                                    model: "bulbul:v3",
                                    target_language_code: targetLang,
                                    properties: {
                                        pace: 1.0,
                                        temperature: 0.6
                                    }
                                })
                            })];
                    case 2:
                        ttsResponse = _a.sent();
                        if (!ttsResponse.ok) return [3 /*break*/, 4];
                        return [4 /*yield*/, ttsResponse.json()];
                    case 3:
                        ttsResult = _a.sent();
                        if (ttsResult.audios && ttsResult.audios[0]) {
                            return [2 /*return*/, ttsResult.audios[0]];
                        }
                        return [3 /*break*/, 6];
                    case 4: return [4 /*yield*/, ttsResponse.text()];
                    case 5:
                        errTxt = _a.sent();
                        console.error("[Voice] Sarvam TTS helper failed with status ".concat(ttsResponse.status, ":"), errTxt);
                        _a.label = 6;
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        ttsErr_1 = _a.sent();
                        console.error("[Voice] Failed to generate Sarvam TTS in helper:", ttsErr_1);
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/, ""];
                }
            });
        });
    }
    var tenantId, userLanguage, currentScreen, screenContext, currentUser, currentRole, currentTheme, currentSubscription, selectedMonth, selectedYear, now, todayStr, history, mode, liveContext, apiKey, activeWorkers, workerDetails, responseSchemaProperties, voiceSchema, chatSchema, ai, model, systemInstruction, transcriptText, audioBuffer, mimeType, sarvamKey, formData, audioBlob, sarvamResponse, errText, sarvamResult, sarvamErr_1, transcriptionModel, transcriptionParts, transcriptionResult, localCommand, commandData, audioBase64, parts, instructionContext, imageBase64, result, completionText, jsonResponseText, match, parsedResult, commandIntent, commandResponse, transcriptText_1, commandData, audioBase64, parseError_1, error_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 20, , 21]);
                tenantId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.tenantId;
                userLanguage = req.body.currentLanguage || req.body.language || "en";
                currentScreen = req.body.currentScreen || "Unknown";
                screenContext = req.body.screenContext || {};
                currentUser = req.body.currentUser || screenContext.currentUser || "User";
                currentRole = req.body.currentRole || screenContext.currentRole || "contractor";
                currentTheme = req.body.currentTheme || screenContext.currentTheme || "light";
                currentSubscription = req.body.currentSubscription || screenContext.currentSubscription || "free";
                selectedMonth = req.body.selectedMonth !== undefined ? req.body.selectedMonth : (screenContext.selectedMonth !== undefined ? screenContext.selectedMonth : new Date().getMonth());
                selectedYear = req.body.selectedYear !== undefined ? req.body.selectedYear : (screenContext.selectedYear !== undefined ? screenContext.selectedYear : new Date().getFullYear());
                now = new Date();
                todayStr = "".concat(now.getFullYear(), "-").concat(String(now.getMonth() + 1).padStart(2, "0"), "-").concat(String(now.getDate()).padStart(2, "0"));
                history = req.body.history
                    ? typeof req.body.history === "string"
                        ? JSON.parse(req.body.history)
                        : req.body.history
                    : [];
                mode = req.body.mode || "chat";
                liveContext = req.body.liveContext || "";
                apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) {
                    console.warn("[Voice] GEMINI_API_KEY is not defined in environment variables.");
                    return [2 /*return*/, res.json({
                            success: false,
                            transcript: "[Voice Assistant API Key Missing]",
                            intent: "NONE",
                            action: "NONE",
                            data: {},
                            response: "Please set the GEMINI_API_KEY in backend/.env file to start using voice commands.",
                        })];
                }
                return [4 /*yield*/, models_1.Worker.find({ tenantId: tenantId, isArchived: false }, "name dailyRate category phone address")];
            case 1:
                activeWorkers = _b.sent();
                workerDetails = activeWorkers.map(function (w) { return ({
                    name: w.name,
                    dailyRate: w.dailyRate,
                    category: w.category,
                    phone: w.phone || "Not provided",
                    address: w.address || "Not provided",
                }); });
                responseSchemaProperties = {
                    intent: {
                        type: "STRING",
                        description: "The parsed user intent. Must be one of the supported intents or NONE.",
                        enum: [
                            "ADD_WORKER",
                            "UPDATE_WORKER",
                            "DELETE_WORKER",
                            "READ_WORKER",
                            "SEARCH_WORKER",
                            "MARK_PRESENT",
                            "MARK_ABSENT",
                            "MARK_HALF_DAY",
                            "MARK_OVERTIME",
                            "ADD_PAYMENT",
                            "DELETE_PAYMENT",
                            "ADD_ADVANCE",
                            "DELETE_ADVANCE",
                            "OPEN_DASHBOARD",
                            "OPEN_WORKERS",
                            "OPEN_ATTENDANCE",
                            "OPEN_SUMMARY",
                            "OPEN_REPORTS",
                            "OPEN_SETTINGS",
                            "OPEN_PROFILE",
                            "OPEN_SUBSCRIPTION",
                            "CHANGE_LANGUAGE",
                            "CHANGE_THEME",
                            "EXPORT_PDF",
                            "EXPORT_CSV",
                            "LOGOUT",
                            "DELETE_ACCOUNT",
                            "INCOMPLETE",
                            "NONE"
                        ]
                    },
                    worker: {
                        type: "STRING",
                        description: "Exact matched worker name from the system list (if applicable)."
                    },
                    amount: {
                        type: "NUMBER",
                        description: "Numeric value for payment amount, wage, daily rate, or advance (if applicable)."
                    },
                    date: {
                        type: "STRING",
                        description: "Target date in YYYY-MM-DD format (if applicable)."
                    },
                    language: {
                        type: "STRING",
                        description: "App language code like 'hi', 'en', 'mr', 'gu', 'ta', 'te' (if applicable)."
                    },
                    theme: {
                        type: "STRING",
                        description: "App theme state like 'dark' or 'light' (if applicable)."
                    },
                    query: {
                        type: "STRING",
                        description: "Search query string, category name, or worker name filter (if applicable)."
                    },
                    type: {
                        type: "STRING",
                        description: "Report type, like 'attendance' or 'summary' (if applicable)."
                    },
                    response: {
                        type: "STRING",
                        description: "Spoken or text response back to the user."
                    },
                    transcript: {
                        type: "STRING",
                        description: "Accurate transcription of the user's spoken audio."
                    }
                };
                voiceSchema = {
                    type: "OBJECT",
                    properties: __assign(__assign({}, responseSchemaProperties), { response: {
                            type: "STRING",
                            description: "A short, spoken confirmation in the user's active language (maximum 4 words) like 'Rahul marked present.' or 'Summary opened.'"
                        } }),
                    required: ["intent", "response", "transcript"]
                };
                chatSchema = {
                    type: "OBJECT",
                    properties: __assign(__assign({}, responseSchemaProperties), { response: {
                            type: "STRING",
                            description: "Detailed, helpful conversational response answering the user's question, using rich formatting, bullet points, or markdown tables for analytics where appropriate."
                        } }),
                    required: ["intent", "response", "transcript"]
                };
                ai = new generative_ai_1.GoogleGenerativeAI(apiKey);
                model = void 0;
                systemInstruction = "";
                if (mode === "voice") {
                    // 1. Voice mode model
                    model = ai.getGenerativeModel({
                        model: "gemini-2.5-flash",
                        generationConfig: {
                            responseMimeType: "application/json",
                            responseSchema: voiceSchema,
                        },
                    });
                    systemInstruction = "\nYou are Ask HAI.\nHAI means Haajari Artificial Intelligence.\nYou are not a chatbot.\nYou are not an assistant that explains things.\nYou are an Intent Parsing Engine.\nYour only responsibility is:\n1 Understand user request.\n2 Extract intent.\n3 Return structured JSON.\n4 Never execute actions.\n5 Never return explanations.\n6 Never return markdown.\n7 Never return conversational text.\nReturn JSON only.\n\nToday's Date is \"".concat(todayStr, "\".\nActive User: \"").concat(currentUser, "\", Role: \"").concat(currentRole, "\", Plan: \"").concat(currentSubscription, "\".\nActive App Language: \"").concat(userLanguage, "\". Active Screen: \"").concat(currentScreen, "\". Active Worker: \"").concat(screenContext.selectedWorkerName || "", "\".\nActive Month: \"").concat(selectedMonth, "\" (0-11), Active Year: \"").concat(selectedYear, "\".\n\nIMPORTANT CRITICAL RULES (HAI VOICE):\n1. Low Latency: Return only JSON matching the schema.\n2. Voice Confirmation: Set the \"response\" property to a short spoken confirmation (maximum 4 words) in the user's active language (e.g. \"Rahul added.\" or \"Attendance marked.\").\n3. Support Hindi, Marathi, English, Gujarati, Tamil, Telugu, Kannada, Punjabi, and Hinglish.\n4. If details are missing or the command is incomplete, return intent \"INCOMPLETE\" and ask for the missing field in 4 words or less.\n5. If the user does not mention a name but \"selectedWorkerName\" is active in context (\"").concat(screenContext.selectedWorkerName || "", "\"), use it.\n6. Match worker names against the system list below. If a user speaks a phonetic variation (e.g. \"Rahul ko\", \"Shubham\", \"Mohan Lal\"), use the EXACT name from the list.\n\nExisting Workers List:\n").concat(JSON.stringify(workerDetails), "\n");
                }
                else if (mode === "live") {
                    // 2. Live mode model
                    model = ai.getGenerativeModel({
                        model: "gemini-2.5-flash",
                        generationConfig: {
                            responseMimeType: "application/json",
                            responseSchema: voiceSchema,
                        },
                    });
                    systemInstruction = "\nYou are Ask HAI.\nHAI means Haajari Artificial Intelligence.\nYou are not a chatbot.\nYou are not an assistant that explains things.\nYou are an Intent Parsing Engine.\nYour only responsibility is:\n1 Understand user request.\n2 Extract intent.\n3 Return structured JSON.\n4 Never execute actions.\n5 Never return explanations.\n6 Never return markdown.\n7 Never return conversational text.\nReturn JSON only.\n\nToday's Date is \"".concat(todayStr, "\".\nActive User: \"").concat(currentUser, "\", Role: \"").concat(currentRole, "\", Plan: \"").concat(currentSubscription, "\".\nActive App Language: \"").concat(userLanguage, "\". Active Screen: \"").concat(currentScreen, "\". Active Worker: \"").concat(screenContext.selectedWorkerName || "", "\".\nActive Month: \"").concat(selectedMonth, "\" (0-11), Active Year: \"").concat(selectedYear, "\".\n\nIMPORTANT CRITICAL RULES (HAI LIVE):\n1. Continuous Speech: Speech is recorded in short chunks. If the transcript is cut off, incomplete, or contains noise, return intent \"INCOMPLETE\" and set the \"response\" property to an empty string (\"\").\n2. No conversational fluff: Confirmations must be extremely crisp (maximum 3 words).\n3. Resolve screen/worker context implicitly. E.g. if the user says \"present mark karo\" and is viewing Rahul, return intent \"MARK_PRESENT\" for worker Rahul.\n4. Supported intents are navigation (e.g. OPEN_SUMMARY, GO_BACK) and actions (e.g. MARK_PRESENT, ADD_PAYMENT).\n5. Match worker names against the system list below. Use phonetic matching.\n\nExisting Workers List:\n").concat(JSON.stringify(workerDetails), "\n");
                }
                else {
                    // 3. Chat mode model
                    model = ai.getGenerativeModel({
                        model: "gemini-2.5-flash",
                        generationConfig: {
                            responseMimeType: "application/json",
                            responseSchema: chatSchema,
                        },
                    });
                    systemInstruction = "\nYou are Ask HAI.\nHAI means Haajari Artificial Intelligence.\nYou are not a chatbot.\nYou are not an assistant that explains things.\nYou are an Intent Parsing Engine.\nYour only responsibility is:\n1 Understand user request.\n2 Extract intent.\n3 Return structured JSON.\n4 Never execute actions.\n5 Never return explanations (except inside the 'response' property of the returned JSON).\n6 Never return markdown (except inside the 'response' property of the returned JSON).\n7 Never return conversational text (except inside the 'response' property of the returned JSON).\nReturn JSON only.\n\nToday's Date is \"".concat(todayStr, "\".\nActive User: \"").concat(currentUser, "\", Role: \"").concat(currentRole, "\", Plan: \"").concat(currentSubscription, "\".\nActive App Language: \"").concat(userLanguage, "\". Active Screen: \"").concat(currentScreen, "\". Active Worker: \"").concat(screenContext.selectedWorkerName || "", "\".\nActive Month: \"").concat(selectedMonth, "\" (0-11), Active Year: \"").concat(selectedYear, "\".\n\nIMPORTANT CRITICAL RULES (HAI CHAT):\n1. Provide rich, detailed conversational answers with bullet points and markdown tables for reports/analytics where helpful inside the 'response' property of the returned JSON.\n2. If the user asks questions about workers, pending payments, or attendance, analyze the worker details list and summarize them in the response.\n3. If the user requests an action (e.g. \"Rahul ko present lagao\" or \"Add a worker Shubham with rate 600\"), set the corresponding \"intent\" (e.g. MARK_PRESENT, ADD_WORKER) so the app can execute it, and write a confirmation in \"response\". If no action is needed, return intent \"NONE\".\n4. Resolve worker names using phonetic matches from the list.\n\nExisting Workers List:\n").concat(JSON.stringify(workerDetails), "\n");
                }
                transcriptText = "";
                audioBuffer = null;
                mimeType = "";
                if (!req.body.text) return [3 /*break*/, 2];
                transcriptText = req.body.text;
                return [3 /*break*/, 12];
            case 2:
                if (req.file) {
                    audioBuffer = req.file.buffer;
                    mimeType = req.file.mimetype;
                }
                else if (req.body.audio && req.body.mimeType) {
                    audioBuffer = Buffer.from(req.body.audio, "base64");
                    mimeType = req.body.mimeType;
                }
                if (!(audioBuffer && audioBuffer.length > 0)) return [3 /*break*/, 11];
                console.log("[Voice] Transcribing audio with Sarvam AI Speech API...");
                _b.label = 3;
            case 3:
                _b.trys.push([3, 8, , 10]);
                sarvamKey = process.env.SARVAM_API_KEY || "";
                if (!sarvamKey) {
                    throw new Error("SARVAM_API_KEY is not defined in environment variables.");
                }
                formData = new FormData();
                audioBlob = new Blob([audioBuffer], { type: mimeType || "audio/wav" });
                formData.append("file", audioBlob, "audio.wav");
                formData.append("model", "saaras:v3");
                formData.append("mode", "transcribe");
                return [4 /*yield*/, fetch("https://api.sarvam.ai/speech-to-text", {
                        method: "POST",
                        headers: {
                            "api-subscription-key": sarvamKey,
                        },
                        body: formData,
                    })];
            case 4:
                sarvamResponse = _b.sent();
                if (!!sarvamResponse.ok) return [3 /*break*/, 6];
                return [4 /*yield*/, sarvamResponse.text()];
            case 5:
                errText = _b.sent();
                throw new Error("Sarvam STT REST API returned status ".concat(sarvamResponse.status, ": ").concat(errText));
            case 6: return [4 /*yield*/, sarvamResponse.json()];
            case 7:
                sarvamResult = _b.sent();
                transcriptText = (sarvamResult.transcript || "").trim();
                console.log("[Voice] Sarvam AI Transcription result:", transcriptText);
                return [3 /*break*/, 10];
            case 8:
                sarvamErr_1 = _b.sent();
                console.error("[Voice] Sarvam STT failed, falling back to Gemini:", sarvamErr_1);
                transcriptionModel = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
                transcriptionParts = [
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: audioBuffer.toString("base64")
                        }
                    },
                    { text: "Listen to the attached audio file. Transcribe the audio command accurately and output ONLY the plain text transcription. Do not add any extra labels, formatting, or commentary." }
                ];
                return [4 /*yield*/, callGeminiWithRetry(transcriptionModel, transcriptionParts)];
            case 9:
                transcriptionResult = _b.sent();
                transcriptText = (transcriptionResult.response.text() || "").trim();
                return [3 /*break*/, 10];
            case 10: return [3 /*break*/, 12];
            case 11: return [2 /*return*/, res.status(400).json({ error: "No audio file, base64 audio payload, or text input provided" })];
            case 12:
                if (!transcriptText) return [3 /*break*/, 14];
                localCommand = parseLocalCommand(transcriptText);
                if (!localCommand) return [3 /*break*/, 14];
                console.log("[Voice] Local Command matched backend-side: \"".concat(transcriptText, "\" ->"), localCommand.intent);
                commandData = {
                    name: localCommand.data.name || "",
                    category: localCommand.data.category || "",
                    dailyRate: localCommand.data.amount || 0,
                    amount: localCommand.data.amount || 0,
                    date: localCommand.data.date || "",
                    language: localCommand.data.language || "",
                    theme: localCommand.data.theme || "",
                    query: localCommand.data.query || "",
                    type: localCommand.data.type || "",
                    screen: localCommand.data.query || "",
                };
                return [4 /*yield*/, generateSarvamTTS(localCommand.response, userLanguage)];
            case 13:
                audioBase64 = _b.sent();
                return [2 /*return*/, res.json({
                        success: true,
                        transcript: transcriptText,
                        intent: localCommand.intent,
                        action: localCommand.intent,
                        data: commandData,
                        response: localCommand.response,
                        audio: audioBase64 || undefined,
                        command: __assign({ action: localCommand.intent }, commandData),
                    })];
            case 14:
                parts = [];
                instructionContext = systemInstruction;
                if (history && history.length > 0) {
                    instructionContext += "\n\nCONVERSATION HISTORY:\n" + history.map(function (h) {
                        var _a, _b;
                        var roleName = h.role === "user" ? "User" : "HAI Assistant";
                        return "".concat(roleName, ": ").concat(h.text || ((_b = (_a = h.parts) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.text) || "");
                    }).join("\n");
                }
                parts.push({ text: instructionContext });
                if (liveContext) {
                    parts.push({
                        text: "Previous incomplete speech context: \"".concat(liveContext, "\"\nCombine this previous context with the new transcribed audio/text command to understand the full user sentence.")
                    });
                }
                // 2. Add image part if present
                if (req.body.image) {
                    console.log("[Voice] Adding image attachment to Gemini prompt...");
                    imageBase64 = req.body.image.replace(/^data:image\/\w+;base64,/, "");
                    parts.push({
                        inlineData: {
                            mimeType: "image/png",
                            data: imageBase64
                        }
                    });
                    parts.push({
                        text: "Analyze the attached image. If it is a worker card, ID card, or document, perform OCR/information extraction and execute the appropriate action (defaulting to ADD_WORKER with details like name, dailyRate, etc.)."
                    });
                }
                // 3. Add text prompt
                parts.push({
                    text: "User command text: \"".concat(transcriptText, "\"\n\nAnalyze the intent and return the structured JSON object, setting the 'transcript' property to the user's text prompt.")
                });
                // Call Gemini API
                console.log("[Voice] Calling Gemini API (".concat(model.model, ")..."));
                return [4 /*yield*/, callGeminiWithRetry(model, parts)];
            case 15:
                result = _b.sent();
                completionText = result.response.text() || "{}";
                console.log("[Voice] Gemini parser output:", completionText);
                _b.label = 16;
            case 16:
                _b.trys.push([16, 18, , 19]);
                jsonResponseText = completionText.trim();
                // Extract JSON if wrapped in markdown code blocks
                if (jsonResponseText.includes("```")) {
                    match = jsonResponseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                    if (match && match[1]) {
                        jsonResponseText = match[1].trim();
                    }
                }
                // Balance braces to exclude any duplicate closing brackets or trailing text
                jsonResponseText = extractBalancedJson(jsonResponseText);
                parsedResult = JSON.parse(jsonResponseText);
                commandIntent = parsedResult.intent || "NONE";
                commandResponse = parsedResult.response || "I processed your request.";
                transcriptText_1 = parsedResult.transcript || req.body.text || "[Audio Transcribed]";
                commandData = {
                    name: parsedResult.worker || "",
                    category: parsedResult.query || "",
                    dailyRate: parsedResult.amount || 0,
                    amount: parsedResult.amount || 0,
                    date: parsedResult.date || "",
                    language: parsedResult.language || "",
                    theme: parsedResult.theme || "",
                    query: parsedResult.query || "",
                    type: parsedResult.type || "",
                    screen: parsedResult.query || "",
                };
                return [4 /*yield*/, generateSarvamTTS(commandResponse, userLanguage)];
            case 17:
                audioBase64 = _b.sent();
                return [2 /*return*/, res.json({
                        success: true,
                        transcript: transcriptText_1,
                        intent: commandIntent,
                        action: commandIntent, // mapped to action for backwards compatibility
                        data: commandData,
                        response: commandResponse,
                        audio: audioBase64 || undefined,
                        command: __assign({ action: commandIntent }, commandData),
                    })];
            case 18:
                parseError_1 = _b.sent();
                console.error("[Voice] Failed to parse Gemini response as JSON:", completionText, parseError_1);
                return [2 /*return*/, res.status(500).json({
                        error: "AI failed to produce a structured action",
                        raw: completionText,
                    })];
            case 19: return [3 /*break*/, 21];
            case 20:
                error_1 = _b.sent();
                console.error("[Voice] Error processing voice command via Gemini:", error_1);
                return [2 /*return*/, res.status(500).json({ error: error_1.message })];
            case 21: return [2 /*return*/];
        }
    });
}); };
exports.processVoice = processVoice;
exports.processVoiceCommand = exports.processVoice;
