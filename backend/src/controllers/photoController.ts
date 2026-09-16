import { Request, Response } from "express";
import { WorkPhoto, AuditLog, DailySiteActivity, Site } from "../models";
import { AuthenticatedRequest } from "../middleware/auth";
import { broadcastAdminActivity } from "../utils/socket";

export const getSitePhotos = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { siteId } = req.params;
    const { date, activityType, workerId, limit = 100 } = req.query;

    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

    // Validate site ownership by tenant
    const site = await Site.findOne({ _id: siteId, tenantId, isDeleted: false });
    if (!site) return res.status(404).json({ error: "Site not found" });

    // Query DailySiteActivity for all photos with strict tenant and site isolation
    const activityQuery: any = {
      tenantId,
      siteId,
      photo: { $exists: true, $ne: "" },
    };

    if (date) {
      activityQuery.dateStr = date;
    }

    if (activityType && activityType !== "ALL" && activityType !== "all") {
      activityQuery.activityType = activityType;
    }

    if (workerId && workerId !== "ALL" && workerId !== "all") {
      activityQuery.$or = [{ workerId }, { userId: workerId }];
    }

    const activities = await DailySiteActivity.find(activityQuery)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    const structuredPhotos = activities.map((a) => ({
      id: a._id,
      photo: a.photo,
      workerId: a.workerId || a.userId,
      workerName: a.userName,
      workerRole: a.workerRole || "Labour",
      activityType: a.activityType,
      description: a.description,
      dateStr: a.dateStr,
      timeStr: a.timeStr,
      location: a.location,
      capturedAt: a.capturedAt || a.createdAt,
    }));

    // Calculate metrics
    const morningCount = activities.filter((a) => a.activityType === "MORNING_WORK").length;
    const eveningCount = activities.filter((a) => a.activityType === "EVENING_WORK").length;
    const issueCount = activities.filter((a) => a.activityType === "ISSUE").length;

    return res.json({
      success: true,
      total: structuredPhotos.length,
      morningCount,
      eveningCount,
      issueCount,
      photos: structuredPhotos,
    });
  } catch (error: any) {
    console.error("getSitePhotos error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const addWorkPhoto = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { siteId } = req.params;
    const { workerId, photoType, photoUri, latitude, longitude } = req.body;

    if (!photoType || !photoUri || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "Missing required fields (photoType, photoUri, latitude, longitude)" });
    }

    const photo = new WorkPhoto({
      tenantId,
      siteId,
      workerId: workerId || undefined,
      photoType,
      photoUri,
      location: {
        latitude,
        longitude
      },
      timestamp: new Date()
    });

    await photo.save();
    if (photo.workerId) {
      await photo.populate("workerId", "name category phone");
    }

    const auditLog = new AuditLog({
      tenantId,
      userId,
      action: "UPLOAD_PHOTO",
      targetType: "WORK_PHOTO",
      targetId: photo._id.toString(),
      changes: { after: photo.toObject() }
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.status(201).json(photo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
