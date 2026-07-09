"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
var Sentry = require("@sentry/node");
var express_1 = require("express");
var mongoose_1 = require("mongoose");
var cors_1 = require("cors");
var helmet_1 = require("helmet");
var express_rate_limit_1 = require("express-rate-limit");
var dotenv_1 = require("dotenv");
var path_1 = require("path");
var fs_1 = require("fs");
var http_1 = require("http");
var routes_1 = require("./routes");
var socket_1 = require("./utils/socket");
// Load environment variables
dotenv_1.default.config();
// Initialize Sentry
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 0.1,
    });
}
var app = (0, express_1.default)();
exports.app = app;
var PORT = process.env.PORT || 5000;
var MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/haajari";
// Middleware
app.use(function (req, res, next) {
    console.log("[HTTP] ".concat(req.method, " ").concat(req.url));
    next();
});
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "50mb" }));
app.use(express_1.default.urlencoded({ limit: "50mb", extended: true }));
// Serve static uploads folder
var uploadsDir = path_1.default.join(__dirname, "../uploads");
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express_1.default.static(uploadsDir));
// Rate limiting
var limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests from this IP, please try again after 15 minutes" },
});
app.use("/api/", limiter);
// Health check endpoint
app.get("/health", function (req, res) {
    res.json({
        status: "OK",
        timestamp: new Date(),
        uptime: process.uptime(),
        dbState: mongoose_1.default.connection.readyState === 1 ? "CONNECTED" : "DISCONNECTED",
    });
});
// Register API routes
app.use("/api", routes_1.default);
// Sentry error handler (must be placed before custom error handlers)
if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
}
// Global Error Handler
app.use(function (err, req, res, next) {
    console.error("Unhandled Error:", err);
    res.status(500).json({ error: "An internal server error occurred" });
});
// Connect to MongoDB & Start Server
if (process.env.NODE_ENV !== "test") {
    console.log("Connecting to MongoDB...");
    mongoose_1.default
        .connect(MONGO_URI)
        .then(function () {
        console.log("Connected to MongoDB successfully.");
        var server = (0, http_1.createServer)(app);
        (0, socket_1.initSocket)(server);
        server.listen(PORT, function () {
            console.log("Haajari Server (with Socket.io) running on port ".concat(PORT, " in ").concat(process.env.NODE_ENV || "development", " mode."));
        });
    })
        .catch(function (err) {
        console.error("Database connection error:", err);
        process.exit(1);
    });
}
