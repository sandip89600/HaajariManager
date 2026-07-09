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
exports.submitFeedback = exports.reportProblem = void 0;
var User_1 = require("../models/User");
var SupportProblem_1 = require("../models/SupportProblem");
var SupportFeedback_1 = require("../models/SupportFeedback");
var reportProblem = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, _a, subject, description, screenshot, user, newProblem, error_1;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 3, , 4]);
                userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
                if (!userId) {
                    return [2 /*return*/, res.status(401).json({ error: "Unauthorized" })];
                }
                _a = req.body, subject = _a.subject, description = _a.description, screenshot = _a.screenshot;
                if (!subject || !description) {
                    return [2 /*return*/, res.status(400).json({ error: "Subject and description are required" })];
                }
                return [4 /*yield*/, User_1.User.findById(userId)];
            case 1:
                user = _c.sent();
                if (!user) {
                    return [2 /*return*/, res.status(404).json({ error: "User not found" })];
                }
                newProblem = new SupportProblem_1.SupportProblem({
                    userId: userId,
                    userName: user.name,
                    mobileNumber: user.phone,
                    subject: subject,
                    description: description,
                    screenshot: screenshot,
                });
                return [4 /*yield*/, newProblem.save()];
            case 2:
                _c.sent();
                return [2 /*return*/, res.status(201).json({ success: true, message: "Problem reported successfully", problem: newProblem })];
            case 3:
                error_1 = _c.sent();
                return [2 /*return*/, res.status(500).json({ error: error_1.message })];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.reportProblem = reportProblem;
var submitFeedback = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var userId, _a, rating, feedback, ratingNum, user, newFeedback, error_2;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 3, , 4]);
                userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id;
                if (!userId) {
                    return [2 /*return*/, res.status(401).json({ error: "Unauthorized" })];
                }
                _a = req.body, rating = _a.rating, feedback = _a.feedback;
                if (rating === undefined || !feedback) {
                    return [2 /*return*/, res.status(400).json({ error: "Rating and feedback text are required" })];
                }
                ratingNum = Number(rating);
                if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
                    return [2 /*return*/, res.status(400).json({ error: "Rating must be a number between 1 and 5" })];
                }
                return [4 /*yield*/, User_1.User.findById(userId)];
            case 1:
                user = _c.sent();
                if (!user) {
                    return [2 /*return*/, res.status(404).json({ error: "User not found" })];
                }
                newFeedback = new SupportFeedback_1.SupportFeedback({
                    userId: userId,
                    userName: user.name,
                    mobileNumber: user.phone,
                    rating: ratingNum,
                    feedback: feedback,
                });
                return [4 /*yield*/, newFeedback.save()];
            case 2:
                _c.sent();
                return [2 /*return*/, res.status(201).json({ success: true, message: "Feedback submitted successfully", feedback: newFeedback })];
            case 3:
                error_2 = _c.sent();
                return [2 /*return*/, res.status(500).json({ error: error_2.message })];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.submitFeedback = submitFeedback;
