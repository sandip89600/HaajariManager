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
  let configuredFrom = process.env.EMAIL_FROM?.trim();

  if (configuredFrom) {
    // Auto-correct domain typo if .com was configured instead of verified .in domain
    if (configuredFrom.includes("@haajari.deepitlabs.com")) {
      configuredFrom = configuredFrom.replace("@haajari.deepitlabs.com", "@haajari.deepitlabs.in");
    }

    if (configuredFrom.includes("<")) {
      return configuredFrom;
    }
    return `Haajari Manager <${configuredFrom}>`;
  }

  // Default verified domain sender for Haajari Manager
  return "Haajari Manager <noreply@haajari.deepitlabs.in>";
}

/**
 * Resolves the application base URL for verification and password reset links.
 */
function getBaseUrl(): string {
  const configuredUrl = (process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || process.env.CLIENT_URL)?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    return "https://haajarimanager.onrender.com";
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
export interface EmailSendResult {
  success: boolean;
  provider: "Resend" | "Nodemailer" | "ConsoleFallback";
  error?: string;
  messageId?: string;
}

/**
 * Centralized Universal Email Sender with detailed error reporting & 6s timeout guard:
 * 1. Attempts Resend Primary
 * 2. If Resend fails, automatically falls back to Nodemailer SMTP / Console Transporter
 * 3. Returns detailed status & safe error message for feedback
 */
export async function sendMailUnifiedDetailed(
  to: string,
  subject: string,
  html: string,
  emailType: string = "Notification"
): Promise<EmailSendResult> {
  console.log(`[EMAIL_PROVIDER_REQUEST_STARTED] Type: ${emailType}`);

  const executeSend = async (): Promise<EmailSendResult> => {
    const resend = getResendClient();
    const from = getSenderEmail();
    let lastResendError = "";

    // 1. Try Resend Primary
    if (resend && from) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Email service timed out.")), 6000)
        );

        const { data, error }: any = await Promise.race([
          resend.emails.send({
            from,
            to,
            subject,
            html,
          }),
          timeoutPromise,
        ]);

        if (!error && data) {
          console.log(`[EMAIL_PROVIDER_RESPONSE_RECEIVED] Provider: Resend | ID: ${data.id}`);
          return { success: true, provider: "Resend", messageId: data.id };
        }

        const safeErrorMsg = error?.message || (typeof error === "string" ? error : JSON.stringify(error));
        lastResendError = safeErrorMsg;
        console.warn(`[EMAIL_PROVIDER_ERROR] Resend delivery failed for "${emailType}". Notice: ${safeErrorMsg}`);
      } catch (resendErr: any) {
        const safeErrorMsg = resendErr?.message || "Unknown error during Resend dispatch";
        lastResendError = safeErrorMsg;
        console.warn(`[EMAIL_PROVIDER_ERROR] Resend exception for "${emailType}". Notice: ${safeErrorMsg}`);
      }
    } else if (!resend) {
      lastResendError = "RESEND_API_KEY is missing or invalid.";
      console.warn(`[EMAIL_PROVIDER_ERROR] Resend client not initialized (RESEND_API_KEY missing).`);
    } else if (!from) {
      lastResendError = "Sender email address (EMAIL_FROM) is missing.";
      console.warn(`[EMAIL_PROVIDER_ERROR] Sender address missing.`);
    }

    // 2. Nodemailer Fallback (SMTP or Console Transporter)
    try {
      const client = await getTransporter();
      const senderAddress = from || "Haajari Manager <no-reply@haajari.com>";

      if (client) {
        const nodemailerTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Nodemailer SMTP dispatch timeout")), 5000)
        );

        const info: any = await Promise.race([
          client.sendMail({
            from: senderAddress,
            to,
            subject,
            html,
          }),
          nodemailerTimeout,
        ]);

        console.log(`[EMAIL_PROVIDER_RESPONSE_RECEIVED] Provider: Nodemailer | ID: ${info.messageId || "delivered"}`);
        return { success: true, provider: "Nodemailer", messageId: info.messageId || "delivered" };
      }
    } catch (smtpErr: any) {
      const safeErrorMsg = smtpErr?.message || "Unknown SMTP delivery error";
      console.error(`[EMAIL_PROVIDER_ERROR] Nodemailer fallback failed. Notice: ${safeErrorMsg}`);
    }

    // 3. Dev Mode Console Transporter Fallback
    if (process.env.NODE_ENV !== "production") {
      console.log("\n================ [EMAIL FALLBACK CONSOLE] ================");
      console.log(`FROM: ${from || "Haajari Manager <no-reply@haajari.com>"}`);
      console.log(`TO: ${to}`);
      console.log(`SUBJECT: ${subject}`);
      console.log(`TYPE: ${emailType}`);
      console.log(`HTML LENGTH: ${html?.length || 0} bytes`);
      console.log("==========================================================\n");

      return {
        success: true,
        provider: "ConsoleFallback",
        messageId: `dev-fallback-${Date.now()}`,
        error: lastResendError ? `Resend Notice: ${lastResendError}` : undefined,
      };
    }

    return {
      success: false,
      provider: "Resend",
      error: lastResendError || "Unable to send email right now.",
    };
  };

  // Global 7-second timeout wrapper guarantee to prevent pending requests
  try {
    const globalTimeout = new Promise<EmailSendResult>((_, reject) =>
      setTimeout(() => reject(new Error("Email service timed out.")), 7000)
    );

    return await Promise.race([executeSend(), globalTimeout]);
  } catch (err: any) {
    console.error(`[EMAIL_PROVIDER_ERROR] Global timeout or exception: ${err.message}`);
    return {
      success: false,
      provider: "Resend",
      error: err.message || "Email service timed out.",
    };
  }
}

