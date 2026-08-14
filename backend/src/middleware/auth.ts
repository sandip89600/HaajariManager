import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    tenantId?: string;
    role: "contractor" | "builder" | "supervisor" | "admin";
  };
}

export const authenticateJWT = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(" ")[1];

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ error: "Server configuration error" });
    }

    jwt.verify(token, secret, async (err, decodedUser: any) => {
      if (err) {
        console.warn("[Auth Middleware] JWT Verification failed:", err.message);
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      const deviceId = (req.headers["x-device-id"] as string) || (req.body?.deviceId as string);

      // Check if device session was revoked
      if (deviceId && decodedUser?.id && decodedUser.role !== "admin") {
        try {
          const userDoc = await User.findById(decodedUser.id).select("trustedDevices").lean();
          if (userDoc?.trustedDevices) {
            const deviceRecord = userDoc.trustedDevices.find((d) => d.deviceId === deviceId);
            if (deviceRecord && deviceRecord.isRevoked) {
              return res.status(401).json({ error: "Session has been revoked. Please log in again." });
            }
          }
        } catch {
          // Fallthrough on DB query error
        }
      }

      req.user = {
        id: decodedUser.id,
        tenantId: decodedUser.tenantId,
        role: decodedUser.role,
      };
      next();
    });
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
};

export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ error: "Forbidden: Admins only" });
  }
};
