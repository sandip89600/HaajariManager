import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

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

    jwt.verify(token, process.env.JWT_SECRET || "supersecretkey", (err, user: any) => {
      if (err) {
        console.warn("[Auth Middleware] JWT Verification failed:", err.message, "Token:", token ? token.substring(0, 15) + "..." : "none");
        return res.status(403).json({ error: "Invalid token" });
      }

      req.user = {
        id: user.id,
        tenantId: user.tenantId,
        role: user.role,
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
