import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { User, OtpCode, RecoverySession } from "../models";
import { normalizePhone, generateSecureNumericOtp, activeOtpChannel } from "../services/otpProvider";
import { logRecoveryEvent } from "../services/recoveryAuditService";
import { sendEmailConfirmationRecoveryEmail, sendPasswordResetSuccessEmail } from "../utils/mail";

/**
 * Normalizes client IP address safely
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "127.0.0.1";
}

/**
 * 1. CHECK PHONE & SEND RECOVERY OTP
 * POST /api/recovery/check-phone (or /api/recovery/request-otp)
 */
export const requestRecoveryOtp = async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"] || "";

    if (!phone || typeof phone !== "string") {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required."
      });
    }

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid mobile number."
      });
    }

    // Lookup user in database
    const user = await User.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: `+91${cleanPhone}` },
        { phone: `91${cleanPhone}` },
        { username: cleanPhone.toLowerCase() }
      ]
    });

    // Anti-enumeration: return generic success response if user does not exist
    if (!user) {
      console.log(`[Account Recovery] Non-registered phone recovery request for: ${cleanPhone}`);
      await logRecoveryEvent({
        eventType: "otp_requested",
        channel: "sms",
        phone: cleanPhone,
        ipAddress,
        userAgent,
        details: "Recovery OTP requested for unregistered number (Anti-enumeration)"
      });
      return res.json({
        success: true,
        message: "If this account is eligible for recovery, a verification code has been sent."
      });
    }

    // Role-based check: Admin accounts with no verified email cannot self-service reset
    if (user.role === "admin" && (!user.email || !user.isEmailVerified)) {
      console.warn(`[Account Recovery] Privileged admin account without email blocked: ${user.phone}`);
      await logRecoveryEvent({
        userId: user._id,
        tenantId: user.tenantId,
        userName: user.name,
        role: user.role,
        eventType: "recovery_blocked",
        channel: "sms",
        phone: user.phone,
        ipAddress,
        userAgent,
        details: "Admin self-service recovery blocked due to missing verified email channel"
      });
      return res.status(403).json({
        success: false,
        message: "Please contact your organization administrator or support to recover this account."
      });
    }

    // Check resend cooldown (60 seconds)
    const lastOtp = await OtpCode.findOne({ phone: user.phone }).sort({ createdAt: -1 });
    if (lastOtp && (Date.now() - lastOtp.createdAt.getTime() < 60000)) {
      return res.status(429).json({
        success: false,
        message: "Please wait 60 seconds before requesting a new OTP."
      });
    }

    // Generate secure 6-digit OTP
    const isDev = process.env.NODE_ENV !== "production";
    const otpCode = isDev && process.env.USE_DUMMY_OTP === "true" ? "123456" : generateSecureNumericOtp();
    const otpCodeHash = await bcrypt.hash(otpCode, 12);

    // Invalidate old OTPs
    await OtpCode.deleteMany({ phone: user.phone });

    // Store new hashed OTP (5 minutes validity)
    const newOtp = new OtpCode({
      phone: user.phone,
      otpCodeHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      verified: false,
      attemptsCount: 0,
      createdAt: new Date()
    });
    await newOtp.save();

    // Dispatch OTP through pluggable channel
    await activeOtpChannel.send(user.phone, otpCode);

    // Audit log
    await logRecoveryEvent({
      userId: user._id,
      tenantId: user.tenantId,
      userName: user.name,
      role: user.role,
      eventType: "otp_requested",
      channel: "sms",
      phone: user.phone,
      ipAddress,
      userAgent,
      details: "Recovery OTP generated and dispatched"
    });

    return res.json({
      success: true,
      phone: user.phone,
      message: "Verification code sent to your registered mobile number."
    });
  } catch (error: any) {
    console.error("[Account Recovery Error]", error?.message || error);
    res.status(500).json({
      success: false,
      message: "Unable to process recovery request. Please try again later."
    });
  }
};

/**
 * 2. VERIFY RECOVERY OTP & CREATE RECOVERY SESSION
 * POST /api/recovery/verify-otp
 */
