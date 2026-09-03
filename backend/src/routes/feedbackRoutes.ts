import { Router } from "express";
import { submitFeedback } from "../controllers/feedbackController";
import { optionalAuth } from "../middleware/auth";

const router = Router();

// Public / Authenticated Feedback Submission Endpoint
router.post("/", optionalAuth as any, submitFeedback as any);

export default router;
