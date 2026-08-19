import { Router } from "express";
import { authenticateJWT } from "../middleware/auth";
import { handleHaiChat } from "../controllers/haiController";

const router = Router();

// Ask HAI Chat Endpoint with Mandatory JWT & Tenant Isolation
router.post("/chat", authenticateJWT, handleHaiChat);

export default router;
