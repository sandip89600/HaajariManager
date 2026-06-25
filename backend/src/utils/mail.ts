import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

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
  } else {
    console.log("No SMTP credentials detected in .env. Initializing test Ethereal SMTP transporter...");
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
    } catch (err) {
      console.warn("Failed to create Ethereal SMTP account, creating console-fallback mailer", err);
      // Fallback in case of networking issues with Ethereal
      transporter = {
        sendMail: async (mailOptions: any) => {
          console.log("\n================ MAIL FALLBACK ================");
          console.log(`FROM: ${mailOptions.from}`);
          console.log(`TO: ${mailOptions.to}`);
          console.log(`SUBJECT: ${mailOptions.subject}`);
          console.log("HTML CONTENT:");
          console.log(mailOptions.html);
          console.log("================================================\n");
          return { messageId: "fallback-message-id" };
        },
      } as any;
    }
  }
  return transporter!;
}

export async function sendVerificationEmail(email: string, token: string) {
  try {
    const client = await getTransporter();
    const verificationLink = `${process.env.CLIENT_URL || "http://localhost:5000"}/api/auth/verify-email/${token}`;
    
    const info = await client.sendMail({
      from: '"Haajari Workforce" <no-reply@haajari.com>',
      to: email,
      subject: "Verify Your Email - Haajari App",
      html: `
        <h2>Welcome to Haajari App!</h2>
        <p>Thank you for signing up. Please verify your email by clicking the link below:</p>
        <p><a href="${verificationLink}" target="_blank">${verificationLink}</a></p>
        <p>This verification link will remain active for 24 hours.</p>
      `,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`\n📧 Verification email sent! View preview: ${previewUrl}\n`);
    } else {
      console.log(`Verification email sent successfully to ${email}`);
    }
  } catch (error) {
    console.error("Error sending verification email:", error);
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  try {
    const client = await getTransporter();
    const resetLink = `${process.env.CLIENT_URL || "http://localhost:5000"}/api/auth/reset-password?token=${token}`;

    const info = await client.sendMail({
      from: '"Haajari Support" <support@haajari.com>',
      to: email,
      subject: "Password Reset Request - Haajari App",
      html: `
        <h2>Password Reset Request</h2>
        <p>You requested a password reset. Please click the link below to set a new password:</p>
        <p><a href="${resetLink}" target="_blank">${resetLink}</a></p>
        <p>If you did not request this, please ignore this email. The link expires in 1 hour.</p>
      `,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`\n📧 Password reset email sent! View preview: ${previewUrl}\n`);
    } else {
      console.log(`Password reset email sent successfully to ${email}`);
    }
  } catch (error) {
    console.error("Error sending password reset email:", error);
  }
}
