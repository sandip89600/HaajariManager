import { Router } from "express";
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  getProjectDashboard,
  addMBEntry,
  getMBEntries,
  addDelayLog,
  getDelayLogs,
  addExpense,
  getExpenses
} from "../controllers/projectController";
import { authenticateJWT } from "../middleware/auth";
import { checkPlanLimit } from "../middleware/subscription";

const router = Router();

router.use(authenticateJWT as any);

router.get("/", getProjects as any);
router.post("/", checkPlanLimit("projects") as any, createProject as any);
router.put("/:id", updateProject as any);
router.delete("/:id", deleteProject as any);

router.get("/:id/dashboard", getProjectDashboard as any);
router.post("/:id/mb-entry", addMBEntry as any);
router.get("/:id/mb-entries", getMBEntries as any);
router.post("/:id/delay-log", addDelayLog as any);
router.get("/:id/delay-logs", getDelayLogs as any);
router.post("/:id/expenses", addExpense as any);
router.get("/:id/expenses", getExpenses as any);

export default router;
