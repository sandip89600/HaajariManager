import { Response } from "express";
import { Project, AuditLog, Worker, User, Expense, MBEntry, DelayLog } from "../models";
import { AuthenticatedRequest } from "../middleware/auth";
import { broadcastAdminActivity } from "../utils/socket";

export const getProjects = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const projects = await Project.find({ tenantId });
    res.json(projects);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createProject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const {
      name,
      location,
      clientName,
      budget,
      startDate,
      endDate,
      retentionPercentage,
      mobilizationAdvance,
      labourLicenseNumber,
      pfEsicStatus,
      wcPolicyNumber,
      progressUnit,
      plannedQty,
      phases
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Project/Site name is required" });
    }

    const project = new Project({
      tenantId,
      name,
      location,
      clientName,
      budget,
      startDate,
      endDate,
      retentionPercentage,
      mobilizationAdvance,
      labourLicenseNumber,
      pfEsicStatus,
      wcPolicyNumber,
      progressUnit,
      plannedQty,
      completedQty: 0,
      phases,
      status: "active",
    });

    await project.save();

    const auditLog = new AuditLog({
      tenantId,
      userId: req.user?.id,
      action: "CREATE_PROJECT",
      targetType: "Project",
      targetId: project._id.toString(),
      changes: { after: { name: project.name } },
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.status(201).json(project);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateProject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;
    const {
      name,
      location,
      status,
      clientName,
      budget,
      startDate,
      endDate,
      retentionPercentage,
      mobilizationAdvance,
      labourLicenseNumber,
      pfEsicStatus,
      wcPolicyNumber,
      progressUnit,
      plannedQty,
      completedQty,
      phases
    } = req.body;

    const project = await Project.findOne({ _id: id, tenantId });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (name) project.name = name;
    if (location !== undefined) project.location = location;
    if (status) project.status = status;
    if (clientName !== undefined) project.clientName = clientName;
    if (budget !== undefined) project.budget = budget;
    if (startDate !== undefined) project.startDate = startDate;
    if (endDate !== undefined) project.endDate = endDate;
    if (retentionPercentage !== undefined) project.retentionPercentage = retentionPercentage;
    if (mobilizationAdvance !== undefined) project.mobilizationAdvance = mobilizationAdvance;
    if (labourLicenseNumber !== undefined) project.labourLicenseNumber = labourLicenseNumber;
    if (pfEsicStatus !== undefined) project.pfEsicStatus = pfEsicStatus;
    if (wcPolicyNumber !== undefined) project.wcPolicyNumber = wcPolicyNumber;
    if (progressUnit !== undefined) project.progressUnit = progressUnit;
    if (plannedQty !== undefined) project.plannedQty = plannedQty;
    if (completedQty !== undefined) project.completedQty = completedQty;
    if (phases !== undefined) project.phases = phases;

    await project.save();
    res.json(project);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteProject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;

    const project = await Project.findOneAndDelete({ _id: id, tenantId });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Cascading: unassign workers that belong to this project
    await Worker.updateMany({ tenantId, projectId: id }, { $unset: { projectId: "" } });

    // Cascading: remove project from supervisor's assignedProjects list
    await User.updateMany(
      { tenantId, role: "supervisor", assignedProjects: id },
      { $pull: { assignedProjects: id } }
    );

    // Log the delete action
    const auditLog = new AuditLog({
      tenantId,
      userId: req.user?.id,
      action: "DELETE",
      targetType: "PROJECT",
      targetId: id,
      changes: { before: { name: project.name } },
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.json({ success: true, message: "Project deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ─── COMMAND CENTER METRICS & ANALYTICS ──────────────────────────────────────
export const getProjectDashboard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;

    const project = await Project.findOne({ _id: id, tenantId });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // 1. Calculate Expenses (Ledger)
    const expenses = await Expense.find({ projectId: id, tenantId });
    const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    const expenseBreakdown = {
      material: expenses.filter(e => e.type === "material").reduce((sum, e) => sum + e.amount, 0),
      machinery: expenses.filter(e => e.type === "machinery").reduce((sum, e) => sum + e.amount, 0),
      labour: expenses.filter(e => e.type === "labour").reduce((sum, e) => sum + e.amount, 0),
      vendor: expenses.filter(e => e.type === "vendor").reduce((sum, e) => sum + e.amount, 0),
      other: expenses.filter(e => e.type === "other").reduce((sum, e) => sum + e.amount, 0),
    };

    // 2. Delay Analytics
    const delayLogs = await DelayLog.find({ projectId: id, tenantId });
    const totalDelayDays = delayLogs.reduce((sum, log) => sum + log.delayDays, 0);

    // 3. Worker headcount on project
    const activeWorkersCount = await Worker.countDocuments({ projectId: id, tenantId, isArchived: false });

    // 4. Progress calculation (Weighted or Qty)
    let progressPercent = 0;
    if (project.phases && project.phases.length > 0) {
      const sumWeight = project.phases.reduce((sum, p) => sum + (p.weight || 0), 0);
      const achievedWeight = project.phases.reduce((sum, p) => {
        return sum + (((p.percentDone || 0) * (p.weight || 0)) / 100);
      }, 0);
      progressPercent = sumWeight > 0 ? (achievedWeight / sumWeight) * 100 : 0;
    } else if (project.plannedQty && project.plannedQty > 0) {
      progressPercent = ((project.completedQty || 0) / project.plannedQty) * 100;
    }

    res.json({
      project,
      totalSpent,
      remainingBudget: (project.budget || 0) - totalSpent,
      expenseBreakdown,
      totalDelayDays,
      activeWorkersCount,
      progressPercent: Math.min(100, Math.max(0, progressPercent)),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ─── MEASUREMENT BOOK (MB) ENTRIES ───────────────────────────────────────────
export const addMBEntry = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;
    const { taskName, quantity, unit, photoProofUri, date } = req.body;

    if (!taskName || quantity === undefined || !unit) {
      return res.status(400).json({ error: "Task name, quantity, and unit are required" });
    }

    const project = await Project.findOne({ _id: id, tenantId });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const mbEntry = new MBEntry({
      tenantId,
      projectId: id,
      taskName,
      quantity,
      unit,
      photoProofUri,
      recordedBy: req.user?.id,
      date: date ? new Date(date) : new Date(),
    });

    await mbEntry.save();

    // Increment completed quantity of the project
    project.completedQty = (project.completedQty || 0) + Number(quantity);
    await project.save();

    res.status(201).json(mbEntry);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getMBEntries = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;
    const entries = await MBEntry.find({ projectId: id, tenantId }).sort({ date: -1 });
    res.json(entries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ─── DELAY LOGS ──────────────────────────────────────────────────────────────
export const addDelayLog = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;
    const { delayDays, reasonCode, description, date } = req.body;

    if (delayDays === undefined || !reasonCode) {
      return res.status(400).json({ error: "Delay days and reason code are required" });
    }

    const delayLog = new DelayLog({
      tenantId,
      projectId: id,
      delayDays,
      reasonCode,
      description,
      date: date ? new Date(date) : new Date(),
    });

    await delayLog.save();
    res.status(201).json(delayLog);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDelayLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;
    const logs = await DelayLog.find({ projectId: id, tenantId }).sort({ date: -1 });
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ─── UNIFIED EXPENSE LEDGER ──────────────────────────────────────────────────
export const addExpense = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;
    const { type, amount, date, vendorName, description, quantity, unit, photoProofUri } = req.body;

    if (!type || amount === undefined) {
      return res.status(400).json({ error: "Expense type and amount are required" });
    }

    const expense = new Expense({
      tenantId,
      projectId: id,
      type,
      amount,
      date: date ? new Date(date) : new Date(),
      vendorName,
      description,
      quantity,
      unit,
      photoProofUri,
      recordedBy: req.user?.id,
    });

    await expense.save();
    res.status(201).json(expense);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getExpenses = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;
    const expenses = await Expense.find({ projectId: id, tenantId }).sort({ date: -1 });
    res.json(expenses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
