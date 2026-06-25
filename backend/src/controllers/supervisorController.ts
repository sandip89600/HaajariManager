import { Response } from "express";
import bcrypt from "bcryptjs";
import { User, AuditLog } from "../models";
import { AuthenticatedRequest } from "../middleware/auth";
import { broadcastAdminActivity } from "../utils/socket";

export const getSupervisors = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const supervisors = await User.find({ tenantId, role: "supervisor" })
      .populate("assignedProjects")
      .select("-passwordHash -refreshTokens");
    res.json(supervisors);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createSupervisor = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { name, phone, password, assignedProjects } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ error: "Name, phone number, and password are required" });
    }

    const phoneTrimmed = phone.trim();
    const existingUser = await User.findOne({ phone: phoneTrimmed });
    if (existingUser) {
      return res.status(400).json({ error: "Mobile number already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const supervisor = new User({
      tenantId,
      name,
      phone: phoneTrimmed,
      passwordHash,
      role: "supervisor",
      assignedProjects: assignedProjects || [],
      isActive: true,
      isVerified: true,
    });

    await supervisor.save();

    const auditLog = new AuditLog({
      tenantId,
      userId: req.user?.id,
      action: "USER_SIGNUP",
      targetType: "User",
      targetId: supervisor._id.toString(),
      changes: { after: { name: supervisor.name, role: supervisor.role } }
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);
    
    // Omit sensitive data before returning
    const responseData = supervisor.toObject();
    delete (responseData as any).passwordHash;
    delete (responseData as any).refreshTokens;

    res.status(201).json(responseData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateSupervisor = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;
    const { name, phone, password, assignedProjects, isActive } = req.body;

    const supervisor = await User.findOne({ _id: id, tenantId, role: "supervisor" });
    if (!supervisor) {
      return res.status(404).json({ error: "Supervisor not found" });
    }

    if (name) supervisor.name = name;
    if (phone) {
      const phoneTrimmed = phone.trim();
      if (phoneTrimmed !== supervisor.phone) {
        const existingUser = await User.findOne({ phone: phoneTrimmed });
        if (existingUser) {
          return res.status(400).json({ error: "Mobile number already registered" });
        }
        supervisor.phone = phoneTrimmed;
      }
    }
    if (password) {
      supervisor.passwordHash = await bcrypt.hash(password, 12);
    }
    if (assignedProjects !== undefined) {
      supervisor.assignedProjects = assignedProjects;
    }
    if (isActive !== undefined) {
      supervisor.isActive = isActive;
    }

    await supervisor.save();

    const auditLog = new AuditLog({
      tenantId,
      userId: req.user?.id,
      action: "UPDATE_PROFILE",
      targetType: "User",
      targetId: supervisor._id.toString(),
      changes: { after: { name: supervisor.name, role: supervisor.role } }
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    const responseData = supervisor.toObject();
    delete (responseData as any).passwordHash;
    delete (responseData as any).refreshTokens;

    res.json(responseData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteSupervisor = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;

    const supervisor = await User.findOneAndDelete({ _id: id, tenantId, role: "supervisor" });
    if (!supervisor) {
      return res.status(404).json({ error: "Supervisor not found" });
    }

    const auditLog = new AuditLog({
      tenantId,
      userId: req.user?.id,
      action: "DELETE",
      targetType: "User",
      targetId: id,
      changes: { before: { name: supervisor.name, role: supervisor.role } }
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.json({ success: true, message: "Supervisor account deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
