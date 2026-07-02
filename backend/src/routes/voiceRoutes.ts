import { Router } from "express";
import { processVoice } from "../controllers/voiceController";
import { authenticateJWT } from "../middleware/auth";
import { uploadAudio } from "../middleware/upload";

const router = Router();

router.use(authenticateJWT as any);
router.post("/process", uploadAudio.single("audio"), processVoice as any);

export default router;
