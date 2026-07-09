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
exports.sendVerificationEmail = sendVerificationEmail;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
var nodemailer_1 = require("nodemailer");
var transporter = null;
function getTransporter() {
    return __awaiter(this, void 0, void 0, function () {
        var host, port, user, pass, testAccount, err_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (transporter)
                        return [2 /*return*/, transporter];
                    host = process.env.SMTP_HOST;
                    port = parseInt(process.env.SMTP_PORT || "587");
                    user = process.env.SMTP_USER;
                    pass = process.env.SMTP_PASS;
                    if (!(host && user && pass)) return [3 /*break*/, 1];
                    transporter = nodemailer_1.default.createTransport({
                        host: host,
                        port: port,
                        secure: port === 465,
                        auth: { user: user, pass: pass },
                    });
                    return [3 /*break*/, 5];
                case 1:
                    console.log("No SMTP credentials detected in .env. Initializing test Ethereal SMTP transporter...");
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, nodemailer_1.default.createTestAccount()];
                case 3:
                    testAccount = _a.sent();
                    transporter = nodemailer_1.default.createTransport({
                        host: "smtp.ethereal.email",
                        port: 587,
                        secure: false,
                        auth: {
                            user: testAccount.user,
                            pass: testAccount.pass,
                        },
                    });
                    return [3 /*break*/, 5];
                case 4:
                    err_1 = _a.sent();
                    console.warn("Failed to create Ethereal SMTP account, creating console-fallback mailer", err_1);
                    // Fallback in case of networking issues with Ethereal
                    transporter = {
                        sendMail: function (mailOptions) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                console.log("\n================ MAIL FALLBACK ================");
                                console.log("FROM: ".concat(mailOptions.from));
                                console.log("TO: ".concat(mailOptions.to));
                                console.log("SUBJECT: ".concat(mailOptions.subject));
                                console.log("HTML CONTENT:");
                                console.log(mailOptions.html);
                                console.log("================================================\n");
                                return [2 /*return*/, { messageId: "fallback-message-id" }];
                            });
                        }); },
                    };
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/, transporter];
            }
        });
    });
}
function sendVerificationEmail(email, token) {
    return __awaiter(this, void 0, void 0, function () {
        var client, verificationLink, info, previewUrl, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, getTransporter()];
                case 1:
                    client = _a.sent();
                    verificationLink = "".concat(process.env.CLIENT_URL || "http://localhost:5000", "/api/auth/verify-email/").concat(token);
                    return [4 /*yield*/, client.sendMail({
                            from: '"Haajari Workforce" <no-reply@haajari.com>',
                            to: email,
                            subject: "Verify Your Email - Haajari App",
                            html: "\n        <h2>Welcome to Haajari App!</h2>\n        <p>Thank you for signing up. Please verify your email by clicking the link below:</p>\n        <p><a href=\"".concat(verificationLink, "\" target=\"_blank\">").concat(verificationLink, "</a></p>\n        <p>This verification link will remain active for 24 hours.</p>\n      "),
                        })];
                case 2:
                    info = _a.sent();
                    previewUrl = nodemailer_1.default.getTestMessageUrl(info);
                    if (previewUrl) {
                        console.log("\n\uD83D\uDCE7 Verification email sent! View preview: ".concat(previewUrl, "\n"));
                    }
                    else {
                        console.log("Verification email sent successfully to ".concat(email));
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.error("Error sending verification email:", error_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function sendPasswordResetEmail(email, token) {
    return __awaiter(this, void 0, void 0, function () {
        var client, resetLink, info, previewUrl, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, getTransporter()];
                case 1:
                    client = _a.sent();
                    resetLink = "".concat(process.env.CLIENT_URL || "http://localhost:5000", "/api/auth/reset-password?token=").concat(token);
                    return [4 /*yield*/, client.sendMail({
                            from: '"Haajari Support" <support@haajari.com>',
                            to: email,
                            subject: "Password Reset Request - Haajari App",
                            html: "\n        <h2>Password Reset Request</h2>\n        <p>You requested a password reset. Please click the link below to set a new password:</p>\n        <p><a href=\"".concat(resetLink, "\" target=\"_blank\">").concat(resetLink, "</a></p>\n        <p>If you did not request this, please ignore this email. The link expires in 1 hour.</p>\n      "),
                        })];
                case 2:
                    info = _a.sent();
                    previewUrl = nodemailer_1.default.getTestMessageUrl(info);
                    if (previewUrl) {
                        console.log("\n\uD83D\uDCE7 Password reset email sent! View preview: ".concat(previewUrl, "\n"));
                    }
                    else {
                        console.log("Password reset email sent successfully to ".concat(email));
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _a.sent();
                    console.error("Error sending password reset email:", error_2);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
