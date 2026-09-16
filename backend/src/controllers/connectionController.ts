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
    }).select("name uniqueId role workerCategory dailyWage connectionStatus avatarColor profileImage contractorName contractorCompany phone");

    if (targetUser) {
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
          phoneMasked: targetUser.phone ? targetUser.phone.replace(/(\d{2})\d{6}(\d{2})/, "$1******$2") : undefined,
        },
      });
    }

    // Also search in Worker records
    const workerConditions: any[] = [
      { uniqueId: cleanUpper },
    ];
    if (phoneOnlyDigits.length >= 8) {
      workerConditions.push({ phone: new RegExp(phoneOnlyDigits.slice(-10) + "$") });
    }

    const targetWorker = await Worker.findOne({
      $or: workerConditions,
      isArchived: false,
    });

    if (targetWorker) {
      return res.json({
        success: true,
        worker: {
          id: targetWorker._id,
          name: targetWorker.name,
          uniqueId: targetWorker.uniqueId,
          role: "worker",
          category: targetWorker.category,
          dailyRate: targetWorker.dailyRate,
          isClaimed: targetWorker.isClaimed,
          phoneMasked: targetWorker.phone ? targetWorker.phone.replace(/(\d{2})\d{6}(\d{2})/, "$1******$2") : undefined,
        },
      });
    }

    return res.status(404).json({ success: false, message: "Account not found with this ID or phone." });
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

