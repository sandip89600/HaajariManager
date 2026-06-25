import { Router } from "express";
import { getWorkers, addWorker, updateWorker, deleteWorker } from "../controllers/workerController";
import { authenticateJWT } from "../middleware/auth";
import { checkPlanLimit } from "../middleware/subscription";

const router = Router();

router.use(authenticateJWT as any);

router.get("/", getWorkers as any);
router.post("/", checkPlanLimit("workers") as any, addWorker as any);
router.put("/:id", updateWorker as any);
router.delete("/:id", deleteWorker as any);

export default router;
