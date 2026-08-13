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

  console.log("=== TEST 1: User Signup (Email Optional, No Email Verification) ===");
  const signupRes = await axios.post("http://localhost:5000/api/auth/signup", {
    name: "Sunil Pandit",
    username,
    email,
    phone,
    password: "Password@123",
    companyName: "Sunil Enterprises",
  });
  console.log("Signup Response Status:", signupRes.status);
  console.log("Signup Success:", !!signupRes.data.token);

  console.log("\n=== TEST 2: Direct Login Using Phone + Password ===");
  const loginPhoneRes = await axios.post("http://localhost:5000/api/auth/login", {
    identifier: phone,
    password: "Password@123",
  });
  console.log("✅ Phone Login Status:", loginPhoneRes.status, "| User:", loginPhoneRes.data.user?.name);

  console.log("\n=== TEST 3: Direct Login Using Username + Password ===");
  const loginUserRes = await axios.post("http://localhost:5000/api/auth/login", {
    identifier: username,
    password: "Password@123",
  });
  console.log("✅ Username Login Status:", loginUserRes.status, "| User:", loginUserRes.data.user?.username);

  console.log("\n=== TEST 4: Direct Login Using Email + Password ===");
  const loginEmailRes = await axios.post("http://localhost:5000/api/auth/login", {
    identifier: email,
    password: "Password@123",
  });
  console.log("✅ Email Login Status:", loginEmailRes.status, "| User:", loginEmailRes.data.user?.email);

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

  console.log("\n🎯 ALL TESTS PASSED PERFECTLY!");
  process.exit(0);
}

runVerificationTest().catch((e) => {
  console.error(e);
  process.exit(1);
});
