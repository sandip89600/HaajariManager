import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  username?: string;
  email?: string;
  passwordHash: string;
  phone: string;
  role: "contractor" | "builder" | "supervisor" | "admin";
  assignedProjects?: mongoose.Types.ObjectId[];
  isActive: boolean;
  isVerified: boolean;
  verificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  refreshTokens: string[];
  createdAt: Date;
  lastLogin?: Date;
  address?: string;
  profileImage?: string;
  avatarColor?: string;

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
    lastActiveAt: Date;
    isSuspicious: boolean;
  }>;
  loginHistory?: Array<{
    loginTime: Date;
    logoutTime?: Date;
    deviceId: string;
    deviceName: string;
    deviceOs?: string;
    deviceBrowser?: string;
    ipAddress?: string;
    location?: string;
  }>;
  securityLogs?: Array<{
    timestamp: Date;
    eventType: string;
    details: string;
    ipAddress?: string;
    deviceId?: string;
  }>;
}

const UserSchema = new Schema<IUser>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  name: { type: String, required: true },
  username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  phone: { type: String, required: true, unique: true, trim: true },
  role: { type: String, enum: ["contractor", "builder", "supervisor", "admin"], default: "contractor" },
  assignedProjects: [{ type: Schema.Types.ObjectId, ref: "Project" }],
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

export const User = mongoose.model<IUser>("User", UserSchema);
