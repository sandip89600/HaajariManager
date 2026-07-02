import mongoose from "mongoose";
import * as dotenv from "dotenv";
import * as path from "path";
import { User } from "../models";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function run() {
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/haajari";
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB successfully.");
    
    const count = await User.countDocuments();
    console.log(`Total users in database: ${count}`);

    if (count > 0) {
      const sampleUsers = await User.find({}, "name phone email role biometricEnabled").limit(5);
      console.log("Sample Users in DB:");
      console.log(JSON.stringify(sampleUsers, null, 2));
    } else {
      console.log("No users found in database! You need to sign up first.");
    }
  } catch (err: any) {
    console.error("Database connection/query failed:", err.message);
  } finally {
    await mongoose.disconnect();
  }
}

run();