export async function sendMailUnified(
  to: string,
  subject: string,
  html: string,
  emailType: string = "Notification"
): Promise<boolean> {
  const result = await sendMailUnifiedDetailed(to, subject, html, emailType);
  return result.success;
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
// 2. FORGOT PASSWORD EMAIL
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

// ─────────────────────────────────────────────────────────────────────────────
// 6. PRIVILEGED RECOVERY EMAIL CONFIRMATION
// ─────────────────────────────────────────────────────────────────────────────
export async function sendEmailConfirmationRecoveryEmail(email: string, name: string, token: string): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const subject = `Confirm your ${APP_NAME} password recovery`;
  const confirmLink = `${baseUrl}/api/recovery/confirm-email?token=${token}`;

  const content = `
    <h2 style="color: #F8FAFC; margin-top: 0; font-size: 22px; font-weight: 700;">Confirm Password Recovery 🛡️</h2>
    <p style="color: #CBD5E1; font-size: 15px; line-height: 1.6;">
      Hello <strong>${name || "User"}</strong>, an account recovery was initiated for your privileged <strong>${APP_NAME}</strong> account. Please confirm this secondary verification request to proceed with setting a new password:
    </p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${confirmLink}" target="_blank" class="btn-primary">Confirm Password Recovery</a>
    </div>
    <div class="info-box">
      <p style="margin: 0; color: #E2E8F0; font-size: 13px;">
        ⏱️ <strong>Security Notice:</strong> This confirmation link will expire in <strong>15 minutes</strong>. If you did not initiate this recovery, please change your credentials immediately.
      </p>
    </div>
    <p style="color: #64748B; font-size: 11px; word-break: break-all; margin-top: 20px;">
      Direct link: <a href="${confirmLink}" style="color: #FF6B35;">${confirmLink}</a>
    </p>
  `;

  return sendMailUnified(email, subject, getEmailLayout("Confirm Password Recovery", content), "Privileged Recovery Email Confirmation");
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. NEW DEVICE LOGIN SECURITY ALERT EMAIL
// ─────────────────────────────────────────────────────────────────────────────
export async function sendNewLoginAlertEmail(
  email: string,
  name: string,
  deviceInfo: {
    deviceName: string;
    platform: string;
    browser: string;
    location: string;
    loginTime: string;
  }
): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const subject = `New login detected on your ${APP_NAME} account`;
  const secureLink = `${baseUrl}/secure-account`;

  const content = `
    <h2 style="color: #F8FAFC; margin-top: 0; font-size: 22px; font-weight: 700;">🔐 New Login Detected</h2>
    <p style="color: #CBD5E1; font-size: 15px; line-height: 1.6;">
      Hello <strong>${name || "User"}</strong>, your <strong>${APP_NAME}</strong> account was recently signed in from a new device.
    </p>

    <div style="background-color: #1E293B; border: 1px solid #334155; border-radius: 8px; padding: 18px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; color: #CBD5E1; font-size: 14px; line-height: 1.8;">
        <tr>
          <td style="color: #94A3B8; font-weight: 600; width: 140px;">Device:</td>
          <td style="color: #F8FAFC; font-weight: 700;">${deviceInfo.deviceName}</td>
        </tr>
        <tr>
          <td style="color: #94A3B8; font-weight: 600;">Platform:</td>
          <td style="color: #F8FAFC;">${deviceInfo.platform}</td>
        </tr>
        <tr>
          <td style="color: #94A3B8; font-weight: 600;">Browser:</td>
          <td style="color: #F8FAFC;">${deviceInfo.browser}</td>
        </tr>
        <tr>
          <td style="color: #94A3B8; font-weight: 600;">Approx Location:</td>
          <td style="color: #F8FAFC;">${deviceInfo.location}</td>
        </tr>
        <tr>
          <td style="color: #94A3B8; font-weight: 600;">Time:</td>
          <td style="color: #F8FAFC;">${deviceInfo.loginTime}</td>
        </tr>
      </table>
    </div>

    <p style="color: #CBD5E1; font-size: 14px; line-height: 1.6;">
      If this was you, no action is required. Your other active sessions will remain logged in.
    </p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${secureLink}" target="_blank" class="btn-primary" style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); font-weight: 700;">Secure My Account</a>
    </div>

    <div class="info-box" style="border-left-color: #EF4444;">
      <p style="margin: 0; color: #E2E8F0; font-size: 13px; line-height: 1.5;">
        ⚠️ <strong>Don't recognize this login?</strong> Please secure your account immediately by choosing a new password or logging out unrecognized devices under <strong>Settings → Security → Devices & Login Activity</strong>.
      </p>
    </div>
  `;

  return sendMailUnified(email, subject, getEmailLayout("New Login Alert", content), "New Device Login Security Alert");
}

