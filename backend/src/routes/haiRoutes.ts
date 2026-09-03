import { Router } from "express";
import { authenticateJWT } from "../middleware/auth";
import { checkFeatureAccess } from "../middleware/featureAccess";
import { handleHaiChat } from "../controllers/haiController";

const router = Router();

// Ask HAI Chat Endpoint with Mandatory JWT & Tenant Isolation
router.post("/chat", authenticateJWT as any, checkFeatureAccess("aiAssistant") as any, handleHaiChat as any);

export default router;
