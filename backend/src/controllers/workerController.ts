import { Response } from "express";
import { Worker, WageHistory, AuditLog, User } from "../models";
import { AuthenticatedRequest } from "../middleware/auth";
import { broadcastAdminActivity } from "../utils/socket";

export const getWorkers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const role = req.user?.role;

    let query: any = { tenantId, isArchived: false };

    if (role === "supervisor") {
      const supervisor = await User.findById(userId);
      const assignedProjects = supervisor?.assignedProjects || [];
      query.projectId = { $in: assignedProjects };
    } else if (req.query.projectId) {
      query.projectId = req.query.projectId;
    }

    const workers = await Worker.find(query);
    res.json(workers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const addWorker = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { name, category, dailyRate, phone, address, notes, photoUri, projectId } = req.body;

    if (!name || !category || dailyRate === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const worker = new Worker({
      tenantId,
      projectId,
      name,
      category,
      dailyRate,
      phone,
      address,
      notes,
      photoUri,
    });
    await worker.save();

    const wageHistory = new WageHistory({
      tenantId,
      workerId: worker._id,
      dailyRate,
      startDate: new Date(),
      updatedBy: userId,
    });
    await wageHistory.save();

    const auditLog = new AuditLog({
      tenantId,
      userId,
      action: "CREATE",
      targetType: "WORKER",
      targetId: worker._id.toString(),
      changes: { after: worker.toObject() },
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.status(201).json(worker);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateWorker = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { id } = req.params;
    const { name, category, dailyRate, phone, address, notes, photoUri, projectId } = req.body;

    const worker = await Worker.findOne({ _id: id, tenantId });
    if (!worker) {
      return res.status(404).json({ error: "Worker not found" });
    }

    const before = worker.toObject();

    if (dailyRate !== undefined && dailyRate !== worker.dailyRate) {
      await WageHistory.findOneAndUpdate(
        { tenantId, workerId: worker._id, endDate: { $exists: false } },
        { endDate: new Date() }
      );

      const wageHistory = new WageHistory({
        tenantId,
        workerId: worker._id,
        dailyRate,
        startDate: new Date(),
        updatedBy: userId,
      });
      await wageHistory.save();
      worker.dailyRate = dailyRate;
    }

    if (name) worker.name = name;
    if (category) worker.category = category;
    if (phone !== undefined) worker.phone = phone;
    if (address !== undefined) worker.address = address;
    if (notes !== undefined) worker.notes = notes;
    if (photoUri !== undefined) worker.photoUri = photoUri;
    if (projectId !== undefined) worker.projectId = projectId;

    await worker.save();

    const auditLog = new AuditLog({
      tenantId,
      userId,
      action: "UPDATE",
      targetType: "WORKER",
      targetId: worker._id.toString(),
      changes: { before, after: worker.toObject() },
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.json(worker);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteWorker = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { id } = req.params;

    const worker = await Worker.findOne({ _id: id, tenantId });
    if (!worker) {
      return res.status(404).json({ error: "Worker not found" });
    }

    const before = worker.toObject();
    worker.isArchived = true;
    await worker.save();

    const auditLog = new AuditLog({
      tenantId,
      userId,
      action: "SOFT_DELETE",
      targetType: "WORKER",
      targetId: worker._id.toString(),
      changes: { before, after: worker.toObject() },
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.json({ success: true, message: "Worker soft deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
