import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import bcrypt from "bcryptjs";
import { User } from "../models";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/haajari";
const DEFAULT_PASSWORD = "Haajari@123";

async function resetPasswords() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  // Update all contractors
  const res = await User.updateMany(
    { role: "contractor" },
    { $set: { passwordHash, isActive: true, isVerified: true, refreshTokens: [] } }
  );

  console.log(`\n✅ Successfully updated ${res.modifiedCount} user passwords.`);
  
  const users = await User.find({ role: "contractor" }, "name phone email username role");
  console.log("\n==============================================");
  console.log("  UPDATED ACCOUNTS LOGINS");
  console.log("==============================================");
  users.forEach((u, i) => {
    console.log(`[User ${i + 1}]`);
    console.log(`  Name    : ${u.name}`);
    console.log(`  Phone   : ${u.phone}`);
    console.log(`  Email   : ${u.email}`);
    console.log(`  Username: ${u.username}`);
    console.log(`  Password: ${DEFAULT_PASSWORD}`);
    console.log("----------------------------------------------");
  });

  await mongoose.disconnect();
}

resetPasswords().catch(console.error);
