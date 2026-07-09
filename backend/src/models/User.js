"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
var mongoose_1 = require("mongoose");
var UserSchema = new mongoose_1.Schema({
    tenantId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Tenant", required: true },
    name: { type: String, required: true },
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, required: true, unique: true, trim: true },
    role: { type: String, enum: ["contractor", "builder", "supervisor", "admin"], default: "contractor" },
    assignedProjects: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "Project" }],
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
    refreshTokens: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date },
    address: { type: String },
    profileImage: { type: String },
    avatarColor: { type: String, default: "#4ECDC4" },
    // Security Module Settings
    otpEnabled: { type: Boolean, default: false },
    biometricEnabled: { type: Boolean, default: false },
    biometricToken: { type: String },
    profileVisibility: { type: String, enum: ["public", "private"], default: "public" },
    attendanceVisibility: { type: String, enum: ["only_me", "supervisors", "admin"], default: "only_me" },
    analyticsConsent: { type: Boolean, default: true },
    notificationPreferences: {
        attendanceAlerts: { type: Boolean, default: true },
        salaryAlerts: { type: Boolean, default: true },
        appUpdates: { type: Boolean, default: true },
    },
    trustedDevices: [{
            deviceId: { type: String },
            deviceName: { type: String },
            deviceOs: { type: String },
            deviceBrowser: { type: String },
            ipAddress: { type: String },
            location: { type: String },
            lastActiveAt: { type: Date, default: Date.now },
            isSuspicious: { type: Boolean, default: false }
        }],
    loginHistory: [{
            loginTime: { type: Date, default: Date.now },
            logoutTime: { type: Date },
            deviceId: { type: String },
            deviceName: { type: String },
            deviceOs: { type: String },
            deviceBrowser: { type: String },
            ipAddress: { type: String },
            location: { type: String }
        }],
    securityLogs: [{
            timestamp: { type: Date, default: Date.now },
            eventType: { type: String },
            details: { type: String },
            ipAddress: { type: String },
            deviceId: { type: String }
        }]
});
UserSchema.index({ tenantId: 1 });
exports.User = mongoose_1.default.model("User", UserSchema);
