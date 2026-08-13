import { Router } from "express";
import {
  createSite,
  getSites,
  getSiteById,
  updateSite,
  archiveSite,
  deleteSite,
  getSiteDashboardStats,
  getSiteUpdates,
  createSiteUpdate
} from "../controllers/siteController";
import {
  getMaterials,
  addMaterial,
  updateMaterial,
  deleteMaterial,
  consumeMaterial,
  getMaterialHistory
} from "../controllers/materialController";
import {
  getSitePhotos,
  addWorkPhoto
} from "../controllers/photoController";
import { authenticateJWT } from "../middleware/auth";
import { validateCreateSite, validateUpdateSite } from "../validators/siteValidator";
import { checkPlanLimit } from "../middleware/subscription";

const router = Router();

// Apply auth middleware to all site routes
router.use(authenticateJWT as any);

router.get("/dashboard/stats", getSiteDashboardStats as any);
router.post("/", checkPlanLimit("projects") as any, validateCreateSite as any, createSite as any);
router.get("/", getSites as any);
router.get("/:id", getSiteById as any);
router.put("/:id", validateUpdateSite as any, updateSite as any);
router.put("/:id/archive", archiveSite as any);
router.delete("/:id", deleteSite as any);

// Materials Management endpoints
router.get("/:siteId/materials", getMaterials as any);
router.post("/:siteId/materials", addMaterial as any);
router.put("/:siteId/materials/:id", updateMaterial as any);
router.delete("/:siteId/materials/:id", deleteMaterial as any);
router.post("/:siteId/materials/:id/consume", consumeMaterial as any);
router.get("/:siteId/materials-history", getMaterialHistory as any);

// Before & After Work Photos timeline endpoints
router.get("/:siteId/photos", getSitePhotos as any);
router.post("/:siteId/photos", addWorkPhoto as any);

// Daily Updates endpoints
router.get("/:siteId/updates", getSiteUpdates as any);
router.post("/:siteId/updates", createSiteUpdate as any);

export default router;
