import { Response } from "express";
import { Worker, WageHistory, AuditLog, User } from "../models";
import { AuthenticatedRequest } from "../middleware/auth";
import { broadcastAdminActivity } from "../utils/socket";
import { logActivity } from "../services/activityLogger";

export const getWorkers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const role = req.user?.role;

    let query: any = { tenantId, isArchived: false };

    if (role === "labor" || role === "worker") {
      const user = await User.findById(userId);
      const myWorker = await Worker.find({
        tenantId,
        isArchived: false,
        $or: [{ phone: user?.phone }, { name: user?.name }],
      }).lean();
      return res.json(myWorker);
    } else if (role === "supervisor") {
      const supervisor = await User.findById(userId).select("assignedProjects").lean();
      const assignedProjects = supervisor?.assignedProjects || [];
      query.projectId = { $in: assignedProjects };
    } else if (req.query.projectId) {
      query.projectId = req.query.projectId;
    }

    const workers = await Worker.find(query).sort({ createdAt: -1 }).lean();
    res.json(workers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const addWorker = async (req: AuthenticatedRequest, res: Response) => {
  const startTime = Date.now();
  try {
    const role = req.user?.role;
    if (role === "labor" || role === "worker") {
      return res.status(403).json({ error: "Forbidden: Workers cannot create worker profiles." });
    }

    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { name, category, dailyRate, phone, address, notes, photoUri, projectId } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const finalDailyRate = dailyRate !== undefined && dailyRate !== null ? Number(dailyRate) : 0;
    const tAuth = Date.now() - startTime;

    const phoneDigits = phone ? String(phone).replace(/\D/g, "") : "";
    const cleanPhone = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : (phone ? String(phone).trim() : undefined);

    let linkedUserId = undefined;
    let isClaimed = false;
    let claimedAt = undefined;

    if (cleanPhone && cleanPhone.length >= 10) {
      const existingUser = await User.findOne({
        phone: new RegExp(cleanPhone + "$"),
        role: { $in: ["labor", "worker"] },
      });
      if (existingUser) {
        linkedUserId = existingUser._id;
        isClaimed = true;
        claimedAt = new Date();

        if (existingUser.connectionStatus !== "connected") {
          existingUser.contractorId = userId as any;
          existingUser.tenantId = tenantId as any;
          existingUser.connectionStatus = "connected";
          await existingUser.save();
        }
      }
    }

    const worker = new Worker({
      tenantId,
      projectId,
      userId: linkedUserId,
      name: name.trim(),
      category: category.trim(),
      dailyRate: finalDailyRate,
      phone: cleanPhone,
      address: address ? String(address).trim() : undefined,
      notes: notes ? String(notes).trim() : undefined,
      photoUri,
      isClaimed,
      claimedAt,
    });
    await worker.save();
    const tWorker = Date.now() - startTime;

    const wageHistory = new WageHistory({
      tenantId,
      workerId: worker._id,
      dailyRate: finalDailyRate,
      startDate: new Date(),
      updatedBy: userId,
    });
    await wageHistory.save();
    const tWage = Date.now() - startTime;

    // Send HTTP response immediately
    res.status(201).json(worker);
    const tTotal = Date.now() - startTime;

    if (process.env.NODE_ENV !== "production") {
      console.log(`[Worker Create] Completed in ${tTotal}ms (Auth/Validation: ${tAuth}ms, WorkerDB: ${tWorker - tAuth}ms, WageDB: ${tWage - tWorker}ms)`);
    }

    // Run activity logging & socket broadcast non-blockingly in the background
    logActivity({
      req,
      action: "WORKER_CREATED",
      targetType: "WORKER",
      targetId: worker._id.toString(),
      changes: { after: worker.toObject() }
    }).catch((logErr) => {
      console.warn("[Worker Controller] Non-blocking activity log error:", logErr);
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateWorker = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = req.user?.role;
    if (role === "labor" || role === "worker") {
      return res.status(403).json({ error: "Forbidden: Workers cannot update worker profiles." });
    }

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

    res.json(worker);

    // Non-blocking activity log
    logActivity({
      req,
      action: "WORKER_UPDATED",
      targetType: "WORKER",
      targetId: worker._id.toString(),
      changes: { before, after: worker.toObject() }
    }).catch((logErr) => {
      console.warn("[Worker Controller] Non-blocking activity log error:", logErr);
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteWorker = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = req.user?.role;
    if (role === "labor" || role === "worker") {
      return res.status(403).json({ error: "Forbidden: Workers cannot delete worker profiles." });
    }

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

    res.json({ success: true, message: "Worker soft deleted successfully" });

    // Non-blocking activity log
    logActivity({
      req,
      action: "WORKER_DELETED",
      targetType: "WORKER",
      targetId: worker._id.toString(),
      changes: { before, after: worker.toObject() }
    }).catch((logErr) => {
      console.warn("[Worker Controller] Non-blocking activity log error:", logErr);
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

