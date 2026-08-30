import * as Sentry from "@sentry/node";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { createServer } from "http";
import mongoSanitize from "express-mongo-sanitize";
import apiRoutes from "./routes";
import { initSocket } from "./utils/socket";
import { validateEmailConfig } from "./utils/mail";

// Load environment variables
dotenv.config();

// Initialize Sentry
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}

// Audit environment variables for security and production readiness
const requiredEnvVars = ["JWT_SECRET", "JWT_REFRESH_SECRET", "MONGO_URI"];
const missingEnvVars: string[] = [];

requiredEnvVars.forEach((v) => {
  if (!process.env[v]) {
    missingEnvVars.push(v);
  }
});

if (missingEnvVars.length > 0) {
  const errorMsg = `CRITICAL STARTUP ERROR: Required environment variables are missing: ${missingEnvVars.join(", ")}`;
  console.error(errorMsg);
  throw new Error(errorMsg);
}

// Validate Email service configuration
validateEmailConfig();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI as string;

// Trust reverse proxy headers on Render/Cloud hosting
app.set("trust proxy", 1);

// Request logging (development only)
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.url}`);
    next();
  });
}
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(mongoSanitize());

// Serve static uploads folder
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// Rate limiting
const isDev = process.env.NODE_ENV !== "production";
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 100000 : 5000,
  skip: (req) => {
    if (isDev) return true;
    const ip = req.ip || req.socket.remoteAddress || "";
    return ip === "127.0.0.1" || ip === "::1" || ip.includes("192.168.") || ip.includes("10.") || ip.includes("172.16.");
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again after a few minutes." },
});
app.use("/api/", limiter);

// Root & Health check endpoints
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "Haajari Manager API",
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

app.get(["/health", "/api/health"], (req, res) => {
  res.json({
    status: "OK",
    service: "Haajari Manager API",
    timestamp: new Date(),
    uptime: process.uptime(),
    dbState: mongoose.connection.readyState === 1 ? "CONNECTED" : "DISCONNECTED",
  });
});

// Register API routes
app.use("/api", apiRoutes);

// Sentry error handler (must be placed before custom error handlers)
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({ error: "An internal server error occurred" });
});

import { ensureSinglePermanentAdmin } from "./controllers/authController";

// Connect to MongoDB & Start Server
if (process.env.NODE_ENV !== "test") {
  console.log("Connecting to MongoDB...");
  mongoose
    .connect(MONGO_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    .then(async () => {
      console.log("Connected to MongoDB successfully.");
      
      // Ensure single permanent admin account is setup and purged of other admins
      await ensureSinglePermanentAdmin();

      // Ensure default feature toggles and subscriptions settings are seeded
      try {
        const { seedDefaultConfigIfNeeded } = require("./controllers/adminConfigController");
        await seedDefaultConfigIfNeeded();
      } catch (err: any) {
        console.error("Failed to seed default app configuration:", err);
      }

      // Programmatically drop any legacy unique index on 'name' in users collection if present
      if (mongoose.connection.db) {
        mongoose.connection.db.collection("users").dropIndex("name_1").catch(() => {
          // Safe to ignore if index does not exist
        });
      }

      const server = createServer(app);
      initSocket(server);
      
      // Initialize automated background reminder scheduler
      try {
        const { startReminderScheduler } = require("./services/reminderScheduler");
        startReminderScheduler();
      } catch (err: any) {
        console.error("Failed to start reminder scheduler:", err);
      }

      server.listen(PORT, () => {
        console.log(`Haajari Server (with Socket.io) running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode.`);
      });
    })
    .catch((err) => {
      console.error("Database connection error:", err);
      process.exit(1);
     });
}

export { app };
