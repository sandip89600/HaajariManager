"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpCode = void 0;
var mongoose_1 = require("mongoose");
var OtpCodeSchema = new mongoose_1.Schema({
    phone: { type: String, required: true },
    otpCodeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    attemptsCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});
// Auto-expire documents after 5 minutes (300 seconds)
OtpCodeSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });
exports.OtpCode = mongoose_1.default.model("OtpCode", OtpCodeSchema);
