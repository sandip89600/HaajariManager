import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../../.env") });

import mongoose from "mongoose";
import { User } from "../models";

async function activateAllUsers() {
  await mongoose.connect(process.env.MONGO_URI || "");
  const result = await User.updateMany(
    {},
    {
      $set: {
        isVerified: true,
        isPhoneVerified: true,
        status: "active",
      },
      $unset: {
        isEmailVerified: "",
        emailVerifiedAt: "",
        emailVerificationTokenHash: "",
        emailVerificationExpires: "",
        emailVerificationRequestedAt: "",
        verificationToken: "",
        verificationTokenExpires: "",
        lastVerificationEmailSentAt: "",
      },
    }
  );
  console.log(`✅ Successfully activated ${result.modifiedCount} user accounts.`);
  await mongoose.disconnect();
}

activateAllUsers().catch(console.error);
