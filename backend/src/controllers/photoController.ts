import { Request, Response } from "express";
import { WorkPhoto, AuditLog } from "../models";
import { AuthenticatedRequest } from "../middleware/auth";
import { broadcastAdminActivity } from "../utils/socket";

export const getSitePhotos = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { siteId } = req.params;

    const list = await WorkPhoto.find({ tenantId, siteId })
      .populate("workerId", "name category phone")
      .sort({ timestamp: -1 });

    res.json(list);
  } catch (error: any) {
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
