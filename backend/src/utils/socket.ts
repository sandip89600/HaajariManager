import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { AuditLog } from "../models/AuditLog";

let io: Server | null = null;

const formatAuditLog = (log: any): string => {
  const userName = log.userId?.name || "Someone";
  const userRole = log.userId?.role || "";
  const tenantName = log.tenantId?.name || "their organization";
  const action = log.action;
  const targetType = log.targetType;

  switch (action) {
    case "USER_SIGNUP":
      return `${userName} (${userRole}) signed up for a new account.`;
    case "USER_LOGIN":
      return `${userName} logged in.`;
    case "UPDATE_PROFILE":
      return `${userName} updated their profile details.`;
    case "CHANGE_PASSWORD":
      return `${userName} updated their password.`;
    case "PLAN_UPGRADE": {
      const plan = log.changes?.after?.plan || "unknown";
      return `${tenantName} upgraded to the ${plan.toUpperCase()} plan.`;
    }
    case "CREATE":
      if (targetType === "WORKER") {
        const workerName = log.changes?.after?.name || "a worker";
        return `${userName} added worker "${workerName}".`;
      }
      if (targetType === "ATTENDANCE") {
        return `${userName} marked attendance.`;
      }
      if (targetType === "PAYMENT") {
        const amount = log.changes?.after?.amount || 0;
        return `${userName} recorded a payment of ₹${amount}.`;
      }
      if (targetType === "PROJECT") {
        const projName = log.changes?.after?.name || "a project";
        return `${userName} created project "${projName}".`;
      }
      return `${userName} created a new ${targetType.toLowerCase()}.`;

    case "UPDATE":
      if (targetType === "WORKER") {
        const workerName = log.changes?.after?.name || "a worker";
        return `${userName} updated worker details for "${workerName}".`;
      }
      if (targetType === "ATTENDANCE") {
        return `${userName} modified attendance records.`;
      }
      return `${userName} modified a ${targetType.toLowerCase()}.`;

    case "SOFT_DELETE":
      if (targetType === "WORKER") {
        const workerName = log.changes?.before?.name || "a worker";
        return `${userName} deleted worker "${workerName}".`;
      }
      return `${userName} deleted a ${targetType.toLowerCase()}.`;

    case "DELETE":
      if (targetType === "PAYMENT") {
        const amount = log.changes?.before?.amount || 0;
        return `${userName} deleted a payment of ₹${amount}.`;
      }
      return `${userName} deleted a ${targetType.toLowerCase()}.`;

    case "ADMIN_USER_UPDATE":
      return `${userName} updated system user details.`;
    case "ADMIN_USER_DELETE":
      return `${userName} permanently deleted a user.`;
    case "ADMIN_WORKER_UPDATE":
      return `${userName} modified worker credentials.`;
    case "ADMIN_WORKER_DELETE":
      return `${userName} permanently deleted worker.`;
    case "ADMIN_ATTENDANCE_UPDATE":
      return `${userName} modified worker attendance record.`;
    case "ADMIN_ATTENDANCE_DELETE":
      return `${userName} deleted worker attendance record.`;
    case "ADMIN_PAYMENT_UPDATE":
      return `${userName} modified payroll transaction.`;
    case "ADMIN_PAYMENT_DELETE":
      return `${userName} deleted payroll transaction.`;

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