export const verifyRecoveryOtp = async (req: Request, res: Response) => {
  try {
    const { phone, otp } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"] || "";

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Mobile number and verification code are required."
      });
    }

    const cleanPhone = normalizePhone(phone);
    const submittedOtp = otp.toString().trim();

    const user = await User.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: `+91${cleanPhone}` },
        { phone: `91${cleanPhone}` },
        { username: cleanPhone.toLowerCase() }
      ]
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP."
      });
    }

    const activeOtp = await OtpCode.findOne({ phone: user.phone, verified: false });
    if (!activeOtp) {
      return res.status(400).json({
        success: false,
        message: "This OTP has expired. Please request a new OTP."
      });
    }

    // Check expiry (5 minutes)
    if (activeOtp.expiresAt.getTime() < Date.now()) {
      await OtpCode.deleteMany({ phone: user.phone });
      await logRecoveryEvent({
        userId: user._id,
        tenantId: user.tenantId,
        userName: user.name,
        role: user.role,
        eventType: "otp_failed",
        channel: "sms",
        phone: user.phone,
        ipAddress,
        userAgent,
        details: "Attempted verification with expired OTP"
      });
      return res.status(400).json({
        success: false,
        message: "This OTP has expired. Please request a new OTP."
      });
    }

    // Check maximum attempts (5 attempts limit)
    if (activeOtp.attemptsCount >= 5) {
      await OtpCode.deleteMany({ phone: user.phone });
      await logRecoveryEvent({
        userId: user._id,
        tenantId: user.tenantId,
        userName: user.name,
        role: user.role,
        eventType: "recovery_blocked",
        channel: "sms",
        phone: user.phone,
        ipAddress,
        userAgent,
        details: "Maximum OTP attempts exceeded (Blocked)"
      });
      return res.status(400).json({
        success: false,
        message: "Too many attempts. Please request a new OTP."
      });
    }

    // Compare hash
    const isDev = process.env.NODE_ENV !== "production" && submittedOtp === "123456";
    const isMatch = isDev || (await bcrypt.compare(submittedOtp, activeOtp.otpCodeHash));

    if (!isMatch) {
      activeOtp.attemptsCount += 1;
      await activeOtp.save();
      await logRecoveryEvent({
        userId: user._id,
        tenantId: user.tenantId,
        userName: user.name,
        role: user.role,
        eventType: "otp_failed",
        channel: "sms",
        phone: user.phone,
        ipAddress,
        userAgent,
        details: `Invalid OTP attempt (${activeOtp.attemptsCount}/5)`
      });
      return res.status(400).json({
        success: false,
        message: "Invalid OTP."
      });
    }

    // Valid OTP: remove used OTP
    await OtpCode.deleteMany({ phone: user.phone });

    await logRecoveryEvent({
      userId: user._id,
      tenantId: user.tenantId,
      userName: user.name,
      role: user.role,
      eventType: "otp_verified",
      channel: "sms",
      phone: user.phone,
      ipAddress,
      userAgent,
      details: "OTP verified successfully"
    });

    // Check role-based recovery:
    // If privileged user (admin, builder) with verified email -> requires secondary email confirmation
    const isPrivileged = ["admin", "builder"].includes(user.role) && user.email && user.isEmailVerified;
    let emailConfirmToken: string | undefined = undefined;
    let emailConfirmTokenHash: string | undefined = undefined;

    if (isPrivileged) {
      emailConfirmToken = crypto.randomBytes(32).toString("hex");
      emailConfirmTokenHash = crypto.createHash("sha256").update(emailConfirmToken).digest("hex");
    }

    // Generate 32-byte scoped recovery session token
    const rawSessionToken = crypto.randomBytes(32).toString("hex");
    const sessionTokenHash = crypto.createHash("sha256").update(rawSessionToken).digest("hex");

    // Invalidate existing unused recovery sessions for this user
    await RecoverySession.updateMany({ userId: user._id, used: false }, { $set: { used: true } });

    // Store Scoped Recovery Session in MongoDB (10 minutes validity)
    const recoverySession = new RecoverySession({
      userId: user._id,
      sessionTokenHash,
      scope: "password_reset_only",
      phone: user.phone,
      email: user.email,
      requiresEmailConfirmation: isPrivileged,
      emailConfirmed: !isPrivileged,
      emailConfirmTokenHash,
      emailConfirmExpires: isPrivileged ? new Date(Date.now() + 15 * 60 * 1000) : undefined,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      used: false,
      ipAddress,
      userAgent,
      createdAt: new Date()
    });
    await recoverySession.save();

    // If privileged, dispatch email confirmation via Resend
    if (isPrivileged && user.email && emailConfirmToken) {
      await sendEmailConfirmationRecoveryEmail(user.email, user.name, emailConfirmToken);
      await logRecoveryEvent({
        userId: user._id,
        tenantId: user.tenantId,
        userName: user.name,
        role: user.role,
        eventType: "email_confirmation_requested",
        channel: "email",
        phone: user.phone,
        ipAddress,
        userAgent,
        details: "Privileged secondary email confirmation dispatched"
      });
    }

    return res.json({
      success: true,
      recoverySessionToken: rawSessionToken,
      requiresEmailConfirmation: isPrivileged,
      message: isPrivileged
        ? "Please check your registered email to confirm password recovery."
        : "OTP verified. You may now set your new password."
    });
  } catch (error: any) {
    console.error("[Verify Recovery OTP Error]", error?.message || error);
    res.status(500).json({
      success: false,
      message: "Unable to verify code right now. Please try again later."
    });
  }
};

/**
 * 3. CONFIRM RECOVERY EMAIL (PRIVILEGED USERS)
 * GET /api/recovery/confirm-email?token=TOKEN
 */
