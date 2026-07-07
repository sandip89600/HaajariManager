import { Response } from "express";
import bcrypt from "bcryptjs";
import { User, Tenant, Worker, Attendance, Payment, AuditLog, WageHistory, Project, SupportProblem, SupportFeedback } from "../models";
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
    const users = await User.find({ role: { $ne: "admin" } })
      .populate("tenantId")
      .select("-passwordHash -refreshTokens")
      .sort({ createdAt: -1 });

    console.log("Users Returned:", users.length);
    console.log("[Admin Audit Log] getAllUsers: Found non-admin users in DB count:", users.length);

    const usersWithWorkerCount = await Promise.all(
      users.map(async (user: any) => {
        const userObj = user.toObject();
        if (user.tenantId) {
          const tenantId = user.tenantId._id;
          const workerCount = await Worker.countDocuments({ tenantId, isArchived: false });
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
      })
    );

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
    const totalUsers = await User.countDocuments({ role: { $ne: "admin" } });
    const count = totalUsers;
    console.log("Users Count:", count);
    const activeUsers = await User.countDocuments({ role: { $ne: "admin" }, isActive: true });
    const inactiveUsers = await User.countDocuments({ role: { $ne: "admin" }, isActive: false });
    const totalContractors = await User.countDocuments({ role: "contractor" });
    const totalBuilders = await User.countDocuments({ role: "builder" });
    const totalSupervisors = await User.countDocuments({ role: "supervisor" });
    const totalWorkers = await Worker.countDocuments({ isArchived: false });
    const totalAttendance = await Attendance.countDocuments();

    console.log("[Admin Audit Log] getAdminAnalytics: totalUsers:", totalUsers, "activeUsers:", activeUsers, "totalWorkers:", totalWorkers);

    // Live Financials
    const tenants = await Tenant.find();
    let totalRevenue = 0;
    let freeCount = 0;
    let proCount = 0;
    let businessCount = 0;
    const tenantMap: Record<string, string> = {};

    tenants.forEach((t) => {
      tenantMap[t._id.toString()] = t.name;
      if (t.plan === "professional") {
        proCount++;
        totalRevenue += 299;
      } else if (t.plan === "business") {
        businessCount++;
        totalRevenue += 999;
      } else {
        freeCount++;
      }
    });

    const allPayments = await Payment.find();
    const totalPayroll = allPayments.reduce((sum, p) => sum + p.amount, 0);

    // Outstanding wages balance
    const activeWorkers = await Worker.find({ isArchived: false });
    const activeWorkerIds = activeWorkers.map(w => w._id);
    const allAttendance = await Attendance.find({ workerId: { $in: activeWorkerIds } });

    // Group attendance by workerId
    const attendanceMap: Record<string, any[]> = {};
    allAttendance.forEach(a => {
      const wId = a.workerId.toString();
      if (!attendanceMap[wId]) attendanceMap[wId] = [];
      attendanceMap[wId].push(a);
    });

    // Group payments by workerId
    const paymentsMap: Record<string, number> = {};
    allPayments.forEach(p => {
      const wId = p.workerId.toString();
      paymentsMap[wId] = (paymentsMap[wId] || 0) + p.amount;
    });

    let outstandingAmount = 0;
    activeWorkers.forEach(w => {
      const wId = w._id.toString();
      const records = attendanceMap[wId] || [];
      let earnings = 0;
      let advances = 0;
      records.forEach(r => {
        const rate = r.dailyRate !== undefined && r.dailyRate !== null ? r.dailyRate : w.dailyRate;
        const extra = (r.customWage !== undefined && r.customWage !== null) ? r.customWage : 0;
        const ot = (r.overtimeWage !== undefined && r.overtimeWage !== null) ? r.overtimeWage : 0;
        let recordPay = 0;

        if (r.value === "P" || r.value === "OT") {
          recordPay = rate + extra + ot;
        } else if (r.value === "H") {
          recordPay = (rate / 2) + extra + ot;
        } else if (r.value === "A") {
          recordPay = 0;
        } else if (typeof r.value === "number") {
          recordPay = r.value;
        } else {
          recordPay = 0;
        }
        earnings += recordPay;
        advances += extra;
      });
      const paid = paymentsMap[wId] || 0;
      const balance = earnings - paid;
      if (balance > 0) {
        outstandingAmount += balance;
      }
    });

    // Workers Analytics
    const workersByCategory: Record<string, number> = {};
    const workersByCompany: Record<string, number> = {};
    activeWorkers.forEach(w => {
      const cat = w.category || "Other";
      workersByCategory[cat] = (workersByCategory[cat] || 0) + 1;

      const comp = tenantMap[w.tenantId.toString()] || "Unknown Company";
      workersByCompany[comp] = (workersByCompany[comp] || 0) + 1;
    });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const newWorkersThisMonth = activeWorkers.filter(w => w.createdAt >= startOfMonth).length;

    // Today/Monthly Attendance
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const currentDay = today.getDate();

    const todayAttendance = await Attendance.countDocuments({ year: currentYear, month: currentMonth, day: currentDay });
    const monthlyAttendance = await Attendance.countDocuments({ year: currentYear, month: currentMonth });

    // Top active companies
    const monthAttendance = await Attendance.find({ year: currentYear, month: currentMonth });
    const tenantAttendanceCount: Record<string, number> = {};
    monthAttendance.forEach(a => {
      const tId = a.tenantId.toString();
      tenantAttendanceCount[tId] = (tenantAttendanceCount[tId] || 0) + 1;
    });

    const topActiveCompanies = Object.entries(tenantAttendanceCount)
      .map(([tenantId, count]) => ({
        companyName: tenantMap[tenantId] || "Unknown Company",
        attendanceCount: count,
      }))
      .sort((a, b) => b.attendanceCount - a.attendanceCount)
      .slice(0, 5);

    // Activity Feed (Last 20 logs)
    const rawLogs = await AuditLog.find()
      .sort({ timestamp: -1 })
      .limit(20)
      .populate("userId", "name role")
      .populate("tenantId", "name");

    const activityFeed = rawLogs.map(log => ({
      id: log._id.toString(),
      message: formatAuditLog(log),
      timestamp: log.timestamp,
    }));

    // User Growth Line Chart Simulator (Last 6 Months)
    const userGrowth: Array<{ month: string; count: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const count = await User.countDocuments({
        role: { $ne: "admin" },
        createdAt: { $gte: monthStart, $lte: monthEnd }
      });
      userGrowth.push({
        month: d.toLocaleString("default", { month: "short" }),
        count
      });
    }

    // Revenue Growth Trend Simulator (Last 6 Months)
    const revenueGrowth: Array<{ month: string; amount: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const activeTenants = await Tenant.find({ createdAt: { $lte: monthEnd } });
      let monthlyRevenue = 0;
      activeTenants.forEach(t => {
        if (t.plan === "professional") monthlyRevenue += 299;
        else if (t.plan === "business") monthlyRevenue += 999;
      });
      revenueGrowth.push({
        month: d.toLocaleString("default", { month: "short" }),
        amount: monthlyRevenue
      });
    }

    // Attendance breakdown count (current month)
    const attendanceBreakdown = {
      present: await Attendance.countDocuments({ year: currentYear, month: currentMonth, value: "P" }),
      absent: await Attendance.countDocuments({ year: currentYear, month: currentMonth, value: "A" }),
      halfDay: await Attendance.countDocuments({ year: currentYear, month: currentMonth, value: "H" }),
    };

    // Payroll Volume Trend Simulator (Last 6 Months)
    const payrollTrend: Array<{ month: string; amount: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const targetYear = d.getFullYear();
      const targetMonth = d.getMonth();
      const targetPayments = await Payment.find({ year: targetYear, month: targetMonth });
      const amount = targetPayments.reduce((sum, p) => sum + p.amount, 0);
      payrollTrend.push({
        month: d.toLocaleString("default", { month: "short" }),
        amount
      });
    }

    res.json({
      metrics: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        totalContractors,
        totalBuilders,
        totalSupervisors,
        totalWorkers,
        totalAttendance,
        totalRevenue,
        totalPayroll,
        outstandingAmount,
      },
      plans: {
        free: freeCount,
        professional: proCount,
        business: businessCount,
      },
      analytics: {
        workersByCategory,
        workersByCompany,
        newWorkersThisMonth,
        todayAttendance,
        monthlyAttendance,
        topActiveCompanies,
        userGrowth,
        revenueGrowth,
        attendanceBreakdown,
        payrollTrend,
      },
      activityFeed,
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
      .sort({ createdAt: -1 });
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
      .limit(500);
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
      .sort({ paidAt: -1 });
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
