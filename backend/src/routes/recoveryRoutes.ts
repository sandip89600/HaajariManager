import { Router } from "express";
import {
  requestRecoveryOtp,
  verifyRecoveryOtp,
  confirmRecoveryEmail,
  resetPasswordWithRecoverySession
} from "../controllers/recoveryController";
import { recoveryRateLimiter, otpRateLimiter } from "../middleware/rateLimiter";

const router = Router();

// Account Recovery Endpoints (Email / Phone + Scoped Session)
router.post("/check-email", recoveryRateLimiter as any, requestRecoveryOtp as any);
router.post("/find-account", recoveryRateLimiter as any, requestRecoveryOtp as any);
router.post("/check-phone", recoveryRateLimiter as any, requestRecoveryOtp as any);
router.post("/send-otp", otpRateLimiter as any, requestRecoveryOtp as any);
router.post("/request-otp", otpRateLimiter as any, requestRecoveryOtp as any);
router.post("/resend-otp", otpRateLimiter as any, requestRecoveryOtp as any);
router.post("/verify-otp", recoveryRateLimiter as any, verifyRecoveryOtp as any);
router.get("/confirm-email", confirmRecoveryEmail as any);
router.post("/reset-password", recoveryRateLimiter as any, resetPasswordWithRecoverySession as any);

export default router;