// 4. Create Connection Request with 6-Digit Temporary Code
export const createConnectionRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const currentUserRole = req.user?.role;
    const currentTenantId = req.user?.tenantId;
    const { targetUniqueId, targetUserId, targetPhone, method = "id" } = req.body;

    if (!targetUniqueId && !targetUserId && !targetPhone) {
      return res.status(400).json({ success: false, message: "Target ID, User ID, or Mobile number is required." });
    }

    let targetUser = null;
    let targetWorker = null;

    if (targetUniqueId) {
      const upper = String(targetUniqueId).trim().toUpperCase();
      targetUser = await User.findOne({ uniqueId: upper });
      if (!targetUser) {
        targetWorker = await Worker.findOne({ uniqueId: upper, isArchived: false });
      }
    } else if (targetUserId) {
      targetUser = await User.findById(targetUserId);
    } else if (targetPhone) {
      const phoneDigits = String(targetPhone).replace(/\D/g, "");
      const clean10 = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : targetPhone.trim();
      targetUser = await User.findOne({ phone: new RegExp(clean10 + "$") });
      if (!targetUser) {
        targetWorker = await Worker.findOne({ phone: new RegExp(clean10 + "$"), isArchived: false });
      }
    }

    if (!targetUser && !targetWorker) {
      return res.status(404).json({ success: false, message: "Target user or worker profile not found." });
    }

    // If target is worker without User account
    if (!targetUser && targetWorker) {
      if (targetWorker.userId) {
        targetUser = await User.findById(targetWorker.userId);
      }
    }

    if (targetUser && targetUser._id.toString() === currentUserId) {
      return res.status(400).json({ success: false, message: "Cannot send connection request to yourself." });
    }

    // Check if already connected
    if (targetUser && targetUser.contractorId && targetUser.contractorId.toString() === currentUserId) {
      return res.status(400).json({ success: false, message: "This user is already connected to your account." });
    }

    const sender = await User.findById(currentUserId);
    const tenant = await Tenant.findById(currentTenantId);
    const companyName = tenant?.name || sender?.name || "Company";

    // If targetUser doesn't exist yet (worker is unclaimed), create or update worker under contractor's tenant directly
    if (!targetUser && targetWorker) {
      targetWorker.tenantId = currentTenantId as any;
      await targetWorker.save();
      return res.json({
        success: true,
        message: `Worker profile ${targetWorker.name} is now connected. When they sign up with mobile, they will claim this account.`,
        worker: targetWorker,
      });
    }

    // Check existing active connection
    const existingActive = await ConnectionRequest.findOne({
      $or: [
        { senderId: currentUserId, receiverId: targetUser!._id, status: { $in: ["active", "accepted"] } },
        { senderId: targetUser!._id, receiverId: currentUserId, status: { $in: ["active", "accepted"] } },
      ],
    });
    if (existingActive) {
      return res.status(400).json({ success: false, message: "You are already connected with this user." });
    }

    // Check existing pending request
    const existingPending = await ConnectionRequest.findOne({
      $or: [
        { senderId: currentUserId, receiverId: targetUser!._id, status: "pending", codeExpiresAt: { $gt: new Date() } },
        { senderId: targetUser!._id, receiverId: currentUserId, status: "pending", codeExpiresAt: { $gt: new Date() } },
      ],
    });

    // Generate 6-digit random connection code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(code, 8);
    const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    let connectionReq = existingPending;
    if (connectionReq) {
      connectionReq.code = code;
      connectionReq.codeHash = codeHash;
      connectionReq.codeExpiresAt = codeExpiresAt;
      connectionReq.codeAttempts = 0;
      connectionReq.method = method === "mobile" ? "mobile" : "id";
      await connectionReq.save();
    } else {
      connectionReq = new ConnectionRequest({
        senderId: currentUserId,
        receiverId: targetUser!._id,
        tenantId: currentTenantId,
        workerId: targetWorker?._id,
        targetRole: targetUser!.role === "supervisor" ? "supervisor" : (targetUser!.role === "contractor" ? "contractor" : "labor"),
        method: method === "mobile" ? "mobile" : "id",
        status: "pending",
        code,
        codeHash,
        codeExpiresAt,
        codeAttempts: 0,
      });
      await connectionReq.save();
    }

    targetUser!.connectionStatus = "pending";
    await targetUser!.save();

    // Broadcast Real-Time socket notification
    try {
      const io = getIO();
      io.to(`user_${targetUser!._id}`).emit("connection:newRequest", {
        requestId: connectionReq._id,
        senderName: sender?.name,
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
      message: "Connection request sent successfully.",
      connectionRequest: {
        id: connectionReq._id,
        targetUser: {
          id: targetUser!._id,
          name: targetUser!.name,
          uniqueId: targetUser!.uniqueId,
          role: targetUser!.role,
        },
        code,
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
    let existingWorker: any = null;
    if (targetUser.role === "labor" || (targetUser.role as string) === "worker") {
      if (connectionReq.workerId) {
        existingWorker = await Worker.findById(connectionReq.workerId);
      }
      if (!existingWorker) {
        const phoneDigits = targetUser.phone ? targetUser.phone.replace(/\D/g, "") : "";
        existingWorker = await Worker.findOne({
          tenantId,
          $or: [
            { userId: targetUser._id },
            ...(targetUser.uniqueId ? [{ uniqueId: targetUser.uniqueId }] : []),
            ...(phoneDigits.length >= 10 ? [{ phone: new RegExp(phoneDigits.slice(-10) + "$") }] : []),
            { name: targetUser.name },
          ],
        });
      }

      if (existingWorker) {
        existingWorker.userId = targetUser._id as any;
        existingWorker.isClaimed = true;
        existingWorker.claimedAt = new Date();
        if (targetUser.uniqueId && !existingWorker.uniqueId) {
          existingWorker.uniqueId = targetUser.uniqueId;
        } else if (existingWorker.uniqueId && !targetUser.uniqueId) {
          targetUser.uniqueId = existingWorker.uniqueId;
          await targetUser.save();
        }
        if (existingWorker.dailyRate) {
          targetUser.dailyWage = existingWorker.dailyRate;
          await targetUser.save();
        }
        await existingWorker.save();
        connectionReq.workerId = existingWorker._id as any;
        await connectionReq.save();
      } else {
        existingWorker = new Worker({
          tenantId,
          userId: targetUser._id,
          uniqueId: targetUser.uniqueId,
          name: targetUser.name,
          phone: targetUser.phone,
          category: targetUser.workerCategory || "labour",
          dailyRate: targetUser.dailyWage || 0,
          skillCategory: "skilled",
          paymentType: "daily",
          isArchived: false,
          isClaimed: true,
          claimedAt: new Date(),
        });
        await existingWorker.save();
        connectionReq.workerId = existingWorker._id as any;
        await connectionReq.save();
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
      worker: existingWorker ? {
        id: existingWorker._id,
        name: existingWorker.name,
        uniqueId: existingWorker.uniqueId,
        dailyRate: existingWorker.dailyRate,
        category: existingWorker.category,
      } : undefined,
    });
  } catch (error: any) {
    console.error("verifyConnectionCode error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Accept Connection Request (Direct Accept without Code)
export const acceptConnectionRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const { requestId, senderId } = req.body;

    let connectionReq = null;
    if (requestId) {
      connectionReq = await ConnectionRequest.findById(requestId);
    } else if (senderId) {
      connectionReq = await ConnectionRequest.findOne({
        senderId,
        receiverId: currentUserId,
        status: "pending",
      });
    }

    if (!connectionReq) {
      return res.status(404).json({ success: false, message: "Connection request not found." });
    }

    if (connectionReq.status === "accepted" || connectionReq.status === "active") {
      return res.status(400).json({ success: false, message: "Connection request has already been accepted." });
    }

    if (connectionReq.status === "rejected" || connectionReq.status === "cancelled" || connectionReq.status === "disconnected") {
      return res.status(400).json({ success: false, message: "Connection request is no longer pending." });
    }

    if (currentUserId && connectionReq.receiverId.toString() !== currentUserId && connectionReq.senderId.toString() !== currentUserId) {
      return res.status(403).json({ success: false, message: "You are not authorized to accept this connection request." });
    }

    const sender = await User.findById(connectionReq.senderId);
    const receiver = await User.findById(connectionReq.receiverId);

    if (!sender || !receiver) {
      return res.status(404).json({ success: false, message: "User accounts not found." });
    }

    connectionReq.status = "accepted";
    connectionReq.acceptedAt = new Date();
    connectionReq.connectedAt = new Date();
    await connectionReq.save();

    // Determine who is contractor and who is member (worker/supervisor)
    let contractor = sender.role === "contractor" ? sender : (receiver.role === "contractor" ? receiver : sender);
    let member = sender.role === "contractor" ? receiver : (receiver.role === "contractor" ? sender : (sender.role === "labor" ? sender : receiver));

    // Ensure contractor has a valid tenantId
    let contractorTenantId = contractor.tenantId;
    if (!contractorTenantId) {
      let tenant = await Tenant.findOne({ ownerId: contractor._id });
      if (!tenant) {
        tenant = new Tenant({
          name: `${contractor.name || "Contractor"}'s Company`,
          ownerId: contractor._id,
        });
        await tenant.save();
      }
      contractorTenantId = tenant._id as any;
      contractor.tenantId = contractorTenantId;
      await contractor.save();
    }

    const tenant = await Tenant.findById(contractorTenantId);

    member.tenantId = contractorTenantId;
    member.contractorId = contractor._id as any;
    member.contractorName = contractor.name;
    member.contractorCompany = tenant?.name || contractor.name;
    member.connectionStatus = "connected";
    await member.save();

    if (contractor._id.toString() !== member._id.toString()) {
      contractor.connectionStatus = "connected";
      await contractor.save();
    }

    // If member is worker/labor, link or create Worker profile in contractor's tenant
    let existingWorker: any = null;
    if (member.role === "labor" || (member.role as string) === "worker") {
      try {
        if (connectionReq.workerId) {
          existingWorker = await Worker.findById(connectionReq.workerId);
        }
        if (!existingWorker) {
          const phoneDigits = member.phone ? member.phone.replace(/\D/g, "") : "";
          existingWorker = await Worker.findOne({
            tenantId: contractorTenantId,
            $or: [
              { userId: member._id },
              ...(member.uniqueId ? [{ uniqueId: member.uniqueId }] : []),
              ...(phoneDigits.length >= 10 ? [{ phone: new RegExp(phoneDigits.slice(-10) + "$") }] : []),
              { name: member.name },
            ],
          });
        }

        if (existingWorker) {
          existingWorker.userId = member._id as any;
          existingWorker.isClaimed = true;
          existingWorker.claimedAt = new Date();
          if (member.name) existingWorker.name = member.name;
          if (member.uniqueId && !existingWorker.uniqueId) {
            existingWorker.uniqueId = member.uniqueId;
          } else if (existingWorker.uniqueId && !member.uniqueId) {
            member.uniqueId = existingWorker.uniqueId;
            await member.save();
          }
          if (existingWorker.dailyRate) {
            member.dailyWage = existingWorker.dailyRate;
            await member.save();
          }
          await existingWorker.save();
          connectionReq.workerId = existingWorker._id as any;
          await connectionReq.save();
        } else {
          existingWorker = new Worker({
            tenantId: contractorTenantId,
            userId: member._id,
            uniqueId: member.uniqueId,
            name: member.name || "Worker",
            phone: member.phone || "",
            category: member.workerCategory || "labour",
            dailyRate: member.dailyWage || 0,
            skillCategory: "skilled",
            paymentType: "daily",
            isArchived: false,
            isClaimed: true,
            claimedAt: new Date(),
          });
          await existingWorker.save();
          connectionReq.workerId = existingWorker._id as any;
          await connectionReq.save();
        }
      } catch (workerErr) {
        console.warn("Worker profile creation/sync non-fatal error:", workerErr);
      }
    }

    // Broadcast socket
    try {
      const io = getIO();
      io.to(`user_${sender._id}`).emit("connection:accepted", {
        member: { id: member._id, name: member.name, uniqueId: member.uniqueId },
        contractor: { id: contractor._id, name: contractor.name },
      });
      io.to(`user_${receiver._id}`).emit("connection:accepted", {
        member: { id: member._id, name: member.name, uniqueId: member.uniqueId },
        contractor: { id: contractor._id, name: contractor.name },
      });
      io.emit("admin_dashboard_update");
    } catch (socketErr) {
      console.warn("Socket broadcast failed:", socketErr);
    }

    return res.json({
      success: true,
      message: "Connection request accepted successfully.",
      connection: connectionReq,
      worker: existingWorker ? {
        id: existingWorker._id,
        name: existingWorker.name,
        uniqueId: existingWorker.uniqueId,
        dailyRate: existingWorker.dailyRate,
        category: existingWorker.category,
      } : undefined,
    });
  } catch (error: any) {
    console.error("acceptConnectionRequest error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to accept connection request." });
  }
};

// 7. Reject Connection Request
export const rejectConnectionRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const { requestId, senderId } = req.body;

    let connectionReq = null;
    if (requestId) {
      connectionReq = await ConnectionRequest.findById(requestId);
    } else if (senderId) {
      connectionReq = await ConnectionRequest.findOne({
        senderId,
        receiverId: currentUserId,
        status: "pending",
      });
    }

    if (!connectionReq) {
      return res.status(404).json({ success: false, message: "Connection request not found." });
    }

    if (currentUserId && connectionReq.receiverId.toString() !== currentUserId && connectionReq.senderId.toString() !== currentUserId) {
      return res.status(403).json({ success: false, message: "You are not authorized to reject this connection request." });
    }

    connectionReq.status = "rejected";
    connectionReq.rejectedAt = new Date();
    await connectionReq.save();

    const receiver = await User.findById(connectionReq.receiverId);
    if (receiver && receiver.connectionStatus === "pending") {
      receiver.connectionStatus = "not_connected";
      await receiver.save();
    }

    const sender = await User.findById(connectionReq.senderId);
    if (sender && sender.connectionStatus === "pending") {
      sender.connectionStatus = "not_connected";
      await sender.save();
    }

    // Broadcast socket
    try {
      const io = getIO();
      io.to(`user_${connectionReq.senderId}`).emit("connection:rejected", {
        requestId: connectionReq._id,
      });
      io.to(`user_${connectionReq.receiverId}`).emit("connection:rejected", {
        requestId: connectionReq._id,
      });
    } catch (socketErr) {
      console.warn("Socket broadcast failed:", socketErr);
    }

    return res.json({
      success: true,
      message: "Connection request rejected.",
    });
  } catch (error: any) {
    console.error("rejectConnectionRequest error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to reject connection request." });
  }
};

