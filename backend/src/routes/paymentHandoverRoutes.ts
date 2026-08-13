import { Router } from "express";
import { authenticateJWT } from "../middleware/auth";
import { checkFeatureAccess } from "../middleware/featureAccess";
import {
  getHandovers,
  createHandover,
  getProofs,
  createProof
} from "../controllers/paymentHandoverController";

const router = Router();

router.use(authenticateJWT as any);

// Payment Handover features
router.get("/handover", checkFeatureAccess("paymentHandover") as any, getHandovers as any);
router.post("/handover", checkFeatureAccess("paymentHandover") as any, createHandover as any);

// Payment Proof features
router.get("/proof", checkFeatureAccess("paymentProof") as any, getProofs as any);
router.post("/proof", checkFeatureAccess("paymentProof") as any, createProof as any);

export default router;
