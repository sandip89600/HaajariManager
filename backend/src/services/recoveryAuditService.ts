import mongoose from "mongoose";
import { AuditLog, User } from "../models";

export type RecoveryEventType =
  | "otp_requested"
  | "otp_failed"
  | "otp_verified"
  | "recovery_blocked"
  | "email_confirmation_requested"
  | "email_confirmed"
  | "password_reset"
  | "password_reset_failed";

interface LogRecoveryParams {
  userId?: mongoose.Types.ObjectId | string;
  tenantId?: mongoose.Types.ObjectId | string;
  userName?: string;
  role?: string;
  eventType: RecoveryEventType;
  channel?: "sms" | "email" | "web";
  ipAddress?: string;
  userAgent?: string;
  details?: string;
  phone?: string;
}

export async function logRecoveryEvent(params: LogRecoveryParams): Promise<void> {
  try {
    const {
      userId,
      tenantId,
      userName,
      role,
      eventType,
      channel = "sms",
      ipAddress = "127.0.0.1",
      userAgent,
      details,
      phone
    } = params;

    // 1. Persist to central AuditLog collection
    const auditRecord = new AuditLog({
      tenantId: tenantId ? new mongoose.Types.ObjectId(tenantId.toString()) : undefined,
      userId: userId ? new mongoose.Types.ObjectId(userId.toString()) : undefined,
      userName: userName || "Account Recovery User",
      role: role || "user",
      action: `RECOVERY_${eventType.toUpperCase()}`,
      targetType: "ACCOUNT_RECOVERY",
      targetId: userId ? userId.toString() : phone || "unknown",
      ipAddress,
      device: userAgent ? userAgent.substring(0, 100) : "Mobile/API",
      platform: channel,
      changes: {
        eventType,
        channel,
        details: details || `Account recovery event: ${eventType}`
      },
      timestamp: new Date()
    });
    await auditRecord.save();

    // 2. Append to user security log if user document is available
    if (userId) {
      await User.findByIdAndUpdate(userId, {
        $push: {
          securityLogs: {
            timestamp: new Date(),
            eventType: `RECOVERY_${eventType.toUpperCase()}`,
            details: details || `Recovery event: ${eventType}`,
            ipAddress
          }
        }
      });
    }

    console.log(`[Recovery Audit] Logged event: ${eventType} (Channel: ${channel})`);
  } catch (err: any) {
    console.warn(`[Recovery Audit Warning] Failed to persist audit event:`, err?.message || err);
  }
}