// 8. Get Pending Connection Requests for Logged-In User
export const getPendingUserConnectionRequests = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    const incomingRequests = await ConnectionRequest.find({
      receiverId: userId,
      status: "pending",
      $or: [
        { codeExpiresAt: { $exists: false } },
        { codeExpiresAt: null },
        { codeExpiresAt: { $gt: new Date() } },
      ],
    })
      .populate("senderId", "name phone email uniqueId role workerCategory dailyWage")
      .populate("tenantId", "name")
      .sort({ createdAt: -1 });

    const outgoingRequests = await ConnectionRequest.find({
      senderId: userId,
      status: "pending",
      $or: [
        { codeExpiresAt: { $exists: false } },
        { codeExpiresAt: null },
        { codeExpiresAt: { $gt: new Date() } },
      ],
    })
      .populate("receiverId", "name phone email uniqueId role workerCategory dailyWage")
      .populate("tenantId", "name")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      incoming: incomingRequests.map((r) => ({
        requestId: r._id,
        senderId: (r.senderId as any)?._id,
        senderName: (r.senderId as any)?.name || "User",
        senderRole: (r.senderId as any)?.role || r.targetRole || "User",
        senderUniqueId: (r.senderId as any)?.uniqueId || "",
        senderCategory: (r.senderId as any)?.workerCategory || "",
        senderPhone: (r.senderId as any)?.phone || "",
        companyName: (r.tenantId as any)?.name || "",
        targetRole: r.targetRole,
        code: r.code,
        method: r.method,
        expiresAt: r.codeExpiresAt,
        createdAt: r.createdAt,
      })),
      outgoing: outgoingRequests.map((r) => ({
        requestId: r._id,
        receiverId: (r.receiverId as any)?._id,
        receiverName: (r.receiverId as any)?.name || "User",
        receiverRole: (r.receiverId as any)?.role || r.targetRole || "User",
        receiverUniqueId: (r.receiverId as any)?.uniqueId || "",
        receiverCategory: (r.receiverId as any)?.workerCategory || "",
        receiverPhone: (r.receiverId as any)?.phone || "",
        companyName: (r.tenantId as any)?.name || "",
        targetRole: r.targetRole,
        code: r.code,
        method: r.method,
        expiresAt: r.codeExpiresAt,
        createdAt: r.createdAt,
      })),
      requests: incomingRequests.map((r) => ({
        requestId: r._id,
        senderName: (r.senderId as any)?.name || "User",
        senderUniqueId: (r.senderId as any)?.uniqueId || "",
        senderRole: (r.senderId as any)?.role || r.targetRole || "User",
        senderCategory: (r.senderId as any)?.workerCategory || "",
        contractorName: (r.senderId as any)?.name || "Contractor",
        contractorUniqueId: (r.senderId as any)?.uniqueId || "",
        companyName: (r.tenantId as any)?.name || "",
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

    const connectedWorkers = await Worker.find({
      tenantId,
      isArchived: false,
    }).select("name uniqueId phone category dailyRate isClaimed userId createdAt");

    const pendingRequests = await ConnectionRequest.find({
      senderId: contractorId,
      status: "pending",
      $or: [
        { codeExpiresAt: { $exists: false } },
        { codeExpiresAt: null },
        { codeExpiresAt: { $gt: new Date() } },
      ],
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
