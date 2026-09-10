import { Response } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { AuthenticatedRequest } from "../middleware/auth";
import { User, Tenant, ConnectionRequest, Worker } from "../models";
import { getIO } from "../utils/socket";

// 1. Safe Lookup by Unique ID, Phone, or Username
export const lookupByUniqueId = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { uniqueId, query } = req.query;
    const searchTerm = String(uniqueId || query || "").trim();

    if (!searchTerm) {
      return res.status(400).json({ success: false, message: "Unique ID or search query is required." });
    }

    const cleanUpper = searchTerm.toUpperCase();
    const cleanLower = searchTerm.toLowerCase();
    const phoneOnlyDigits = searchTerm.replace(/\D/g, "");

    const searchConditions: any[] = [
      { uniqueId: cleanUpper },
      { username: cleanLower },
      { email: cleanLower },
    ];

    if (phoneOnlyDigits.length >= 8) {
      searchConditions.push({ phone: new RegExp(phoneOnlyDigits.slice(-10) + "$") });
    }

    const targetUser = await User.findOne({
      $or: searchConditions,
      isActive: true,
    }).select("name uniqueId role workerCategory dailyWage connectionStatus avatarColor profileImage contractorName contractorCompany");

    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found with this Unique ID or phone." });
    }

    // Do not allow self-connection
    if (targetUser._id.toString() === req.user?.id) {
      return res.status(400).json({ success: false, message: "You cannot connect to your own account." });
    }

    return res.json({
      success: true,
      user: {
        id: targetUser._id,
        name: targetUser.name,
        uniqueId: targetUser.uniqueId,
        role: targetUser.role === "labor" ? "worker" : targetUser.role,
        workerCategory: targetUser.workerCategory || (targetUser.role === "labor" ? "Labour / Worker" : targetUser.role),
        dailyWage: targetUser.dailyWage || 0,
        connectionStatus: targetUser.connectionStatus,
        avatarColor: targetUser.avatarColor,
        profileImage: targetUser.profileImage,
        contractorName: targetUser.contractorName,
        contractorCompany: targetUser.contractorCompany,
      },
    });
  } catch (error: any) {
    console.error("lookupByUniqueId error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Search Supervisors (Legacy + Enhanced)
export const searchSupervisors = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({ success: false, message: "Search query is required." });
    }

    const cleanQuery = query.trim();
    const cleanUpper = cleanQuery.toUpperCase();
    const cleanLower = cleanQuery.toLowerCase();
    const phoneOnlyDigits = cleanQuery.replace(/\D/g, "");

    const searchConditions: any[] = [
      { uniqueId: cleanUpper },
      { username: cleanLower },
      { email: cleanLower },
      { phone: cleanLower },
    ];

    if (phoneOnlyDigits.length >= 8) {
      searchConditions.push({ phone: new RegExp(phoneOnlyDigits.slice(-10) + "$") });
    }

    const supervisors = await User.find({
      role: "supervisor",
      $or: searchConditions,
    }).select("name uniqueId username email phone contractorName contractorCompany connectionStatus avatarColor profileImage createdAt");

    return res.json({ success: true, supervisors });
  } catch (error: any) {
    console.error("searchSupervisors error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Search Labor / Worker
export const searchLabor = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({ success: false, message: "Search query is required." });
    }

    const cleanQuery = query.trim();
    const cleanUpper = cleanQuery.toUpperCase();
    const cleanLower = cleanQuery.toLowerCase();
    const phoneOnlyDigits = cleanQuery.replace(/\D/g, "");

    const searchConditions: any[] = [
      { uniqueId: cleanUpper },
      { username: cleanLower },
      { email: cleanLower },
      { phone: cleanLower },
    ];

    if (phoneOnlyDigits.length >= 8) {
      searchConditions.push({ phone: new RegExp(phoneOnlyDigits.slice(-10) + "$") });
    }

    const laborUsers = await User.find({
      role: { $in: ["labor", "worker"] },
      $or: searchConditions,
    }).select("name uniqueId username email phone workerCategory dailyWage connectionStatus avatarColor profileImage createdAt");

    return res.json({ success: true, labor: laborUsers });
  } catch (error: any) {
    console.error("searchLabor error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Create Connection Request with 6-Digit Temporary Code (10-minute TTL)
export const createConnectionRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const contractorId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const { targetUniqueId, targetUserId } = req.body;

    if (!targetUniqueId && !targetUserId) {
      return res.status(400).json({ success: false, message: "Target Unique ID or User ID is required." });
    }

    let targetUser = null;
    if (targetUniqueId) {
      targetUser = await User.findOne({ uniqueId: String(targetUniqueId).trim().toUpperCase() });
    } else if (targetUserId) {
      targetUser = await User.findById(targetUserId);
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, message: "Target account not found." });
    }

    if (targetUser._id.toString() === contractorId) {
      return res.status(400).json({ success: false, message: "Cannot send connection request to yourself." });
    }

    const contractor = await User.findById(contractorId);
    const tenant = await Tenant.findById(tenantId);
    const companyName = tenant?.name || contractor?.name || "Contractor Company";

    // Generate 6-digit random connection code (cryptographically uniform)
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(code, 8);
    const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Check existing request
    let connectionReq = await ConnectionRequest.findOne({
      senderId: contractorId,
      receiverId: targetUser._id,
      status: "pending",
    });

    if (connectionReq) {
      // Refresh code and expiration
      connectionReq.code = code;
      connectionReq.codeHash = codeHash;
      connectionReq.codeExpiresAt = codeExpiresAt;
      connectionReq.codeAttempts = 0;
      await connectionReq.save();
    } else {
      connectionReq = new ConnectionRequest({
        senderId: contractorId,
        receiverId: targetUser._id,
        tenantId,
        targetRole: targetUser.role === "supervisor" ? "supervisor" : "labor",
        status: "pending",
        code,
        codeHash,
        codeExpiresAt,
        codeAttempts: 0,
      });
      await connectionReq.save();
    }

    targetUser.connectionStatus = "pending";
    await targetUser.save();

    // Broadcast Real-Time socket notification
    try {
      const io = getIO();
      io.to(`user_${targetUser._id}`).emit("connection:newRequest", {
        requestId: connectionReq._id,
        contractorName: contractor?.name,
        companyName,
        code,
        expiresAt: codeExpiresAt,
        createdAt: connectionReq.createdAt,
      });
      io.emit("admin_dashboard_update");
    } catch (socketErr) {
      console.warn("Socket broadcast failed:", socketErr);
    }

    return res.status(201).json({
      success: true,
      message: "Connection request sent. The target user has received the 6-digit connection code.",
      connectionRequest: {
        id: connectionReq._id,
        targetUser: {
          id: targetUser._id,
          name: targetUser.name,
          uniqueId: targetUser.uniqueId,
          role: targetUser.role,
        },
        expiresAt: codeExpiresAt,
      },
    });
  } catch (error: any) {
    console.error("createConnectionRequest error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Verify 6-Digit Connection Code and Activate Connection
export const verifyConnectionCode = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const contractorId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const { targetUniqueId, targetUserId, code } = req.body;

    if (!code || typeof code !== "string" || code.trim().length !== 6) {
      return res.status(400).json({ success: false, message: "Valid 6-digit connection code is required." });
    }

    let targetUser = null;
    if (targetUniqueId) {
      targetUser = await User.findOne({ uniqueId: String(targetUniqueId).trim().toUpperCase() });
    } else if (targetUserId) {
      targetUser = await User.findById(targetUserId);
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, message: "Target user not found." });
    }

    const connectionReq = await ConnectionRequest.findOne({
      senderId: contractorId,
      receiverId: targetUser._id,
      status: "pending",
    });

    if (!connectionReq) {
      return res.status(404).json({ success: false, message: "No active connection request found for this user." });
    }

    // Check expiration
    if (connectionReq.codeExpiresAt && connectionReq.codeExpiresAt.getTime() < Date.now()) {
      connectionReq.status = "expired";
      await connectionReq.save();
      return res.status(400).json({ success: false, message: "Connection code has expired. Please request a new one." });
    }

    // Check rate-limiting on failed attempts
    if ((connectionReq.codeAttempts || 0) >= 5) {
      connectionReq.status = "expired";
      await connectionReq.save();
      return res.status(429).json({ success: false, message: "Too many failed attempts. Please send a new connection request." });
    }

    // Verify code
    const isCodeMatch =
      (connectionReq.code && connectionReq.code === code.trim()) ||
      (connectionReq.codeHash && (await bcrypt.compare(code.trim(), connectionReq.codeHash)));

    if (!isCodeMatch) {
      connectionReq.codeAttempts = (connectionReq.codeAttempts || 0) + 1;
      await connectionReq.save();
      const remaining = 5 - connectionReq.codeAttempts;
      return res.status(400).json({
        success: false,
        message: `Incorrect connection code. ${remaining} attempts remaining.`,
      });
    }

    // Code matched! Activate connection
    connectionReq.status = "active";
    connectionReq.connectedAt = new Date();
    await connectionReq.save();

    const contractor = await User.findById(contractorId);
    const tenant = await Tenant.findById(tenantId);

    if (tenantId) targetUser.tenantId = new mongoose.Types.ObjectId(tenantId);
    if (contractorId) targetUser.contractorId = new mongoose.Types.ObjectId(contractorId);
    targetUser.contractorName = contractor?.name || "";
    targetUser.contractorCompany = tenant?.name || "";
    targetUser.connectionStatus = "connected";
    await targetUser.save();

    // If target is worker / labor, ensure a corresponding Worker record exists in the tenant
    if (targetUser.role === "labor" || (targetUser.role as string) === "worker") {
      let existingWorker = await Worker.findOne({
        tenantId,
        $or: [
          { phone: targetUser.phone },
          { name: targetUser.name },
        ],
      });

      if (!existingWorker) {
        existingWorker = new Worker({
          tenantId,
          name: targetUser.name,
          phone: targetUser.phone,
          category: targetUser.workerCategory || "Labour",
          dailyRate: targetUser.dailyWage || 500,
          skillCategory: "skilled",
          paymentType: "daily",
          isArchived: false,
        });
        await existingWorker.save();
      }
    }

    // Real-time socket notification
    try {
      const io = getIO();
      io.to(`user_${targetUser._id}`).emit("connection:verified", {
        contractorName: contractor?.name,
        companyName: tenant?.name,
        connectedAt: connectionReq.connectedAt,
      });
      io.to(`user_${contractorId}`).emit("connection:verified", {
        targetUserName: targetUser.name,
        uniqueId: targetUser.uniqueId,
        connectedAt: connectionReq.connectedAt,
      });
      io.emit("admin_dashboard_update");
    } catch (socketErr) {
      console.warn("Socket broadcast failed:", socketErr);
    }

    return res.json({
      success: true,
      message: `Successfully connected with ${targetUser.name}!`,
      user: {
        id: targetUser._id,
        name: targetUser.name,
        uniqueId: targetUser.uniqueId,
        role: targetUser.role,
        connectionStatus: "connected",
      },
    });
  } catch (error: any) {
    console.error("verifyConnectionCode error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Get Pending Connection Requests for Logged-In User (Supervisor or Worker)
export const getPendingUserConnectionRequests = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    const pendingRequests = await ConnectionRequest.find({
      receiverId: userId,
      status: "pending",
      codeExpiresAt: { $gt: new Date() },
    })
      .populate("senderId", "name phone email uniqueId")
      .populate("tenantId", "name");

    return res.json({
      success: true,
      requests: pendingRequests.map((r) => ({
        requestId: r._id,
        contractorName: (r.senderId as any)?.name || "Contractor",
        contractorUniqueId: (r.senderId as any)?.uniqueId || "",
        companyName: (r.tenantId as any)?.name || "Company",
        targetRole: r.targetRole,
        code: r.code,
        expiresAt: r.codeExpiresAt,
        createdAt: r.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("getPendingUserConnectionRequests error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 7. Disconnect Connection (Preserves All Historical Records)
export const disconnectConnection = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const { targetUserId, targetUniqueId } = req.body;

    let targetUser = null;
    if (targetUserId) {
      targetUser = await User.findById(targetUserId);
    } else if (targetUniqueId) {
      targetUser = await User.findOne({ uniqueId: String(targetUniqueId).trim().toUpperCase() });
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found to disconnect." });
    }

    // Update connection requests
    await ConnectionRequest.updateMany(
      {
        $or: [
          { senderId: currentUserId, receiverId: targetUser._id },
          { senderId: targetUser._id, receiverId: currentUserId },
        ],
        status: { $in: ["active", "accepted", "pending"] },
      },
      {
        $set: {
          status: "disconnected",
          disconnectedAt: new Date(),
        },
      }
    );

    // Update target user connection status
    targetUser.connectionStatus = "not_connected";
    targetUser.contractorId = undefined;
    targetUser.contractorName = undefined;
    targetUser.contractorCompany = undefined;
    await targetUser.save();

    return res.json({
      success: true,
      message: "Disconnected successfully. All past records, attendance, and work data are preserved.",
    });
  } catch (error: any) {
    console.error("disconnectConnection error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 8. Get Contractor's Connected Users (Supervisors + Workers)
export const getContractorConnections = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const contractorId = req.user?.id;

    const connectedSupervisors = await User.find({
      tenantId,
      role: "supervisor",
      connectionStatus: "connected",
    }).select("name uniqueId email phone avatarColor profileImage createdAt assignedProjects");

    const connectedWorkers = await User.find({
      tenantId,
      role: { $in: ["labor", "worker"] },
      connectionStatus: "connected",
    }).select("name uniqueId email phone workerCategory dailyWage avatarColor profileImage createdAt");

    const pendingRequests = await ConnectionRequest.find({
      senderId: contractorId,
      status: "pending",
      codeExpiresAt: { $gt: new Date() },
    }).populate("receiverId", "name uniqueId phone email role workerCategory connectionStatus");

    return res.json({
      success: true,
      supervisors: connectedSupervisors,
      workers: connectedWorkers,
      pendingRequests: pendingRequests.map((r) => ({
        requestId: r._id,
        user: r.receiverId,
        code: r.code,
        expiresAt: r.codeExpiresAt,
        createdAt: r.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("getContractorConnections error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 9. Legacy controller handlers for backward compatibility
export const sendSupervisorConnectionRequest = createConnectionRequest;
export const acceptSupervisorConnectionRequest = verifyConnectionCode;
export const declineSupervisorConnectionRequest = disconnectConnection;
export const getContractorSupervisors = getContractorConnections;
export const sendLaborConnectionRequest = createConnectionRequest;
export const acceptLaborConnectionRequest = verifyConnectionCode;
export const declineLaborConnectionRequest = disconnectConnection;
export const getContractorLabor = getContractorConnections;
