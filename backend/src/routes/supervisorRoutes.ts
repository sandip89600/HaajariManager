import { Router } from "express";
import { getSupervisors, createSupervisor, updateSupervisor, deleteSupervisor } from "../controllers/supervisorController";
import { authenticateJWT } from "../middleware/auth";
import { checkPlanLimit } from "../middleware/subscription";

const router = Router();

router.use(authenticateJWT as any);

router.get("/", getSupervisors as any);
router.post("/", checkPlanLimit("supervisors") as any, createSupervisor as any);
router.put("/:id", updateSupervisor as any);
router.delete("/:id", deleteSupervisor as any);

export default router;
