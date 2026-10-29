import fs from "fs";
import path from "path";
import {
  User,
  Tenant,
  Worker,
  Attendance,
  Payment,
  AuditLog,
  WageHistory,
  Project,
  Site,
  Expense,
  MBEntry,
  OtpCode,
  SubscriptionTransaction,
  SupportProblem,
  SupportFeedback,
  Material,
} from "../models";

const BACKUP_DIR = path.join(__dirname, "../../backups");
const RETENTION_DAYS = 14;

/**
 * Execute automated daily snapshot backup of database collections.
 * Automatically sanitizes sensitive security credentials and rotates old snapshots.
 */
export async function performDailyBackup(): Promise<{
  success: boolean;
  filename?: string;
  sizeKb?: number;
  message: string;
}> {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const todayDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const filename = `daily_backup_${todayDate}.json`;
    const filePath = path.join(BACKUP_DIR, filename);

    console.log(`[BackupService] Starting daily database snapshot backup: ${filename}...`);

    const rawUsers = await User.find({}).lean();
    // Sanitize user records to prevent accidental plaintext/hash exposure in backups
    const sanitizedUsers = rawUsers.map((u: any) => {
      const copy = { ...u };
      delete copy.refreshTokens;
      delete copy.emailVerificationTokenHash;
      delete copy.passwordResetTokenHash;
      return copy;
    });

    const backupData: Record<string, any> = {
      backupDate: new Date().toISOString(),
      version: "2.0",
      users: sanitizedUsers,
      tenants: await Tenant.find({}).lean(),
      workers: await Worker.find({}).lean(),
      attendances: await Attendance.find({}).lean(),
      payments: await Payment.find({}).lean(),
      auditlogs: await AuditLog.find({}).lean(),
      wagehistories: await WageHistory.find({}).lean(),
      projects: await Project.find({}).lean(),
      sites: await Site.find({}).lean(),
      expenses: await Expense.find({}).lean(),
      mbentries: await MBEntry.find({}).lean(),
      otpcodes: await OtpCode.find({}).lean(),
      subscriptiontransactions: await SubscriptionTransaction.find({}).lean(),
      supportproblems: await SupportProblem.find({}).lean(),
      supportfeedbacks: await SupportFeedback.find({}).lean(),
      materials: await Material.find({}).lean(),
    };

    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), "utf-8");
    const stats = fs.statSync(filePath);
    const sizeKb = Number((stats.size / 1024).toFixed(2));

    console.log(`[BackupService] Daily backup saved successfully: ${filename} (${sizeKb} KB)`);

    // Rotate and clean up backups older than retention limit
    rotateOldBackups();

    return {
      success: true,
      filename,
      sizeKb,
      message: `Daily backup created successfully (${sizeKb} KB)`,
    };
  } catch (error: any) {
    console.error("[BackupService] Error generating daily backup:", error.message);
    return {
      success: false,
      message: `Backup failed: ${error.message}`,
    };
  }
}

/**
 * Remove backup snapshots older than 14 days to prevent uncontrolled disk growth
 */
export function rotateOldBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;

    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    const maxAgeMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const fullPath = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(fullPath);
      const ageMs = now - stat.mtimeMs;

      if (ageMs > maxAgeMs) {
        fs.unlinkSync(fullPath);
        console.log(`[BackupService] Pruned expired backup snapshot: ${file}`);
      }
    }
  } catch (err: any) {
    console.warn("[BackupService] Warning during backup rotation:", err.message);
  }
}

/**
 * Start automated background daily backup scheduler
 */
export function startDailyBackupScheduler() {
  if (process.env.NODE_ENV === "test") return;

  console.log("[BackupService] Daily backup background scheduler registered.");

  // Execute first backup 30 seconds after server startup
  setTimeout(() => {
    performDailyBackup().catch((e) =>
      console.error("[BackupService] Initial startup backup error:", e)
    );
  }, 30000);

  // Recurring trigger every 24 hours (86,400,000 ms)
  setInterval(() => {
    performDailyBackup().catch((e) =>
      console.error("[BackupService] Scheduled daily backup error:", e)
    );
  }, 24 * 60 * 60 * 1000);
}
