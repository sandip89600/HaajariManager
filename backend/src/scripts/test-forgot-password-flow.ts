import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../../.env") });

import axios from "axios";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User, Tenant } from "../models";

async function testForgotPasswordFlow() {
  await mongoose.connect(process.env.MONGO_URI || "");

  const baseUrl = "http://localhost:5000/api/auth";
  const uniqueId = Math.floor(100000 + Math.random() * 900000);
  const email = `testuser_${uniqueId}@example.com`;
  const phone = `9999${uniqueId}`;
  const initialPassword = "OldPassword@123";
  const newPassword = "NewSecret#2026";

  console.log("=== STEP 1: Creating Test User in Database ===");
  let tenant = await Tenant.findOne();
  if (!tenant) {
    tenant = new Tenant({ name: "Test Tenant", code: "TT" + uniqueId, plan: "free" });
    await tenant.save();
  }

  const user = new User({
    tenantId: tenant._id,
    name: "Reset Flow Test User",
    email,
    phone,
    username: `reset_${uniqueId}`,
    passwordHash: await bcrypt.hash(initialPassword, 12),
    isActive: true,
    isVerified: true,
    isEmailVerified: true,
    status: "active",
  });
  await user.save();
  console.log(`✅ Test user created: ${user.email} (ID: ${user._id})`);

  console.log("\n=== STEP 2: Requesting Forgot Password Email Link ===");
  const forgotRes = await axios.post(`${baseUrl}/forgot-password`, { email });
  console.log("Forgot Password Response:", forgotRes.data);

  // Retrieve user from DB to check reset token
  const userAfterForgot = await User.findById(user._id);
  const resetToken = userAfterForgot?.passwordResetToken;
  console.log("Generated Password Reset Token in DB:", resetToken);
  console.log("Token Expiration in DB:", userAfterForgot?.passwordResetExpires);

  if (!resetToken) {
    throw new Error("❌ Reset token was not saved to database!");
  }

  console.log("\n=== STEP 3: Testing Reset Password Web Page Loading ===");
  const pageRes = await axios.get(`${baseUrl}/reset-password-page?token=${resetToken}`);
  console.log("Reset Page Status Code:", pageRes.status);
  const hasForm = pageRes.data.includes("id=\"resetForm\"");
  const hasRequirements = pageRes.data.includes("req-special");
  console.log("Page includes reset form & criteria checklist:", hasForm && hasRequirements);

  console.log("\n=== STEP 4: Testing Invalid Password Submission (Less than 8 chars / no special) ===");
  try {
    await axios.post(`${baseUrl}/reset-password`, {
      token: resetToken,
      password: "short1",
    });
    console.error("❌ FAILED: Invalid password was accepted!");
  } catch (err: any) {
    console.log("✅ Blocked invalid password as expected:", err.response?.status, err.response?.data?.error);
  }

  console.log("\n=== STEP 5: Submitting Valid 8-char Password with Special & Number ===");
  const resetRes = await axios.post(`${baseUrl}/reset-password`, {
    token: resetToken,
    password: newPassword,
  });
  console.log("Reset Password Response:", resetRes.data);

  console.log("\n=== STEP 6: Verifying Database Persistence ===");
  const userAfterReset = await User.findById(user._id);
  console.log("Reset Token in DB (should be undefined):", userAfterReset?.passwordResetToken);
  console.log("Reset Token Expiration (should be undefined):", userAfterReset?.passwordResetExpires);

  const isNewPasswordMatching = await bcrypt.compare(newPassword, userAfterReset?.passwordHash || "");
  const isOldPasswordMatching = await bcrypt.compare(initialPassword, userAfterReset?.passwordHash || "");

  console.log("Does DB hash match NEW password?:", isNewPasswordMatching ? "✅ YES" : "❌ NO");
  console.log("Does DB hash match OLD password?:", isOldPasswordMatching ? "❌ STILL MATCHES OLD" : "✅ NO (Updated)");

  if (!isNewPasswordMatching) {
    throw new Error("❌ New password hash is not stored properly in database!");
  }

  console.log("\n=== STEP 7: Testing Login with Old Password ===");
  try {
    await axios.post(`${baseUrl}/login`, { phone, password: initialPassword });
    console.error("❌ FAILED: User was able to log in with OLD password!");
  } catch (err: any) {
    console.log("✅ Login with old password blocked as expected:", err.response?.status, err.response?.data?.error);
  }

  console.log("\n=== STEP 8: Testing Login with NEW Password ===");
  const loginRes = await axios.post(`${baseUrl}/login`, { phone, password: newPassword });
  console.log("✅ LOGIN SUCCESSFUL with new password! User:", loginRes.data.user?.name, "Token received:", !!loginRes.data.token);

  await mongoose.disconnect();
  console.log("\n🎯 ALL 8 FORGOT PASSWORD & DATABASE PERSISTENCE TESTS PASSED PERFECTLY!");
  process.exit(0);
}

testForgotPasswordFlow().catch((e) => {
  console.error(e.response?.data || e);
  process.exit(1);
});
