import { Router } from "express";
import { seedDefaultConfigIfNeeded } from "../controllers/adminConfigController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

// Retrieve user-facing configuration, authenticated for safety
router.get("/config", authenticateJWT as any, async (req: any, res: any) => {
  try {
    const config = await seedDefaultConfigIfNeeded(req.user?._id);
    res.json({
      subscriptionsEnabled: config.subscriptionsEnabled,
      features: config.features.map((f: any) => ({
        key: f.key,
        name: f.name,
        description: f.description,
        enabled: f.enabled,
        premium: f.premium,
        minPlan: f.minPlan
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
