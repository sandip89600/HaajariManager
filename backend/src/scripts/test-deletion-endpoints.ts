import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../../.env") });

import axios from "axios";
import mongoose from "mongoose";
import { User, Tenant, Worker, Attendance } from "../models";
import jwt from "jsonwebtoken";

async function testDeletions() {
  await mongoose.connect(process.env.MONGO_URI || "");

  // Create admin token
  const adminToken = jwt.sign(
    { id: new mongoose.Types.ObjectId(), role: "admin" },
    process.env.JWT_SECRET || "default_secret",
    { expiresIn: "1h" }
  );

  const headers = { Authorization: `Bearer ${adminToken}` };
  const baseUrl = "http://localhost:5000/api/admin";

  // 1. Create a dummy tenant, user, worker, attendance
  const tenant = new Tenant({ name: "Deletion Test Tenant", code: "DEL" + Math.floor(1000 + Math.random() * 9000), plan: "free" });
  await tenant.save();

  const user = new User({
    tenantId: tenant._id,
    name: "Delete Test User",
    phone: "9998887770",
    email: "delete_test@example.com",
    role: "contractor",
    passwordHash: "dummyhash",
    isActive: true,
    isVerified: true,
  });
  await user.save();

  const worker = new Worker({
    tenantId: tenant._id,
    name: "Delete Test Worker",
    phone: "9998887771",
    category: "Mason",
    dailyRate: 600,
  });
  await worker.save();

  const attendance = new Attendance({
    tenantId: tenant._id,
    workerId: worker._id,
    year: 2026,
    month: 7,
    day: 10,
    value: "P",
    timestamp: new Date(),
  });
  await attendance.save();

  console.log("=== Testing 1: Delete Attendance ===");
  const delAtt = await axios.delete(`${baseUrl}/attendance/${attendance._id}`, { headers });
  console.log("Attendance Delete Response:", delAtt.data);

  console.log("\n=== Testing 2: Delete Worker ===");
  const delWorker = await axios.delete(`${baseUrl}/workers/${worker._id}`, { headers });
  console.log("Worker Delete Response:", delWorker.data);

  console.log("\n=== Testing 3: Delete User ===");
  const delUser = await axios.delete(`${baseUrl}/users/${user._id}`, { headers });
  console.log("User Delete Response:", delUser.data);

  console.log("\n=== Testing 4: Delete Organization ===");
  const tenant2 = new Tenant({ name: "Deletion Test Tenant 2", code: "DEL" + Math.floor(1000 + Math.random() * 9000), plan: "free" });
  await tenant2.save();
  const delTenant = await axios.delete(`${baseUrl}/tenants/${tenant2._id}`, { headers });
  console.log("Tenant Delete Response:", delTenant.data);

  await mongoose.disconnect();
  console.log("\n✅ ALL 4 DELETE ENDPOINTS TESTED AND WORKING PERFECTLY!");
  process.exit(0);
}

testDeletions().catch((e) => {
  console.error(e.response?.data || e);
  process.exit(1);
});
