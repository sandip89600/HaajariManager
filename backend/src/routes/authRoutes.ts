import { Router } from "express";
import {
  signup,
  login,
  refresh,
  forgotPassword,
  resetPassword,
  renderResetPasswordPage,
  getProfile,
  updateProfile,
  changePassword,
  upgradePlan,
  deleteAccount,
  sendOtp,
  verifyOtpLogin,
  registerBiometric,
  biometricLogin,
  updatePrivacySettings,
  toggleOtpSetting,
  toggleBiometricsSetting,
  getUserSessions,
  logoutDevice,
  logoutAllDevices,
  savePushToken,
  validateSignupField,
  sendPhoneVerificationOtp,
  verifyPhoneOtp,
  trustDevice,
  reportSuspicious,
  getSecurityEvents,
  googleAuth,
  registerContractor,
  registerSupervisor,
  registerLabor,
  sendSignupOtp,
  verifySignupOtp,
  firebasePhoneLogin,
  firebaseVerifyPhone,
  claimWorkerProfile,
  verifyEmail,
  resendVerificationEmail
} from "../controllers/authController";
import { authenticateJWT, optionalAuthenticateJWT } from "../middleware/auth";
import { loginRateLimiter, otpRateLimiter, recoveryRateLimiter, signupRateLimiter } from "../middleware/rateLimiter";

const router = Router();

router.post("/signup", signupRateLimiter as any, signup as any);
router.get("/verify-email", verifyEmail as any);
router.post("/verify-email", verifyEmail as any);
router.post("/resend-verification-email", otpRateLimiter as any, resendVerificationEmail as any);
router.post("/send-signup-otp", otpRateLimiter as any, sendSignupOtp as any);
router.post("/verify-signup-otp", verifySignupOtp as any);
router.post("/firebase-phone-login", loginRateLimiter as any, firebasePhoneLogin as any);
router.post("/firebase-verify-phone", firebaseVerifyPhone as any);
router.post("/claim-worker-profile", optionalAuthenticateJWT as any, claimWorkerProfile as any);
router.post("/register/contractor", signupRateLimiter as any, registerContractor as any);
router.post("/register/supervisor", signupRateLimiter as any, registerSupervisor as any);
router.post("/register/labor", signupRateLimiter as any, registerLabor as any);
router.post("/v2/auth/register/contractor", signupRateLimiter as any, registerContractor as any);
router.post("/v2/auth/register/supervisor", signupRateLimiter as any, registerSupervisor as any);
router.post("/v2/auth/register/labor", signupRateLimiter as any, registerLabor as any);
router.post("/validate-signup-field", validateSignupField as any);

router.post("/login", loginRateLimiter as any, login as any);
router.post("/google", loginRateLimiter as any, googleAuth as any);
router.post("/refresh", refresh as any);
router.post("/send-phone-verification-otp", otpRateLimiter as any, sendPhoneVerificationOtp as any);
router.post("/verify-phone-otp", verifyPhoneOtp as any);
router.post("/forgot-password", recoveryRateLimiter as any, forgotPassword as any);
router.post("/reset-password", recoveryRateLimiter as any, resetPassword as any);
router.get("/reset-password-page", renderResetPasswordPage as any);
router.get("/profile", authenticateJWT as any, getProfile as any);
router.put("/profile", authenticateJWT as any, updateProfile as any);
router.put("/change-password", authenticateJWT as any, changePassword as any);
router.put("/upgrade", authenticateJWT as any, upgradePlan as any);
router.delete("/delete-account", authenticateJWT as any, deleteAccount as any);

// Security Module Routes
router.post("/send-otp", otpRateLimiter as any, sendOtp as any);
router.post("/verify-otp-login", loginRateLimiter as any, verifyOtpLogin as any);
router.post("/register-biometric", authenticateJWT as any, registerBiometric as any);
router.post("/biometric-login", loginRateLimiter as any, biometricLogin as any);
router.put("/security/otp", authenticateJWT as any, toggleOtpSetting as any);
router.put("/security/biometrics", authenticateJWT as any, toggleBiometricsSetting as any);
router.put("/security/privacy", authenticateJWT as any, updatePrivacySettings as any);
router.get("/security/sessions", authenticateJWT as any, getUserSessions as any);
router.get("/security/events", authenticateJWT as any, getSecurityEvents as any);
router.post("/security/trust-device", authenticateJWT as any, trustDevice as any);
router.post("/security/report-suspicious", authenticateJWT as any, reportSuspicious as any);
router.post("/security/logout-device", authenticateJWT as any, logoutDevice as any);
router.post("/security/logout-all", authenticateJWT as any, logoutAllDevices as any);
router.post("/push-token", authenticateJWT as any, savePushToken as any);

export default router;
