import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { SiteService } from "../services/siteService";
import { AuditLog, Site, Worker, Attendance, SiteUpdate, Expense, WorkPhoto } from "../models";
import { broadcastAdminActivity } from "../utils/socket";
import { logActivity } from "../services/activityLogger";

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

    await logActivity({
      req,
      action: "SITE_CREATED",
      targetType: "SITE",
      targetId: site._id.toString(),
      changes: { after: site.toObject() }
    });

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

    await logActivity({
      req,
      action: "SITE_UPDATED",
      targetType: "SITE",
      targetId: id,
      changes: { 
        before: before.toObject(), 
        after: site ? site.toObject() : null 
      }
    });

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

    await logActivity({
      req,
      action: "SITE_UPDATED", // Archiving is an update to status
      targetType: "SITE",
      targetId: id,
      changes: { 
        before: before.toObject(), 
        after: site ? site.toObject() : null 
      }
    });

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

    await logActivity({
      req,
      action: "SITE_DELETED",
      targetType: "SITE",
      targetId: id,
      changes: { 
        before: before.toObject(), 
        after: { isDeleted: true }
      }
    });

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
    const activeSites = sites.filter(s => ["Started", "In Progress", "Active"].includes(s.status)).length;
    const sitesInProgress = sites.filter(s => ["In Progress", "Active"].includes(s.status)).length;
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

/**
 * Get site updates history / timeline
 */
export const getSiteUpdates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { siteId } = req.params;

    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const updates = await SiteUpdate.find({ tenantId, siteId })
      .populate("updatedBy", "name role")
      .sort({ timestamp: -1 });

    return res.json(updates);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Create a new site update (Work, Material, Expense, Photos, GPS, Issues)
 */
export const createSiteUpdate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { siteId } = req.params;

    if (!tenantId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      type,
      workType,
      progressPercent,
      workNotes,
      materialName,
      materialQty,
      materialUnit,
      materialNotes,
      expenseAmount,
      expenseCategory,
      expenseNotes,
      expenseDate,
      photoUris,
      location,
      issueDescription,
      issuePriority,
      issueStatus
    } = req.body;

    if (!type) {
      return res.status(400).json({ error: "Update type is required" });
    }

    const site = await Site.findOne({ _id: siteId, tenantId, isDeleted: false });
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    const update = new SiteUpdate({
      tenantId,
      siteId,
      updatedBy: userId,
      type,
      workType,
      progressPercent,
      workNotes,
      materialName,
      materialQty,
      materialUnit,
      materialNotes,
      expenseAmount,
      expenseCategory,
      expenseNotes,
      expenseDate: expenseDate ? new Date(expenseDate) : undefined,
      photoUris,
      location,
      issueDescription,
      issuePriority,
      issueStatus,
      timestamp: new Date()
    });

    await update.save();

    // Cache latest status on the Site document
    const siteUpdates: any = {
      lastUpdateAt: update.timestamp,
      lastUpdatedBy: userId,
      lastUpdateType: type
    };

    if (type === "work") {
      if (workType) siteUpdates.currentWork = workType;
      if (progressPercent !== undefined) siteUpdates.currentProgress = progressPercent;
    }

    await Site.updateOne({ _id: siteId }, { $set: siteUpdates });

    // Save copy to existing database models if applicable
    if (type === "expense" && expenseAmount !== undefined) {
      const dbExpense = new Expense({
        tenantId,
        siteId,
        type: expenseCategory === "Labour" ? "labour" : expenseCategory === "Material" ? "material" : "other",
        amount: expenseAmount,
        date: expenseDate ? new Date(expenseDate) : new Date(),
        description: expenseNotes || `Site Update Expense: ${expenseCategory}`,
        recordedBy: userId
      });
      await dbExpense.save();
    }

    if (type === "photo" && photoUris && photoUris.length > 0) {
      for (const uri of photoUris) {
        const dbPhoto = new WorkPhoto({
          tenantId,
          siteId,
          photoType: "after",
          photoUri: uri,
          location: {
            latitude: location?.latitude || 0,
            longitude: location?.longitude || 0
          },
          timestamp: new Date()
        });
        await dbPhoto.save();
      }
    }

    // Log Activity
    await logActivity({
      req,
      action: "SITE_UPDATE_CREATED",
      targetType: "SITE_UPDATE",
      targetId: update._id.toString(),
      changes: { after: update.toObject() }
    });

    // Populate updater before returning
    await update.populate("updatedBy", "name role");

    return res.status(201).json(update);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
