import nodemailer from "nodemailer";
import { Resend } from "resend";

// Resend client initialization function
function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

/**
 * Resolves the sender email address.
 * In production: Requires a verified-domain sender via EMAIL_FROM.
 * In development: Falls back to onboarding@resend.dev for local testing if not configured.
 */
function getSenderEmail(): string | null {
  const isProd = process.env.NODE_ENV === "production";
  const configuredFrom = process.env.EMAIL_FROM?.trim();

  if (configuredFrom) {
    return configuredFrom;
  }

  if (isProd) {
    console.error(
      "[Email Config Error] EMAIL_FROM is missing in production environment. A verified-domain sender is required (e.g. Haajari Manager <noreply@yourdomain.com>)."
    );
    return null;
  }

  // Development default only
  return "Haajari Manager <onboarding@resend.dev>";
}

/**
 * Resolves the application base URL for verification and password reset links.
 */
function getBaseUrl(): string {
  const isProd = process.env.NODE_ENV === "production";
  const configuredUrl = (process.env.CLIENT_URL || process.env.BASE_URL)?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  if (isProd) {
    console.warn(
      "[Email Config Warning] Neither CLIENT_URL nor BASE_URL is set in production. Links will default to https://haajari.com"
    );
    return "https://haajari.com";
  }

  return "http://localhost:5000";
}

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@haajari.com";
const APP_NAME = "Haajari Manager";

let transporter: nodemailer.Transporter | null = null;

/**
 * Initializes the Nodemailer SMTP transporter.
 * In production: Only connects to configured SMTP servers (never uses Ethereal test accounts).
 * In development: Uses Ethereal test account or console fallback.
 */
async function getTransporter(): Promise<nodemailer.Transporter | null> {
  if (transporter) return transporter;

  const isProd = process.env.NODE_ENV === "production";
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    return transporter;
  }

  if (isProd) {
    // In production, do not create test accounts if SMTP credentials are not configured
    console.warn(
      "[Email] Nodemailer fallback is not configured for production (SMTP_HOST / SMTP_USER / SMTP_PASS not set)."
    );
    return null;
  }

  // Development only: Ethereal test account / local console fallback
  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  } catch {
    transporter = {
      sendMail: async (mailOptions: any) => {
        console.log("\n================ [EMAIL FALLBACK CONSOLE] ================");
        console.log(`FROM: ${mailOptions.from}`);
        console.log(`TO: ${mailOptions.to}`);
        console.log(`SUBJECT: ${mailOptions.subject}`);
        console.log(`HTML LENGTH: ${mailOptions.html?.length || 0} bytes`);
        console.log("==========================================================\n");
        return { messageId: `dev-fallback-${Date.now()}` };
      },
    } as any;
  }

  return transporter;
}

/**
 * Validates email environment configuration at server startup.
 */
export function validateEmailConfig(): void {
  const isProd = process.env.NODE_ENV === "production";
  const resendKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  const baseUrl = process.env.CLIENT_URL || process.env.BASE_URL;

  console.log(`\n================ [EMAIL SERVICE CONFIG] ================`);
  console.log(`Environment : ${process.env.NODE_ENV || "development"}`);
  console.log(`Primary     : Resend (${resendKey ? "Configured" : "MISSING"})`);
  console.log(
    `Sender From : ${
      emailFrom
        ? emailFrom
        : isProd
        ? "MISSING (Required in Production)"
        : "Haajari Manager <onboarding@resend.dev> (Dev Default)"
    }`
  );
  console.log(`Base URL    : ${baseUrl || (isProd ? "NOT CONFIGURED" : "http://localhost:5000 (Dev Default)")}`);

  if (isProd) {
    if (!resendKey) {
      console.error("❌ [Email Config Error] RESEND_API_KEY is missing in production environment variables.");
    }
    if (!emailFrom) {
      console.error(
        "❌ [Email Config Error] EMAIL_FROM is missing in production environment variables. A verified sender is required."
      );
    }
    if (!baseUrl || baseUrl.includes("localhost")) {
      console.warn("⚠️  [Email Config Warning] BASE_URL/CLIENT_URL is missing or points to localhost in production.");
    }
  }
  console.log(`========================================================\n`);
}

