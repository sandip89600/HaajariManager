import { Server } from "socket.io";
import { Server as HttpServer } from "http";

let io: Server | null = null;

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

export const broadcastAdminActivity = (activity?: any) => {
  if (io) {
    console.log(`[Socket] Broadcasting activity event: ${activity?.action || "generic"}`);
    io.emit("admin_activity", activity);
    io.emit("admin_dashboard_update");
  } else {
    console.log("[Socket] Socket server not running, skipping broadcast.");
  }
};
