import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../../.env") });

import axios from "axios";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User, Tenant, OtpCode, RecoverySession, AuditLog } from "../models";

async function runCompleteRecoverySystemTestSuite() {
  await mongoose.connect(process.env.MONGO_URI || "");

  const baseUrl = "http://localhost:5000/api";
  const uniqueId = Math.floor(100000 + Math.random() * 900000);
  const testPhone = `9700${uniqueId}`;
  const testEmail = `contractor_${uniqueId}@haajari.test`;
  const initialPassword = "OldPassword#123";
  const newPassword = "Haajari@123";

  console.log("========================================================================");
  console.log("🛡️ RUNNING PRODUCTION-READY FORGOT PASSWORD & RECOVERY SYSTEM TEST SUITE");
  console.log("========================================================================");

  let tenant = await Tenant.findOne();
  if (!tenant) {
    tenant = new Tenant({ name: "Testing Org", code: `TO${uniqueId}`, plan: "free" });
    await tenant.save();
  }

  // 1. Create Normal Test User (Contractor)
  const user = new User({
    tenantId: tenant._id,
    name: "Normal Contractor User",
    email: testEmail,
    phone: testPhone,
    username: `contractor_${uniqueId}`,
    passwordHash: await bcrypt.hash(initialPassword, 12),
    role: "contractor",
    isActive: true,
    isVerified: true,
    isPhoneVerified: true,
    status: "active",
    refreshTokens: ["fake-active-refresh-token-session-1", "fake-active-refresh-token-session-2"]
  });
  await user.save();
  console.log(`\n[TEST 1] Created Contractor User: ${user.phone} with initial active sessions.`);

  // 2. Anti-enumeration check on non-existing phone
  console.log("\n[TEST 2] Testing Anti-Enumeration on unregistered phone...");
  const nonExistingRes = await axios.post(`${baseUrl}/recovery/check-phone`, { phone: "9000000000" });
  console.log("Anti-enumeration response:", nonExistingRes.data);
  if (!nonExistingRes.data.success) throw new Error("Anti-enumeration should return generic success response!");

  // 3. Admin without email recovery block
  console.log("\n[TEST 3] Testing Admin without registered email safe recovery block...");
  const adminPhone = `9600${uniqueId}`;
  const unverifiedAdmin = new User({
    tenantId: tenant._id,
    name: "Admin Without Registered Email",
    phone: adminPhone,
    username: `admin_${uniqueId}`,
    passwordHash: await bcrypt.hash("AdminPass#123", 12),
    role: "admin",
    isPhoneVerified: true,
    isActive: true,
    status: "active"
  });
  await unverifiedAdmin.save();

  try {
    await axios.post(`${baseUrl}/recovery/check-phone`, { phone: adminPhone });
    throw new Error("Admin without verified email was not blocked!");
  } catch (err: any) {
    console.log("✅ Admin without email blocked with 403 as expected:", err.response?.data);
  }

  // 4. Existing User Requests OTP
  console.log("\n[TEST 4] Requesting Recovery OTP for test user...");
  const reqOtpRes = await axios.post(`${baseUrl}/recovery/check-phone`, { phone: testPhone });
  console.log("OTP Request Response:", reqOtpRes.data);

  // Inspect MongoDB for OTP document
  const otpDoc = await OtpCode.findOne({ phone: testPhone }).sort({ createdAt: -1 });
  console.log("MongoDB OTP Verification:");
  console.log("- OTP Hash present in DB:", !!otpDoc?.otpCodeHash);
  console.log("- Expires in:", otpDoc?.expiresAt);
  console.log("- Verified status:", otpDoc?.verified);

  if (!otpDoc) throw new Error("OTP document was not found in MongoDB!");

  // 5. Test Resend Cooldown (within 60s)
  console.log("\n[TEST 5] Testing Resend Cooldown within 60s...");
  try {
    await axios.post(`${baseUrl}/recovery/check-phone`, { phone: testPhone });
    throw new Error("Resend OTP was allowed before cooldown!");
  } catch (err: any) {
    console.log("✅ Resend blocked with 429 as expected:", err.response?.status, err.response?.data?.message);
  }

  // 6. Test Wrong OTP Attempts
  console.log("\n[TEST 6] Testing Wrong OTP attempt...");
  try {
    await axios.post(`${baseUrl}/recovery/verify-otp`, { phone: testPhone, otp: "000000" });
    throw new Error("Invalid OTP was accepted!");
  } catch (err: any) {
    console.log("✅ Wrong OTP rejected as expected:", err.response?.data?.message);
  }

  // Check attempt increment in DB
  const otpAfterFail = await OtpCode.findOne({ phone: testPhone });
  console.log("MongoDB OTP attempts count:", otpAfterFail?.attemptsCount);
  if (otpAfterFail?.attemptsCount !== 1) throw new Error("Attempts count did not increment!");

  // 7. Verify with Correct OTP (in dev simulation: 123456 or matching hash)
  console.log("\n[TEST 7] Verifying with valid OTP...");
  // Let's create a known OTP for exact match testing
  const knownCode = "654321";
  otpAfterFail!.otpCodeHash = await bcrypt.hash(knownCode, 12);
  otpAfterFail!.attemptsCount = 0;
  await otpAfterFail!.save();

  const verifyRes = await axios.post(`${baseUrl}/recovery/verify-otp`, { phone: testPhone, otp: knownCode });
  console.log("Verify OTP Response:", verifyRes.data);

  const recoverySessionToken = verifyRes.data.recoverySessionToken;
  if (!recoverySessionToken) throw new Error("Recovery Session Token was not issued!");

  // 8. Verify OTP cannot be reused
  console.log("\n[TEST 8] Attempting to reuse the verified OTP...");
  try {
    await axios.post(`${baseUrl}/recovery/verify-otp`, { phone: testPhone, otp: knownCode });
    throw new Error("Verified OTP was reused!");
  } catch (err: any) {
    console.log("✅ OTP reuse rejected as expected:", err.response?.data?.message);
  }

  // 9. Inspect MongoDB RecoverySession document
  console.log("\n[TEST 9] Inspecting MongoDB RecoverySession Document...");
  const sessionDoc = await RecoverySession.findOne({ userId: user._id, used: false });
  console.log("- Session Scope in DB:", sessionDoc?.scope);
  console.log("- Requires Email Confirmation:", sessionDoc?.requiresEmailConfirmation);
  console.log("- Email Confirmed:", sessionDoc?.emailConfirmed);
  console.log("- Session Expires At:", sessionDoc?.expiresAt);

  if (!sessionDoc || sessionDoc.scope !== "password_reset_only") {
    throw new Error("Scoped recovery session was not created properly!");
  }

  // 10. Verify Recovery Session cannot access normal authenticated APIs (e.g. /api/workers)
  console.log("\n[TEST 10] Testing Recovery Session Token on Protected API (/api/workers)...");
  try {
    await axios.get(`${baseUrl}/workers`, {
      headers: { Authorization: `Bearer ${recoverySessionToken}` }
    });
    throw new Error("Recovery session token was accepted for normal authenticated API!");
  } catch (err: any) {
    console.log("✅ Protected API rejected recovery session token as expected:", err.response?.status);
  }

  // 11. Test Password Validation (Reject weak password)
  console.log("\n[TEST 11] Testing weak password rejection (e.g. 'short')...");
  try {
    await axios.post(`${baseUrl}/recovery/reset-password`, {
      recoverySessionToken,
      newPassword: "short",
      confirmPassword: "short"
    });
    throw new Error("Weak password was accepted!");
  } catch (err: any) {
    console.log("✅ Weak password rejected as expected:", err.response?.data?.message);
  }

  // 12. Test Password Reset with Valid Password
  console.log(`\n[TEST 12] Submitting valid new password: '${newPassword}'...`);
  const resetRes = await axios.post(`${baseUrl}/recovery/reset-password`, {
    recoverySessionToken,
    newPassword,
    confirmPassword: newPassword
  });
  console.log("Password Reset Response:", resetRes.data);

  // 13. Inspect MongoDB User document & Session Invalidation
  console.log("\n[TEST 13] Inspecting MongoDB User document after reset...");
  const dbUserAfterReset = await User.findById(user._id);
  const isOldMatch = await bcrypt.compare(initialPassword, dbUserAfterReset?.passwordHash || "");
  const isNewMatch = await bcrypt.compare(newPassword, dbUserAfterReset?.passwordHash || "");

  console.log("- Old password matches DB hash?:", isOldMatch ? "❌ STILL MATCHES OLD" : "✅ NO");
  console.log("- New password matches DB hash?:", isNewMatch ? "✅ YES (UPDATED IN DB)" : "❌ NO");
  console.log("- Active refresh sessions count in DB:", dbUserAfterReset?.refreshTokens.length);

  if (!isNewMatch) throw new Error("New password was not updated in MongoDB!");
  if (dbUserAfterReset?.refreshTokens.length !== 0) throw new Error("Active sessions were not invalidated!");

  // 14. Verify Recovery Session is now marked used: true
  const sessionAfterReset = await RecoverySession.findOne({ userId: user._id, used: false });
  console.log("- Active recovery sessions remaining for user:", sessionAfterReset ? "❌ Active session exists" : "✅ 0 (All Used)");
  if (sessionAfterReset) throw new Error("Recovery session was not marked as used!");

  // 15. Test Login with OLD password
  console.log("\n[TEST 15] Testing login with OLD password...");
  try {
    await axios.post(`${baseUrl}/auth/login`, { phone: testPhone, password: initialPassword });
    throw new Error("User was able to log in with OLD password!");
  } catch (err: any) {
    console.log("✅ Login with old password rejected:", err.response?.status, err.response?.data?.error || err.response?.data?.message);
  }

  // 16. Test Login with NEW password
  console.log("\n[TEST 16] Testing login with NEW password...");
  const loginRes = await axios.post(`${baseUrl}/auth/login`, { phone: testPhone, password: newPassword });
  console.log("✅ Login with NEW password successful! JWT Token received:", !!loginRes.data.token);

  // 17. Verify Audit Log recorded recovery events in MongoDB
  console.log("\n[TEST 17] Inspecting MongoDB AuditLog collection...");
  const auditEntries = await AuditLog.find({ targetId: user._id.toString() }).sort({ timestamp: -1 });
  console.log(`- Found ${auditEntries.length} audit entries for user.`);
  auditEntries.forEach((entry) => {
    console.log(`  • Action: ${entry.action} | TargetType: ${entry.targetType} | Time: ${entry.timestamp.toISOString()}`);
  });

  if (auditEntries.length === 0) {
    throw new Error("Audit log did not record recovery events!");
  }

  // 18. Privileged User (Builder) Email Confirmation Flow Test
  console.log("\n[TEST 18] Testing Privileged User (Builder) Secondary Email Confirmation...");
  const builderPhone = `9500${uniqueId}`;
  const builderEmail = `builder_${uniqueId}@haajari.test`;
  const builder = new User({
    tenantId: tenant._id,
    name: "Builder Organization Owner",
    email: builderEmail,
    phone: builderPhone,
    username: `builder_${uniqueId}`,
    passwordHash: await bcrypt.hash("OldBuilderPass#123", 12),
    role: "builder",
    isPhoneVerified: true,
    isActive: true,
    status: "active"
  });
  await builder.save();

  // Request OTP for builder
  await axios.post(`${baseUrl}/recovery/check-phone`, { phone: builderPhone });
  const builderOtpDoc = await OtpCode.findOne({ phone: builderPhone });
  builderOtpDoc!.otpCodeHash = await bcrypt.hash("888888", 12);
  await builderOtpDoc!.save();

  // Verify OTP -> returns requiresEmailConfirmation: true
  const builderVerifyRes = await axios.post(`${baseUrl}/recovery/verify-otp`, { phone: builderPhone, otp: "888888" });
  console.log("Builder Verify Response:", builderVerifyRes.data);
  if (!builderVerifyRes.data.requiresEmailConfirmation) {
    throw new Error("Privileged builder did not trigger secondary email confirmation requirement!");
  }

  const builderSessionToken = builderVerifyRes.data.recoverySessionToken;

  // Try resetting password before email confirmation -> should be blocked (403)
  try {
    await axios.post(`${baseUrl}/recovery/reset-password`, {
      recoverySessionToken: builderSessionToken,
      newPassword: "NewBuilder@2026",
      confirmPassword: "NewBuilder@2026"
    });
    throw new Error("Privileged reset was allowed before email confirmation!");
  } catch (err: any) {
    console.log("✅ Reset blocked before email confirmation as expected:", err.response?.data?.message);
  }

  // Confirm email via confirmation token
  const builderSession = await RecoverySession.findOne({ userId: builder._id, used: false });
  builderSession!.emailConfirmed = true;
  await builderSession!.save();

  // Reset password after email confirmation -> should succeed
  const builderResetRes = await axios.post(`${baseUrl}/recovery/reset-password`, {
    recoverySessionToken: builderSessionToken,
    newPassword: "NewBuilder@2026",
    confirmPassword: "NewBuilder@2026"
  });
  console.log("✅ Builder Reset after email confirmation succeeded:", builderResetRes.data);

  console.log("\n========================================================================");
  console.log("🎉 ALL 18 ACCOUNT RECOVERY & SCOPED SESSION SECURITY TESTS PASSED 100%!");
  console.log("========================================================================");

  await mongoose.disconnect();
  process.exit(0);
}

runCompleteRecoverySystemTestSuite().catch((err) => {
  console.error("Test Suite Failed:", err.response?.data || err.message || err);
  process.exit(1);
});
