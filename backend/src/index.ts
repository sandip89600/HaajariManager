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
import apiRoutes from "./routes";
import { initSocket } from "./utils/socket";

// Load environment variables
dotenv.config();

// Initialize Sentry
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/haajari";

// Middleware
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors());
app.use(express.json());

// Serve static uploads folder
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));


// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP, please try again after 15 minutes" },
});
app.use("/api/", limiter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
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

// Connect to MongoDB & Start Server
if (process.env.NODE_ENV !== "test") {
  console.log("Connecting to MongoDB...");
  mongoose
    .connect(MONGO_URI)
    .then(() => {
      console.log("Connected to MongoDB successfully.");
      const server = createServer(app);
      initSocket(server);
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
