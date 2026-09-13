import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  username?: string;
  email?: string;
  passwordHash: string;
  phone: string;
  uniqueId: string;
  role: "contractor" | "builder" | "supervisor" | "labor" | "admin";
  workerCategory?: string;
  dailyWage?: number;
  connectionStatus?: "connected" | "pending" | "declined" | "not_connected";
  contractorId?: mongoose.Types.ObjectId;
  contractorName?: string;
  contractorCompany?: string;
  assignedSiteIds?: mongoose.Types.ObjectId[];
  assignedProjects?: mongoose.Types.ObjectId[];
  isActive: boolean;
  isVerified: boolean;
  isPhoneVerified?: boolean;
  phoneVerifiedAt?: Date;
  status?: "pending_verification" | "active" | "suspended" | "deactivated";
  passwordResetToken?: string;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  passwordResetRequestedAt?: Date;
  lastPhoneVerificationSentAt?: Date;
  refreshTokens: string[];
  createdAt: Date;
  lastLogin?: Date;
  address?: string;
  profileImage?: string;
  avatarColor?: string;
  googleId?: string;
  authProvider?: "password" | "otp" | "google";

  // Security Module
  otpEnabled?: boolean;
  biometricEnabled?: boolean;
  biometricToken?: string;
  profileVisibility?: "public" | "private";
  attendanceVisibility?: "only_me" | "supervisors" | "admin";
  analyticsConsent?: boolean;
  notificationPreferences?: {
    attendanceAlerts: boolean;
    salaryAlerts: boolean;
    appUpdates: boolean;
  };
  trustedDevices?: Array<{
    deviceId: string;
    deviceName: string;
    deviceOs?: string;
    deviceBrowser?: string;
    ipAddress?: string;
    location?: string;
    trusted?: boolean;
    trustedAt?: Date;
    firstSeenAt?: Date;
    lastActiveAt: Date;
    isSuspicious?: boolean;
    isRevoked?: boolean;
  }>;
  loginHistory?: Array<{
    loginTime: Date;
    logoutTime?: Date;
    deviceId?: string;
    deviceName?: string;
    deviceOs?: string;
    deviceBrowser?: string;
    ipAddress?: string;
    location?: string;
  }>;
  securityLogs?: Array<{
    timestamp: Date;
    eventType: string;
    details?: string;
    ipAddress?: string;
    deviceId?: string;
  }>;
  expoPushToken?: string;
}

const UserSchema = new Schema<IUser>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  name: { type: String, required: true },
  expoPushToken: { type: String },
  username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  phone: { type: String, required: true, unique: true, trim: true },
  uniqueId: { type: String, uppercase: true, trim: true },
  role: { type: String, enum: ["contractor", "builder", "supervisor", "labor", "admin"], default: "contractor" },
  workerCategory: { type: String, trim: true },
  dailyWage: { type: Number, min: 0 },
  connectionStatus: { type: String, enum: ["connected", "pending", "declined", "not_connected"], default: "not_connected" },
  contractorId: { type: Schema.Types.ObjectId, ref: "User" },
  contractorName: { type: String, trim: true },
  contractorCompany: { type: String, trim: true },
  assignedSiteIds: [{ type: Schema.Types.ObjectId, ref: "Site" }],
  assignedProjects: [{ type: Schema.Types.ObjectId, ref: "Project" }],
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: true },
  isPhoneVerified: { type: Boolean, default: false },
  phoneVerifiedAt: { type: Date },
  status: { type: String, enum: ["pending_verification", "active", "suspended", "deactivated"], default: "active" },
  passwordResetToken: { type: String },
  passwordResetTokenHash: { type: String },
  passwordResetExpires: { type: Date },
  passwordResetRequestedAt: { type: Date },
  lastPhoneVerificationSentAt: { type: Date },
  refreshTokens: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date },
  address: { type: String },
  profileImage: { type: String },
  avatarColor: { type: String, default: "#4ECDC4" },
  googleId: { type: String, unique: true, sparse: true, trim: true },
  authProvider: { type: String, enum: ["password", "otp", "google"], default: "password" },

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
    trusted: { type: Boolean, default: false },
    trustedAt: { type: Date },
    firstSeenAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
    isSuspicious: { type: Boolean, default: false },
    isRevoked: { type: Boolean, default: false }
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
UserSchema.index({ uniqueId: 1 }, { unique: true, sparse: true });

export function generateUserUniqueId(role: string): string {
  const r = (role || "").toLowerCase();
  let prefix = "HM-C";
  if (r === "supervisor") {
    prefix = "HM-S";
  } else if (r === "labor" || r === "worker") {
    prefix = "HM-W";
  }
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${randomNum}`;
}

UserSchema.pre<IUser>("save", async function (next) {
  if (!this.uniqueId) {
    let uniqueId = generateUserUniqueId(this.role);
    let attempts = 0;
    while (attempts < 10) {
      const existing = await mongoose.models.User?.findOne({ uniqueId });
      if (!existing) {
        this.uniqueId = uniqueId;
        break;
      }
      uniqueId = generateUserUniqueId(this.role);
      attempts++;
    }
    if (!this.uniqueId) {
      this.uniqueId = uniqueId;
    }
  }
  next();
});

export const User = mongoose.model<IUser>("User", UserSchema);
