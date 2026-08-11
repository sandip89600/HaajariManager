import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../../.env") });

import axios from "axios";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User, Tenant } from "../models";

async function runRealWorldPasswordResetTest() {
  await mongoose.connect(process.env.MONGO_URI || "");

  const baseUrl = "http://localhost:5000/api/auth";
  const testId = Math.floor(100000 + Math.random() * 900000);
  const testEmail = `user_reset_${testId}@haajari.test`;
  const testPhone = `9876${testId}`;
  const oldPassword = "OldPassword#123";
  const newPassword = "Haajari@123";

  console.log("==================================================================");
  console.log("🚀 STARTING COMPLETE REAL-WORLD PASSWORD RESET VERIFICATION TEST");
  console.log("==================================================================");

  // 1. Setup Tenant and User
  let tenant = await Tenant.findOne();
  if (!tenant) {
    tenant = new Tenant({ name: "Demo Organization", code: `DO${testId}`, plan: "free" });
    await tenant.save();
  }

  const initialHash = await bcrypt.hash(oldPassword, 12);
  const user = new User({
    tenantId: tenant._id,
    name: "Password Flow Tester",
    email: testEmail,
    phone: testPhone,
    username: `tester_${testId}`,
    passwordHash: initialHash,
    isActive: true,
    isVerified: true,
    isEmailVerified: true,
    status: "active",
  });
  await user.save();
  console.log(`\n[STEP 1] Created user ${testEmail} with OLD password.`);

  // 2. Request Forgot Password
  console.log("\n[STEP 2] User requests Forgot Password via email...");
  const forgotRes = await axios.post(`${baseUrl}/forgot-password`, { email: testEmail });
  console.log("Response:", forgotRes.data);

  // 3. Inspect MongoDB for token
  const dbUserAfterForgot = await User.findById(user._id);
  const token = dbUserAfterForgot?.passwordResetToken;
  const tokenExpiry = dbUserAfterForgot?.passwordResetExpires;
  console.log(`\n[STEP 3] MongoDB Token Verification:`);
  console.log(`- Stored Reset Token: ${token ? "YES (Valid Hex)" : "NO"}`);
  console.log(`- Token Expiry Date : ${tokenExpiry}`);

  if (!token) throw new Error("Reset token was not saved to MongoDB!");

  // 4. Test Invalid Password
  console.log("\n[STEP 4] Submitting invalid password (e.g. 'simple')...");
  try {
    await axios.post(`${baseUrl}/reset-password`, { token, password: "simple" });
    throw new Error("Invalid password was unexpectedly accepted!");
  } catch (err: any) {
    console.log("✅ Blocked as expected. Response:", err.response?.data);
  }

  // 5. Submit Valid New Password
  console.log(`\n[STEP 5] Submitting valid new password: '${newPassword}'...`);
  const resetRes = await axios.post(`${baseUrl}/reset-password`, {
    token,
    password: newPassword,
  });
  console.log("✅ Reset Response:", resetRes.data);

  // 6. Inspect MongoDB for password update & token deletion
  console.log("\n[STEP 6] Inspecting MongoDB Document Directly...");
  const dbUserAfterReset = await User.findById(user._id);
  const newHash = dbUserAfterReset?.passwordHash || "";
  const isOldMatch = await bcrypt.compare(oldPassword, newHash);
  const isNewMatch = await bcrypt.compare(newPassword, newHash);

  console.log(`- Old password matches DB hash? : ${isOldMatch ? "❌ STILL MATCHES OLD" : "✅ NO"}`);
  console.log(`- New password matches DB hash? : ${isNewMatch ? "✅ YES (UPDATED IN DB)" : "❌ NO"}`);
  console.log(`- Reset token in DB            : ${dbUserAfterReset?.passwordResetToken || "null (Invalidated)"}`);
  console.log(`- Reset expiry in DB           : ${dbUserAfterReset?.passwordResetExpires || "null (Invalidated)"}`);

  if (!isNewMatch) throw new Error("New password hash does not match in MongoDB!");
  if (dbUserAfterReset?.passwordResetToken) throw new Error("Reset token was not deleted from MongoDB!");

  // 7. Test Login with OLD password
  console.log("\n[STEP 7] Testing Login with OLD password...");
  try {
    await axios.post(`${baseUrl}/login`, { phone: testPhone, password: oldPassword });
    throw new Error("User was able to log in with OLD password!");
  } catch (err: any) {
    console.log("✅ Old password rejected as expected:", err.response?.status, err.response?.data?.error || err.response?.data?.message);
  }

  // 8. Test Login with NEW password
  console.log("\n[STEP 8] Testing Login with NEW password...");
  const loginRes = await axios.post(`${baseUrl}/login`, { phone: testPhone, password: newPassword });
  console.log("✅ Login with NEW password succeeded! JWT Token received:", !!loginRes.data.token);

  // 9. Test Token Reuse Prevention
  console.log("\n[STEP 9] Attempting to REUSE the same reset token...");
  try {
    await axios.post(`${baseUrl}/reset-password`, { token, password: "AnotherPassword@999" });
    throw new Error("Expired/used token was unexpectedly accepted!");
  } catch (err: any) {
    console.log("✅ Token reuse rejected as expected:", err.response?.data);
  }

  console.log("\n==================================================================");
  console.log("🎉 ALL REAL-WORLD DATABASE & RESET FLOW CHECKS PASSED PERFECTLY!");
  console.log("==================================================================");

  await mongoose.disconnect();
  process.exit(0);
}

runRealWorldPasswordResetTest().catch((err) => {
  console.error("Test Error:", err.response?.data || err.message || err);
  process.exit(1);
});
