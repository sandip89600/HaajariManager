import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { User } from "../models";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/haajari";

async function listAllUsers() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB.");
  
  const users = await User.find({}, "name phone email username role createdAt");
  console.log("\n==============================================");
  console.log(`TOTAL REGISTERED USERS: ${users.length}`);
  console.log("==============================================");
  
  users.forEach((u, i) => {
    console.log(`[User ${i + 1}]`);
    console.log(`  Name    : ${u.name}`);
    console.log(`  Phone   : ${u.phone}`);
    console.log(`  Email   : ${u.email || "N/A"}`);
    console.log(`  Username: ${u.username || "N/A"}`);
    console.log(`  Role    : ${u.role}`);
    console.log(`  Created : ${u.createdAt}`);
    console.log("----------------------------------------------");
  });

  await mongoose.disconnect();
}

listAllUsers().catch(console.error);
