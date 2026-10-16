import { Router } from "express";
import { getWorkers, addWorker, updateWorker, deleteWorker } from "../controllers/workerController";
import { getWorkerTodayContext, getWorkerSiteLogs, getWorkerSummaryStats } from "../controllers/siteActivityController";
import { authenticateJWT } from "../middleware/auth";
import { checkPlanLimit } from "../middleware/subscription";

const router = Router();

router.use(authenticateJWT as any);

// Worker Context & Activity Endpoints
router.get("/me/today-context", getWorkerTodayContext as any);
router.get("/workers/me/today-context", getWorkerTodayContext as any);
router.get("/me/site-logs", getWorkerSiteLogs as any);
router.get("/me/summary", getWorkerSummaryStats as any);

router.get("/", getWorkers as any);
router.post("/", checkPlanLimit("workers") as any, addWorker as any);
router.put("/:id", updateWorker as any);
router.delete("/:id", deleteWorker as any);

export default router;

