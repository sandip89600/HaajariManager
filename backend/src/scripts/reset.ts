/**
 * Haajari App – Database Reset Script
 *
 * This script will:
 * 1. Drop ALL documents from every collection
 * 2. Recreate the admin user (haajari896 / 1234)
 * 3. Log the results
 *
 * Run with: npx ts-node src/scripts/reset.ts
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";

// Load env
dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/haajari";

async function resetDatabase() {
  console.log("\n======================================");
  console.log("  HAAJARI DATABASE RESET SCRIPT");
  console.log("======================================\n");

  console.log(`Connecting to: ${MONGO_URI.split("@").pop() || MONGO_URI}`);

  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB\n");

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database connection not established");
  }

  // List of all collections to wipe
  const collections = [
    "users",
    "tenants",
    "workers",
    "attendances",
    "payments",
    "wagehistories",
    "auditlogs",
    "projects",
  ];

  console.log("🗑️  Wiping all collections...");
  for (const col of collections) {
    try {
      const result = await db.collection(col).deleteMany({});
      console.log(`   ${col}: deleted ${result.deletedCount} documents`);
    } catch (e: any) {
      console.log(`   ${col}: collection not found or already empty (${e.message})`);
    }
  }

  console.log("\n✅ All collections wiped.\n");

  // Create admin tenant
  console.log("🏗️  Creating System Admin tenant...");
  const tenantResult = await db.collection("tenants").insertOne({
    name: "System Admin Org",
    code: "SYSADMIN",
    plan: "business",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const tenantId = tenantResult.insertedId;
  console.log(`   Tenant created: ${tenantId}`);

  // Create admin user
  console.log("👤 Creating Admin user (haajari896 / 1234)...");
  const passwordHash = await bcrypt.hash("1234", 12);
  const adminResult = await db.collection("users").insertOne({
    tenantId,
    name: "System Admin",
    phone: "haajari896",
    passwordHash,
    role: "admin",
    isActive: true,
    isVerified: true,
    refreshTokens: [],
    assignedProjects: [],
    avatarColor: "#FF6B35",
    createdAt: new Date(),
  });
  console.log(`   Admin user created: ${adminResult.insertedId}`);

  console.log("\n======================================");
  console.log("  RESET COMPLETE");
  console.log("======================================");
  console.log("  Admin Username : haajari896");
  console.log("  Admin Password : 1234");
  console.log("  All other data : DELETED");
  console.log("======================================\n");

  await mongoose.disconnect();
  console.log("✅ Disconnected from MongoDB. Done.\n");
}

resetDatabase().catch((err) => {
  console.error("\n❌ RESET FAILED:", err.message);
  process.exit(1);
});
