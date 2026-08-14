import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { AuditLog } from "../models/AuditLog";

let io: Server | null = null;

const formatAuditLog = (log: any): string => {
  const userName = log.userName || log.userId?.name || "Someone";
  const userRole = log.role || log.userId?.role || "";
  const tenantName = log.tenantId?.name || "their organization";
  const action = log.action;
  const targetType = log.targetType;

  // Custom detailed event action messages
  if (action === "USER_SIGNUP" || action === "ACCOUNT_CREATED") {
    return `${userName} (${userRole}) registered a new account.`;
  }
  if (action === "USER_LOGIN") {
    return `${userName} logged in successfully.`;
  }
  if (action === "USER_LOGOUT") {
    return `${userName} logged out.`;
  }
  if (action === "CHANGE_PASSWORD" || action === "PASSWORD_CHANGED") {
    return `${userName} updated their password.`;
  }
  if (action === "UPDATE_PROFILE" || action === "PROFILE_UPDATED") {
    return `${userName} updated their profile settings.`;
  }
  if (action === "GUEST_LOGIN") {
    return `New guest user initiated onboarding.`;
  }
  if (action === "GPS_ATTENDANCE") {
    return `${userName} clocked attendance via GPS.`;
  }
  if (action === "EXPORT_PDF") {
    return `${userName} generated and exported a PDF report.`;
  }
  if (action === "EXPORT_EXCEL") {
    return `${userName} generated and exported an Excel spreadsheet.`;
  }
  if (action === "BACKUP_CREATED") {
    return `${userName} created a manual database backup.`;
  }
  if (action === "RESTORE_COMPLETED") {
    return `System database restored successfully.`;
  }
  if (action === "SUBSCRIPTION_PURCHASED") {
    return `${tenantName} purchased a premium subscription plan.`;
  }

  switch (action) {
    case "CREATE":
    case "WORKER_CREATED":
    case "SITE_CREATED":
    case "ATTENDANCE_MARKED":
    case "PAYMENT_ADDED":
    case "MATERIAL_ADDED":
    case "EXPENSE_ADDED":
      if (targetType === "WORKER" || action === "WORKER_CREATED") {
        const workerName = log.changes?.after?.name || log.newValue?.name || "a worker";
        return `${userName} added worker "${workerName}".`;
      }
      if (targetType === "ATTENDANCE" || action === "ATTENDANCE_MARKED") {
        return `${userName} marked attendance.`;
      }
      if (targetType === "PAYMENT" || action === "PAYMENT_ADDED") {
        const amount = log.changes?.after?.amount || log.newValue?.amount || 0;
        return `${userName} recorded a payment of ₹${amount}.`;
      }
      if (targetType === "PROJECT" || targetType === "SITE" || action === "SITE_CREATED") {
        const projName = log.changes?.after?.name || log.newValue?.name || "a project/site";
        return `${userName} created site "${projName}".`;
      }
      return `${userName} created a new ${targetType.toLowerCase()}.`;

    case "UPDATE":
    case "WORKER_UPDATED":
    case "ATTENDANCE_UPDATED":
    case "SITE_UPDATED":
    case "PAYMENT_UPDATED":
      if (targetType === "WORKER" || action === "WORKER_UPDATED") {
        const workerName = log.changes?.after?.name || log.newValue?.name || "a worker";
        return `${userName} updated worker "${workerName}".`;
      }
      if (targetType === "ATTENDANCE" || action === "ATTENDANCE_UPDATED") {
        return `${userName} modified attendance records.`;
      }
      if (targetType === "PROJECT" || targetType === "SITE" || action === "SITE_UPDATED") {
        const projName = log.changes?.after?.name || log.newValue?.name || "a site";
        return `${userName} updated site settings for "${projName}".`;
      }
      return `${userName} modified a ${targetType.toLowerCase()}.`;

    case "SOFT_DELETE":
    case "DELETE":
    case "WORKER_DELETED":
    case "SITE_DELETED":
    case "ATTENDANCE_DELETED":
    case "PAYMENT_DELETED":
      if (targetType === "WORKER" || action === "WORKER_DELETED") {
        const workerName = log.changes?.before?.name || log.oldValue?.name || "a worker";
        return `${userName} deleted worker "${workerName}".`;
      }
      if (targetType === "PAYMENT" || action === "PAYMENT_DELETED") {
        const amount = log.changes?.before?.amount || log.oldValue?.amount || 0;
        return `${userName} deleted a payment transaction of ₹${amount}.`;
      }
      if (targetType === "PROJECT" || targetType === "SITE" || action === "SITE_DELETED") {
        const projName = log.changes?.before?.name || log.oldValue?.name || "a site";
        return `${userName} deleted site "${projName}".`;
      }
      return `${userName} deleted a ${targetType.toLowerCase()}.`;

    default:
      return `${userName} performed action: ${action} on ${targetType}.`;
  }
};

export const initSocket = (server: HttpServer): Server => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] Admin/User client connected: ${socket.id}`);
    
    socket.on("join_user_room", (userId: string) => {
      if (userId) {
        socket.join(`user_${userId}`);
        console.log(`[Socket] Client ${socket.id} joined room user_${userId}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error("Socket.io is not initialized!");
  }
  return io;
};

export const broadcastAdminActivity = async (activity?: any) => {
  if (io) {
    try {
      if (activity && activity._id) {
        // Fetch and populate the audit log to retrieve user and tenant names
        const populatedLog = await AuditLog.findById(activity._id)
          .populate("userId", "name role")
          .populate("tenantId", "name");
          
        if (populatedLog) {
          const message = formatAuditLog(populatedLog);
          console.log(`[Socket] Broadcasting activity event: "${message}"`);
          
          io.emit("admin_activity", {
            id: populatedLog._id.toString(),
            message,
            action: populatedLog.action,
            userName: populatedLog.userName || (populatedLog.userId as any)?.name || "Someone",
            role: populatedLog.role || (populatedLog.userId as any)?.role || "user",
            platform: populatedLog.platform || "unknown",
            device: populatedLog.device || "unknown",
            ipAddress: populatedLog.ipAddress || "127.0.0.1",
            timestamp: populatedLog.timestamp || new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      console.error("[Socket] Failed to fetch and format real-time activity:", err);
    }
    
    // Always trigger database updates in admin panel
    io.emit("admin_dashboard_update");
  } else {
    console.log("[Socket] Socket server not running, skipping broadcast.");
  }
};

