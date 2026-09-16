import { Response } from "express";
import { Attendance, AuditLog, User, Worker, Tenant, AppConfig, Payment } from "../models";
import { AuthenticatedRequest } from "../middleware/auth";
import { broadcastAdminActivity, getIO } from "../utils/socket";
import { logActivity } from "../services/activityLogger";
import { getPlanRank } from "../middleware/subscription";

export const getAttendanceForMonth = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const role = req.user?.role;
    const { year, month } = req.query;

    if (!year || month === undefined || month === null || month === "") {
      return res.status(400).json({ error: "Missing year or month parameters" });
    }

    const y = parseInt(year as string);
    const m = parseInt(month as string);

    // Support flexible month matching (both 0-indexed and 1-indexed)
    const monthFilter = { $in: [m, m + 1, ...(m > 0 ? [m - 1] : [])] };

    let query: any = {
      year: y,
      month: monthFilter,
    };

    if (role === "labor" || role === "worker") {
      const user = await User.findById(req.user?.id);
      const phoneDigits = user?.phone ? String(user.phone).replace(/\D/g, "") : "";
      const cleanPhone = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : "";
      const phoneRegex = cleanPhone ? new RegExp(cleanPhone + "$") : null;

      const workerMatchCriteria: any[] = [
        { userId: user?._id },
        ...(user?.uniqueId ? [{ uniqueId: user.uniqueId }] : []),
        ...(phoneRegex ? [{ phone: phoneRegex }] : []),
        ...(user?.phone ? [{ phone: user.phone }] : []),
        ...(user?.name ? [{ name: new RegExp(`^${user.name.trim()}$`, "i") }] : []),
      ];

      const matchedWorkers = await Worker.find({
        $or: workerMatchCriteria,
      }).lean();

      const workerIds = matchedWorkers.map((w) => w._id);

      if (workerIds.length === 0 && !user?.uniqueId) {
        return res.json([]);
      }

      query.workerId = { $in: workerIds };
      // Worker matches attendance across all contractor tenants without tenantId constraint
    } else if (role === "supervisor") {
      query.tenantId = tenantId;
      const supervisor = await User.findById(req.user?.id);
      const assignedProjects = supervisor?.assignedProjects || [];
      const workers = await Worker.find({ tenantId, isArchived: false, projectId: { $in: assignedProjects } });
      const workerIds = workers.map((w) => w._id);
      query.workerId = { $in: workerIds };
    } else {
      // Contractor / Admin
      query.tenantId = tenantId;
    }

    const records = await Attendance.find(query).lean();
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const setAttendanceRecord = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = req.user?.role;
    if (role === "labor" || role === "worker") {
      return res.status(403).json({ error: "Forbidden: Workers are not authorized to mark or edit attendance." });
    }

    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { workerId, year, month, day, value, location, projectId, overtimeHours, overtimeWage } = req.body;

    if (!workerId || year === undefined || month === undefined || day === undefined || value === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check GPS limits with Master Global Switch
    if (location && (location.latitude || location.longitude)) {
      const appConfig = await AppConfig.findOne();
      if (appConfig?.subscriptionsEnabled) {
        const tenant = await Tenant.findById(tenantId).select("plan").lean();
        if (getPlanRank(tenant?.plan) < 2) {
          return res.status(403).json({
            error: "GPS attendance is not available on your current plan. Upgrade to Super Plan to unlock this feature.",
            limitExceeded: true,
            plan: tenant?.plan || "free",
          });
        }
      }
    }

    const worker = await Worker.findById(workerId).lean();
    const workerDailyRate = worker ? worker.dailyRate : 0;

    const dailyRateResolved = req.body.dailyRate !== undefined ? req.body.dailyRate : workerDailyRate;
    let customWageResolved = req.body.customWage;
    let overtimeWageResolved = overtimeWage;
    let overtimeHoursResolved = overtimeHours;
    let finalPayResolved = 0;

    const advanceAmount = (customWageResolved !== undefined && customWageResolved !== null) ? customWageResolved : 0;
    const otAmount = (overtimeWageResolved !== undefined && overtimeWageResolved !== null) ? overtimeWageResolved : 0;

    if (value === "OT") {
      finalPayResolved = dailyRateResolved + otAmount;
    } else if (value === "P") {
      finalPayResolved = dailyRateResolved;
      overtimeWageResolved = null as any;
      overtimeHoursResolved = null as any;
    } else if (value === "H") {
      finalPayResolved = dailyRateResolved / 2;
      overtimeWageResolved = null as any;
      overtimeHoursResolved = null as any;
    } else if (value === "A") {
      finalPayResolved = 0;
      customWageResolved = null as any;
      overtimeWageResolved = null as any;
      overtimeHoursResolved = null as any;
    } else if (typeof value === "number") {
      finalPayResolved = value;
      overtimeWageResolved = null as any;
      overtimeHoursResolved = null as any;
    } else {
      finalPayResolved = 0;
      overtimeWageResolved = null as any;
      overtimeHoursResolved = null as any;
    }

    const filter = { tenantId, workerId, year, month, day };
    const update = {
      tenantId,
      workerId,
      projectId,
      year,
      month,
      day,
      value,
      dailyRate: dailyRateResolved,
      customWage: customWageResolved ?? null,
      finalPay: finalPayResolved,
      overtimeHours: overtimeHoursResolved ?? null,
      overtimeWage: overtimeWageResolved ?? null,
      location,
      timestamp: new Date(),
    };

    const record = await Attendance.findOneAndUpdate(
      filter,
      update,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Resolve user ID if not directly attached to worker doc
    let resolvedUserId = worker?.userId;
    if (!resolvedUserId) {
      const phoneDigits = worker?.phone ? String(worker.phone).replace(/\D/g, "") : "";
      const cleanPhone = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : "";
      const userLookupCriteria: any[] = [
        ...(worker?.uniqueId ? [{ uniqueId: worker.uniqueId }] : []),
        ...(cleanPhone ? [{ phone: new RegExp(cleanPhone + "$") }] : []),
      ];
      if (userLookupCriteria.length > 0) {
        const matchedUser = await User.findOne({
          $or: userLookupCriteria,
          role: { $in: ["labor", "worker"] },
        });
        if (matchedUser) {
          resolvedUserId = matchedUser._id;
          await Worker.findByIdAndUpdate(workerId, { userId: matchedUser._id });
        }
      }
    }

    // ── Real-time Socket Broadcast to Worker & Tenant ──
    try {
      const io = getIO();
      const payload = {
        attendanceId: record._id,
        workerId: record.workerId,
        uniqueId: worker?.uniqueId,
        year: record.year,
        month: record.month,
        day: record.day,
        value: record.value,
        finalPay: record.finalPay,
        dailyRate: record.dailyRate,
        timestamp: record.timestamp,
      };
      if (resolvedUserId) {
        io.to(`user_${resolvedUserId}`).emit("attendance:recorded", payload);
        io.to(`user_${resolvedUserId}`).emit("attendance:updated", payload);
      }
      if (worker?.uniqueId) {
        io.to(`worker_${worker.uniqueId}`).emit("attendance:recorded", payload);
        io.to(`worker_${worker.uniqueId}`).emit("attendance:updated", payload);
      }
      if (tenantId) {
        io.to(`tenant_${tenantId}`).emit("attendance:recorded", payload);
        io.to(`tenant_${tenantId}`).emit("attendance:updated", payload);
      }
      io.emit("admin_dashboard_update");
    } catch (socketErr) {
      console.warn("[Attendance Controller] Socket emit non-fatal error:", socketErr);
    }

    res.json(record);

    // Non-blocking activity logging
    logActivity({
      req,
      action: "ATTENDANCE_MARKED",
      targetType: "ATTENDANCE",
      targetId: record._id.toString(),
      changes: { after: record.toObject() }
    }).catch((logErr) => {
      console.warn("[Attendance Controller] Non-blocking activity log error:", logErr);
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const syncAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = req.user?.role;
    if (role === "labor" || role === "worker") {
      return res.status(403).json({ error: "Forbidden: Workers cannot sync attendance." });
    }

    const tenantId = req.user?.tenantId;
    const { records } = req.body;

    if (!Array.isArray(records)) {
      return res.status(400).json({ error: "Records must be an array" });
    }

    // Check GPS limits with Master Global Switch
    const hasLocation = records.some((r: any) => r.location && (r.location.latitude || r.location.longitude));
    if (hasLocation) {
      const appConfig = await AppConfig.findOne();
      if (appConfig?.subscriptionsEnabled) {
        const tenant = await Tenant.findById(tenantId);
        if (getPlanRank(tenant?.plan) < 2) {
          return res.status(403).json({
            error: "GPS attendance is not available on your current plan. Upgrade to Super Plan to unlock this feature.",
            limitExceeded: true,
            plan: tenant?.plan || "free"
          });
        }
      }
    }

    const results = [];
    const affectedWorkerIds = new Set<string>();

    for (const record of records) {
      const { workerId, year, month, day, value, location, timestamp, projectId, overtimeHours, overtimeWage, dailyRate, customWage, finalPay } = record;

      if (workerId) affectedWorkerIds.add(String(workerId));

      const worker = await Worker.findById(workerId);
      const workerDailyRate = worker ? worker.dailyRate : 0;

      const dailyRateResolved = dailyRate !== undefined ? dailyRate : workerDailyRate;
      let customWageResolved = customWage;
      let overtimeWageResolved = overtimeWage;
      let overtimeHoursResolved = overtimeHours;
      let finalPayResolved = 0;

      const advanceAmount = (customWageResolved !== undefined && customWageResolved !== null) ? customWageResolved : 0;
      const otAmount = (overtimeWageResolved !== undefined && overtimeWageResolved !== null) ? overtimeWageResolved : 0;

      if (value === "OT") {
        finalPayResolved = dailyRateResolved + otAmount;
      } else if (value === "P") {
        finalPayResolved = dailyRateResolved;
        overtimeWageResolved = null as any;
        overtimeHoursResolved = null as any;
      } else if (value === "H") {
        finalPayResolved = dailyRateResolved / 2;
        overtimeWageResolved = null as any;
        overtimeHoursResolved = null as any;
      } else if (value === "A") {
        finalPayResolved = 0;
        customWageResolved = null as any;
        overtimeWageResolved = null as any;
        overtimeHoursResolved = null as any;
      } else if (typeof value === "number") {
        finalPayResolved = value;
        overtimeWageResolved = null as any;
        overtimeHoursResolved = null as any;
      } else {
        finalPayResolved = 0;
        overtimeWageResolved = null as any;
        overtimeHoursResolved = null as any;
      }

      const filter = { tenantId, workerId, year, month, day };
      const update = {
        tenantId,
        workerId,
        projectId,
        year,
        month,
        day,
        value,
        dailyRate: dailyRateResolved,
        customWage: customWageResolved ?? null,
        finalPay: finalPayResolved,
        overtimeHours: overtimeHoursResolved ?? null,
        overtimeWage: overtimeWageResolved ?? null,
        location,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      };

      const result = await Attendance.findOneAndUpdate(
        filter,
        update,
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      results.push(result);
    }

    // ── Broadcast batch sync to all affected workers and tenant ──
    try {
      const io = getIO();
      if (tenantId) {
        io.to(`tenant_${tenantId}`).emit("attendance:updated", { count: results.length });
      }
      for (const wId of affectedWorkerIds) {
        const workerDoc = await Worker.findById(wId);
        let targetUserId = workerDoc?.userId;
        if (!targetUserId && workerDoc?.uniqueId) {
          const u = await User.findOne({ uniqueId: workerDoc.uniqueId, role: { $in: ["labor", "worker"] } });
          if (u) {
            targetUserId = u._id;
            await Worker.findByIdAndUpdate(wId, { userId: u._id });
          }
        }
        if (targetUserId) {
          io.to(`user_${targetUserId}`).emit("attendance:updated", { count: results.length });
        }
        if (workerDoc?.uniqueId) {
          io.to(`worker_${workerDoc.uniqueId}`).emit("attendance:updated", { count: results.length });
        }
      }
      io.emit("admin_dashboard_update");
    } catch (socketErr) {
      console.warn("[Attendance Controller] syncAttendance socket broadcast error:", socketErr);
    }

    res.json({ success: true, count: results.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const clearAttendanceRecord = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = req.user?.role;
    if (role === "labor" || role === "worker") {
      return res.status(403).json({ error: "Forbidden: Workers cannot clear attendance." });
    }

    const tenantId = req.user?.tenantId;
    const { workerId, year, month, day, id } = { ...req.query, ...req.body };

    let targetWorkerIds: any[] = [];
    let workerDoc: any = null;

    if (id) {
      const existing = await Attendance.findById(id);
      if (existing) {
        workerDoc = await Worker.findById(existing.workerId);
        targetWorkerIds = [existing.workerId];
      }
    } else if (workerId) {
      targetWorkerIds = [workerId];
      workerDoc = await Worker.findById(workerId);
      if (workerDoc?.uniqueId) {
        const siblingWorkers = await Worker.find({ uniqueId: workerDoc.uniqueId }).select("_id").lean();
        siblingWorkers.forEach((w) => targetWorkerIds.push(w._id));
      }
    }

    let deleteFilter: any = {};
    if (id) {
      deleteFilter._id = id;
    } else if (workerId && year !== undefined && month !== undefined && day !== undefined) {
      const y = parseInt(year as string);
      const m = parseInt(month as string);
      const d = parseInt(day as string);
      const monthFilter = [m, m + 1, ...(m > 0 ? [m - 1] : [])];

      deleteFilter = {
        workerId: { $in: targetWorkerIds },
        year: y,
        month: { $in: monthFilter },
        day: d,
      };
    } else {
      return res.status(400).json({ error: "Missing required parameters: workerId, year, month, day (or id)" });
    }

    // Find all matching before deleting for logging & broadcast
    const matchingRecords = await Attendance.find(deleteFilter).lean();
    const deleteResult = await Attendance.deleteMany(deleteFilter);

    // Resolve worker to broadcast socket event
    let resolvedUserId = workerDoc?.userId;
    if (!resolvedUserId && workerDoc?.uniqueId) {
      const u = await User.findOne({ uniqueId: workerDoc.uniqueId, role: { $in: ["labor", "worker"] } });
      if (u) resolvedUserId = u._id;
    }

    try {
      const io = getIO();
      const payload = {
        workerId: workerId || workerDoc?._id,
        uniqueId: workerDoc?.uniqueId,
        year: year ? parseInt(year as string) : undefined,
        month: month !== undefined ? parseInt(month as string) : undefined,
        day: day ? parseInt(day as string) : undefined,
        cleared: true,
        deletedCount: deleteResult.deletedCount,
      };

      if (resolvedUserId) {
        io.to(`user_${resolvedUserId}`).emit("attendance:cleared", payload);
        io.to(`user_${resolvedUserId}`).emit("attendance:deleted", payload);
        io.to(`user_${resolvedUserId}`).emit("attendance:updated", payload);
      }
      if (workerDoc?.uniqueId) {
        io.to(`worker_${workerDoc.uniqueId}`).emit("attendance:cleared", payload);
        io.to(`worker_${workerDoc.uniqueId}`).emit("attendance:deleted", payload);
        io.to(`worker_${workerDoc.uniqueId}`).emit("attendance:updated", payload);
      }
      if (tenantId) {
        io.to(`tenant_${tenantId}`).emit("attendance:cleared", payload);
        io.to(`tenant_${tenantId}`).emit("attendance:deleted", payload);
        io.to(`tenant_${tenantId}`).emit("attendance:updated", payload);
      }
      io.emit("admin_dashboard_update");
    } catch (socketErr) {
      console.warn("[Attendance Controller] Socket emit on clear error:", socketErr);
    }

    logActivity({
      req,
      action: "ATTENDANCE_DELETED",
      targetType: "ATTENDANCE",
      targetId: (matchingRecords[0]?._id || workerId || "BATCH").toString(),
      changes: { before: matchingRecords }
    }).catch(() => {});

    res.json({
      success: true,
      message: "Attendance permanently cleared from database",
      deletedCount: deleteResult.deletedCount,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteAttendanceRecord = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = req.user?.role;
    if (role === "labor" || role === "worker") {
      return res.status(403).json({ error: "Forbidden: Workers cannot delete attendance." });
    }

    const tenantId = req.user?.tenantId;
    const { id } = req.params;

    const attendance = await Attendance.findOne({ _id: id, tenantId });
    if (!attendance) {
      return res.status(404).json({ error: "Attendance record not found" });
    }

    const before = attendance.toObject();
    await Attendance.findByIdAndDelete(id);

    // Resolve worker to broadcast socket event
    const worker = await Worker.findById(attendance.workerId);
    let resolvedUserId = worker?.userId;
    if (!resolvedUserId && worker?.uniqueId) {
      const u = await User.findOne({ uniqueId: worker.uniqueId, role: { $in: ["labor", "worker"] } });
      if (u) resolvedUserId = u._id;
    }

    try {
      const io = getIO();
      const payload = {
        attendanceId: attendance._id,
        workerId: attendance.workerId,
        uniqueId: worker?.uniqueId,
        year: attendance.year,
        month: attendance.month,
        day: attendance.day,
        cleared: true,
      };
      if (resolvedUserId) {
        io.to(`user_${resolvedUserId}`).emit("attendance:cleared", payload);
        io.to(`user_${resolvedUserId}`).emit("attendance:deleted", payload);
        io.to(`user_${resolvedUserId}`).emit("attendance:updated", payload);
      }
      if (worker?.uniqueId) {
        io.to(`worker_${worker.uniqueId}`).emit("attendance:cleared", payload);
        io.to(`worker_${worker.uniqueId}`).emit("attendance:deleted", payload);
        io.to(`worker_${worker.uniqueId}`).emit("attendance:updated", payload);
      }
      if (tenantId) {
        io.to(`tenant_${tenantId}`).emit("attendance:cleared", payload);
        io.to(`tenant_${tenantId}`).emit("attendance:deleted", payload);
        io.to(`tenant_${tenantId}`).emit("attendance:updated", payload);
      }
      io.emit("admin_dashboard_update");
    } catch (socketErr) {
      console.warn("[Attendance Controller] Socket emit on delete error:", socketErr);
    }

    logActivity({
      req,
      action: "ATTENDANCE_DELETED",
      targetType: "ATTENDANCE",
      targetId: id,
      changes: { before }
    }).catch(() => {});

    res.json({ success: true, message: "Attendance record deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Worker Personal Attendance & Summary
export const getMyAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { year, month } = req.query;

    const phoneDigits = user.phone ? String(user.phone).replace(/\D/g, "") : "";
    const cleanPhone = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : "";
    const phoneRegex = cleanPhone ? new RegExp(cleanPhone + "$") : null;

    const workerMatchCriteria: any[] = [
      { userId: user._id },
      ...(user.uniqueId ? [{ uniqueId: user.uniqueId }] : []),
      ...(phoneRegex ? [{ phone: phoneRegex }] : []),
      ...(user.phone ? [{ phone: user.phone }] : []),
      ...(user.name ? [{ name: new RegExp(`^${user.name.trim()}$`, "i") }] : []),
    ];

    // Find ALL worker documents across tenants
    const matchedWorkers = await Worker.find({
      $or: workerMatchCriteria,
    }).sort({ updatedAt: -1, createdAt: -1 });

    const workerIds = matchedWorkers.map((w) => w._id);
    const primaryWorker = matchedWorkers[0] || null;

    if (workerIds.length === 0) {
      return res.json({
        worker: {
          id: user._id,
          uniqueId: user.uniqueId || "",
          name: user.name,
          category: user.workerCategory || "Labour",
          dailyRate: user.dailyWage || 0,
          dailyWage: user.dailyWage || 0,
          contractorName: user.contractorName || "Contractor",
          contractorCompany: user.contractorCompany || "Company",
        },
        records: [],
        summary: {
          presentDays: 0,
          absentDays: 0,
          halfDays: 0,
          overtimeHours: 0,
          totalEarned: 0,
          advancePaid: 0,
          totalPaid: 0,
          netPayable: 0,
        },
      });
    }

    let query: any = { workerId: { $in: workerIds } };

    if (year) query.year = parseInt(year as string);
    if (month !== undefined && month !== null && month !== "") {
      const m = parseInt(month as string);
      query.month = { $in: [m, m + 1, ...(m > 0 ? [m - 1] : [])] };
    }

    const records = await Attendance.find(query).sort({ year: -1, month: -1, day: -1 }).lean();

    let presentDays = 0;
    let absentDays = 0;
    let halfDays = 0;
    let overtimeHours = 0;
    let totalEarned = 0;
    let advancePaid = 0;

    const defaultRate = primaryWorker?.dailyRate ?? user.dailyWage ?? 0;

    for (const rec of records) {
      const rate =
        rec.dailyRate !== undefined && rec.dailyRate !== null
          ? rec.dailyRate
          : defaultRate;
      const ot =
        rec.overtimeWage !== undefined && rec.overtimeWage !== null
          ? rec.overtimeWage
          : 0;

      let pay = 0;
      if (rec.value === "OT") {
        pay = rate + ot;
      } else if (rec.value === "P") {
        pay = rate;
      } else if (rec.value === "H") {
        pay = rate / 2;
      } else if (rec.value === "A") {
        pay = 0;
      } else if (typeof rec.value === "number") {
        pay = rec.value;
      }

      if (rec.value === "P") presentDays++;
      else if (rec.value === "A") absentDays++;
      else if (rec.value === "H") halfDays += 0.5;
      else if (rec.value === "OT") {
        presentDays++;
        overtimeHours += rec.overtimeHours || 0;
      }
      totalEarned += pay;
      if (rec.customWage && rec.customWage > 0) {
        advancePaid += rec.customWage;
      }
    }

    const paymentRecords = await Payment.find(query).lean();
    let totalPaid = 0;
    for (const p of paymentRecords) {
      totalPaid += p.amount || 0;
    }

    const netPayable = Math.max(0, totalEarned - advancePaid - totalPaid);

    return res.json({
      worker: {
        id: primaryWorker?._id || user._id,
        uniqueId: primaryWorker?.uniqueId || user.uniqueId || "",
        name: primaryWorker?.name || user.name,
        category: primaryWorker?.category || user.workerCategory || "Labour",
        dailyRate: primaryWorker?.dailyRate ?? user.dailyWage ?? 0,
        dailyWage: primaryWorker?.dailyRate ?? user.dailyWage ?? 0,
        contractorName: user.contractorName || "Contractor",
        contractorCompany: user.contractorCompany || "Company",
      },
      records,
      summary: {
        presentDays,
        absentDays,
        halfDays,
        overtimeHours,
        totalEarned,
        advancePaid,
        totalPaid,
        netPayable,
      },
    });
  } catch (error: any) {
    console.error("getMyAttendance error:", error);
    res.status(500).json({ error: error.message });
  }
};
