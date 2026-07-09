"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.authenticateJWT = void 0;
var jsonwebtoken_1 = require("jsonwebtoken");
var authenticateJWT = function (req, res, next) {
    var authHeader = req.headers.authorization;
    if (authHeader) {
        var token_1 = authHeader.split(" ")[1];
        jsonwebtoken_1.default.verify(token_1, process.env.JWT_SECRET || "supersecretkey", function (err, user) {
            if (err) {
                console.warn("[Auth Middleware] JWT Verification failed:", err.message, "Token:", token_1 ? token_1.substring(0, 15) + "..." : "none");
                return res.status(401).json({ error: "Invalid token" });
            }
            req.user = {
                id: user.id,
                tenantId: user.tenantId,
                role: user.role,
            };
            next();
        });
    }
    else {
        res.status(401).json({ error: "Unauthorized" });
    }
};
exports.authenticateJWT = authenticateJWT;
var requireAdmin = function (req, res, next) {
    if (req.user && req.user.role === "admin") {
        next();
    }
    else {
        res.status(403).json({ error: "Forbidden: Admins only" });
    }
};
exports.requireAdmin = requireAdmin;
