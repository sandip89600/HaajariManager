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
        isEmailVerified: true,
        status: "active",
      },
      $unset: {
        verificationToken: "",
        verificationTokenExpires: "",
      },
    }
  );
  console.log(`✅ Successfully activated and verified ${result.modifiedCount} user accounts.`);
  await mongoose.disconnect();
}

activateAllUsers().catch(console.error);