/**
 * Generates branded HTML for Admin Custom Email Notifications
 */
export function generateAdminNotificationEmailHTML(
  heading: string,
  messageContent: string,
  cta?: {
    enabled?: boolean;
    buttonText?: string;
    actionTarget?: string;
    customUrl?: string;
  },
  isTest: boolean = false
): string {
  const baseUrl = getBaseUrl();
  let ctaLink = baseUrl;

  if (cta?.enabled) {
    if (cta.actionTarget === "Custom Link" && cta.customUrl) {
      ctaLink = cta.customUrl;
    } else if (cta.actionTarget === "Open Attendance") {
      ctaLink = `${baseUrl}/attendance`;
    } else if (cta.actionTarget === "Open Workers") {
      ctaLink = `${baseUrl}/workers`;
    } else if (cta.actionTarget === "Open Reports") {
      ctaLink = `${baseUrl}/reports`;
    } else if (cta.actionTarget === "Open Profile") {
      ctaLink = `${baseUrl}/settings`;
    } else if (cta.actionTarget === "Open Site Management") {
      ctaLink = `${baseUrl}/sites`;
    } else {
      ctaLink = `${baseUrl}/dashboard`;
    }
  }

  // Format paragraphs in message content safely if not HTML formatted
  const formattedBody = messageContent.includes("<p>")
    ? messageContent
    : messageContent
        .split("\n\n")
        .map((para) => `<p style="margin: 0 0 16px; color: #E2E8F0; font-size: 15px; line-height: 1.6;">${para.replace(/\n/g, "<br/>")}</p>`)
        .join("");

  const testBanner = isTest
    ? `
      <div style="background-color: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 10px 16px; margin-bottom: 20px; text-align: center;">
        <span style="color: #92400E; font-[700]; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
          ⚠️ THIS IS A TEST EMAIL FROM HAAJARI MANAGER ADMIN PANEL
        </span>
      </div>
    `
    : "";

  const ctaButtonHtml = cta?.enabled
    ? `
      <div style="text-align: center; margin: 28px 0 16px;">
        <a href="${ctaLink}" target="_blank" class="btn-primary" style="background: linear-gradient(135deg, #F97316 0%, #EA580C 100%); color: #FFFFFF; font-weight: 800; font-size: 15px; padding: 12px 28px; text-decoration: none; border-radius: 12px; display: inline-block;">
          ${cta.buttonText || "Open Haajari Manager"}
        </a>
      </div>
    `
    : "";

  const innerContent = `
    ${testBanner}
    <h2 style="color: #FFFFFF; font-size: 22px; font-weight: 800; margin: 0 0 16px; letter-spacing: -0.5px;">
      ${heading}
    </h2>
    
    <div style="margin-bottom: 24px;">
      ${formattedBody}
    </div>

    ${ctaButtonHtml}
  `;

  return getEmailLayout(heading, innerContent);
}



