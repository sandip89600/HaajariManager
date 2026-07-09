"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastAdminActivity = exports.getIO = exports.initSocket = void 0;
var socket_io_1 = require("socket.io");
var io = null;
var initSocket = function (server) {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST", "PUT", "DELETE"],
        },
    });
    io.on("connection", function (socket) {
        console.log("[Socket] Admin/User client connected: ".concat(socket.id));
        socket.on("disconnect", function () {
            console.log("[Socket] Client disconnected: ".concat(socket.id));
        });
    });
    return io;
};
exports.initSocket = initSocket;
var getIO = function () {
    if (!io) {
        throw new Error("Socket.io is not initialized!");
    }
    return io;
};
exports.getIO = getIO;
var broadcastAdminActivity = function (activity) {
    if (io) {
        console.log("[Socket] Broadcasting activity event: ".concat((activity === null || activity === void 0 ? void 0 : activity.action) || "generic"));
        io.emit("admin_activity", activity);
        io.emit("admin_dashboard_update");
    }
    else {
        console.log("[Socket] Socket server not running, skipping broadcast.");
    }
};
exports.broadcastAdminActivity = broadcastAdminActivity;