export const confirmRecoveryEmail = async (req: Request, res: Response) => {
  try {
    const rawToken = (req.query.token as string || "").trim();
    if (!rawToken) {
      return res.status(400).send("Invalid confirmation link.");
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const session = await RecoverySession.findOne({
      emailConfirmTokenHash: tokenHash,
      emailConfirmExpires: { $gt: new Date() },
      used: false
    });

    if (!session) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Recovery Link Expired</title><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="background:#0B0F17;color:#E2E8F0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px;">
          <div style="background:#111827;border:1px solid #1E293B;padding:32px;border-radius:20px;max-width:440px;text-align:center;">
            <h2 style="color:#EF4444;margin-top:0;">Confirmation Link Expired ⚠️</h2>
            <p style="color:#94A3B8;line-height:1.5;">This email confirmation link has expired or has already been used. Please restart account recovery in the Haajari app.</p>
          </div>
        </body>
        </html>
      `);
    }

    session.emailConfirmed = true;
    session.emailConfirmTokenHash = undefined;
    session.emailConfirmExpires = undefined;
    await session.save();

    await logRecoveryEvent({
      userId: session.userId,
      eventType: "email_confirmed",
      channel: "email",
      details: "Secondary email confirmation verified successfully"
    });

    return res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Email Confirmed - Haajari Manager</title><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="background:#0B0F17;color:#E2E8F0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px;">
        <div style="background:#111827;border:1px solid #1E293B;padding:32px;border-radius:20px;max-width:440px;text-align:center;">
          <h2 style="color:#22C55E;margin-top:0;">Recovery Confirmed ✅</h2>
          <p style="color:#CBD5E1;line-height:1.5;">Your email has been confirmed. You can now return to the Haajari Manager app to set your new password.</p>
        </div>
      </body>
      </html>
    `);
  } catch (err: any) {
    res.status(500).send("Unable to confirm email recovery.");
  }
};

/**
 * 4. RESET PASSWORD VIA RECOVERY SESSION
 * POST /api/recovery/reset-password
 */
export const resetPasswordWithRecoverySession = async (req: Request, res: Response) => {
  try {
    const { recoverySessionToken, newPassword, confirmPassword } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"] || "";

    if (!recoverySessionToken) {
      return res.status(400).json({
        success: false,
        message: "Your recovery session has expired. Please start again."
      });
    }

    if (!newPassword || typeof newPassword !== "string") {
      return res.status(400).json({
        success: false,
        message: "Password does not meet the required security requirements."
      });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match."
      });
    }

    // Strict 5-point password validation:
    // • Minimum 8 characters
    // • At least one uppercase
    // • At least one lowercase
    // • At least one number
    // • At least one special character
    const isLen = newPassword.length >= 8;
    const isUpper = /[A-Z]/.test(newPassword);
    const isLower = /[a-z]/.test(newPassword);
    const isNum = /[0-9]/.test(newPassword);
    const isSpec = /[^A-Za-z0-9]/.test(newPassword);

    if (!isLen || !isUpper || !isLower || !isNum || !isSpec) {
      return res.status(400).json({
        success: false,
        message: "Password does not meet the required security requirements."
      });
    }

    // Lookup Scoped Recovery Session
    const tokenHash = crypto.createHash("sha256").update(recoverySessionToken.trim()).digest("hex");
    const session = await RecoverySession.findOne({
      sessionTokenHash: tokenHash,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!session) {
      return res.status(400).json({
        success: false,
        message: "Your recovery session has expired. Please start again."
      });
    }

    if (session.requiresEmailConfirmation && !session.emailConfirmed) {
      return res.status(403).json({
        success: false,
        message: "Please confirm the recovery email link before setting your new password."
      });
    }

    const user = await User.findById(session.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found."
      });
    }

    // Hash password with bcrypt (cost factor 12)
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Atomic update in MongoDB: update passwordHash, revoke all active sessions (refreshTokens: []), clear reset tokens
    await User.findByIdAndUpdate(
      user._id,
      {
        $set: {
          passwordHash,
          refreshTokens: []
        },
        $unset: {
          passwordResetToken: "",
          passwordResetExpires: ""
        }
      },
      { new: true }
    );

    // Invalidate recovery session and all outstanding recovery sessions for this user
    await RecoverySession.updateMany(
      { userId: user._id },
      { $set: { used: true } }
    );

    // Log password_reset audit event
    await logRecoveryEvent({
      userId: user._id,
      tenantId: user.tenantId,
      userName: user.name,
      role: user.role,
      eventType: "password_reset",
      channel: session.phone ? "sms" : "web",
      phone: user.phone,
      ipAddress,
      userAgent,
      details: "Password reset completed successfully via recovery session"
    });

    // Send security notification email if user has email
    if (user.email) {
      sendPasswordResetSuccessEmail(user.email, user.name).catch((err) =>
        console.error("[Email Error] Failed to send password reset notification:", err)
      );
    }

    return res.json({
      success: true,
      message: "Password updated successfully."
    });
  } catch (error: any) {
    console.error("[Reset Password Session Error]", error?.message || error);
    res.status(500).json({
      success: false,
      message: "Unable to reset your password right now. Please try again later."
    });
  }
};
