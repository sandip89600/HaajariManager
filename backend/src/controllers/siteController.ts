import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { SiteService } from "../services/siteService";
import { AuditLog, Site, Worker, Attendance } from "../models";
import { broadcastAdminActivity } from "../utils/socket";

/**
 * Create a new Site
 */
export const createSite = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const siteData = {
      ...req.body,
      tenantId,
      createdBy: userId
    };

    const site = await SiteService.createSite(siteData);

    // Audit Log
    const auditLog = new AuditLog({
      tenantId,
      userId,
      action: "CREATE",
      targetType: "SITE",
      targetId: site._id.toString(),
      changes: { after: site.toObject() }
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    return res.status(201).json(site);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Get all Sites (Paginated, Sorted, Filtered, Searched)
 */
export const getSites = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { search, status, sortBy, page, limit } = req.query;

    const result = await SiteService.querySites({
      tenantId: tenantId.toString(),
      search: search ? String(search) : undefined,
      status: status ? String(status) : undefined,
      sortBy: sortBy ? String(sortBy) : undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined
    });

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Get Site Details
 */
export const getSiteById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const site = await SiteService.getSiteById(tenantId.toString(), id);
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    return res.json(site);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Update Site Details
 */
export const updateSite = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!tenantId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const before = await SiteService.getSiteById(tenantId.toString(), id);
    if (!before) {
      return res.status(404).json({ error: "Site not found" });
    }

    const site = await SiteService.updateSite(tenantId.toString(), id, req.body);

    // Audit Log
    const auditLog = new AuditLog({
      tenantId,
      userId,
      action: "UPDATE",
      targetType: "SITE",
      targetId: id,
      changes: { 
        before: before.toObject(), 
        after: site ? site.toObject() : null 
      }
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    return res.json(site);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Archive Site
 */
export const archiveSite = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!tenantId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const before = await SiteService.getSiteById(tenantId.toString(), id);
    if (!before) {
      return res.status(404).json({ error: "Site not found" });
    }

    const site = await SiteService.updateSite(tenantId.toString(), id, { isArchived: true } as any);

    // Audit Log
    const auditLog = new AuditLog({
      tenantId,
      userId,
      action: "ARCHIVE",
      targetType: "SITE",
      targetId: id,
      changes: { 
        before: before.toObject(), 
        after: site ? site.toObject() : null 
      }
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    return res.json(site);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Soft Delete Site
 */
export const deleteSite = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!tenantId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const before = await SiteService.getSiteById(tenantId.toString(), id);
    if (!before) {
      return res.status(404).json({ error: "Site not found" });
    }

    const success = await SiteService.deleteSite(tenantId.toString(), id);
    if (!success) {
      return res.status(404).json({ error: "Site not found or already deleted" });
    }

    // Audit Log
    const auditLog = new AuditLog({
      tenantId,
      userId,
      action: "DELETE",
      targetType: "SITE",
      targetId: id,
      changes: { 
        before: before.toObject(), 
        after: { isDeleted: true }
      }
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    return res.json({ message: "Site deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Get Site Dashboard Statistics
 */
export const getSiteDashboardStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();

    // 1. Fetch sites under the tenant
    const sites = await Site.find({ tenantId, isDeleted: false, isArchived: false });
    const totalSites = sites.length;
    
    // Status counts
    const activeSites = sites.filter(s => ["Started", "In Progress"].includes(s.status)).length;
    const sitesInProgress = sites.filter(s => s.status === "In Progress").length;
    const delayedSites = sites.filter(s => s.status === "Delayed").length;
    const completedSites = sites.filter(s => s.status === "Completed").length;

    // 2. Fetch total workers under the tenant
    const totalWorkers = await Worker.countDocuments({ tenantId });

    // 3. Fetch today's attendance records under the tenant
    const todayAttendance = await Attendance.find({
      tenantId,
      year,
      month,
      day
    });

    const workersPresent = todayAttendance.filter(a => ["P", "H", "OT"].includes(a.value as string)).length;
    const workersAbsent = todayAttendance.filter(a => a.value === "A").length;

    return res.json({
      totalSites,
      activeSites,
      workersPresent,
      workersAbsent,
      totalWorkers,
      sitesInProgress,
      delayedSites,
      completedSites
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
