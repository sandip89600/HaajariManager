import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { SiteService } from "../services/siteService";
import { AuditLog, Site, Worker, Attendance, SiteUpdate, Expense, WorkPhoto, DailySiteWorkUpdate } from "../models";
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
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { search, status, sortBy, page, limit } = req.query;

    const result = await SiteService.querySites({
      tenantId: tenantId.toString(),
      userId: userId ? userId.toString() : undefined,
      userRole,
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

/**
 * Helper to format date as YYYY-MM-DD
 */
const getTodayDateStr = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Get Today's Work Update for a Site
 */
export const getTodayDailyWork = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { siteId } = req.params;
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

    const dateStr = getTodayDateStr();
    let update = await DailySiteWorkUpdate.findOne({ tenantId, siteId, dateStr })
      .populate("createdBy", "name role");

    return res.json(update || null);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Start Today's Work (Morning Photo & Work Details)
 */
export const startDailyWork = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { siteId } = req.params;

    if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

    const {
      workType,
      description,
      startingPoint,
      morningPhoto,
      morningLocation,
    } = req.body;

    if (!morningPhoto) {
      return res.status(400).json({ error: "Morning photo is required" });
    }
    if (!workType || !description || !startingPoint) {
      return res.status(400).json({ error: "Work type, description, and starting point are required" });
    }

    const site = await Site.findOne({ _id: siteId, tenantId, isDeleted: false });
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    const dateStr = getTodayDateStr();
    let update = await DailySiteWorkUpdate.findOne({ tenantId, siteId, dateStr });

    if (update) {
      update.workType = workType;
      update.description = description;
      update.startingPoint = startingPoint;
      update.morningPhoto = morningPhoto;
      update.morningTimestamp = new Date();
      if (morningLocation) update.morningLocation = morningLocation;
      update.status = "in_progress";
    } else {
      update = new DailySiteWorkUpdate({
        tenantId,
        siteId,
        createdBy: userId,
        dateStr,
        status: "in_progress",
        workType,
        description,
        startingPoint,
        morningPhoto,
        morningTimestamp: new Date(),
        morningLocation,
      });
    }

    await update.save();

    // Update cache fields on site
    site.currentWork = `${workType} - ${description}`;
    site.status = "In Progress";
    site.lastUpdateAt = new Date();
    site.lastUpdatedBy = userId as any;
    site.lastUpdateType = "MORNING_START";
    await site.save();

    // WorkPhoto timeline log
    const workPhoto = new WorkPhoto({
      tenantId,
      siteId,
      photoType: "before",
      photoUri: morningPhoto,
      location: {
        latitude: morningLocation?.latitude || 0,
        longitude: morningLocation?.longitude || 0,
      },
      timestamp: new Date(),
    });
    await workPhoto.save();

    await update.populate("createdBy", "name role");
    return res.status(200).json(update);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Complete Today's Work (Evening Photo & Completion Details)
 */
export const completeDailyWork = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { siteId } = req.params;

    if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

    const {
      completionDescription,
      endingPoint,
      eveningPhoto,
      eveningLocation,
      progress,
      progressPercent,
      issues,
    } = req.body;

    if (!eveningPhoto) {
      return res.status(400).json({ error: "Evening photo is required" });
    }
    if (!completionDescription || !endingPoint) {
      return res.status(400).json({ error: "Completion description and ending point are required" });
    }

    const site = await Site.findOne({ _id: siteId, tenantId, isDeleted: false });
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    const dateStr = getTodayDateStr();
    let update = await DailySiteWorkUpdate.findOne({ tenantId, siteId, dateStr });

    if (!update) {
      return res.status(400).json({ error: "Cannot complete work before starting morning work update" });
    }

    update.completionDescription = completionDescription;
    update.endingPoint = endingPoint;
    update.eveningPhoto = eveningPhoto;
    update.eveningTimestamp = new Date();
    if (eveningLocation) update.eveningLocation = eveningLocation;
    if (progress !== undefined) update.progress = progress;
    if (progressPercent !== undefined) update.progressPercent = Number(progressPercent);
    if (issues !== undefined) update.issues = issues;
    update.status = "completed";

    await update.save();

    // Update cache fields on site
    site.currentProgress = progressPercent !== undefined ? Number(progressPercent) : site.currentProgress;
    site.lastUpdateAt = new Date();
    site.lastUpdatedBy = userId as any;
    site.lastUpdateType = "EVENING_COMPLETE";
    await site.save();

    // WorkPhoto timeline log
    const workPhoto = new WorkPhoto({
      tenantId,
      siteId,
      photoType: "after",
      photoUri: eveningPhoto,
      location: {
        latitude: eveningLocation?.latitude || 0,
        longitude: eveningLocation?.longitude || 0,
      },
      timestamp: new Date(),
    });
    await workPhoto.save();

    await update.populate("createdBy", "name role");
    return res.status(200).json(update);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Get Daily Work Updates Timeline History for a Site
 */
export const getDailyWorkHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { siteId } = req.params;

    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

    const history = await DailySiteWorkUpdate.find({ tenantId, siteId })
      .populate("createdBy", "name role")
      .sort({ dateStr: -1 });

    return res.json(history);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Get Single Daily Work Update Details
 */
export const getDailyWorkUpdateById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { siteId, updateId } = req.params;

    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

    const update = await DailySiteWorkUpdate.findOne({ _id: updateId, tenantId, siteId })
      .populate("createdBy", "name role");

    if (!update) {
      return res.status(404).json({ error: "Daily work update not found" });
    }

    return res.json(update);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