/**
 * Centralized Universal Email Sender:
 * 1. Attempts Resend Primary
 * 2. If Resend fails, automatically falls back to Nodemailer SMTP
 * 3. Never exposes secrets or tokens in logs
 */
async function sendMailUnified(
  to: string,
  subject: string,
  html: string,
  emailType: string = "Notification"
): Promise<boolean> {
  const resend = getResendClient();
  const from = getSenderEmail();

  console.log(`[Email] Type: ${emailType}`);
  console.log(`[Email] To: ${to}`);

  // 1. Try Resend Primary
  if (resend && from) {
    console.log(`[Email] Provider: Resend`);
    try {
      const { data, error } = await resend.emails.send({
        from,
        to,
        subject,
        html,
      });

      if (!error && data) {
        console.log(`[Email] Status: SUCCESS`);
        console.log(`[Email] Message ID: ${data.id}`);
        return true;
      }

      const safeErrorMsg = error?.message || (typeof error === "string" ? error : JSON.stringify(error));
      console.warn(`[Email] Resend failed for "${emailType}" to ${to}`);
      console.warn(`[Email] Error: ${safeErrorMsg}`);
      console.log(`[Email] Attempting Nodemailer fallback...`);
    } catch (resendErr: any) {
      const safeErrorMsg = resendErr?.message || "Unknown error during Resend dispatch";
      console.warn(`[Email] Resend exception for "${emailType}" to ${to}`);
      console.warn(`[Email] Error: ${safeErrorMsg}`);
      console.log(`[Email] Attempting Nodemailer fallback...`);
    }
  } else if (!resend) {
    console.warn(`[Email] Resend client not initialized (RESEND_API_KEY missing). Falling back to Nodemailer...`);
  } else if (!from) {
    console.warn(`[Email] Valid sender address missing. Falling back to Nodemailer...`);
  }

  // 2. Nodemailer Fallback
  try {
    const client = await getTransporter();
    if (!client) {
      console.error(`[Email] Both Resend and Nodemailer are unavailable for ${to}.`);
      return false;
    }

    const senderAddress = from || "Haajari Manager <no-reply@haajari.com>";
    const info = await client.sendMail({
      from: senderAddress,
      to,
      subject,
      html,
    });

    console.log(`[Email] Provider: Nodemailer`);
    console.log(`[Email] Status: SUCCESS`);
    console.log(`[Email] Message ID: ${info.messageId || "delivered"}`);

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[Email] Dev Preview URL: ${previewUrl}`);
    }

    return true;
  } catch (smtpErr: any) {
    const safeErrorMsg = smtpErr?.message || "Unknown SMTP delivery error";
    console.error(`[Email] Nodemailer fallback failed for "${emailType}" to ${to}. Error: ${safeErrorMsg}`);
    return false;
  }
}

/**
 * Base Email Layout Wrapper for responsive, enterprise HTML emails
 */
function getEmailLayout(title: string, content: string): string {
  const currentYear = new Date().getFullYear();
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0B0F17; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #E2E8F0; }
    table { border-spacing: 0; }
    td { padding: 0; }
    img { border: 0; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #0B0F17; padding-bottom: 40px; padding-top: 20px; }
    .main-table { background-color: #111827; margin: 0 auto; width: 100%; max-width: 600px; border-radius: 16px; border: 1px solid #1E293B; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
    .header { background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); padding: 32px 40px; text-align: center; border-bottom: 1px solid #334155; }
    .logo-badge { display: inline-block; background: linear-gradient(135deg, #FF6B35 0%, #EA580C 100%); color: #FFFFFF; font-weight: 800; font-size: 20px; padding: 8px 16px; border-radius: 10px; letter-spacing: 0.5px; }
    .content-body { padding: 36px 40px; }
    .btn-primary { display: inline-block; background: linear-gradient(135deg, #FF6B35 0%, #EA580C 100%); color: #FFFFFF !important; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 10px; margin: 24px 0; text-align: center; box-shadow: 0 4px 14px 0 rgba(234, 88, 12, 0.39); }
    .info-box { background-color: #1E293B; border-left: 4px solid #FF6B35; padding: 16px 20px; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 24px 40px; background-color: #0F172A; border-top: 1px solid #1E293B; font-size: 12px; color: #64748B; line-height: 1.6; }
    .footer a { color: #FF6B35; text-decoration: none; }
    @media screen and (max-width: 600px) {
      .content-body { padding: 24px 20px !important; }
      .header { padding: 24px 20px !important; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main-table" align="center">
      <tr>
        <td class="header">
          <div class="logo-badge">⚡ ${APP_NAME.toUpperCase()}</div>
          <div style="color: #94A3B8; font-size: 13px; margin-top: 8px; font-weight: 500;">Enterprise Workforce & Attendance Management</div>
        </td>
      </tr>
      <tr>
        <td class="content-body">
          ${content}
        </td>
      </tr>
      <tr>
        <td class="footer">
          <p style="margin: 0 0 8px 0;">Need assistance? Reach our support team anytime at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
          <p style="margin: 0 0 8px 0;">Secure Automated Notification &bull; Please do not reply directly to this email.</p>
          <p style="margin: 0;">&copy; ${currentYear} ${APP_NAME}. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. WELCOME EMAIL
// ─────────────────────────────────────────────────────────────────────────────
export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const subject = `Welcome to ${APP_NAME}, ${name}!`;
  const content = `
    <h2 style="color: #F8FAFC; margin-top: 0; font-size: 22px; font-weight: 700;">Welcome to the Platform, ${name}! 👋</h2>
    <p style="color: #CBD5E1; font-size: 15px; line-height: 1.6;">
      Thank you for joining <strong>${APP_NAME}</strong>. Your organization workspace is now configured and ready to streamline real-time workforce attendance, site tracking, and instant payroll calculations.
    </p>
    <div class="info-box">
      <p style="margin: 0; color: #E2E8F0; font-size: 14px; font-weight: 600;">🚀 Quick Start Highlights:</p>
      <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #94A3B8; font-size: 13px; line-height: 1.6;">
        <li>Manage daily contractor & supervisor attendance</li>
        <li>Generate instant salary reports with one click</li>
        <li>Track project sites, materials & site expenses seamlessly</li>
      </ul>
    </div>
    <p style="color: #CBD5E1; font-size: 14px; line-height: 1.6;">
      If you have any questions or need onboarding assistance, our team is always here to help.
    </p>
  `;

  return sendMailUnified(email, subject, getEmailLayout("Welcome to Haajari Manager", content), "Welcome / Onboarding");
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. EMAIL VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────
export async function sendVerificationEmail(email: string, name: string, token: string): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const subject = `Verify your ${APP_NAME} account`;
  const verificationLink = `${baseUrl}/api/auth/verify-email?token=${token}`;

  const content = `
    <h2 style="color: #F8FAFC; margin-top: 0; font-size: 22px; font-weight: 700;">Verify Your Email Address</h2>
    <p style="color: #CBD5E1; font-size: 15px; line-height: 1.6;">
      Hello <strong>${name}</strong>, thank you for registering with <strong>${APP_NAME}</strong>. Please confirm your email address to activate your account and start managing your workforce.
    </p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${verificationLink}" target="_blank" class="btn-primary">Verify Email Address</a>
    </div>
    <div class="info-box">
      <p style="margin: 0; color: #E2E8F0; font-size: 13px;">
        ⏳ <strong>Security Notice:</strong> This verification link will expire in <strong>24 hours</strong>. If you did not create this account, no further action is required.
      </p>
    </div>
    <p style="color: #94A3B8; font-size: 12px; word-break: break-all; margin-top: 20px;">
      If the button above does not work, copy and paste this link into your browser:<br>
      <a href="${verificationLink}" style="color: #FF6B35;">${verificationLink}</a>
    </p>
  `;

  return sendMailUnified(email, subject, getEmailLayout("Verify Your Email", content), "Email Verification");
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. RESEND VERIFICATION EMAIL
// ─────────────────────────────────────────────────────────────────────────────
export async function sendResendVerificationEmail(email: string, name: string, token: string): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const subject = `New Verification Link - ${APP_NAME}`;
  const verificationLink = `${baseUrl}/api/auth/verify-email?token=${token}`;

  const content = `
    <h2 style="color: #F8FAFC; margin-top: 0; font-size: 22px; font-weight: 700;">New Email Verification Link</h2>
    <p style="color: #CBD5E1; font-size: 15px; line-height: 1.6;">
      Hello <strong>${name}</strong>, as requested, here is your updated email verification link for <strong>${APP_NAME}</strong>. All previous verification links have been invalidated.
    </p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${verificationLink}" target="_blank" class="btn-primary">Activate My Account</a>
    </div>
    <div class="info-box">
      <p style="margin: 0; color: #E2E8F0; font-size: 13px;">
        ⏳ <strong>Notice:</strong> This link is valid for <strong>24 hours</strong>.
      </p>
    </div>
    <p style="color: #94A3B8; font-size: 12px; word-break: break-all;">
      Or visit: <a href="${verificationLink}" style="color: #FF6B35;">${verificationLink}</a>
    </p>
  `;

  return sendMailUnified(email, subject, getEmailLayout("New Verification Link", content), "Resend Verification");
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. FORGOT PASSWORD EMAIL
// ─────────────────────────────────────────────────────────────────────────────
export async function sendPasswordResetEmail(email: string, name: string, token: string): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const subject = `Reset your ${APP_NAME} password`;
  const resetLink = `${baseUrl}/api/auth/reset-password-page?token=${token}`;

  const content = `
    <h2 style="color: #F8FAFC; margin-top: 0; font-size: 22px; font-weight: 700;">Password Reset Request</h2>
    <p style="color: #CBD5E1; font-size: 15px; line-height: 1.6;">
      Hello <strong>${name || "User"}</strong>, we received a request to reset your password for your <strong>${APP_NAME}</strong> account. Click the button below to choose a new secure password:
    </p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${resetLink}" target="_blank" class="btn-primary">Reset My Password</a>
    </div>
    <div class="info-box">
      <p style="margin: 0; color: #E2E8F0; font-size: 13px;">
        ⏱️ <strong>Time Limit:</strong> This reset link is valid for <strong>30 minutes</strong> only. For security reasons, it can only be used once.
      </p>
    </div>
    <p style="color: #94A3B8; font-size: 13px; line-height: 1.6;">
      If you did not request a password reset, please ignore this email or reach out to <a href="mailto:${SUPPORT_EMAIL}" style="color: #FF6B35;">${SUPPORT_EMAIL}</a> if you suspect unauthorized activity.
    </p>
    <p style="color: #64748B; font-size: 11px; word-break: break-all; margin-top: 20px;">
      Direct link: <a href="${resetLink}" style="color: #FF6B35;">${resetLink}</a>
    </p>
  `;

  return sendMailUnified(email, subject, getEmailLayout("Reset Password", content), "Password Reset Request");
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. PASSWORD CHANGED SUCCESS EMAIL
// ─────────────────────────────────────────────────────────────────────────────
export async function sendPasswordResetSuccessEmail(email: string, name: string): Promise<boolean> {
  const subject = `Password Updated Successfully - ${APP_NAME}`;

  const content = `
    <h2 style="color: #F8FAFC; margin-top: 0; font-size: 22px; font-weight: 700;">Password Changed Successfully ✅</h2>
    <p style="color: #CBD5E1; font-size: 15px; line-height: 1.6;">
      Hello <strong>${name || "User"}</strong>, the password for your <strong>${APP_NAME}</strong> account was updated successfully on ${new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })} IST.
    </p>
    <div class="info-box">
      <p style="margin: 0; color: #E2E8F0; font-size: 13px;">
        🔒 All active sessions and security tokens have been refreshed for your security. You can now log in using your new password.
      </p>
    </div>
    <p style="color: #F87171; font-size: 13px; line-height: 1.6;">
      <strong>Did not make this change?</strong> If you did not update your password, please contact our support team immediately at <a href="mailto:${SUPPORT_EMAIL}" style="color: #FF6B35;">${SUPPORT_EMAIL}</a>.
    </p>
  `;

  return sendMailUnified(email, subject, getEmailLayout("Password Changed", content), "Password Reset Success");
}
