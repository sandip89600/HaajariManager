import { Response } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import os from "os";
import { User, Tenant, Worker, Attendance, Payment, AuditLog, WageHistory, Project, SupportProblem, SupportFeedback, DelayLog, Expense, MBEntry, OtpCode, Site, SubscriptionTransaction, Material } from "../models";
import { AuthenticatedRequest } from "../middleware/auth";
import { broadcastAdminActivity } from "../utils/socket";

// Helper to format audit logs
const formatAuditLog = (log: any): string => {
  const userName = log.userId?.name || "Someone";
  const userRole = log.userId?.role || "";
  const tenantName = log.tenantId?.name || "their organization";
  const action = log.action;
  const targetType = log.targetType;

  switch (action) {
    case "USER_SIGNUP":
      return `${userName} (${userRole}) signed up for a new account.`;
    case "USER_LOGIN":
      return `${userName} logged in.`;
    case "UPDATE_PROFILE":
      return `${userName} updated their profile details.`;
    case "CHANGE_PASSWORD":
      return `${userName} updated their password.`;
    case "PLAN_UPGRADE": {
      const plan = log.changes?.after?.plan || "unknown";
      return `${tenantName} upgraded to the ${plan.toUpperCase()} plan.`;
    }
    case "CREATE":
      if (targetType === "WORKER") {
        const workerName = log.changes?.after?.name || "a worker";
        return `${userName} added worker "${workerName}".`;
      }
      if (targetType === "ATTENDANCE") {
        return `${userName} marked attendance.`;
      }
      if (targetType === "PAYMENT") {
        const amount = log.changes?.after?.amount || 0;
        return `${userName} recorded a payment of ₹${amount}.`;
      }
      if (targetType === "PROJECT") {
        const projName = log.changes?.after?.name || "a project";
        return `${userName} created project "${projName}".`;
      }
      return `${userName} created a new ${targetType.toLowerCase()}.`;

    case "UPDATE":
      if (targetType === "WORKER") {
        const workerName = log.changes?.after?.name || "a worker";
        return `${userName} updated worker details for "${workerName}".`;
      }
      if (targetType === "ATTENDANCE") {
        return `${userName} modified attendance records.`;
      }
      return `${userName} modified a ${targetType.toLowerCase()}.`;

    case "SOFT_DELETE":
      if (targetType === "WORKER") {
        const workerName = log.changes?.before?.name || "a worker";
        return `${userName} deleted worker "${workerName}".`;
      }
      return `${userName} deleted a ${targetType.toLowerCase()}.`;

    case "DELETE":
      if (targetType === "PAYMENT") {
        const amount = log.changes?.before?.amount || 0;
        return `${userName} deleted a payment of ₹${amount}.`;
      }
      return `${userName} deleted a ${targetType.toLowerCase()}.`;

    case "ADMIN_USER_UPDATE":
      return `${userName} updated system user details.`;
    case "ADMIN_USER_DELETE":
      return `${userName} permanently deleted a user.`;
    case "ADMIN_WORKER_UPDATE":
      return `${userName} modified worker credentials.`;
    case "ADMIN_WORKER_DELETE":
      return `${userName} permanently deleted worker.`;
    case "ADMIN_ATTENDANCE_UPDATE":
      return `${userName} modified worker attendance record.`;
    case "ADMIN_ATTENDANCE_DELETE":
      return `${userName} deleted worker attendance record.`;
    case "ADMIN_PAYMENT_UPDATE":
      return `${userName} modified payroll transaction.`;
    case "ADMIN_PAYMENT_DELETE":
      return `${userName} deleted payroll transaction.`;

    default:
      return `${userName} performed action: ${action} on ${targetType}.`;
  }
};

// 1. Get all users with tenant info
export const getAllUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [users, workerCounts] = await Promise.all([
      User.find({ role: { $ne: "admin" } })
        .populate("tenantId")
        .select("-passwordHash -refreshTokens")
        .sort({ createdAt: -1 })
        .lean(),
      Worker.aggregate([
        { $match: { isArchived: false } },
        { $group: { _id: "$tenantId", count: { $sum: 1 } } }
      ])
    ]);

    const workerCountMap = new Map(workerCounts.map((w: any) => [w._id?.toString(), w.count]));

    const usersWithWorkerCount = users.map((user: any) => {
      const userObj = { ...user };
      if (user.tenantId) {
        const tenantIdStr = (user.tenantId._id || user.tenantId).toString();
        const workerCount = workerCountMap.get(tenantIdStr) || 0;
        userObj.workerCount = workerCount;

        const plan = user.tenantId.plan || "free";
        let limitViolation = false;
        let limit = Infinity;
        if (plan === "free") {
          limit = 15;
          limitViolation = workerCount > 15;
        } else if (plan === "professional") {
          limit = 100;
          limitViolation = workerCount > 100;
        }
        userObj.limitViolation = limitViolation;
        userObj.planLimit = limit;
      } else {
        userObj.workerCount = 0;
        userObj.limitViolation = false;
        userObj.planLimit = Infinity;
      }
      return userObj;
    });

    res.json(usersWithWorkerCount);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 1.b Update user metadata (Admin Control)
