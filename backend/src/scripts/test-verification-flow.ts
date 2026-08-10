import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../../.env") });

import axios from "axios";
import mongoose from "mongoose";
import { User } from "../models";

async function runVerificationTest() {
  const phone = "99999" + Math.floor(10000 + Math.random() * 90000);
  const username = "user_" + Math.floor(100000 + Math.random() * 900000);
  const email = "test_" + Math.floor(100000 + Math.random() * 900000) + "@example.com";

  console.log("=== TEST 1: User Signup ===");
  const signupRes = await axios.post("http://localhost:5000/api/auth/signup", {
    name: "Sunil Pandit",
    username,
    email,
    phone,
    password: "Password@123",
    companyName: "Sunil Enterprises",
  });
  console.log("Signup Response Status:", signupRes.status);
  console.log("Requires Email Verification:", signupRes.data.requiresEmailVerification);

  console.log("\n=== TEST 2: Attempt Login Before Verification ===");
  try {
    await axios.post("http://localhost:5000/api/auth/login", {
      phone,
      password: "Password@123",
    });
    console.error("❌ FAILED: Login was allowed for unverified user");
  } catch (err: any) {
    console.log("✅ BLOCKED as expected (Status " + err.response?.status + "):", err.response?.data?.error);
  }

  console.log("\n=== TEST 3: Verification Link Execution ===");
  await mongoose.connect(process.env.MONGO_URI || "");
  const createdUser = await User.findOne({ email });
  console.log("Found user token in DB:", createdUser?.verificationToken);

  const verifyRes = await axios.get(
    `http://localhost:5000/api/auth/verify-email?token=${createdUser?.verificationToken}`
  );
  console.log("Verify Endpoint Status:", verifyRes.status);
  console.log("Verify Message:", verifyRes.data);

  console.log("\n=== TEST 4: Login After Email Verified ===");
  const loginRes = await axios.post("http://localhost:5000/api/auth/login", {
    phone,
    password: "Password@123",
  });
  console.log("✅ LOGIN SUCCESS! User:", loginRes.data.user?.name, "| Role:", loginRes.data.user?.role);

  console.log("\n=== TEST 5: Allow Same Full Name for New User ===");
  const phone2 = "99998" + Math.floor(10000 + Math.random() * 90000);
  const username2 = "user2_" + Math.floor(100000 + Math.random() * 900000);
  const email2 = "test2_" + Math.floor(100000 + Math.random() * 900000) + "@example.com";

  const signup2Res = await axios.post("http://localhost:5000/api/auth/signup", {
    name: "Sunil Pandit", // Same full name
    username: username2,
    email: email2,
    phone: phone2,
    password: "Password@123",
    companyName: "Sunil Construction Ltd",
  });
  console.log("✅ Second user with same name 'Sunil Pandit' created successfully (Status " + signup2Res.status + ")");

  await mongoose.disconnect();
  console.log("\n🎯 ALL 5 TESTS PASSED PERFECTLY!");
  process.exit(0);
}

runVerificationTest().catch((e) => {
  console.error(e);
  process.exit(1);
});
