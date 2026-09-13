import { Response } from "express";
import { Attendance, AuditLog, User, Worker, Tenant, AppConfig, Payment } from "../models";
import { AuthenticatedRequest } from "../middleware/auth";
import { broadcastAdminActivity, getIO } from "../utils/socket";
import { logActivity } from "../services/activityLogger";
import { getPlanRank } from "../middleware/subscription";

export const getAttendanceForMonth = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: "Missing year or month parameters" });
    }

    const y = parseInt(year as string);
    const m = parseInt(month as string);

    // Support flexible month matching (both 0-indexed and 1-indexed)
    let monthFilter: any = m;
    if (m >= 1 && m <= 12) {
      monthFilter = { $in: [m, m - 1] };
    } else if (m === 0) {
      monthFilter = { $in: [0, 1] };
    }

    let query: any = {
      tenantId,
      year: y,
      month: monthFilter,
    };

    if (req.user?.role === "labor" || req.user?.role === "worker") {
      const user = await User.findById(req.user.id);
      let worker = null;
      if (tenantId) {
        worker = await Worker.findOne({
          tenantId,
          $or: [
            { userId: user?._id },
            ...(user?.uniqueId ? [{ uniqueId: user.uniqueId }] : []),
            ...(user?.phone ? [{ phone: user.phone }] : []),
            ...(user?.name ? [{ name: user.name }] : []),
          ],
        });
      }
      if (!worker) {
        worker = await Worker.findOne({
          $or: [
            { userId: user?._id },
            ...(user?.uniqueId ? [{ uniqueId: user.uniqueId }] : []),
            ...(user?.phone ? [{ phone: user.phone }] : []),
            ...(user?.name ? [{ name: user.name }] : []),
          ],
        });
      }
      if (!worker) {
        return res.json([]);
      }
      query.workerId = worker._id;
    } else if (req.user?.role === "supervisor") {
      const supervisor = await User.findById(req.user.id);
      const assignedProjects = supervisor?.assignedProjects || [];
      const workers = await Worker.find({ tenantId, isArchived: false, projectId: { $in: assignedProjects } });
      const workerIds = workers.map(w => w._id);
      query.workerId = { $in: workerIds };
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
            plan: tenant?.plan || "free"
          });
        }
      }
    }

    const worker = await Worker.findById(workerId).select("dailyRate").lean();
    const workerDailyRate = worker ? worker.dailyRate : 0;

    const dailyRateResolved = req.body.dailyRate !== undefined ? req.body.dailyRate : workerDailyRate;
    let customWageResolved = req.body.customWage;
    let overtimeWageResolved = overtimeWage;
    let overtimeHoursResolved = overtimeHours;
    let finalPayResolved = 0;

    const advanceAmount = (customWageResolved !== undefined && customWageResolved !== null) ? customWageResolved : 0;
    const otAmount = (overtimeWageResolved !== undefined && overtimeWageResolved !== null) ? overtimeWageResolved : 0;

    if (value === "P" || value === "OT") {
      finalPayResolved = dailyRateResolved + advanceAmount + otAmount;
    } else if (value === "H") {
      finalPayResolved = (dailyRateResolved / 2) + advanceAmount + otAmount;
    } else if (value === "A") {
      finalPayResolved = 0;
      customWageResolved = undefined;
      overtimeWageResolved = undefined;
      overtimeHoursResolved = undefined;
    } else if (typeof value === "number") {
      finalPayResolved = value;
    } else {
      finalPayResolved = 0;
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
      customWage: customWageResolved,
      finalPay: finalPayResolved,
      overtimeHours: overtimeHoursResolved,
      overtimeWage: overtimeWageResolved,
      location,
      timestamp: new Date(),
    };

    const record = await Attendance.findOneAndUpdate(
      filter,
      update,
      { new: true, upsert: true }
    );

    // ── Real-time Socket Broadcast to Worker & Tenant ──
    try {
      const io = getIO();
      const workerDoc = await Worker.findById(workerId).select("userId uniqueId tenantId");
      const payload = {
        attendanceId: record._id,
        workerId: record.workerId,
        uniqueId: workerDoc?.uniqueId,
        year: record.year,
        month: record.month,
        day: record.day,
        value: record.value,
        finalPay: record.finalPay,
        dailyRate: record.dailyRate,
        timestamp: record.timestamp,
      };
      if (workerDoc?.userId) {
        io.to(`user_${workerDoc.userId}`).emit("attendance:recorded", payload);
        io.to(`user_${workerDoc.userId}`).emit("attendance:updated", payload);
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
    for (const record of records) {
      const { workerId, year, month, day, value, location, timestamp, projectId, overtimeHours, overtimeWage, dailyRate, customWage, finalPay } = record;

      const worker = await Worker.findById(workerId);
      const workerDailyRate = worker ? worker.dailyRate : 0;

      const dailyRateResolved = dailyRate !== undefined ? dailyRate : workerDailyRate;
      let customWageResolved = customWage;
      let overtimeWageResolved = overtimeWage;
      let overtimeHoursResolved = overtimeHours;
      let finalPayResolved = 0;

      const advanceAmount = (customWageResolved !== undefined && customWageResolved !== null) ? customWageResolved : 0;
      const otAmount = (overtimeWageResolved !== undefined && overtimeWageResolved !== null) ? overtimeWageResolved : 0;

      if (value === "P" || value === "OT") {
        finalPayResolved = dailyRateResolved + advanceAmount + otAmount;
      } else if (value === "H") {
        finalPayResolved = (dailyRateResolved / 2) + advanceAmount + otAmount;
      } else if (value === "A") {
        finalPayResolved = 0;
        customWageResolved = undefined;
        overtimeWageResolved = undefined;
        overtimeHoursResolved = undefined;
      } else if (typeof value === "number") {
        finalPayResolved = value;
      } else {
        finalPayResolved = 0;
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
        customWage: customWageResolved,
        finalPay: finalPayResolved,
        overtimeHours: overtimeHoursResolved,
        overtimeWage: overtimeWageResolved,
        location,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      };

      const result = await Attendance.findOneAndUpdate(
        filter,
        update,
        { new: true, upsert: true }
      );
      results.push(result);
    }

    res.json({ success: true, count: results.length });
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
    const userId = req.user?.id;
    const { id } = req.params;

    const attendance = await Attendance.findOne({ _id: id, tenantId });
    if (!attendance) {
      return res.status(404).json({ error: "Attendance record not found" });
    }

    const before = attendance.toObject();
    await Attendance.findByIdAndDelete(id);

    await logActivity({
      req,
      action: "ATTENDANCE_DELETED",
      targetType: "ATTENDANCE",
      targetId: id,
      changes: { before }
    });

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

    // Find linked worker record in user's tenant or global fallback
    let worker = null;
    if (user.tenantId) {
      worker = await Worker.findOne({
        tenantId: user.tenantId,
        $or: [
          { userId: user._id },
          ...(user.uniqueId ? [{ uniqueId: user.uniqueId }] : []),
          ...(user.phone ? [{ phone: user.phone }] : []),
          ...(user.name ? [{ name: user.name }] : []),
        ],
      });
    }
    if (!worker) {
      worker = await Worker.findOne({
        $or: [
          { userId: user._id },
          ...(user.uniqueId ? [{ uniqueId: user.uniqueId }] : []),
          ...(user.phone ? [{ phone: user.phone }] : []),
          ...(user.name ? [{ name: user.name }] : []),
        ],
      });
    }
    if (!worker) {
      return res.json({
        worker: null,
        records: [],
        summary: {
          presentDays: 0,
          absentDays: 0,
          halfDays: 0,
          overtimeHours: 0,
          totalEarned: 0,
          advancePaid: 0,
          netPayable: 0,
        },
      });
    }

    let query: any = { workerId: worker._id };

    if (year) query.year = parseInt(year as string);
    if (month !== undefined && month !== null && month !== "") {
      const m = parseInt(month as string);
      if (m >= 1 && m <= 12) {
        query.month = { $in: [m, m - 1] };
      } else if (m === 0) {
        query.month = { $in: [0, 1] };
      } else {
        query.month = m;
      }
    }

    const records = await Attendance.find(query).sort({ year: -1, month: -1, day: -1 }).lean();

    let presentDays = 0;
    let absentDays = 0;
    let halfDays = 0;
    let overtimeHours = 0;
    let totalEarned = 0;
    let advancePaid = 0;

    for (const rec of records) {
      const rate =
        rec.dailyRate !== undefined && rec.dailyRate !== null
          ? rec.dailyRate
          : worker.dailyRate || 0;
      const adv =
        rec.customWage !== undefined && rec.customWage !== null
          ? rec.customWage
          : 0;
      const ot =
        rec.overtimeWage !== undefined && rec.overtimeWage !== null
          ? rec.overtimeWage
          : 0;

      let pay = 0;
      if (rec.finalPay !== undefined && rec.finalPay !== null) {
        pay = rec.finalPay;
      } else {
        if (rec.value === "P" || rec.value === "OT") {
          pay = rate + adv + ot;
        } else if (rec.value === "H") {
          pay = rate / 2 + adv + ot;
        } else if (typeof rec.value === "number") {
          pay = rec.value;
        }
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
    for (const p of paymentRecords) {
      advancePaid += p.amount || 0;
    }

    return res.json({
      worker: {
        id: worker._id,
        uniqueId: worker.uniqueId || user.uniqueId || "",
        name: worker.name,
        category: worker.category,
        dailyRate: worker.dailyRate,
        dailyWage: worker.dailyRate,
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
        netPayable: Math.max(0, totalEarned - advancePaid),
      },
    });
  } catch (error: any) {
    console.error("getMyAttendance error:", error);
    res.status(500).json({ error: error.message });
  }
};
