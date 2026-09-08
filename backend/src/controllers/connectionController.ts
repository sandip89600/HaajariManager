import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { User, Tenant, ConnectionRequest, AuditLog } from "../models";
import { getIO, broadcastAdminActivity } from "../utils/socket";

// Search Supervisors by Username, Mobile Number, or Email
export const searchSupervisors = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({ success: false, message: "Search query is required." });
    }

    const cleanQuery = query.trim().toLowerCase();
    const phoneOnlyDigits = cleanQuery.replace(/\D/g, "");

    const searchConditions: any[] = [
      { username: cleanQuery },
      { email: cleanQuery },
      { phone: cleanQuery },
    ];

    if (phoneOnlyDigits.length >= 8) {
      searchConditions.push({ phone: new RegExp(phoneOnlyDigits.slice(-10) + "$") });
    }

    const supervisors = await User.find({
      role: "supervisor",
      $or: searchConditions,
    }).select("name username email phone contractorName contractorCompany connectionStatus avatarColor profileImage createdAt");

    return res.json({ success: true, supervisors });
  } catch (error: any) {
    console.error("searchSupervisors error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Contractor Sends Connection Request to Supervisor
export const sendSupervisorConnectionRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const contractorId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const { supervisorId } = req.body;

    if (!supervisorId) {
      return res.status(400).json({ success: false, message: "Supervisor ID is required." });
    }

    const supervisor = await User.findById(supervisorId);
    if (!supervisor || supervisor.role !== "supervisor") {
      return res.status(404).json({ success: false, message: "Supervisor account not found." });
    }

    const contractor = await User.findById(contractorId);
    const tenant = await Tenant.findById(tenantId);
    const companyName = tenant?.name || contractor?.name || "Contractor Company";

    // Check existing pending or accepted request
    const existingReq = await ConnectionRequest.findOne({
      senderId: contractorId,
      receiverId: supervisorId,
      status: { $in: ["pending", "accepted"] },
    });

    if (existingReq) {
      if (existingReq.status === "accepted") {
        return res.status(400).json({ success: false, message: "Supervisor is already connected." });
      }
      return res.status(400).json({ success: false, message: "Connection request is already pending." });
    }

    const connectionReq = new ConnectionRequest({
      senderId: contractorId,
      receiverId: supervisorId,
      tenantId,
      targetRole: "supervisor",
      status: "pending",
    });

    await connectionReq.save();

    supervisor.connectionStatus = "pending";
    await supervisor.save();

    // Emit Socket.IO notification to Supervisor
    try {
      const io = getIO();
      io.to(`user_${supervisorId}`).emit("supervisor:connectionRequest", {
        requestId: connectionReq._id,
        contractorName: contractor?.name,
        companyName,
        createdAt: connectionReq.createdAt,
      });
      io.emit("admin_dashboard_update");
    } catch (socketErr) {
      console.warn("Socket broadcast failed:", socketErr);
    }

    return res.status(201).json({
      success: true,
      message: "Connection request sent successfully.",
      connectionRequest: connectionReq,
    });
  } catch (error: any) {
    console.error("sendSupervisorConnectionRequest error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Supervisor Accepts Connection Request
export const acceptSupervisorConnectionRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supervisorId = req.user?.id;
    const { id: requestId } = req.params;

    const connectionReq = await ConnectionRequest.findById(requestId);
    if (!connectionReq || connectionReq.receiverId.toString() !== supervisorId) {
      return res.status(404).json({ success: false, message: "Connection request not found." });
    }

    if (connectionReq.status === "accepted") {
      return res.status(400).json({ success: false, message: "Request has already been accepted." });
    }

    connectionReq.status = "accepted";
    await connectionReq.save();

    const contractor = await User.findById(connectionReq.senderId);
    const tenant = await Tenant.findById(connectionReq.tenantId);

    const supervisor = await User.findById(supervisorId);
    if (supervisor) {
      supervisor.tenantId = connectionReq.tenantId;
      supervisor.contractorId = connectionReq.senderId;
      supervisor.contractorName = contractor?.name || "";
      supervisor.contractorCompany = tenant?.name || "";
      supervisor.connectionStatus = "connected";
      await supervisor.save();
    }

    // Emit Real-time Socket.IO notification to Contractor & Admin
    try {
      const io = getIO();
      io.to(`user_${connectionReq.senderId}`).emit("supervisor:connectionAccepted", {
        supervisorId,
        supervisorName: supervisor?.name,
        requestId: connectionReq._id,
      });
      io.emit("admin_dashboard_update");
    } catch (socketErr) {
      console.warn("Socket broadcast failed:", socketErr);
    }

    return res.json({
      success: true,
      message: "Connection request accepted successfully.",
      supervisor,
    });
  } catch (error: any) {
    console.error("acceptSupervisorConnectionRequest error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Supervisor Declines Connection Request
export const declineSupervisorConnectionRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const supervisorId = req.user?.id;
    const { id: requestId } = req.params;

    const connectionReq = await ConnectionRequest.findById(requestId);
    if (!connectionReq || connectionReq.receiverId.toString() !== supervisorId) {
      return res.status(404).json({ success: false, message: "Connection request not found." });
    }

    connectionReq.status = "declined";
    await connectionReq.save();

    const supervisor = await User.findById(supervisorId);
    if (supervisor) {
      supervisor.connectionStatus = "declined";
      await supervisor.save();
    }

    try {
      const io = getIO();
      io.to(`user_${connectionReq.senderId}`).emit("supervisor:connectionDeclined", {
        supervisorId,
        supervisorName: supervisor?.name,
        requestId: connectionReq._id,
      });
      io.emit("admin_dashboard_update");
    } catch (socketErr) {
      console.warn("Socket broadcast failed:", socketErr);
    }

    return res.json({
      success: true,
      message: "Connection request declined.",
    });
  } catch (error: any) {
    console.error("declineSupervisorConnectionRequest error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get Contractor's Supervisors (Connected, Pending, Declined)
export const getContractorSupervisors = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const contractorId = req.user?.id;

    // Connected supervisors (in contractor's tenantId)
    const connectedSupervisors = await User.find({
      tenantId,
      role: "supervisor",
    }).select("-passwordHash -refreshTokens").populate("assignedProjects");

    // Pending requests sent by this contractor
    const pendingRequests = await ConnectionRequest.find({
      senderId: contractorId,
      status: "pending",
      targetRole: "supervisor",
    }).populate("receiverId", "name username phone email connectionStatus");

    return res.json({
      success: true,
      supervisors: connectedSupervisors,
      pendingRequests: pendingRequests.map((r) => ({
        requestId: r._id,
        supervisor: r.receiverId,
        createdAt: r.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("getContractorSupervisors error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Search Labor Accounts by Username, Mobile Number, or Email
export const searchLabor = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({ success: false, message: "Search query is required." });
    }

    const cleanQuery = query.trim().toLowerCase();
    const phoneOnlyDigits = cleanQuery.replace(/\D/g, "");

    const searchConditions: any[] = [
      { username: cleanQuery },
      { email: cleanQuery },
      { phone: cleanQuery },
    ];

    if (phoneOnlyDigits.length >= 8) {
      searchConditions.push({ phone: new RegExp(phoneOnlyDigits.slice(-10) + "$") });
    }

    const laborUsers = await User.find({
      role: "labor",
      $or: searchConditions,
    }).select("name username email phone connectionStatus avatarColor profileImage createdAt");

    return res.json({ success: true, labor: laborUsers });
  } catch (error: any) {
    console.error("searchLabor error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Contractor Sends Connection Request to Labor
export const sendLaborConnectionRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const contractorId = req.user?.id;
    const tenantId = req.user?.tenantId;
    const { laborId } = req.body;

    if (!laborId) {
      return res.status(400).json({ success: false, message: "Labor ID is required." });
    }

    const laborUser = await User.findById(laborId);
    if (!laborUser || laborUser.role !== "labor") {
      return res.status(404).json({ success: false, message: "Labor account not found." });
    }

    const contractor = await User.findById(contractorId);
    const tenant = await Tenant.findById(tenantId);
    const companyName = tenant?.name || contractor?.name || "Contractor Company";

    const existingReq = await ConnectionRequest.findOne({
      senderId: contractorId,
      receiverId: laborId,
      status: { $in: ["pending", "accepted"] },
    });

    if (existingReq) {
      if (existingReq.status === "accepted") {
        return res.status(400).json({ success: false, message: "Labor account is already connected." });
      }
      return res.status(400).json({ success: false, message: "Connection request is already pending." });
    }

    const connectionReq = new ConnectionRequest({
      senderId: contractorId,
      receiverId: laborId,
      tenantId,
      targetRole: "labor",
      status: "pending",
    });

    await connectionReq.save();

    laborUser.connectionStatus = "pending";
    await laborUser.save();

    try {
      const io = getIO();
      io.to(`user_${laborId}`).emit("labor:connectionRequest", {
        requestId: connectionReq._id,
        contractorName: contractor?.name,
        companyName,
        createdAt: connectionReq.createdAt,
      });
      io.emit("admin_dashboard_update");
    } catch (socketErr) {
      console.warn("Socket broadcast failed:", socketErr);
    }

    return res.status(201).json({
      success: true,
      message: "Labor connection request sent successfully.",
      connectionRequest: connectionReq,
    });
  } catch (error: any) {
    console.error("sendLaborConnectionRequest error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Labor Accepts Connection Request
export const acceptLaborConnectionRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const laborId = req.user?.id;
    const { id: requestId } = req.params;

    const connectionReq = await ConnectionRequest.findById(requestId);
    if (!connectionReq || connectionReq.receiverId.toString() !== laborId) {
      return res.status(404).json({ success: false, message: "Connection request not found." });
    }

    if (connectionReq.status === "accepted") {
      return res.status(400).json({ success: false, message: "Request has already been accepted." });
    }

    connectionReq.status = "accepted";
    await connectionReq.save();

    const contractor = await User.findById(connectionReq.senderId);
    const tenant = await Tenant.findById(connectionReq.tenantId);

    const laborUser = await User.findById(laborId);
    if (laborUser) {
      laborUser.tenantId = connectionReq.tenantId;
      laborUser.contractorId = connectionReq.senderId;
      laborUser.contractorName = contractor?.name || "";
      laborUser.contractorCompany = tenant?.name || "";
      laborUser.connectionStatus = "connected";
      await laborUser.save();
    }

    try {
      const io = getIO();
      io.to(`user_${connectionReq.senderId}`).emit("labor:connectionAccepted", {
        laborId,
        laborName: laborUser?.name,
        requestId: connectionReq._id,
      });
      io.emit("admin_dashboard_update");
    } catch (socketErr) {
      console.warn("Socket broadcast failed:", socketErr);
    }

    return res.json({
      success: true,
      message: "Connection request accepted successfully.",
      labor: laborUser,
    });
  } catch (error: any) {
    console.error("acceptLaborConnectionRequest error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Labor Declines Connection Request
export const declineLaborConnectionRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const laborId = req.user?.id;
    const { id: requestId } = req.params;

    const connectionReq = await ConnectionRequest.findById(requestId);
    if (!connectionReq || connectionReq.receiverId.toString() !== laborId) {
      return res.status(404).json({ success: false, message: "Connection request not found." });
    }

    connectionReq.status = "declined";
    await connectionReq.save();

    const laborUser = await User.findById(laborId);
    if (laborUser) {
      laborUser.connectionStatus = "declined";
      await laborUser.save();
    }

    try {
      const io = getIO();
      io.to(`user_${connectionReq.senderId}`).emit("labor:connectionDeclined", {
        laborId,
        laborName: laborUser?.name,
        requestId: connectionReq._id,
      });
      io.emit("admin_dashboard_update");
    } catch (socketErr) {
      console.warn("Socket broadcast failed:", socketErr);
    }

    return res.json({
      success: true,
      message: "Connection request declined.",
    });
  } catch (error: any) {
    console.error("declineLaborConnectionRequest error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get Contractor's Connected Labor Accounts
export const getContractorLabor = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const contractorId = req.user?.id;

    const connectedLabor = await User.find({
      tenantId,
      role: "labor",
    }).select("-passwordHash -refreshTokens");

    const pendingRequests = await ConnectionRequest.find({
      senderId: contractorId,
      status: "pending",
      targetRole: "labor",
    }).populate("receiverId", "name username phone email connectionStatus");

    return res.json({
      success: true,
      labor: connectedLabor,
      pendingRequests: pendingRequests.map((r) => ({
        requestId: r._id,
        labor: r.receiverId,
        createdAt: r.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("getContractorLabor error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get Pending Connection Requests for Logged-In User (Supervisor / Labor)
export const getPendingUserConnectionRequests = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    const pendingRequests = await ConnectionRequest.find({
      receiverId: userId,
      status: "pending",
    }).populate("senderId", "name phone email").populate("tenantId", "name");

    return res.json({
      success: true,
      requests: pendingRequests.map((r) => ({
        requestId: r._id,
        contractorName: (r.senderId as any)?.name || "Contractor",
        companyName: (r.tenantId as any)?.name || "Company",
        targetRole: r.targetRole,
        createdAt: r.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("getPendingUserConnectionRequests error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
