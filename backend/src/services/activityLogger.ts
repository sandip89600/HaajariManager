import { Request } from "express";
import mongoose from "mongoose";
import { AuditLog } from "../models/AuditLog";
import { User } from "../models/User";
import { broadcastAdminActivity } from "../utils/socket";

interface LogActivityOptions {
  req?: Request;
  action: string;
  targetType: string;
  targetId: string;
  userId?: string;
  userName?: string;
  tenantId?: string;
  role?: string;
  changes?: {
    before?: any;
    after?: any;
  };
  oldValue?: any;
  newValue?: any;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
}

/**
 * Parses user agent to extract basic OS/Platform & Device info.
 */
function parseUserAgent(userAgent?: string): { platform: string; device: string } {
  if (!userAgent) {
    return { platform: "unknown", device: "unknown" };
  }

  let platform = "Web Browser";
  let device = "Desktop";

  const ua = userAgent.toLowerCase();

  // Platform detection
  if (ua.includes("android")) {
    platform = "Android";
    device = "Mobile";
  } else if (ua.includes("iphone") || ua.includes("ipad")) {
    platform = "iOS";
    device = ua.includes("ipad") ? "Tablet" : "Mobile";
  } else if (ua.includes("windows")) {
    platform = "Windows";
  } else if (ua.includes("macintosh") || ua.includes("mac os")) {
    platform = "macOS";
  } else if (ua.includes("linux")) {
    platform = "Linux";
  }

  // Device model parsing attempt
  if (ua.includes("mobile")) {
    device = "Mobile";
  }

  return { platform, device };
}

/**
 * Log a user action or system event into the global activity logging system,
 * persist in MongoDB, and broadcast in real-time to the Live Admin Dashboard.
 */
export async function logActivity(options: LogActivityOptions): Promise<void> {
  try {
    const { req, action, targetType, targetId, changes, oldValue, newValue, location } = options;

    let userId = options.userId;
    let userName = options.userName;
    let tenantId = options.tenantId;
    let role = options.role;
    let ipAddress = "127.0.0.1";
    let platform = "unknown";
    let device = "unknown";

    // Extract information from Request
    if (req) {
      // Fetch metadata from authenticated req.user (see AuthenticatedRequest)
      const authUser = (req as any).user;
      if (authUser) {
        if (!userId) userId = authUser.id;
        if (!tenantId) tenantId = authUser.tenantId;
        if (!role) role = authUser.role;
      }

      // Fetch client IP address
      const xForwardedFor = req.headers["x-forwarded-for"];
      if (typeof xForwardedFor === "string") {
        ipAddress = xForwardedFor.split(",")[0].trim();
      } else if (Array.isArray(xForwardedFor)) {
        ipAddress = xForwardedFor[0];
      } else {
        ipAddress = req.ip || req.socket.remoteAddress || "127.0.0.1";
      }

      // Parse user-agent
      const userAgent = req.headers["user-agent"];
      const uaInfo = parseUserAgent(userAgent);
      platform = uaInfo.platform;
      device = uaInfo.device;
    }

    // If we have a userId but no userName, fetch from Database
    if (userId && !userName) {
      try {
        const userObj = await User.findById(userId).select("name role tenantId");
        if (userObj) {
          userName = userObj.name;
          if (!role) role = userObj.role;
          if (!tenantId) tenantId = userObj.tenantId?.toString();
        }
      } catch (dbErr) {
        console.warn("[ActivityLogger] Failed to fetch user profile for audit:", dbErr);
      }
    }

    // Build the expanded AuditLog model entity
    const auditLogData: any = {
      action,
      targetType,
      targetId,
      entityType: targetType,
      entityId: targetId,
      ipAddress,
      device,
      platform,
      timestamp: new Date(),
    };

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      auditLogData.userId = new mongoose.Types.ObjectId(userId);
    }
    if (tenantId && mongoose.Types.ObjectId.isValid(tenantId)) {
      auditLogData.tenantId = new mongoose.Types.ObjectId(tenantId);
    }
    if (userName) {
      auditLogData.userName = userName;
    }
    if (role) {
      auditLogData.role = role;
    }

    // Handle audit change logs
    if (changes) {
      auditLogData.changes = changes;
      if (changes.before && !oldValue) auditLogData.oldValue = changes.before;
      if (changes.after && !newValue) auditLogData.newValue = changes.after;
    } else if (oldValue || newValue) {
      auditLogData.changes = { before: oldValue, after: newValue };
      auditLogData.oldValue = oldValue;
      auditLogData.newValue = newValue;
    }

    // Inject location if supplied
    if (location) {
      auditLogData.location = location;
    }

    // Save activity record to DB
    const savedLog = await AuditLog.create(auditLogData);

    // Trigger Socket.IO broadcast to real-time administrative consoles
    await broadcastAdminActivity(savedLog);

  } catch (error) {
    // Fail-safe: NEVER throw inside logActivity to protect primary user request flows
    console.error("[ActivityLogger] Error logging action:", error);
  }
}
