import { Router } from "express";
import { getProjects, createProject, updateProject, deleteProject } from "../controllers/projectController";
import { authenticateJWT } from "../middleware/auth";
import { checkPlanLimit } from "../middleware/subscription";

const router = Router();

router.use(authenticateJWT as any);

router.get("/", getProjects as any);
router.post("/", checkPlanLimit("projects") as any, createProject as any);
router.put("/:id", updateProject as any);
router.delete("/:id", deleteProject as any);

export default router;
