import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import { User, Tenant, Worker, Attendance, Payment, AuditLog, WageHistory, Project, SupportProblem, SupportFeedback, Expense, MBEntry, OtpCode, Site, SubscriptionTransaction, Material } from "../models";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/haajari";

async function backupAndWipe() {
  console.log("\n==============================================");
  console.log("  HAAJARI DATABASE BACKUP & NON-ADMIN WIPE SCRIPT");
  console.log("==============================================\n");

  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  // Create backup folder if it doesn't exist
  const backupDir = path.join(__dirname, "../../backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Define backup payload
  const backupData: Record<string, any> = {};

  console.log("📦 Fetching database collections for backup...");
  
  backupData.users = await User.find({});
  backupData.tenants = await Tenant.find({});
  backupData.workers = await Worker.find({});
  backupData.attendances = await Attendance.find({});
  backupData.payments = await Payment.find({});
  backupData.auditlogs = await AuditLog.find({});
  backupData.wagehistories = await WageHistory.find({});
  backupData.projects = await Project.find({});
  backupData.sites = await Site.find({});
  backupData.expenses = await Expense.find({});
  backupData.mbentries = await MBEntry.find({});
  backupData.otpcodes = await OtpCode.find({});
  backupData.subscriptiontransactions = await SubscriptionTransaction.find({});
  backupData.supportproblems = await SupportProblem.find({});
  backupData.supportfeedbacks = await SupportFeedback.find({});
  backupData.materials = await Material.find({});

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(backupDir, `backup_${timestamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));

  console.log(`✅ Backup file created successfully: ${backupFile}`);
  console.log(`   Size: ${(fs.statSync(backupFile).size / 1024).toFixed(2)} KB\n`);

  console.log("🗑️  Wiping non-admin collections...");

  const userRes = await User.deleteMany({ role: { $ne: "admin" } });
  console.log(`   Deleted ${userRes.deletedCount} non-admin Users`);

  const tenantRes = await Tenant.deleteMany({ code: { $ne: "SYSADMIN" } });
  console.log(`   Deleted ${tenantRes.deletedCount} non-admin Tenants (Organizations)`);

  const workerRes = await Worker.deleteMany({});
  console.log(`   Deleted ${workerRes.deletedCount} Workers`);

  const attendanceRes = await Attendance.deleteMany({});
  console.log(`   Deleted ${attendanceRes.deletedCount} Attendance records`);

  const paymentRes = await Payment.deleteMany({});
  console.log(`   Deleted ${paymentRes.deletedCount} Payments`);

  const auditLogRes = await AuditLog.deleteMany({});
  console.log(`   Deleted ${auditLogRes.deletedCount} Audit Logs`);

  const wageHistRes = await WageHistory.deleteMany({});
  console.log(`   Deleted ${wageHistRes.deletedCount} Wage Histories`);

  const projectRes = await Project.deleteMany({});
  console.log(`   Deleted ${projectRes.deletedCount} Projects`);

  const siteRes = await Site.deleteMany({});
  console.log(`   Deleted ${siteRes.deletedCount} Sites`);

  const expenseRes = await Expense.deleteMany({});
  console.log(`   Deleted ${expenseRes.deletedCount} Expenses`);

  const mbRes = await MBEntry.deleteMany({});
  console.log(`   Deleted ${mbRes.deletedCount} MBEntries`);

  const otpRes = await OtpCode.deleteMany({});
  console.log(`   Deleted ${otpRes.deletedCount} OTP Codes`);

  const subRes = await SubscriptionTransaction.deleteMany({});
  console.log(`   Deleted ${subRes.deletedCount} Subscription Transactions`);

  const problemRes = await SupportProblem.deleteMany({});
  console.log(`   Deleted ${problemRes.deletedCount} Support Problems`);

  const feedbackRes = await SupportFeedback.deleteMany({});
  console.log(`   Deleted ${feedbackRes.deletedCount} Support Feedbacks`);

  const materialRes = await Material.deleteMany({});
  console.log(`   Deleted ${materialRes.deletedCount} Materials`);

  // Clear refresh tokens of any remaining admin user and synchronize credentials
  let admin = await User.findOne({ role: "admin" });
  let tenant = await Tenant.findOne({ code: "SYSADMIN" });
  if (!tenant) {
    tenant = new Tenant({
      name: "System Admin Org",
      code: "SYSADMIN",
      plan: "business",
    });
    await tenant.save();
  }
  const defaultPasswordHash = await bcrypt.hash("Sandeep#101", 12);
  if (!admin) {
    admin = new User({
      tenantId: tenant._id,
      name: "System Administrator",
      email: "sandippandit896@gmail.com",
      phone: "7058222107",
      passwordHash: defaultPasswordHash,
      role: "admin",
      isActive: true,
      isVerified: true,
      isEmailVerified: true,
      status: "active",
      refreshTokens: [],
    });
    await admin.save();
    console.log("👑 Admin account initialized: sandippandit896@gmail.com");
  } else {
    admin.email = "sandippandit896@gmail.com";
    admin.name = "System Administrator";
    admin.phone = "7058222107";
    admin.passwordHash = defaultPasswordHash;
    admin.isActive = true;
    admin.isVerified = true;
    admin.isEmailVerified = true;
    admin.status = "active";
    admin.tenantId = tenant._id;
    admin.refreshTokens = [];
    await admin.save();
    console.log("👑 Admin credentials refreshed and synchronized: sandippandit896@gmail.com");
  }

  console.log("\n==============================================");
  console.log("  RESET COMPLETE");
  console.log("==============================================");
  console.log("  Admin accounts preserved successfully.");
  console.log("  All non-admin user data deleted.");
  console.log("==============================================\n");

  await mongoose.disconnect();
}

backupAndWipe().catch(err => {
  console.error("❌ Reset script failed:", err);
  process.exit(1);
});
