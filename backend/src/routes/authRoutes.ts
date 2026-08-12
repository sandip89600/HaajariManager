import { Router } from "express";
import { signup, login, refresh, verifyEmail, resendVerification, forgotPassword, resetPassword, renderResetPasswordPage, getProfile, updateProfile, changePassword, upgradePlan, deleteAccount, sendOtp, verifyOtpLogin, registerBiometric, biometricLogin, updatePrivacySettings, toggleOtpSetting, toggleBiometricsSetting, getUserSessions, logoutDevice, logoutAllDevices, savePushToken, validateSignupField, sendPhoneVerificationOtp, verifyPhoneOtp } from "../controllers/authController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

router.post("/signup", signup as any);
router.post("/validate-signup-field", validateSignupField as any);
router.post("/login", login as any);
router.post("/refresh", refresh as any);
router.get("/verify-email", verifyEmail as any);
router.get("/verify-email/:token", verifyEmail as any);
router.post("/resend-verification", resendVerification as any);
router.post("/send-phone-verification-otp", sendPhoneVerificationOtp as any);
router.post("/verify-phone-otp", verifyPhoneOtp as any);
router.post("/forgot-password", forgotPassword as any);
router.post("/reset-password", resetPassword as any);
router.get("/reset-password-page", renderResetPasswordPage as any);
router.get("/profile", authenticateJWT as any, getProfile as any);
router.put("/profile", authenticateJWT as any, updateProfile as any);
router.put("/change-password", authenticateJWT as any, changePassword as any);
router.put("/upgrade", authenticateJWT as any, upgradePlan as any);
router.delete("/delete-account", authenticateJWT as any, deleteAccount as any);

// Security Module Routes
router.post("/send-otp", sendOtp as any);
router.post("/verify-otp-login", verifyOtpLogin as any);
router.post("/register-biometric", authenticateJWT as any, registerBiometric as any);
router.post("/biometric-login", biometricLogin as any);
router.put("/security/otp", authenticateJWT as any, toggleOtpSetting as any);
router.put("/security/biometrics", authenticateJWT as any, toggleBiometricsSetting as any);
router.put("/security/privacy", authenticateJWT as any, updatePrivacySettings as any);
router.get("/security/sessions", authenticateJWT as any, getUserSessions as any);
router.post("/security/logout-device", authenticateJWT as any, logoutDevice as any);
router.post("/security/logout-all", authenticateJWT as any, logoutAllDevices as any);
router.post("/push-token", authenticateJWT as any, savePushToken as any);

export default router;
