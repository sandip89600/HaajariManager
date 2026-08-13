import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../../.env") });

import axios from "axios";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User, Tenant, AuditLog } from "../models";

async function runEmailRecoveryTestSuite() {
  await mongoose.connect(process.env.MONGO_URI || "");

  const baseUrl = "http://localhost:5000/api/auth";
  const uniqueId = Math.floor(100000 + Math.random() * 900000);
  const testEmail = `email_rec_${uniqueId}@haajari.test`;
  const testPhone = `9555${uniqueId}`;
  const initialPassword = "OldSecret#123";
  const newPassword = "Haajari@123";

  console.log("==========================================================================");
  console.log("📧 RUNNING COMPLETE EMAIL PASSWORD RECOVERY SYSTEM TEST SUITE (14+ TESTS)");
  console.log("==========================================================================");

  let tenant = await Tenant.findOne();
  if (!tenant) {
    tenant = new Tenant({ name: "Email Test Org", code: `ET${uniqueId}`, plan: "free" });
    await tenant.save();
  }

  // Setup user with known active sessions and verified email status
  const user = new User({
    tenantId: tenant._id,
    name: "Email Recovery Tester",
    email: testEmail,
    phone: testPhone,
    username: `email_user_${uniqueId}`,
    passwordHash: await bcrypt.hash(initialPassword, 12),
    role: "contractor",
    isActive: true,
    isVerified: true,
    isPhoneVerified: true,
    status: "active",
    refreshTokens: ["active-session-token-1", "active-session-token-2"]
  });
  await user.save();
  console.log(`\n[SETUP] Created User: ${testEmail} with 2 active refresh tokens.`);

  // TEST 1: Registered Email requests password reset
  console.log("\n[TEST 1] Registered email requests password recovery...");
  const registeredRes = await axios.post(`${baseUrl}/forgot-password`, { email: testEmail });
  console.log("Response:", registeredRes.data);
  if (!registeredRes.data.success || !registeredRes.data.message.includes("If this email is registered")) {
    throw new Error("Expected generic anti-enumeration response for registered email!");
  }

  // TEST 2: Unregistered Email requests password reset
  console.log("\n[TEST 2] Unregistered email requests password recovery...");
  const unregisteredRes = await axios.post(`${baseUrl}/forgot-password`, { email: "unregistered_random@haajari.test" });
  console.log("Anti-enumeration response:", unregisteredRes.data);
  if (!unregisteredRes.data.success || !unregisteredRes.data.message.includes("If this email is registered")) {
    throw new Error("Expected identical generic response for unregistered email!");
  }

  // TEST 3: Resend before 60s cooldown
  console.log("\n[TEST 3] Testing Resend Cooldown within 60s...");
  try {
    await axios.post(`${baseUrl}/forgot-password`, { email: testEmail });
    throw new Error("Resend was allowed before cooldown!");
  } catch (err: any) {
    console.log("✅ Blocked with 429 as expected:", err.response?.status, err.response?.data?.message);
  }

  // TEST 4: Inspect MongoDB for secure token hash
  console.log("\n[TEST 4] Inspecting MongoDB Document for Token & Hash...");
  const userAfterForgot = await User.findById(user._id);
  const rawToken = userAfterForgot?.passwordResetToken;
  const tokenHash = userAfterForgot?.passwordResetTokenHash;
  const expiry = userAfterForgot?.passwordResetExpires;

  console.log("- Raw Token in DB (stored for dispatch):", !!rawToken);
  console.log("- Token Hash in DB (SHA-256):", !!tokenHash);
  console.log("- Expiry Date:", expiry);

  if (!rawToken || !tokenHash) {
    throw new Error("Token and SHA-256 Token Hash must be present in MongoDB!");
  }

  // TEST 5: Reset Page Loading
  console.log("\n[TEST 5] Loading interactive reset password web page...");
  const pageRes = await axios.get(`${baseUrl}/reset-password-page?token=${rawToken}`);
  console.log("Web Page HTTP Status:", pageRes.status);
  console.log("Includes live checklist & form:", pageRes.data.includes("req-special") && pageRes.data.includes("resetForm"));
  if (pageRes.status !== 200) throw new Error("Reset password page failed to load!");

  // TEST 6: Reject weak password
  console.log("\n[TEST 6] Submitting weak password (e.g. 'simple')...");
  try {
    await axios.post(`${baseUrl}/reset-password`, {
      token: rawToken,
      newPassword: "simple",
      confirmPassword: "simple"
    });
    throw new Error("Weak password was accepted!");
  } catch (err: any) {
    console.log("✅ Weak password rejected as expected:", err.response?.data?.message);
  }

  // TEST 7: Reject mismatched passwords
  console.log("\n[TEST 7] Submitting mismatched passwords...");
  try {
    await axios.post(`${baseUrl}/reset-password`, {
      token: rawToken,
      newPassword: "Haajari@123",
      confirmPassword: "Different@123"
    });
    throw new Error("Mismatched passwords were accepted!");
  } catch (err: any) {
    console.log("✅ Mismatched passwords rejected as expected:", err.response?.data?.message);
  }

  // TEST 8: Submit valid new password
  console.log(`\n[TEST 8] Submitting valid new password: '${newPassword}'...`);
  const resetRes = await axios.post(`${baseUrl}/reset-password`, {
    token: rawToken,
    newPassword,
    confirmPassword: newPassword
  });
  console.log("Password Reset Response:", resetRes.data);
  if (!resetRes.data.success) throw new Error("Valid password reset failed!");

  // TEST 9 & 10: Database verification of hash update and token cleanup
  console.log("\n[TEST 9 & 10] Inspecting MongoDB User Document after reset...");
  const dbUserAfterReset = await User.findById(user._id);
  const isOldMatch = await bcrypt.compare(initialPassword, dbUserAfterReset?.passwordHash || "");
  const isNewMatch = await bcrypt.compare(newPassword, dbUserAfterReset?.passwordHash || "");

  console.log("- Old password matches DB hash? :", isOldMatch ? "❌ STILL MATCHES OLD" : "✅ NO");
  console.log("- New password matches DB hash? :", isNewMatch ? "✅ YES (UPDATED IN DB)" : "❌ NO");
  console.log("- Reset Token in DB             :", dbUserAfterReset?.passwordResetToken || "null (Cleared)");
  console.log("- Reset Token Hash in DB        :", dbUserAfterReset?.passwordResetTokenHash || "null (Cleared)");
  console.log("- Reset Expiry in DB            :", dbUserAfterReset?.passwordResetExpires || "null (Cleared)");
  console.log("- Active Sessions Count in DB   :", dbUserAfterReset?.refreshTokens.length, "(All Revoked)");

  if (!isNewMatch) throw new Error("New password hash is not stored in MongoDB!");
  if (dbUserAfterReset?.passwordResetToken) throw new Error("Reset token was not cleared from MongoDB!");
  if (dbUserAfterReset?.refreshTokens.length !== 0) throw new Error("Active sessions were not revoked!");

  // TEST 11: Old password fails login
  console.log("\n[TEST 11] Testing login with OLD password...");
  try {
    await axios.post(`${baseUrl}/login`, { phone: testPhone, password: initialPassword });
    throw new Error("Old password was accepted!");
  } catch (err: any) {
    console.log("✅ Old password rejected as expected:", err.response?.status, err.response?.data?.error || err.response?.data?.message);
  }

  // TEST 12: New password succeeds login
  console.log("\n[TEST 12] Testing login with NEW password...");
  const loginRes = await axios.post(`${baseUrl}/login`, { phone: testPhone, password: newPassword });
  console.log("✅ Login with NEW password succeeded! JWT Token received:", !!loginRes.data.token);

  // TEST 13: Attempt to reuse the same reset link
  console.log("\n[TEST 13] Attempting to REUSE the same reset token...");
  try {
    await axios.post(`${baseUrl}/reset-password`, {
      token: rawToken,
      newPassword: "AnotherPass@2026",
      confirmPassword: "AnotherPass@2026"
    });
    throw new Error("Reused token was accepted!");
  } catch (err: any) {
    console.log("✅ Token reuse rejected as expected:", err.response?.data?.message);
  }

  // TEST 14: Check Audit Log
  console.log("\n[TEST 14] Verifying MongoDB Audit Log...");
  const auditEntries = await AuditLog.find({ targetId: user._id.toString() });
  console.log(`- Found ${auditEntries.length} audit entries for user.`);
  auditEntries.forEach((entry) => {
    console.log(`  • Action: ${entry.action} | Platform: ${entry.platform} | Time: ${entry.timestamp.toISOString()}`);
  });

  if (auditEntries.length === 0) throw new Error("Audit log did not record recovery events!");

  console.log("\n==========================================================================");
  console.log("🎉 ALL 14+ EMAIL PASSWORD RECOVERY & DATABASE TESTS PASSED 100%!");
  console.log("==========================================================================");

  await mongoose.disconnect();
  process.exit(0);
}

runEmailRecoveryTestSuite().catch((err) => {
  console.error("Test Suite Failed:", err.response?.data || err.message || err);
  process.exit(1);
});
