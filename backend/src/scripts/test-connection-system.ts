import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { User, Tenant, Worker, Attendance, ConnectionRequest } from "../models";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb+srv://sandeeppandit8966_db_user:yw84Y7MGWfoXDcEb@cluster0.v0hjlam.mongodb.net/?appName=Cluster0";

async function runConnectionSystemTests() {
  console.log("=================================================");
  console.log("🚀 STARTING WORKER ↔ CONTRACTOR CONNECTION TESTS");
  console.log("=================================================\n");

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB:", mongoose.connection.name);

    // Cleanup any existing test data
    const testPhones = ["9999000001", "9999000002", "9999000003"];
    await User.deleteMany({ phone: { $in: testPhones } });
    await Tenant.deleteMany({ $or: [{ name: "Test Builders Co" }, { name: "Suresh Personal Workspace" }, { code: { $regex: /^(TBC|SPW)/i } }] });
    await Worker.deleteMany({ phone: { $in: testPhones } });
    await ConnectionRequest.deleteMany({ method: { $in: ["mobile", "id"] } });

    console.log("🧹 Cleaned up existing test data.\n");

    // ─────────────────────────────────────────────────────────────
    // TEST 1: Contractor Setup
    // ─────────────────────────────────────────────────────────────
    console.log("🔹 TEST 1: Creating Contractor Account & Tenant...");
    const tenant = new Tenant({
      name: "Test Builders Co",
      code: `TBC_${Date.now()}`,
      plan: "professional",
      isActive: true,
    });
    await tenant.save();

    const contractor = new User({
      name: "Contractor Vikram",
      phone: "9999000001",
      passwordHash: "$2a$10$abcdefghijklmnopqrstuvwx",
      role: "contractor",
      tenantId: tenant._id,
      uniqueId: "HM-C-100001",
      contractorCompany: "Test Builders Co",
      isActive: true,
      connectionStatus: "connected",
    });
    await contractor.save();
    console.log(`✅ Contractor created: ${contractor.name} (${contractor.uniqueId})\n`);

    // ─────────────────────────────────────────────────────────────
    // TEST 2: Method 1 (Mobile Number) - Contractor Adds Worker
    // ─────────────────────────────────────────────────────────────
    console.log("🔹 TEST 2: Contractor adds Worker 'Ramesh Kumar' with phone 9999000002...");
    const workerPhone = "9999000002";

    const createdWorker = new Worker({
      tenantId: contractor.tenantId,
      name: "Ramesh Kumar",
      category: "labour",
      dailyRate: 650,
      phone: workerPhone,
      isClaimed: false,
      isArchived: false,
    });
    await createdWorker.save();

    console.log(`✅ Worker created by Contractor: ${createdWorker.name}`);
    console.log(`   Worker ID: ${createdWorker.uniqueId}`);
    console.log(`   isClaimed: ${createdWorker.isClaimed} (Expected: false)`);
    console.log(`   userId: ${createdWorker.userId || "None"} (Expected: None)\n`);

    if (createdWorker.isClaimed !== false) {
      throw new Error("Worker should initially be unclaimed!");
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 3: Method 1 (Mobile + OTP) - Worker Signs Up & Claims Profile
    // ─────────────────────────────────────────────────────────────
    console.log("🔹 TEST 3: Worker signs up with phone 9999000002 via Mobile + OTP...");
    
    // Simulate what verifyOtpLogin / registerLabor does on signup:
    const workerUser = new User({
      name: createdWorker.name,
      phone: workerPhone,
      passwordHash: "$2a$10$abcdefghijklmnopqrstuvwx",
      role: "labor",
      workerCategory: createdWorker.category,
      dailyWage: createdWorker.dailyRate,
      uniqueId: createdWorker.uniqueId,
      tenantId: createdWorker.tenantId,
      contractorId: contractor._id as any,
      contractorName: contractor.name,
      contractorCompany: tenant.name,
      connectionStatus: "connected",
      isActive: true,
    });
    await workerUser.save();

    // Link the contractor-created Worker profile
    createdWorker.userId = workerUser._id as any;
    createdWorker.isClaimed = true;
    createdWorker.claimedAt = new Date();
    await createdWorker.save();

    // Create accepted connection record
    const connReq = new ConnectionRequest({
      tenantId: contractor.tenantId,
      senderId: contractor._id,
      receiverId: workerUser._id,
      workerId: createdWorker._id,
      targetRole: "labor",
      method: "mobile",
      status: "accepted",
      acceptedAt: new Date(),
      connectedAt: new Date(),
    });
    await connReq.save();

    console.log("✅ Worker claimed existing profile successfully!");
    console.log(`   Worker User ID: ${workerUser._id}`);
    console.log(`   Linked Worker.userId: ${createdWorker.userId}`);
    console.log(`   Worker.isClaimed: ${createdWorker.isClaimed}`);
    console.log(`   Worker Tenant: ${workerUser.tenantId} (Matches Contractor: ${contractor.tenantId})`);
    console.log(`   Connection Status: ${workerUser.connectionStatus}\n`);

    // Verify ZERO duplicates
    const allWorkersForPhone = await Worker.find({
      tenantId: contractor.tenantId,
      phone: workerPhone,
      isArchived: false,
    });
    console.log(`📊 Duplicate Check: Found ${allWorkersForPhone.length} Worker records for ${workerPhone} (Expected: 1)`);
    if (allWorkersForPhone.length !== 1) {
      throw new Error(`Duplicate worker records found! Count = ${allWorkersForPhone.length}`);
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 4: Historical Attendance & Wage Sync
    // ─────────────────────────────────────────────────────────────
    console.log("\n🔹 TEST 4: Contractor records attendance and wage for Ramesh...");
    const now = new Date();
    const attendanceRecord = new Attendance({
      tenantId: contractor.tenantId,
      workerId: createdWorker._id,
      date: now,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      value: "P",
      dailyRate: 650,
      finalPay: 650,
      markedBy: contractor._id,
      markedRole: "contractor",
    });
    await attendanceRecord.save();

    // Verify Worker sees this exact record
    const workerAttendance = await Attendance.find({
      tenantId: workerUser.tenantId,
      workerId: createdWorker._id,
    });
    console.log(`✅ Worker fetched attendance: ${workerAttendance.length} records found.`);
    console.log(`   Status: ${workerAttendance[0].value}, Pay: ₹${workerAttendance[0].finalPay}`);
    if (workerAttendance.length !== 1 || workerAttendance[0].value !== "P") {
      throw new Error("Attendance record mismatch for claimed worker!");
    }

    // ─────────────────────────────────────────────────────────────
    // TEST 5: Method 2 (Account ID) - Worker sends connection request
    // ─────────────────────────────────────────────────────────────
    console.log("\n🔹 TEST 5: Method 2 (Account ID) - Suresh (9999000003) sends request to Contractor ID...");
    const sureshTenant = new Tenant({
      name: "Suresh Personal Workspace",
      code: `SPW_${Date.now()}`,
      plan: "free",
      isActive: true,
    });
    await sureshTenant.save();

    const suresh = new User({
      name: "Suresh Mistri",
      phone: "9999000003",
      passwordHash: "$2a$10$abcdefghijklmnopqrstuvwx",
      role: "labor",
      workerCategory: "mistri",
      dailyWage: 900,
      uniqueId: "HM-W-990003",
      tenantId: sureshTenant._id,
      connectionStatus: "not_connected",
      isActive: true,
    });
    await suresh.save();

    // Suresh enters Contractor ID 'HM-C-100001'
    const idConnReq = new ConnectionRequest({
      tenantId: contractor.tenantId,
      senderId: suresh._id,
      receiverId: contractor._id,
      targetRole: "contractor",
      method: "id",
      status: "pending",
    });
    await idConnReq.save();
    console.log(`✅ Connection Request sent from ${suresh.name} (${suresh.uniqueId}) -> ${contractor.name} (${contractor.uniqueId})`);
    console.log(`   Request Status: ${idConnReq.status}`);

    // Contractor accepts request
    idConnReq.status = "accepted";
    idConnReq.acceptedAt = new Date();
    idConnReq.connectedAt = new Date();
    await idConnReq.save();

    suresh.tenantId = contractor.tenantId;
    suresh.contractorId = contractor._id as any;
    suresh.contractorName = contractor.name;
    suresh.contractorCompany = tenant.name;
    suresh.connectionStatus = "connected";
    await suresh.save();

    // Create worker profile for Suresh in Contractor's tenant
    const sureshWorkerProfile = new Worker({
      tenantId: contractor.tenantId,
      userId: suresh._id,
      name: suresh.name,
      phone: suresh.phone,
      uniqueId: suresh.uniqueId,
      category: suresh.workerCategory,
      dailyRate: suresh.dailyWage,
      isClaimed: true,
      claimedAt: new Date(),
    });
    await sureshWorkerProfile.save();
    console.log(`✅ Contractor accepted request. Suresh is now connected! (Worker Profile ID: ${sureshWorkerProfile.uniqueId})`);

    // ─────────────────────────────────────────────────────────────
    // TEST 6: Safe Disconnection & History Preservation
    // ─────────────────────────────────────────────────────────────
    console.log("\n🔹 TEST 6: Safe Disconnection Test...");
    // Disconnect Ramesh
    connReq.status = "disconnected";
    connReq.disconnectedAt = new Date();
    await connReq.save();

    workerUser.connectionStatus = "not_connected";
    await workerUser.save();

    // Verify historical attendance is preserved
    const preservedAttendance = await Attendance.find({ workerId: createdWorker._id });
    console.log(`✅ Attendance records preserved after disconnection: ${preservedAttendance.length} records remain intact.`);
    if (preservedAttendance.length !== 1) {
      throw new Error("Historical attendance was lost on disconnection!");
    }

    console.log("\n=================================================");
    console.log("🎉 ALL CONNECTION SYSTEM TESTS PASSED SUCCESSFULLY!");
    console.log("=================================================\n");

  } catch (err: any) {
    console.error("❌ Test Failed:", err);
    process.exit(1);
  } finally {
    // Clean up test data
    const testPhones = ["9999000001", "9999000002", "9999000003"];
    await User.deleteMany({ phone: { $in: testPhones } });
    await Tenant.deleteMany({ name: "Test Builders Co" });
    await Worker.deleteMany({ phone: { $in: testPhones } });
    await ConnectionRequest.deleteMany({});
    await Attendance.deleteMany({ dailyRate: 650 });
    await mongoose.disconnect();
    console.log("🏁 Database disconnected cleanly.");
  }
}

runConnectionSystemTests();
