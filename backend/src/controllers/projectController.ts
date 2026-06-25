import { Response } from "express";
import { Project, AuditLog, Worker, User } from "../models";
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
    const { name, location } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Project name is required" });
    }

    const project = new Project({
      tenantId,
      name,
      location,
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
    const { name, location, status } = req.body;

    const project = await Project.findOne({ _id: id, tenantId });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (name) project.name = name;
    if (location !== undefined) project.location = location;
    if (status) project.status = status;

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
