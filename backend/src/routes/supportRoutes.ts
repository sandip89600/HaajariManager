import { Router } from "express";
import { reportProblem, submitFeedback } from "../controllers/supportController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

router.use(authenticateJWT as any);

router.post("/report-problem", reportProblem as any);
router.post("/feedback", submitFeedback as any);

export default router;
