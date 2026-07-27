import { Router } from "express";
import {
  createSite,
  getSites,
  getSiteById,
  updateSite,
  archiveSite,
  deleteSite,
  getSiteDashboardStats
} from "../controllers/siteController";
import { authenticateJWT } from "../middleware/auth";
import { validateCreateSite, validateUpdateSite } from "../validators/siteValidator";

const router = Router();

// Apply auth middleware to all site routes
router.use(authenticateJWT as any);

router.get("/dashboard/stats", getSiteDashboardStats as any);
router.post("/", validateCreateSite as any, createSite as any);
router.get("/", getSites as any);
router.get("/:id", getSiteById as any);
router.put("/:id", validateUpdateSite as any, updateSite as any);
router.put("/:id/archive", archiveSite as any);
router.delete("/:id", deleteSite as any);

export default router;
