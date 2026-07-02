import { Response } from "express";
import { Attendance, AuditLog, User, Worker, Tenant } from "../models";
import { AuthenticatedRequest } from "../middleware/auth";
import { broadcastAdminActivity } from "../utils/socket";

export const getAttendanceForMonth = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: "Missing year or month parameters" });
    }

    let query: any = {
      tenantId,
      year: parseInt(year as string),
      month: parseInt(month as string),
    };

    if (req.user?.role === "supervisor") {
      const supervisor = await User.findById(req.user.id);
      const assignedProjects = supervisor?.assignedProjects || [];
      const workers = await Worker.find({ tenantId, isArchived: false, projectId: { $in: assignedProjects } });
      const workerIds = workers.map(w => w._id);
      query.workerId = { $in: workerIds };
    }

    const records = await Attendance.find(query);
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const setAttendanceRecord = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { workerId, year, month, day, value, location, projectId, overtimeHours, overtimeWage } = req.body;

    if (!workerId || year === undefined || month === undefined || day === undefined || value === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check GPS limits
    if (location && (location.latitude || location.longitude)) {
      const tenant = await Tenant.findById(tenantId);
      if (tenant?.plan === "free") {
        return res.status(403).json({
          error: "GPS attendance is not available on the Free Plan. Upgrade to Professional Plan to unlock this feature.",
          limitExceeded: true,
          plan: "free"
        });
      }
    }

    const worker = await Worker.findById(workerId);
    const workerDailyRate = worker ? worker.dailyRate : 0;

    const dailyRateResolved = req.body.dailyRate !== undefined ? req.body.dailyRate : workerDailyRate;
    let customWageResolved = req.body.customWage;
    let finalPayResolved = 0;

    const extraWage = (customWageResolved !== undefined && customWageResolved !== null) ? customWageResolved : 0;

    if (value === "P" || value === "OT") {
      finalPayResolved = dailyRateResolved;
    } else if (value === "H") {
      finalPayResolved = (dailyRateResolved / 2);
    } else if (value === "A") {
      finalPayResolved = 0;
    } else if (typeof value === "number") {
      customWageResolved = value;
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
      overtimeHours,
      overtimeWage,
      location,
      timestamp: new Date(),
    };

    const beforeRecord = await Attendance.findOne(filter);
    const before = beforeRecord ? beforeRecord.toObject() : null;

    const record = await Attendance.findOneAndUpdate(
      filter,
      update,
      { new: true, upsert: true }
    );

    const auditLog = new AuditLog({
      tenantId,
      userId,
      action: before ? "UPDATE" : "CREATE",
      targetType: "ATTENDANCE",
      targetId: record._id.toString(),
      changes: { before, after: record.toObject() },
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const syncAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { records } = req.body;

    if (!Array.isArray(records)) {
      return res.status(400).json({ error: "Records must be an array" });
    }

    // Check GPS limits
    const hasLocation = records.some((r: any) => r.location && (r.location.latitude || r.location.longitude));
    if (hasLocation) {
      const tenant = await Tenant.findById(tenantId);
      if (tenant?.plan === "free") {
        return res.status(403).json({
          error: "GPS attendance is not available on the Free Plan. Upgrade to Professional Plan to unlock this feature.",
          limitExceeded: true,
          plan: "free"
        });
      }
    }

    const results = [];
    for (const record of records) {
      const { workerId, year, month, day, value, location, timestamp, projectId, overtimeHours, overtimeWage, dailyRate, customWage, finalPay } = record;

      const worker = await Worker.findById(workerId);
      const workerDailyRate = worker ? worker.dailyRate : 0;

      const dailyRateResolved = dailyRate !== undefined ? dailyRate : workerDailyRate;
      let customWageResolved = customWage;
      let finalPayResolved = 0;

      const extraWage = (customWageResolved !== undefined && customWageResolved !== null) ? customWageResolved : 0;

      if (value === "P" || value === "OT") {
        finalPayResolved = dailyRateResolved;
      } else if (value === "H") {
        finalPayResolved = (dailyRateResolved / 2);
      } else if (value === "A") {
        finalPayResolved = 0;
      } else if (typeof value === "number") {
        customWageResolved = value;
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
        overtimeHours,
        overtimeWage,
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
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { id } = req.params;

    const attendance = await Attendance.findOne({ _id: id, tenantId });
    if (!attendance) {
      return res.status(404).json({ error: "Attendance record not found" });
    }

    const before = attendance.toObject();
    await Attendance.findByIdAndDelete(id);

    const auditLog = new AuditLog({
      tenantId,
      userId,
      action: "DELETE",
      targetType: "ATTENDANCE",
      targetId: id,
      changes: { before },
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.json({ success: true, message: "Attendance record deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
