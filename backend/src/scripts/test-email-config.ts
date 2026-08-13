import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../../.env") });

import {
  validateEmailConfig,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordResetSuccessEmail,
} from "../utils/mail";

async function testAllEmailFlows() {
  console.log("==========================================================");
  console.log("🧪 TESTING HAAJARI MANAGER EMAIL CONFIGURATION & DISPATCH");
  console.log("==========================================================\n");

  // 1. Validate startup configuration
  validateEmailConfig();

  const recipient = "sandippandit896@gmail.com";
  const recipientName = "Sandeep Pandit";

  console.log(`Target Recipient: ${recipient}\n`);

  // 2. Test Welcome Email
  console.log("----------------------------------------------------------");
  console.log("TEST 1: Welcome / Onboarding Email");
  console.log("----------------------------------------------------------");
  const welcomeOk = await sendWelcomeEmail(recipient, recipientName);
  console.log(`Result: ${welcomeOk ? "SUCCESS ✅" : "FAILED ❌"}\n`);

  // 3. Test Forgot Password
  console.log("----------------------------------------------------------");
  console.log("TEST 2: Forgot Password Reset Email");
  console.log("----------------------------------------------------------");
  const resetOk = await sendPasswordResetEmail(recipient, recipientName, "sample_reset_token_789");
  console.log(`Result: ${resetOk ? "SUCCESS ✅" : "FAILED ❌"}\n`);

  // 6. Test Password Changed Success
  console.log("----------------------------------------------------------");
  console.log("TEST 5: Password Reset Success Confirmation Email");
  console.log("----------------------------------------------------------");
  const successOk = await sendPasswordResetSuccessEmail(recipient, recipientName);
  console.log(`Result: ${successOk ? "SUCCESS ✅" : "FAILED ❌"}\n`);

  console.log("==========================================================");
  console.log("🎉 ALL EMAIL DISPATCH TESTS COMPLETED");
  console.log("==========================================================");
}

testAllEmailFlows().catch(console.error);
