import { Router } from "express";
import { processVoice } from "../controllers/voiceController";
import { authenticateJWT } from "../middleware/auth";
import { checkFeatureAccess } from "../middleware/featureAccess";
import { uploadAudio } from "../middleware/upload";

const router = Router();

router.use(authenticateJWT as any);
router.post("/process", checkFeatureAccess("aiAssistant") as any, uploadAudio.single("audio"), processVoice as any);

export default router;
