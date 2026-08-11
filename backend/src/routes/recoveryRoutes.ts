import { Router } from "express";
import {
  requestRecoveryOtp,
  verifyRecoveryOtp,
  confirmRecoveryEmail,
  resetPasswordWithRecoverySession
} from "../controllers/recoveryController";

const router = Router();

// Account Recovery Endpoints (Phone + Scoped Session)
router.post("/check-phone", requestRecoveryOtp as any);
router.post("/request-otp", requestRecoveryOtp as any);
router.post("/resend-otp", requestRecoveryOtp as any);
router.post("/verify-otp", verifyRecoveryOtp as any);
router.get("/confirm-email", confirmRecoveryEmail as any);
router.post("/reset-password", resetPasswordWithRecoverySession as any);

export default router;