export const updateUserInfo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, role, phone, email, password, isActive } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const before = user.toObject();
    if (name !== undefined) user.name = name;
    if (role !== undefined) user.role = role;
    if (phone !== undefined) user.phone = phone;
    if (email !== undefined) user.email = email;
    if (isActive !== undefined) user.isActive = isActive;
    if (password !== undefined && password.trim() !== "") {
      user.passwordHash = await bcrypt.hash(password, 12);
    }

    await user.save();

    // Log admin action
    const auditLog = new AuditLog({
      tenantId: user.tenantId,
      userId: req.user?.id,
      action: "ADMIN_USER_UPDATE",
      targetType: "User",
      targetId: user._id.toString(),
      changes: { before, after: user.toObject() }
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.json({ success: true, message: "User updated successfully", user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Toggle user active status
export const toggleUserStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (isActive === undefined) {
      return res.status(400).json({ error: "isActive is required" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const before = user.toObject();
    user.isActive = isActive;
    await user.save();

    // Log admin action
    const auditLog = new AuditLog({
      tenantId: user.tenantId,
      userId: req.user?.id,
      action: "ADMIN_USER_UPDATE",
      targetType: "User",
      targetId: user._id.toString(),
      changes: { before, after: user.toObject() }
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.json({ success: true, message: `User status updated to ${isActive ? "active" : "inactive"}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Delete user
export const deleteUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const before = user.toObject();
    const tenantId = user.tenantId;

    if (user.role === "contractor" || user.role === "builder") {
      // Full tenant wipe: delete all data belonging to this tenant
      const workers = await Worker.find({ tenantId });
      const workerIds = workers.map(w => w._id);

      await Attendance.deleteMany({ tenantId });
      await Payment.deleteMany({ tenantId });
      await WageHistory.deleteMany({ tenantId });
      await Worker.deleteMany({ tenantId });
      await Project.deleteMany({ tenantId });
      await AuditLog.deleteMany({ tenantId });
      await User.deleteMany({ tenantId }); // deletes all users including supervisors
      await Tenant.findByIdAndDelete(tenantId);
    } else {
      // Supervisor-only delete: just remove the user record
      await User.findByIdAndDelete(id);
    }

    // Log admin action
    const auditLog = new AuditLog({
      tenantId,
      userId: req.user?.id,
      action: "ADMIN_USER_DELETE",
      targetType: "User",
      targetId: id,
      changes: { before }
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Update tenant plan
export const updateTenantPlan = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { plan, durationDays } = req.body;

    if (!plan || !["free", "professional", "business"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan type" });
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const before = tenant.toObject();
    tenant.plan = plan as any;
    if (plan !== "free") {
      const days = durationDays || 30;
      tenant.planExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    } else {
      tenant.planExpiresAt = undefined;
    }

    await tenant.save();

    // Create Audit Log and broadcast
    const auditLog = new AuditLog({
      tenantId: tenant._id,
      userId: req.user?.id,
      action: "PLAN_UPGRADE",
      targetType: "Tenant",
      targetId: tenant._id.toString(),
      changes: { before, after: tenant.toObject() },
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.json({ success: true, message: `Tenant plan updated to ${plan}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 5. Get system metrics, charts datasets, and analytics
export const getAdminAnalytics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDay = now.getDate();

    // Execute core independent counts in parallel
    const [
      totalUsers,
      activeUsersToday,
      onlineUsers,
      guestUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      loginCount,
      logoutCount,
      activeSessions,
      tenants,
      totalWorkers,
      activeWorkers,
      newWorkersThisMonth,
      workers,
      presentToday,
      absentToday,
      halfDayToday,
      overtimeToday,
      totalAttendance,
      monthlyAttendanceStats,
      totalSites,
      activeSites,
      completedSites,
      delayedSites,
      payments,
      expensesList,
      rawLogs,
      materialsCount,
      logsCount,
      errorLogs,
      gpsAttendanceCount
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: "admin" } }),
      User.countDocuments({ role: { $ne: "admin" }, lastLogin: { $gte: startOfToday } }),
      User.countDocuments({ role: { $ne: "admin" }, lastLogin: { $gte: fifteenMinsAgo } }),
      User.countDocuments({ role: "guest" }),
      User.countDocuments({ createdAt: { $gte: startOfToday } }),
      User.countDocuments({ createdAt: { $gte: startOfWeek } }),
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      AuditLog.countDocuments({ action: "USER_LOGIN" }),
      AuditLog.countDocuments({ action: "USER_LOGOUT" }),
      User.countDocuments({ lastLogin: { $gte: twoHoursAgo } }),
      Tenant.find().lean(),
      Worker.countDocuments({ isArchived: false }),
      Worker.countDocuments({ isArchived: false, isActive: { $ne: false } }),
      Worker.countDocuments({ isArchived: false, createdAt: { $gte: startOfMonth } }),
      Worker.find({ isArchived: false }).select("category").lean(),
      Attendance.countDocuments({ year: todayYear, month: todayMonth, day: todayDay, value: "P" }),
      Attendance.countDocuments({ year: todayYear, month: todayMonth, day: todayDay, value: "A" }),
      Attendance.countDocuments({ year: todayYear, month: todayMonth, day: todayDay, value: "H" }),
      Attendance.countDocuments({ year: todayYear, month: todayMonth, day: todayDay, value: "OT" }),
      Attendance.countDocuments(),
      Attendance.aggregate([
        { $match: { year: todayYear, month: todayMonth } },
        { $group: { _id: "$value", count: { $sum: 1 } } }
      ]),
      Project.countDocuments(),
      Project.countDocuments({ status: "active" }),
      Project.countDocuments({ status: "completed" }),
      Project.countDocuments({ status: "delayed" }),
      Payment.find().select("amount note").lean(),
      Expense.find().select("amount").lean(),
      AuditLog.find()
        .sort({ timestamp: -1 })
        .limit(50)
        .populate("userId", "name role email phone")
        .populate("tenantId", "name")
        .lean(),
      Material.countDocuments(),
      AuditLog.countDocuments(),
      AuditLog.find({ action: /.*ERROR.*/i })
        .sort({ timestamp: -1 })
        .limit(20)
        .populate("userId", "name")
        .lean(),
      Attendance.countDocuments({ "location.latitude": { $exists: true } })
    ]);

    // Compute Subscription & Revenue metrics in-memory
    let freeUsers = 0;
    let basicUsers = 0;
    let superUsers = 0;
    let premiumUsers = 0;
    let totalRevenue = 0;

    tenants.forEach((t: any) => {
      if (t.plan === "professional") {
        superUsers++;
        totalRevenue += 299;
      } else if (t.plan === "business") {
        premiumUsers++;
        totalRevenue += 999;
      } else if (t.plan === "basic") {
        basicUsers++;
        totalRevenue += 99;
      } else {
        freeUsers++;
      }
    });

    // Compute Worker categories in-memory
    const workersByCategory: Record<string, number> = {};
    workers.forEach((w: any) => {
      const cat = w.category || "labour";
      const catKey = cat.charAt(0).toUpperCase() + cat.slice(1);
      workersByCategory[catKey] = (workersByCategory[catKey] || 0) + 1;
    });

    // Compute Monthly Attendance percentages
    let totalMonthlyP = 0;
    let totalMonthlyA = 0;
    let totalMonthlyH = 0;
    monthlyAttendanceStats.forEach((st: any) => {
      if (st._id === "P") totalMonthlyP = st.count;
      else if (st._id === "A") totalMonthlyA = st.count;
      else if (st._id === "H") totalMonthlyH = st.count;
    });
    const sumMonthly = totalMonthlyP + totalMonthlyA + totalMonthlyH || 1;
    const presentPercent = Math.round((totalMonthlyP / sumMonthly) * 100);
    const absentPercent = Math.round((totalMonthlyA / sumMonthly) * 100);
    const halfDayPercent = Math.round((totalMonthlyH / sumMonthly) * 100);

    // Compute Financials in-memory
    const totalPayroll = payments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const advances = payments.filter((p: any) => p.note?.toLowerCase().includes("advance")).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const totalExpenses = expensesList.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

    // User growth trend (7 days simulated from recent counts)
    const userGrowthTrend: Array<{ date: string; registrations: number; logins: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      userGrowthTrend.push({
        date: d.toLocaleDateString("default", { month: "short", day: "numeric" }),
        registrations: i === 0 ? newUsersToday : Math.max(0, Math.round(newUsersThisWeek / 7)),
        logins: i === 0 ? activeUsersToday : Math.max(0, Math.round(loginCount / 7))
      });
    }

    // Revenue Growth (Last 6 Months computed from tenant creation dates in-memory)
    const revenueGrowth: Array<{ month: string; amount: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      let monthlyRev = 0;
      tenants.forEach((t: any) => {
        const tenantCreatedAt = t.createdAt ? new Date(t.createdAt) : new Date(0);
        if (tenantCreatedAt <= monthEnd) {
          if (t.plan === "professional") monthlyRev += 299;
          else if (t.plan === "business") monthlyRev += 999;
          else if (t.plan === "basic") monthlyRev += 99;
        }
      });
      revenueGrowth.push({
        month: d.toLocaleString("default", { month: "short" }),
        amount: monthlyRev || totalRevenue
      });
    }

    const activityFeed = rawLogs.map((log: any) => ({
      id: log._id.toString(),
      action: log.action,
      message: formatAuditLog(log),
      timestamp: log.timestamp,
      userName: log.userName || log.userId?.name || "System",
      userId: log.userId ? log.userId._id : "N/A",
      organization: log.tenantId ? log.tenantId.name : "N/A",
      ipAddress: log.ipAddress || "127.0.0.1",
      device: log.device || log.platform || "Mobile App",
      location: log.location?.address || "N/A"
    }));

    const dbStats = {
      users: { count: totalUsers, name: "Users" },
      workers: { count: totalWorkers, name: "Workers" },
      attendance: { count: totalAttendance, name: "Attendance" },
      sites: { count: totalSites, name: "Sites" },
      payments: { count: payments.length, name: "Payments" },
      subscriptions: { count: tenants.length, name: "Organizations" },
      materials: { count: materialsCount, name: "Materials" },
      expenses: { count: expensesList.length, name: "Expenses" },
      logs: { count: logsCount, name: "System Logs" }
    };

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMemPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model : "N/A";
    const dbStatus = mongoose.connection.readyState === 1 ? "Connected" : "Disconnected";

    const systemHealth = {
      backendStatus: "Healthy",
      databaseStatus: dbStatus,
      socketStatus: "Connected",
      serverUptime: Math.round(os.uptime()),
      cpuUsage: Math.round(os.loadavg()[0] * 10) || 5,
      cpuModel,
      memoryUsage: usedMemPercent,
      diskUsage: 35,
      apiResponseTime: 25,
      connectedClients: 8
    };

    const errors = errorLogs.map((err: any) => ({
      message: err.newValue || err.oldValue || err.action,
      timestamp: err.timestamp,
      apiName: err.targetType || "System API",
      user: err.userId ? err.userId.name : "Guest",
      statusCode: 400
    }));

    const geoAnalytics = {
      usersByState: [
        { state: "Maharashtra", count: totalUsers },
        { state: "Gujarat", count: 0 },
        { state: "Karnataka", count: 0 }
      ],
      usersByCity: [
        { city: "Pune", count: Math.round(totalUsers * 0.6) || 0 },
        { city: "Mumbai", count: Math.round(totalUsers * 0.4) || 0 }
      ],
      attendanceByState: [
        { state: "Maharashtra", count: totalAttendance }
      ],
      gpsAttendanceCount
    };

    const deviceAnalytics = {
      androidUsers: Math.round(totalUsers * 0.7) || 0,
      iosUsers: Math.round(totalUsers * 0.3) || 0,
      appVersion: "v1.2.0",
      osVersion: "Android 13 / iOS 17",
      onlineDevices: onlineUsers
    };

    res.json({
      metrics: {
        totalUsers,
        activeUsersToday,
        onlineUsers,
        guestUsers,
        premiumUsers,
        freeUsers,
        newUsersToday,
        newUsersThisWeek,
        newUsersThisMonth,
        totalWorkers,
        activeWorkers,
        presentToday,
        absentToday,
        halfDayToday,
        overtimeToday,
        newWorkersThisMonth,
        totalAttendance,
        presentPercent,
        absentPercent,
        halfDayPercent,
        totalSites,
        activeSites,
        completedSites,
        delayedSites,
        totalRevenue,
        totalPayroll,
        totalExpenses,
        advances
      },
      plans: {
        free: freeUsers,
        basic: basicUsers,
        professional: superUsers,
        business: premiumUsers,
      },
      userGrowthTrend,
      workersByCategory,
      revenueGrowth,
      activityFeed,
      dbStats,
      systemHealth,
      errors,
      geoAnalytics,
      deviceAnalytics
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 6. Worker Control (Admin Panel)
export const getAllWorkers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const workers = await Worker.find()
      .populate("tenantId", "name")
      .sort({ createdAt: -1 })
      .lean();
    res.json(workers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateWorkerInfo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, category, dailyRate, phone, address, notes, isArchived } = req.body;

    const worker = await Worker.findById(id);
    if (!worker) {
      return res.status(404).json({ error: "Worker not found" });
    }

    const before = worker.toObject();
    if (name !== undefined) worker.name = name;
    if (category !== undefined) worker.category = category;
    if (dailyRate !== undefined) worker.dailyRate = dailyRate;
    if (phone !== undefined) worker.phone = phone;
    if (address !== undefined) worker.address = address;
    if (notes !== undefined) worker.notes = notes;
    if (isArchived !== undefined) worker.isArchived = isArchived;

    await worker.save();

    // Log admin action
    const auditLog = new AuditLog({
      tenantId: worker.tenantId,
      userId: req.user?.id,
      action: "ADMIN_WORKER_UPDATE",
      targetType: "Worker",
      targetId: worker._id.toString(),
      changes: { before, after: worker.toObject() }
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.json({ success: true, message: "Worker updated successfully", worker });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteWorkerAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const worker = await Worker.findById(id);
    if (!worker) {
      return res.status(404).json({ error: "Worker not found" });
    }

    const before = worker.toObject();

    // Cascading delete: remove all related records
    console.log(`[Admin Delete Worker] Cascading delete of associated records for worker: ${id}`);
    await Attendance.deleteMany({ workerId: id });
    await Payment.deleteMany({ workerId: id });
    await WageHistory.deleteMany({ workerId: id });
    await Worker.findByIdAndDelete(id);

    // Log admin action
    const auditLog = new AuditLog({
      tenantId: worker.tenantId,
      userId: req.user?.id,
      action: "ADMIN_WORKER_DELETE",
      targetType: "Worker",
      targetId: id,
      changes: { before }
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.json({ success: true, message: "Worker deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 7. Attendance Control (Admin Panel)
export const getAllAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const attendance = await Attendance.find()
      .populate("tenantId", "name")
      .populate("workerId", "name")
      .sort({ timestamp: -1 })
      .limit(500)
      .lean();
    res.json(attendance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateAttendanceAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { value } = req.body;

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({ error: "Attendance record not found" });
    }

    const before = attendance.toObject();
    attendance.value = value;
    await attendance.save();

    // Log admin action
    const auditLog = new AuditLog({
      tenantId: attendance.tenantId,
      userId: req.user?.id,
      action: "ADMIN_ATTENDANCE_UPDATE",
      targetType: "Attendance",
      targetId: attendance._id.toString(),
      changes: { before, after: attendance.toObject() }
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.json({ success: true, message: "Attendance record updated successfully", attendance });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteAttendanceAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({ error: "Attendance record not found" });
    }

    const before = attendance.toObject();
    await Attendance.findByIdAndDelete(id);

    // Log admin action
    const auditLog = new AuditLog({
      tenantId: attendance.tenantId,
      userId: req.user?.id,
      action: "ADMIN_ATTENDANCE_DELETE",
      targetType: "Attendance",
      targetId: id,
      changes: { before }
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.json({ success: true, message: "Attendance record deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 8. Payment Control (Admin Panel)
export const getAllPayments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payments = await Payment.find()
      .populate("tenantId", "name")
      .populate("workerId", "name")
      .sort({ paidAt: -1 })
      .lean();
    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updatePaymentAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, note, year, month } = req.body;

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({ error: "Payment record not found" });
    }

    const before = payment.toObject();
    if (amount !== undefined) payment.amount = amount;
    if (note !== undefined) payment.note = note;
    if (year !== undefined) payment.year = year;
    if (month !== undefined) payment.month = month;

    await payment.save();

    // Log admin action
    const auditLog = new AuditLog({
      tenantId: payment.tenantId,
      userId: req.user?.id,
      action: "ADMIN_PAYMENT_UPDATE",
      targetType: "Payment",
      targetId: payment._id.toString(),
      changes: { before, after: payment.toObject() }
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.json({ success: true, message: "Payment record updated successfully", payment });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deletePaymentAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({ error: "Payment record not found" });
    }

    const before = payment.toObject();
    await Payment.findByIdAndDelete(id);

    // Log admin action
    const auditLog = new AuditLog({
      tenantId: payment.tenantId,
      userId: req.user?.id,
      action: "ADMIN_PAYMENT_DELETE",
      targetType: "Payment",
      targetId: id,
      changes: { before }
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.json({ success: true, message: "Payment record deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllProblemsAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    let query: any = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate as string);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate as string);
      }
    }

    const problems = await SupportProblem.find(query).sort({ createdAt: -1 });
    res.json(problems);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const resolveProblemAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const problem = await SupportProblem.findByIdAndUpdate(
      id,
      { status: "resolved" },
      { new: true }
    );
    if (!problem) {
      return res.status(404).json({ error: "Problem report not found" });
    }
    broadcastAdminActivity({ action: "ADMIN_RESOLVE_PROBLEM" });
    res.json({ success: true, problem });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteProblemAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const problem = await SupportProblem.findByIdAndDelete(id);
    if (!problem) {
      return res.status(404).json({ error: "Problem report not found" });
    }
    broadcastAdminActivity({ action: "ADMIN_DELETE_PROBLEM" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllFeedbackAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, rating } = req.query;
    let query: any = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate as string);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate as string);
      }
    }

    if (rating) {
      query.rating = Number(rating);
    }

    const feedbacks = await SupportFeedback.find(query).sort({ createdAt: -1 });
    res.json(feedbacks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteFeedbackAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const feedback = await SupportFeedback.findByIdAndDelete(id);
    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found" });
    }
    broadcastAdminActivity({ action: "ADMIN_DELETE_FEEDBACK" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ─── ADMIN SECURITY CONTROLLERS ──────────────────────────────────────────────

// 1. Get all security logs aggregated
export const getSecurityLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await User.find({ role: { $ne: "admin" } }).select("name phone securityLogs");
    let logs: any[] = [];
    users.forEach(user => {
      if (user.securityLogs && user.securityLogs.length > 0) {
        user.securityLogs.forEach(log => {
          logs.push({
            userId: user._id,
            userName: user.name,
            userPhone: user.phone,
            timestamp: log.timestamp,
            eventType: log.eventType,
            details: log.details,
            ipAddress: log.ipAddress || "Unknown",
            deviceId: log.deviceId || "Unknown"
          });
        });
      }
    });

    // Sort by timestamp descending
    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Get all active user sessions
export const getActiveSessions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await User.find({ role: { $ne: "admin" } }).select("name phone trustedDevices otpEnabled biometricEnabled");
    let sessions: any[] = [];
    users.forEach(user => {
      if (user.trustedDevices && user.trustedDevices.length > 0) {
        user.trustedDevices.forEach(device => {
          sessions.push({
            userId: user._id,
            userName: user.name,
            userPhone: user.phone,
            otpEnabled: user.otpEnabled || false,
            biometricEnabled: user.biometricEnabled || false,
            deviceId: device.deviceId,
            deviceName: device.deviceName,
            deviceOs: device.deviceOs || "Unknown",
            deviceBrowser: device.deviceBrowser || "Unknown",
            ipAddress: device.ipAddress || "Unknown",
            location: device.location || "Unknown",
            lastActiveAt: device.lastActiveAt,
            isSuspicious: device.isSuspicious || false
          });
        });
      }
    });

    // Sort by last active desc
    sessions.sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());

    res.json(sessions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Force logout user (revokes all sessions)
export const forceLogoutUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.refreshTokens = [];
    user.trustedDevices = [];
    if (user.loginHistory) {
      user.loginHistory.forEach(h => {
        if (!h.logoutTime) h.logoutTime = new Date();
      });
    }

    if (!user.securityLogs) user.securityLogs = [];
    user.securityLogs.push({
      timestamp: new Date(),
      eventType: "ADMIN_FORCE_LOGOUT",
      details: "Force logged out by Administrator",
      ipAddress: req.ip || "Admin Portal"
    });

    await user.save();

    broadcastAdminActivity({ action: "ADMIN_FORCE_LOGOUT", userId });
    res.json({ success: true, message: `Successfully force logged out user ${user.name}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Disable Suspicious Device
export const disableSuspiciousDevice = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, deviceId } = req.body;
    if (!userId || !deviceId) {
      return res.status(400).json({ error: "User ID and Device ID are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Mark as suspicious/suspended or remove
    if (user.trustedDevices) {
      user.trustedDevices = user.trustedDevices.filter(d => d.deviceId !== deviceId);
    }
    if (user.loginHistory) {
      const active = user.loginHistory.filter(h => h.deviceId === deviceId && !h.logoutTime);
      active.forEach(a => {
        a.logoutTime = new Date();
      });
    }

    if (!user.securityLogs) user.securityLogs = [];
    user.securityLogs.push({
      timestamp: new Date(),
      eventType: "SUSPICIOUS_DEVICE_BLOCKED",
      details: `Device suspended by Administrator. Device ID: ${deviceId}`,
      ipAddress: req.ip || "Admin Portal",
      deviceId
    });

    await user.save();

    broadcastAdminActivity({ action: "ADMIN_DISABLE_DEVICE", userId, deviceId });
    res.json({ success: true, message: "Device successfully suspended and session revoked." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Wipes all non-admin data (Do not delete admin accounts/tenants)
export const deleteAllUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. Wipe all transactional and entity collections
    await Attendance.deleteMany({});
    await Payment.deleteMany({});
    await WageHistory.deleteMany({});
    await Worker.deleteMany({});
    await Project.deleteMany({});
    await AuditLog.deleteMany({});
    await SupportProblem.deleteMany({});
    await SupportFeedback.deleteMany({});
    await DelayLog.deleteMany({});
    await Expense.deleteMany({});
    await MBEntry.deleteMany({});
    await OtpCode.deleteMany({});

    // 2. Delete all non-admin users (keeping admins completely intact)
    const userDeleteResult = await User.deleteMany({ role: { $ne: "admin" } });

    // 3. Delete all non-SYSADMIN tenants
    const tenantDeleteResult = await Tenant.deleteMany({ code: { $ne: "SYSADMIN" } });

    console.log(`[Admin Wipe Database] Deleted non-admin users: ${userDeleteResult.deletedCount}, deleted tenants: ${tenantDeleteResult.deletedCount}`);

    broadcastAdminActivity({ action: "ADMIN_USER_DELETE" });
    res.json({ success: true, message: "All non-admin users, associated tenants, and tracking documents have been wiped." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Force logout all active user devices except the current requesting administrator
export const logoutAllUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentAdminId = req.user?.id;

    // Find all users (both admins and non-admins)
    const users = await User.find({});
    let count = 0;

    for (const user of users) {
      // Do not log out the currently logged in administrator
      if (user._id.toString() === currentAdminId?.toString()) {
        continue;
      }

      // Revoke all session keys
      user.refreshTokens = [];
      user.trustedDevices = [];
      if (user.loginHistory) {
        user.loginHistory.forEach(h => {
          if (!h.logoutTime) h.logoutTime = new Date();
        });
      }

      if (!user.securityLogs) user.securityLogs = [];
      user.securityLogs.push({
        timestamp: new Date(),
        eventType: "ADMIN_FORCE_LOGOUT_ALL",
        details: "Administrator forced global logout across all active devices",
        ipAddress: req.ip || "Admin Portal"
      });

      await user.save();
      count++;
    }

    console.log(`[Admin Force Logout] Revoked active sessions for ${count} users.`);
    broadcastAdminActivity({ action: "ADMIN_FORCE_LOGOUT" });
    res.json({ success: true, message: `Successfully logged out active devices for ${count} users.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getActivityLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const logs = await AuditLog.find()
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "name role")
      .populate("tenantId", "name");

    const total = await AuditLog.countDocuments();

    // Map logs to detailed formatted object array
    const results = logs.map(log => {
      const flatName = log.userName || (log.userId as any)?.name || "Someone";
      const flatRole = log.role || (log.userId as any)?.role || "";
      const orgName = (log.tenantId as any)?.name || "their organization";
      
      const message = formatAuditLog(log);

      return {
        id: log._id.toString(),
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        userName: flatName,
        role: flatRole,
        orgName,
        message,
        ipAddress: log.ipAddress || "127.0.0.1",
        device: log.device || "unknown",
        platform: log.platform || "unknown",
        location: log.location,
        oldValue: log.oldValue || log.changes?.before,
        newValue: log.newValue || log.changes?.after,
        timestamp: log.timestamp,
      };
    });

    res.json({
      results,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getActivityStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();

    const startOfToday = new Date(currentYear, currentMonth, currentDay);

    // 1. Account Stats
    const totalAccounts = await Tenant.countDocuments();
    const todayNewAccounts = await Tenant.countDocuments({ createdAt: { $gte: startOfToday } });
    const totalContractors = await User.countDocuments({ role: "contractor" });
    const totalSupervisors = await User.countDocuments({ role: "supervisor" });
    
    // 2. Workforce Stats
    const totalWorkers = await Worker.countDocuments({ isArchived: false });
    const todayAttendance = await Attendance.find({ year: currentYear, month: currentMonth, day: currentDay });
    const todayPresent = todayAttendance.filter(a => ["P", "OT"].includes(a.value as string)).length;
    const todayAbsent = todayAttendance.filter(a => a.value === "A").length;
    const todayHalfDay = todayAttendance.filter(a => a.value === "H").length;

    // 3. Site/Project Stats
    const totalSites = await Site.countDocuments({ isDeleted: false });
    const runningSites = await Site.countDocuments({ isDeleted: false, status: { $in: ["Started", "In Progress"] } });
    const completedSites = await Site.countDocuments({ isDeleted: false, status: "Completed" });
    const delayedSites = await Site.countDocuments({ isDeleted: false, status: "Delayed" });

    // 4. Financial Stats
    const paymentsResult = await Payment.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalPayments = paymentsResult.length > 0 ? paymentsResult[0].total : 0;
    
    // Today's collections/payment sum
    const todayPaymentsResult = await Payment.aggregate([
      { $match: { createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const todayCollections = todayPaymentsResult.length > 0 ? todayPaymentsResult[0].total : 0;

    // Monthly revenue simulation
    const tenants = await Tenant.find();
    let monthlyRevenue = 0;
    let subscriptions = { professional: 0, business: 0, free: 0 };

    tenants.forEach(t => {
      if (t.plan === "professional") {
        monthlyRevenue += 299;
        subscriptions.professional++;
      } else if (t.plan === "business") {
        monthlyRevenue += 999;
        subscriptions.business++;
      } else {
        subscriptions.free++;
      }
    });

    // Outstanding wages (Pending Payments)
    const activeWorkers = await Worker.find({ isArchived: false });
    const activeWorkerIds = activeWorkers.map(w => w._id);
    const allAttendance = await Attendance.find({ workerId: { $in: activeWorkerIds } });
    const allPayments = await Payment.find();

    const attendanceMap: Record<string, any[]> = {};
    allAttendance.forEach(a => {
      const wId = a.workerId.toString();
      if (!attendanceMap[wId]) attendanceMap[wId] = [];
      attendanceMap[wId].push(a);
    });

    const paymentsMap: Record<string, number> = {};
    allPayments.forEach(p => {
      const wId = p.workerId.toString();
      paymentsMap[wId] = (paymentsMap[wId] || 0) + p.amount;
    });

    let pendingPayments = 0;
    activeWorkers.forEach(w => {
      const wId = w._id.toString();
      const records = attendanceMap[wId] || [];
      let earnings = 0;
      records.forEach(r => {
        const rate = r.dailyRate ?? w.dailyRate;
        const extra = r.customWage ?? 0;
        const ot = r.overtimeWage ?? 0;
        let recordPay = 0;
        if (r.value === "P" || r.value === "OT") recordPay = rate + extra + ot;
        else if (r.value === "H") recordPay = (rate / 2) + extra + ot;
        else if (r.value === "A") recordPay = 0;
        else if (typeof r.value === "number") recordPay = r.value;
        earnings += recordPay;
      });
      const paid = paymentsMap[wId] || 0;
      const balance = earnings - paid;
      if (balance > 0) pendingPayments += balance;
    });

    // 5. Attendance Trend (Last 11 Days)
    const attendanceTrend = [];
    for (let i = 10; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = d.getMonth();
      const dayVal = d.getDate();

      const dayAttendance = await Attendance.find({ year: y, month: m, day: dayVal });
      const present = dayAttendance.filter(a => ["P", "OT"].includes(a.value as string)).length;
      const absent = dayAttendance.filter(a => a.value === "A").length;

      attendanceTrend.push({
        day: `${dayVal} ${d.toLocaleString("default", { month: "short" })}`,
        present,
        absent,
      });
    }

    // 6. Revenue Trend (Last 6 Months)
    const revenueTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const activeTenants = await Tenant.find({ createdAt: { $lte: monthEnd } });
      let monthlyRev = 0;
      activeTenants.forEach(t => {
        if (t.plan === "professional") monthlyRev += 299;
        else if (t.plan === "business") monthlyRev += 999;
      });
      revenueTrend.push({
        month: d.toLocaleString("default", { month: "short" }),
        revenue: monthlyRev,
      });
    }

    // 7. Recent Workers
    const dbRecentWorkers = await Worker.find({ isArchived: false })
      .sort({ createdAt: -1 })
      .limit(5);

    const recentWorkers = [];
    for (const w of dbRecentWorkers) {
      const tenant = tenants.find(t => t._id.toString() === w.tenantId.toString());
      
      // Get today's attendance for this worker
      const attendance = await Attendance.findOne({
        workerId: w._id,
        year: currentYear,
        month: currentMonth,
        day: currentDay
      });

      let status = "Unmarked";
      if (attendance?.value === "P") status = "Present";
      else if (attendance?.value === "A") status = "Absent";
      else if (attendance?.value === "H") status = "Half Day";
      else if (attendance?.value === "OT") status = "Overtime";

      recentWorkers.push({
        id: w._id.toString(),
        name: w.name,
        role: w.category || "General",
        site: tenant ? tenant.name : "Company Workspace",
        status,
        wage: `₹${w.dailyRate}`
      });
    }

    // 8. Growth statistics
    const growthStatistics = {
      usersPercent: 12.5,
      sitesPercent: 8.3,
      paymentsPercent: 15.2,
      revenuePercent: 10.1
    };

    // 9. Server & Systems status
    const dbState = mongoose.connection.readyState === 1 ? "CONNECTED" : "DISCONNECTED";

    res.json({
      totalAccounts,
      todayNewAccounts,
      totalContractors,
      totalSupervisors,
      totalWorkers,
      todayAttendance: todayAttendance.length,
      todayPresent,
      todayAbsent,
      todayHalfDay,
      totalSites,
      runningSites,
      completedSites,
      delayedSites,
      totalPayments,
      pendingPayments,
      todayCollections,
      monthlyRevenue,
      subscriptions,
      growthStatistics,
      attendanceTrend,
      revenueTrend,
      recentWorkers,
      serverStatus: "ONLINE",
      databaseStatus: dbState,
      apiStatus: "HEALTHY",
      timestamp: new Date()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllTenantsAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [tenants, workerCounts, siteCounts, owners] = await Promise.all([
      Tenant.find().sort({ createdAt: -1 }).lean(),
      Worker.aggregate([
        { $match: { isArchived: false } },
        { $group: { _id: "$tenantId", count: { $sum: 1 } } }
      ]),
      Project.aggregate([
        { $group: { _id: "$tenantId", count: { $sum: 1 } } }
      ]),
      User.find({ role: { $in: ["contractor", "builder", "admin"] } })
        .select("name phone isActive tenantId")
        .lean()
    ]);

    const workerMap = new Map(workerCounts.map((w: any) => [w._id?.toString(), w.count]));
    const siteMap = new Map(siteCounts.map((s: any) => [s._id?.toString(), s.count]));
    const ownerMap = new Map(owners.map((u: any) => [u.tenantId?.toString(), u]));

    const result = tenants.map((t: any) => {
      const tId = t._id.toString();
      const ownerUser = ownerMap.get(tId);
      return {
        _id: t._id,
        name: t.name,
        owner: ownerUser ? ownerUser.name : "System Generated",
        phone: ownerUser ? ownerUser.phone : "N/A",
        plan: t.plan || "free",
        isActive: ownerUser ? ownerUser.isActive : true,
        sitesCount: siteMap.get(tId) || 0,
        workersCount: workerMap.get(tId) || 0,
        createdAt: t.createdAt ? new Date(t.createdAt).toISOString().split('T')[0] : "2026-08-01"
      };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteTenantAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tenant = await Tenant.findById(id);
    if (!tenant) {
      return res.status(404).json({ error: "Organization not found" });
    }

    await Promise.all([
      Attendance.deleteMany({ tenantId: id }),
      Payment.deleteMany({ tenantId: id }),
      WageHistory.deleteMany({ tenantId: id }),
      Worker.deleteMany({ tenantId: id }),
      Project.deleteMany({ tenantId: id }),
      AuditLog.deleteMany({ tenantId: id }),
      User.deleteMany({ tenantId: id }),
      Tenant.findByIdAndDelete(id)
    ]);

    res.json({ success: true, message: "Organization and all related records deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllMaterialsAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const materials = await Material.find().populate("tenantId", "name").lean();
    const result = materials.map((m: any) => ({
      _id: m._id,
      name: m.name,
      category: m.category,
      inStock: m.remainingStock,
      unit: m.unit,
      threshold: m.minStockLevel,
      company: m.tenantId?.name || "System Workspace"
    }));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllExpensesAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const expenses = await Expense.find().populate("tenantId", "name").lean();
    const result = expenses.map((e: any) => ({
      _id: e._id,
      description: e.description || "Construction Expense",
      category: e.type === "material" ? "Materials" : e.type === "machinery" ? "Machinery Lease" : e.type === "labour" ? "Labor" : "Other",
      amount: e.amount,
      date: e.date ? new Date(e.date).toISOString().split('T')[0] : "2026-08-01",
      company: e.tenantId?.name || "System Workspace",
      status: "Approved"
    }));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllSalariesAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [workers, allAttendance, allPayments] = await Promise.all([
      Worker.find({ isArchived: false }).populate("tenantId", "name").lean(),
      Attendance.find().select("workerId value dailyRate customWage overtimeWage").lean(),
      Payment.find().select("workerId amount").lean()
    ]);

    // Group attendance by workerId
    const attendanceByWorker = new Map<string, any[]>();
    allAttendance.forEach((a: any) => {
      const wId = a.workerId?.toString();
      if (!wId) return;
      if (!attendanceByWorker.has(wId)) attendanceByWorker.set(wId, []);
      attendanceByWorker.get(wId)!.push(a);
    });

    // Group payments by workerId
    const paymentsByWorker = new Map<string, number>();
    allPayments.forEach((p: any) => {
      const wId = p.workerId?.toString();
      if (!wId) return;
      paymentsByWorker.set(wId, (paymentsByWorker.get(wId) || 0) + (p.amount || 0));
    });

    const result = workers.map((w: any) => {
      const wId = w._id.toString();
      const attendance = attendanceByWorker.get(wId) || [];
      let earnings = 0;
      let presentCount = 0;

      attendance.forEach((a: any) => {
        const rate = a.dailyRate !== undefined && a.dailyRate !== null ? a.dailyRate : (w.dailyRate || 0);
        const extra = a.customWage || 0;
        const ot = a.overtimeWage || 0;
        if (a.value === "P" || a.value === "OT") {
          earnings += rate + extra + ot;
          presentCount++;
        } else if (a.value === "H") {
          earnings += (rate / 2) + extra + ot;
          presentCount++;
        }
      });

      const paid = paymentsByWorker.get(wId) || 0;
      const balance = earnings - paid;

      return {
        _id: w._id,
        workerName: w.name,
        company: w.tenantId?.name || "System Workspace",
        dailyRate: w.dailyRate || 0,
        daysPresent: presentCount,
        grossSalary: earnings,
        paidAmount: paid,
        dueAmount: balance > 0 ? balance : 0,
        status: balance <= 0 ? "Fully Paid" : paid > 0 ? "Partially Paid" : "Due"
      };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllNotificationsAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(30).populate("tenantId", "name");
    const result = logs.map(log => ({
      _id: log._id,
      title: log.action.replace(/_/g, " "),
      message: formatAuditLog(log),
      type: log.action.includes("FAIL") || log.action.includes("ALERT") ? "warning" : "info",
      timestamp: log.timestamp.toISOString(),
      company: (log.tenantId as any)?.name || "System"
    }));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllSubscriptionsAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const transactions = await SubscriptionTransaction.find().sort({ date: -1 }).populate("tenantId", "name");
    const result: any[] = [];
    
    if (transactions.length === 0) {
      const tenants = await Tenant.find();
      for (const t of tenants) {
        if (t.plan !== "free") {
          result.push({
            _id: t._id,
            company: t.name,
            plan: t.plan,
            amount: t.plan === "professional" ? 299 : t.plan === "business" ? 999 : 70,
            cycle: "monthly",
            renewalDate: t.planExpiresAt ? t.planExpiresAt.toISOString().split('T')[0] : "2026-12-31",
            autoRenew: true,
            status: "Active"
          });
        }
      }
    } else {
      transactions.forEach(tx => {
        result.push({
          _id: tx._id,
          company: (tx.tenantId as any)?.name || "Client Org",
          plan: tx.planName,
          amount: tx.amount,
          cycle: tx.billingCycle === "3months" ? "3 months" : tx.billingCycle,
          renewalDate: tx.date.toISOString().split('T')[0],
          autoRenew: tx.autoRenew,
          status: tx.status === "Completed" ? "Active" : "Expired"
        });
      });
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllSupportTicketsAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const problems = await SupportProblem.find().sort({ createdAt: -1 }).populate("userId");
    const result = problems.map((p: any) => ({
      _id: p._id,
      ticketId: `TKT-${p._id.toString().substring(18).toUpperCase()}`,
      company: p.userId?.companyName || p.userName || "Client Org",
      issue: p.subject || p.description || "Support Request",
      priority: "Medium",
      status: p.status === "resolved" ? "Resolved" : "Open",
      createdAt: p.createdAt ? p.createdAt.toISOString().split('T')[0] : "2026-08-01"
    }));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllDevicesAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await User.find({ role: "supervisor" }).populate("tenantId", "name");
    const result: any[] = [];
    users.forEach(u => {
      if (u.trustedDevices && u.trustedDevices.length > 0) {
        u.trustedDevices.forEach(d => {
          result.push({
            _id: `${u._id}-${d.deviceId}`,
            deviceId: d.deviceId,
            model: d.deviceName || "Mobile Device",
            os: d.deviceOs || "iOS/Android",
            company: (u.tenantId as any)?.name || "Client Org",
            biometricEnrolled: u.biometricEnabled || false,
            isActive: !d.isSuspicious,
            registeredAt: d.lastActiveAt ? d.lastActiveAt.toISOString().split('T')[0] : "2026-08-01"
          });
        });
      }
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};


