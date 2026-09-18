import { Response } from "express";
import mongoose from "mongoose";
import { AuthenticatedRequest } from "../middleware/auth";
import {
  Site,
  Worker,
  User,
  Attendance,
  DailySiteActivity,
  DailySiteSession,
  Tenant,
  Project,
} from "../models";
import { getIO } from "../utils/socket";

// Helper for format YYYY-MM-DD in local time
function getTodayDateStr(date?: Date): string {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimeString(date?: Date): string {
  const d = date || new Date();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

// Calculate Haversine distance in meters
function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * 0. CONTRACTOR SITES CONTROL OVERVIEW
 * GET /api/sites/control/summary?date=YYYY-MM-DD
 */
export const getContractorSitesControl = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

    const { date } = req.query;
    const targetDateStr = (date as string) || getTodayDateStr();
    const [yStr, mStr, dStr] = targetDateStr.split("-");
    const targetYear = parseInt(yStr, 10);
    const targetMonth = parseInt(mStr, 10);
    const targetDay = parseInt(dStr, 10);

    // 1. Fetch contractor details
    const contractor = await User.findById(userId).select("name phone email");

    // 2. Fetch all active sites for this tenant
    const sites = await Site.find({
      tenantId,
      isDeleted: false,
      isArchived: false,
    })
      .populate("supervisor", "name phone email")
      .sort({ updatedAt: -1 })
      .lean();

    // 3. For each site, calculate today's metrics
    const siteCards = await Promise.all(
      sites.map(async (site) => {
        // Assigned workers
        const assignedWorkers = await Worker.find({
          tenantId,
          projectId: site._id,
          isArchived: false,
        }).lean();

        // Also find workers who worked at this site today via DailySiteSession
        const todaySessions = await DailySiteSession.find({
          tenantId,
          siteId: site._id,
          dateStr: targetDateStr,
        }).lean();

        const sessionWorkerIds = todaySessions.map((s) => s.workerId.toString());
        const additionalWorkers = await Worker.find({
          _id: { $in: sessionWorkerIds },
          tenantId,
          isArchived: false,
        }).lean();

        const workerMap = new Map<string, any>();
        assignedWorkers.forEach((w) => workerMap.set(w._id.toString(), w));
        additionalWorkers.forEach((w) => workerMap.set(w._id.toString(), w));
        const allSiteWorkers = Array.from(workerMap.values());
        const totalWorkers = allSiteWorkers.length;

        // Attendance today
        const workerObjectIds = allSiteWorkers.map((w) => w._id);
        const attendanceRecords = await Attendance.find({
          tenantId,
          workerId: { $in: workerObjectIds },
          year: targetYear,
          month: targetMonth,
          day: targetDay,
        }).lean();

        let presentCount = 0;
        attendanceRecords.forEach((rec) => {
          if (["P", "H", "OT"].includes(rec.value as string)) {
            presentCount++;
          }
        });

        // Site activities today
        const activities = await DailySiteActivity.find({
          tenantId,
          siteId: site._id,
          dateStr: targetDateStr,
        }).lean();

        const morningUpdates = activities.filter((a) => a.activityType === "MORNING_WORK");
        const eveningUpdates = activities.filter((a) => a.activityType === "EVENING_WORK");
        const openIssues = activities.filter(
          (a) => a.activityType === "ISSUE" && a.status === "OPEN"
        );
        const updatesCount = morningUpdates.length + eveningUpdates.length;

        // Determine clear status indicator:
        // 🔴 Attention Required (if open issues > 0 or status === "Delayed")
        // ⚪ Completed (if status === "Completed")
        // 🟢 Active (default)
        let statusBadge = "Active";
        if (site.status === "Completed") {
          statusBadge = "Completed";
        } else if (openIssues.length > 0 || site.status === "Delayed") {
          statusBadge = "Attention Required";
        }

        return {
          id: site._id,
          name: site.name,
          address: site.address || "Nashik",
          projectType: site.projectType || "Residential Project",
          status: site.status,
          statusBadge,
          totalWorkers,
          presentWorkers: presentCount,
          updatesCount,
          openIssuesCount: openIssues.length,
          morningSubmitted: morningUpdates.length,
          morningTotal: totalWorkers,
          eveningSubmitted: eveningUpdates.length,
          eveningTotal: totalWorkers,
          supervisorName: (site.supervisor as any)?.name,
          lastUpdateAt: site.updatedAt,
        };
      })
    );

    // Global summary metrics
    const totalSites = siteCards.length;
    const activeSites = siteCards.filter((s) => s.statusBadge !== "Completed").length;
    const totalWorkers = siteCards.reduce((sum, s) => sum + s.totalWorkers, 0);
    const workersPresent = siteCards.reduce((sum, s) => sum + s.presentWorkers, 0);
    const totalUpdates = siteCards.reduce((sum, s) => sum + s.updatesCount, 0);
    const totalOpenIssues = siteCards.reduce((sum, s) => sum + s.openIssuesCount, 0);

    return res.json({
      success: true,
      contractorName: contractor?.name || "Contractor",
      dateStr: targetDateStr,
      metrics: {
        totalSites,
        activeSites,
        totalWorkers,
        workersPresent,
        totalUpdates,
        totalOpenIssues,
      },
      sites: siteCards,
    });
  } catch (error: any) {
    console.error("getContractorSitesControl error:", error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 1. CONTRACTOR SITE CONTROL CENTER
 * GET /api/sites/:siteId/control?date=YYYY-MM-DD
 */
export const getSiteControlCenter = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const tenantId = req.user?.tenantId;
    const { siteId } = req.params;
    const { date } = req.query;

    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

    const targetDateStr = (date as string) || getTodayDateStr();
    const [yStr, mStr, dStr] = targetDateStr.split("-");
    const targetYear = parseInt(yStr, 10);
    const targetMonth = parseInt(mStr, 10);
    const targetDay = parseInt(dStr, 10);

    const site = await Site.findOne({
      _id: siteId,
      tenantId,
      isDeleted: false,
    }).populate("supervisor", "name phone email profileImage");

    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }

    // 1. Fetch site workers (assigned by projectId/siteId or active session today)
    const assignedWorkers = await Worker.find({
      tenantId,
      projectId: site._id,
      isArchived: false,
    }).lean();

    // Also find workers who worked at this site today via DailySiteSession
    const todaySessions = await DailySiteSession.find({
      tenantId,
      siteId: site._id,
      dateStr: targetDateStr,
    }).lean();

    const sessionWorkerIds = todaySessions.map((s) => s.workerId.toString());
    const additionalWorkers = await Worker.find({
      _id: { $in: sessionWorkerIds },
      tenantId,
      isArchived: false,
    }).lean();

    const workerMap = new Map<string, any>();
    assignedWorkers.forEach((w) => workerMap.set(w._id.toString(), w));
    additionalWorkers.forEach((w) => workerMap.set(w._id.toString(), w));
    const allSiteWorkers = Array.from(workerMap.values());

    const totalWorkers = allSiteWorkers.length;

    // 2. Fetch today's attendance records for these workers
    const workerObjectIds = allSiteWorkers.map((w) => w._id);
    const attendanceRecords = await Attendance.find({
      tenantId,
      workerId: { $in: workerObjectIds },
      year: targetYear,
      month: targetMonth,
      day: targetDay,
    }).lean();

    const attendanceMap = new Map<string, any>();
    attendanceRecords.forEach((a) => attendanceMap.set(a.workerId.toString(), a));

    let presentCount = 0;
    let absentCount = 0;
    let halfDayCount = 0;
    let otCount = 0;

    attendanceRecords.forEach((rec) => {
      if (rec.value === "P") presentCount++;
      else if (rec.value === "A") absentCount++;
      else if (rec.value === "H") halfDayCount++;
      else if (rec.value === "OT") {
        presentCount++;
        otCount++;
      }
    });

    // 3. Fetch today's activities for this site
    const activities = await DailySiteActivity.find({
      tenantId,
      siteId: site._id,
      dateStr: targetDateStr,
    })
      .sort({ createdAt: -1 })
      .lean();

    // 4. Compute Morning & Evening update counts
    const morningUpdates = activities.filter((a) => a.activityType === "MORNING_WORK");
    const eveningUpdates = activities.filter((a) => a.activityType === "EVENING_WORK");
    const openIssues = activities.filter(
      (a) => a.activityType === "ISSUE" && a.status === "OPEN"
    );
    const activeInstructions = activities.filter(
      (a) => a.activityType === "INSTRUCTION" && a.status === "ACTIVE"
    );
    const sitePhotos = activities
      .filter((a) => !!a.photo)
      .map((a) => ({
        id: a._id,
        workerName: a.userName,
        photo: a.photo,
        activityType: a.activityType,
        timeStr: a.timeStr,
        description: a.description,
        location: a.location,
        createdAt: a.createdAt,
      }));

    // 5. Build worker card summaries
    const workerCards = allSiteWorkers.map((w) => {
      const att = attendanceMap.get(w._id.toString());
      const workerMorning = morningUpdates.find(
        (m) =>
          m.workerId?.toString() === w._id.toString() ||
          (w.userId && m.userId?.toString() === w.userId.toString())
      );
      const workerEvening = eveningUpdates.find(
        (e) =>
          e.workerId?.toString() === w._id.toString() ||
          (w.userId && e.userId?.toString() === w.userId.toString())
      );

      let lastActivityTime = "—";
      if (workerEvening) lastActivityTime = workerEvening.timeStr;
      else if (workerMorning) lastActivityTime = workerMorning.timeStr;
      else if (att?.timestamp) lastActivityTime = formatTimeString(new Date(att.timestamp));

      return {
        id: w._id,
        uniqueId: w.uniqueId,
        name: w.name,
        category: w.category,
        dailyRate: w.dailyRate || 0,
        phone: w.phone,
        photoUri: w.photoUri,
        attendanceStatus: att?.value || "unmarked",
        morningStatus: workerMorning ? "submitted" : "pending",
        morningTime: workerMorning?.timeStr,
        eveningStatus: workerEvening ? "submitted" : "pending",
        eveningTime: workerEvening?.timeStr,
        lastActivityTime,
      };
    });

    // 6. Emergency Contacts
    const contractor = await User.findById(site.createdBy).select("name phone email");
    const supervisor = site.supervisor as any;

    const emergencyContacts = [
      {
        role: "Contractor",
        name: contractor?.name || "Contractor",
        phone: contractor?.phone || "",
      },
      {
        role: "Site Supervisor",
        name: supervisor?.name || "Site Supervisor",
        phone: supervisor?.phone || "",
      },
    ].filter((c) => !!c.phone);

    return res.json({
      success: true,
      site: {
        id: site._id,
        name: site.name,
        address: site.address,
        projectType: site.projectType,
        status: site.status,
        location: site.location,
        startDate: site.startDate,
      },
      dateStr: targetDateStr,
      metrics: {
        totalWorkers,
        presentCount,
        absentCount,
        halfDayCount,
        otCount,
        workUpdatesCount: morningUpdates.length + eveningUpdates.length,
        openIssuesCount: openIssues.length,
        activeInstructionsCount: activeInstructions.length,
      },
      attendanceSummary: {
        present: presentCount,
        absent: absentCount,
        halfDay: halfDayCount,
        overtime: otCount,
      },
      morningProgress: {
        submittedCount: morningUpdates.length,
        totalWorkers,
        percentage:
          totalWorkers > 0
            ? Math.round((morningUpdates.length / totalWorkers) * 100)
            : 0,
      },
      eveningProgress: {
        submittedCount: eveningUpdates.length,
        totalWorkers,
        percentage:
          totalWorkers > 0
            ? Math.round((eveningUpdates.length / totalWorkers) * 100)
            : 0,
      },
      sitePhotos,
      openIssues,
      activeInstructions,
      dailyTimeline: activities,
      emergencyContacts,
      workers: workerCards,
    });
  } catch (error: any) {
    console.error("getSiteControlCenter error:", error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 2. SUBMIT WORK UPDATE (Morning or Evening)
 * POST /api/sites/:siteId/work-updates
 */
export const submitWorkUpdate = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user?.id;
    const { siteId } = req.params;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const {
      activityType,
      photo,
      location,
      clientRequestId,
      description,
    } = req.body;

    let normalizedType = (activityType || "").toUpperCase().trim();
    if (normalizedType === "MORNING") normalizedType = "MORNING_WORK";
    if (normalizedType === "EVENING") normalizedType = "EVENING_WORK";

    if (!["MORNING_WORK", "EVENING_WORK"].includes(normalizedType)) {
      return res.status(400).json({
        error: "Photo type must be MORNING or EVENING",
      });
    }

    if (!photo) {
      return res.status(400).json({ error: "Photo is required for work update." });
    }

    if (
      !location ||
      typeof location.latitude !== "number" ||
      typeof location.longitude !== "number"
    ) {
      return res.status(400).json({
        error: "Location permission and GPS coordinates are required for work photos.",
      });
    }

    // Check idempotency with clientRequestId
    if (clientRequestId) {
      const existing = await DailySiteActivity.findOne({ clientRequestId });
      if (existing) {
        return res.json({ success: true, activity: existing, isDuplicate: true });
      }
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const phoneDigits = user.phone ? user.phone.replace(/\D/g, "") : "";
    const clean10 = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : "";

    // Link corresponding Worker record if available
    let worker = await Worker.findOne({
      $or: [
        { userId: user._id },
        ...(user.uniqueId ? [{ uniqueId: user.uniqueId }] : []),
        ...(clean10 ? [{ phone: new RegExp(clean10 + "$") }] : []),
        ...(user.phone ? [{ phone: user.phone }] : []),
      ],
      isArchived: false,
    }).sort({ updatedAt: -1, createdAt: -1 });

    let effectiveTenantId = worker?.tenantId || user.tenantId || req.user?.tenantId;
    if (user.contractorId) {
      const contractor = await User.findById(user.contractorId);
      if (contractor?.tenantId) effectiveTenantId = contractor.tenantId;
    }

    let site = await Site.findOne({ _id: siteId, isDeleted: false });
    if (!site) {
      const proj = await Project.findOne({ _id: siteId, isDeleted: { $ne: true } });
      if (proj) {
        site = await Site.findOne({ name: proj.name, tenantId: effectiveTenantId, isDeleted: false });
        if (!site) {
          site = new Site({
            tenantId: effectiveTenantId,
            name: proj.name,
            address: proj.location || "Site Address",
            projectType: "Residential Project",
            status: "Active",
            createdBy: user.contractorId || user._id,
          });
          await site.save();
        }
      }
    }
    if (!site) return res.status(404).json({ error: "Site not found" });

    const now = new Date();
    const dateStr = getTodayDateStr(now);
    const timeStr = formatTimeString(now);

    // Prevent duplicate morning/evening submission for same worker & same date
    const duplicateQuery: any = {
      siteId: site._id,
      dateStr,
      activityType: normalizedType,
    };
    if (worker) {
      duplicateQuery.workerId = worker._id;
    } else {
      duplicateQuery.userId = user._id;
    }

    const duplicate = await DailySiteActivity.findOne(duplicateQuery);
    if (duplicate) {
      const isMorning = normalizedType === "MORNING_WORK";
      return res.status(400).json({
        error: `${isMorning ? "Morning" : "Evening"} photo already uploaded for today.`,
      });
    }

    const defaultDesc =
      normalizedType === "MORNING_WORK"
        ? "Morning Work Photo"
        : "Evening Work Photo";

    const activityTenantId = site.tenantId || effectiveTenantId;

    const activity = new DailySiteActivity({
      tenantId: activityTenantId,
      siteId: site._id,
      workerId: worker ? worker._id : undefined,
      userId: user._id,
      userName: user.name,
      workerRole: user.workerCategory || worker?.category || user.role,
      activityType: normalizedType,
      photo,
      description: (description || "").trim() || defaultDesc,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        address: location.address || site.address,
      },
      dateStr,
      timeStr,
      clientRequestId,
      capturedAt: now,
    });

    await activity.save();

    // Auto-record or update DailySiteSession for today
    if (worker) {
      await DailySiteSession.findOneAndUpdate(
        { workerId: worker._id, dateStr },
        {
          $setOnInsert: {
            tenantId: activityTenantId,
            workerId: worker._id,
            userId: user._id,
            siteId: site._id,
            dateStr,
            startTime: now,
            location: location
              ? { latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy }
              : undefined,
            source: "SMART_DETECTED_SITE",
          },
        },
        { upsert: true, new: true }
      );
    }

    // Real-time socket broadcast
    try {
      const io = getIO();
      io.to(`tenant_${activityTenantId}`).emit("site:activity_added", {
        siteId: site._id,
        activity,
      });
      io.to(`site_${site._id}`).emit("site:activity_added", {
        siteId: site._id,
        activity,
      });
      io.emit("admin_dashboard_update");
    } catch (sErr) {
      console.warn("Socket broadcast warning:", sErr);
    }

    return res.status(201).json({
      success: true,
      message: `${
        normalizedType === "MORNING_WORK" ? "Morning" : "Evening"
      } update submitted successfully!`,
      activity,
    });
  } catch (error: any) {
    console.error("submitWorkUpdate error:", error);
    return res.status(500).json({ error: error.message });
  }
};



/**
 * 3. START TODAY'S WORK SESSION (1-Tap Zero Friction)
 * POST /api/sites/session/start
 */
export const startDailyWorkSession = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { siteId, location, source } = req.body;
    if (!siteId) return res.status(400).json({ error: "siteId is required" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const phoneDigits = user.phone ? user.phone.replace(/\D/g, "") : "";
    const clean10 = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : "";

    let worker = await Worker.findOne({
      $or: [
        { userId: user._id },
        ...(user.uniqueId ? [{ uniqueId: user.uniqueId }] : []),
        ...(clean10 ? [{ phone: new RegExp(clean10 + "$") }] : []),
        ...(user.phone ? [{ phone: user.phone }] : []),
      ],
      isArchived: false,
    }).sort({ updatedAt: -1, createdAt: -1 });

    let effectiveTenantId = worker?.tenantId || user.tenantId || req.user?.tenantId;
    if (user.contractorId) {
      const contractor = await User.findById(user.contractorId);
      if (contractor?.tenantId) effectiveTenantId = contractor.tenantId;
    }

    let site = await Site.findOne({ _id: siteId, isDeleted: false });
    if (!site) {
      const proj = await Project.findOne({ _id: siteId, isDeleted: { $ne: true } });
      if (proj) {
        site = await Site.findOne({ name: proj.name, tenantId: effectiveTenantId, isDeleted: false });
        if (!site) {
          site = new Site({
            tenantId: effectiveTenantId,
            name: proj.name,
            address: proj.location || "Site Address",
            projectType: "Residential Project",
            status: "Active",
            createdBy: user.contractorId || user._id,
          });
          await site.save();
        }
      }
    }
    if (!site) return res.status(404).json({ error: "Site not found" });

    const sessionTenantId = site.tenantId || effectiveTenantId;

    if (!worker) {
      worker = new Worker({
        tenantId: sessionTenantId,
        userId: user._id,
        uniqueId: user.uniqueId,
        name: user.name,
        phone: user.phone,
        category: user.workerCategory || "labour",
        dailyRate: user.dailyWage || 0,
        projectId: site._id,
        isArchived: false,
      });
      await worker.save();
    }

    const now = new Date();
    const dateStr = getTodayDateStr(now);

    const session = await DailySiteSession.findOneAndUpdate(
      { workerId: worker._id, dateStr },
      {
        tenantId: sessionTenantId,
        siteId: site._id,
        userId: user._id,
        startTime: now,
        location: location
          ? { latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy }
          : undefined,
        source: source || "DEFAULT_SITE",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({
      success: true,
      message: `Started work at ${site.name}`,
      session,
      site: {
        id: site._id,
        name: site.name,
        address: site.address,
      },
    });
  } catch (error: any) {
    console.error("startDailyWorkSession error:", error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 4. GET WORKER TODAY'S CONTEXT (Smart Detection + Default Site + Status)
 * GET /api/workers/me/today-context
 */
export const getWorkerTodayContext = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const userId = req.user?.id;
    const { lat, lng, lon } = req.query;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const phoneDigits = user.phone ? user.phone.replace(/\D/g, "") : "";
    const clean10 = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : "";

    // 1. Locate Worker record across tenants
    let worker = await Worker.findOne({
      $or: [
        { userId: user._id },
        ...(user.uniqueId ? [{ uniqueId: user.uniqueId }] : []),
        ...(clean10 ? [{ phone: new RegExp(clean10 + "$") }] : []),
        ...(user.phone ? [{ phone: user.phone }] : []),
      ],
      isArchived: false,
    }).sort({ updatedAt: -1, createdAt: -1 });

    // 2. Resolve effective contractor and tenantId
    let effectiveTenantId = worker?.tenantId || user.tenantId || req.user?.tenantId;
    let contractorUser: any = null;

    if (user.contractorId) {
      contractorUser = await User.findById(user.contractorId);
      if (contractorUser?.tenantId) {
        effectiveTenantId = contractorUser.tenantId;
      }
    } else if (worker?.tenantId) {
      contractorUser = await User.findOne({
        tenantId: worker.tenantId,
        role: { $in: ["contractor", "builder", "admin"] },
      });
      if (contractorUser) {
        user.contractorId = contractorUser._id as any;
        user.contractorName = contractorUser.name;
        user.contractorCompany = contractorUser.companyName || contractorUser.name;
        user.connectionStatus = "connected";
      }
    }

    if (effectiveTenantId && user.tenantId?.toString() !== effectiveTenantId.toString()) {
      user.tenantId = effectiveTenantId as any;
      await user.save();
    }

    const now = new Date();
    const dateStr = getTodayDateStr(now);
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth() + 1;
    const todayDay = now.getDate();

    // 3. Fetch active session today if already started
    let activeSession = null;
    if (worker) {
      activeSession = await DailySiteSession.findOne({
        workerId: worker._id,
        dateStr,
      }).populate("siteId", "name address location projectType status");
    }

    // 4. Fetch default assigned site
    let defaultSite: any = null;
    if (worker?.projectId) {
      defaultSite = await Site.findOne({
        _id: worker.projectId,
        isDeleted: false,
      });
      if (!defaultSite) {
        const proj = await Project.findOne({ _id: worker.projectId, isDeleted: { $ne: true } });
        if (proj) {
          defaultSite = await Site.findOne({ name: proj.name, tenantId: effectiveTenantId, isDeleted: false });
          if (!defaultSite) {
            defaultSite = new Site({
              tenantId: effectiveTenantId,
              name: proj.name,
              address: proj.location || "Site Address",
              projectType: "Residential Project",
              status: "Active",
              createdBy: user.contractorId || user._id,
            });
            await defaultSite.save();
          }
        }
      }
    }

    // Fallback A: Active site in effectiveTenantId
    if (!defaultSite) {
      defaultSite = await Site.findOne({
        tenantId: effectiveTenantId,
        isDeleted: false,
        isArchived: false,
      }).sort({ updatedAt: -1, createdAt: -1 });
    }

    // Fallback B: Site created by contractor
    if (!defaultSite && contractorUser) {
      defaultSite = await Site.findOne({
        createdBy: contractorUser._id,
        isDeleted: false,
        isArchived: false,
      }).sort({ updatedAt: -1, createdAt: -1 });
    }

    // Fallback C: Active Project in effectiveTenantId
    if (!defaultSite) {
      const proj = await Project.findOne({
        tenantId: effectiveTenantId,
        status: "active",
        isDeleted: { $ne: true },
      }).sort({ updatedAt: -1, createdAt: -1 });

      if (proj) {
        defaultSite = await Site.findOne({ name: proj.name, tenantId: effectiveTenantId, isDeleted: false });
        if (!defaultSite) {
          defaultSite = new Site({
            tenantId: effectiveTenantId,
            name: proj.name,
            address: proj.location || "Site Address",
            projectType: "Residential Project",
            status: "Active",
            createdBy: user.contractorId || user._id,
          });
          await defaultSite.save();
        }
      }
    }

    // Fallback D: Any active site in system
    if (!defaultSite) {
      defaultSite = await Site.findOne({ isDeleted: false, isArchived: false }).sort({ updatedAt: -1 });
    }

    // 5. Smart GPS Detection against all registered sites
    const allSites = await Site.find({
      $or: [
        { tenantId: effectiveTenantId },
        ...(contractorUser ? [{ createdBy: contractorUser._id }] : []),
      ],
      isDeleted: false,
      isArchived: false,
    }).lean();

    let detectedNearbySite: any = null;
    const clientLat = lat ? parseFloat(lat as string) : null;
    const rawLng = lng || lon;
    const clientLng = rawLng ? parseFloat(rawLng as string) : null;

    if (clientLat !== null && clientLng !== null && !isNaN(clientLat) && !isNaN(clientLng)) {
      for (const s of allSites) {
        if (s.location?.latitude && s.location?.longitude) {
          const dist = getDistanceMeters(
            clientLat,
            clientLng,
            s.location.latitude,
            s.location.longitude
          );
          const geofenceRadius = s.location.radius || 400; // 400m radius
          if (dist <= geofenceRadius) {
            detectedNearbySite = s;
            break;
          }
        }
      }
    }

    // 6. Current working site resolution
    let activeWorkingSite = activeSession?.siteId || defaultSite;

    // 7. Today's attendance status
    let todayAttendance = null;
    if (worker || user._id) {
      todayAttendance = await Attendance.findOne({
        $or: [
          ...(worker ? [{ workerId: worker._id }] : []),
          { userId: user._id },
        ],
        year: todayYear,
        month: todayMonth,
        day: todayDay,
      });
    }

    // 8. Today's work update status
    let morningUpdate = null;
    let eveningUpdate = null;
    if (activeWorkingSite) {
      const siteIdToQuery = (activeWorkingSite._id || activeWorkingSite.id || activeWorkingSite);
      morningUpdate = await DailySiteActivity.findOne({
        siteId: siteIdToQuery,
        dateStr,
        activityType: "MORNING_WORK",
        $or: [
          ...(worker ? [{ workerId: worker._id }] : []),
          { userId: user._id },
        ],
      });

      eveningUpdate = await DailySiteActivity.findOne({
        siteId: siteIdToQuery,
        dateStr,
        activityType: "EVENING_WORK",
        $or: [
          ...(worker ? [{ workerId: worker._id }] : []),
          { userId: user._id },
        ],
      });
    }

    // 9. Latest active instruction for today's site
    let latestInstruction = null;
    if (activeWorkingSite) {
      const siteIdToQuery = (activeWorkingSite._id || activeWorkingSite.id || activeWorkingSite);
      latestInstruction = await DailySiteActivity.findOne({
        siteId: siteIdToQuery,
        activityType: "INSTRUCTION",
        status: "ACTIVE",
      }).sort({ createdAt: -1 });
    }

    return res.json({
      success: true,
      worker: {
        id: worker?._id || user._id,
        uniqueId: worker?.uniqueId || user.uniqueId,
        name: user.name,
        category: user.workerCategory || worker?.category || "Labour",
        dailyWage: user.dailyWage || worker?.dailyRate || 0,
        profileImage: user.profileImage,
        contractorName: user.contractorName || contractorUser?.name,
      },
      hasActiveSession: !!activeSession,
      activeSession,
      defaultSite: defaultSite
        ? {
            id: defaultSite._id,
            name: defaultSite.name,
            address: defaultSite.address,
            location: defaultSite.location,
          }
        : null,
      detectedNearbySite: detectedNearbySite
        ? {
            id: detectedNearbySite._id,
            name: detectedNearbySite.name,
            address: detectedNearbySite.address,
            location: detectedNearbySite.location,
          }
        : null,
      activeWorkingSite: activeWorkingSite
        ? {
            id: (activeWorkingSite as any)._id || (activeWorkingSite as any).id,
            name: (activeWorkingSite as any).name || "",
            address: (activeWorkingSite as any).address || "",
            location: (activeWorkingSite as any).location,
          }
        : null,
      attendance: {
        status: todayAttendance?.value || "unmarked",
        overtimeHours: todayAttendance?.overtimeHours || 0,
      },
      workUpdates: {
        morning: {
          submitted: !!morningUpdate,
          time: morningUpdate?.timeStr,
          photo: morningUpdate?.photo,
          description: morningUpdate?.description,
        },
        evening: {
          submitted: !!eveningUpdate,
          time: eveningUpdate?.timeStr,
          photo: eveningUpdate?.photo,
          description: eveningUpdate?.description,
        },
      },
      latestInstruction: latestInstruction
        ? {
            id: latestInstruction._id,
            description: latestInstruction.description,
            timeStr: latestInstruction.timeStr,
            userName: latestInstruction.userName,
            createdAt: latestInstruction.createdAt,
          }
        : null,
    });
  } catch (error: any) {
    console.error("getWorkerTodayContext error:", error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 5. GET SITE LOGS (Worker & Contractor Feed with Filters)
 * GET /api/workers/me/site-logs?siteId=...&filter=all|instructions|work|issues
 */
export const getWorkerSiteLogs = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const tenantId = req.user?.tenantId;
    const { siteId, filter } = req.query;

    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

    let targetSiteId = siteId as string;
    if (!targetSiteId) {
      const firstSite = await Site.findOne({ tenantId, isDeleted: false });
      targetSiteId = firstSite?._id?.toString() || "";
    }

    if (!targetSiteId) {
      return res.json({ success: true, logs: [] });
    }

    const query: any = { tenantId, siteId: targetSiteId };

    if (filter === "instructions") {
      query.activityType = "INSTRUCTION";
    } else if (filter === "work") {
      query.activityType = { $in: ["MORNING_WORK", "EVENING_WORK"] };
    } else if (filter === "issues") {
      query.activityType = "ISSUE";
    }

    const logs = await DailySiteActivity.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({ success: true, logs });
  } catch (error: any) {
    console.error("getWorkerSiteLogs error:", error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 6. REPORT SITE ISSUE
 * POST /api/sites/:siteId/issues
 */
export const reportSiteIssue = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { siteId } = req.params;

    if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

    const { title, description, photo, location } = req.body;

    if (!description && !title) {
      return res.status(400).json({ error: "Issue description or title is required." });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const site = await Site.findOne({ _id: siteId, tenantId, isDeleted: false });
    if (!site) return res.status(404).json({ error: "Site not found" });

    const worker = await Worker.findOne({
      tenantId,
      $or: [{ userId: user._id }, ...(user.uniqueId ? [{ uniqueId: user.uniqueId }] : [])],
    });

    const now = new Date();
    const dateStr = getTodayDateStr(now);
    const timeStr = formatTimeString(now);

    const issueActivity = new DailySiteActivity({
      tenantId,
      siteId: site._id,
      workerId: worker?._id,
      userId: user._id,
      userName: user.name,
      workerRole: user.workerCategory || worker?.category || user.role,
      activityType: "ISSUE",
      photo,
      description: title ? `${title.trim()}: ${(description || "").trim()}` : description.trim(),
      location: location
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            address: location.address,
          }
        : undefined,
      dateStr,
      timeStr,
      status: "OPEN",
      capturedAt: now,
    });

    await issueActivity.save();

    // Broadcast socket
    try {
      const io = getIO();
      io.to(`tenant_${tenantId}`).emit("site:issue_reported", {
        siteId: site._id,
        issue: issueActivity,
      });
      io.emit("admin_dashboard_update");
    } catch (sErr) {}

    return res.status(201).json({
      success: true,
      message: "Issue reported successfully.",
      issue: issueActivity,
    });
  } catch (error: any) {
    console.error("reportSiteIssue error:", error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 7. RESOLVE SITE ISSUE (Contractor / Supervisor)
 * PATCH /api/issues/:issueId/resolve
 */
export const resolveSiteIssue = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { issueId } = req.params;

    if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

    const issue = await DailySiteActivity.findOne({
      _id: issueId,
      tenantId,
      activityType: "ISSUE",
    });

    if (!issue) {
      return res.status(404).json({ error: "Issue not found" });
    }

    issue.status = "RESOLVED";
    issue.resolvedBy = new mongoose.Types.ObjectId(userId);
    issue.resolvedAt = new Date();
    await issue.save();

    // Broadcast socket
    try {
      const io = getIO();
      io.to(`tenant_${tenantId}`).emit("site:issue_resolved", {
        issueId: issue._id,
        siteId: issue.siteId,
      });
      io.emit("admin_dashboard_update");
    } catch (sErr) {}

    return res.json({
      success: true,
      message: "Issue marked as resolved.",
      issue,
    });
  } catch (error: any) {
    console.error("resolveSiteIssue error:", error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 8. ADD SITE INSTRUCTION (Contractor / Supervisor)
 * POST /api/sites/:siteId/instructions
 */
export const addSiteInstruction = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { siteId } = req.params;

    if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

    const { instruction, description } = req.body;
    const finalContent = (instruction || description || "").trim();

    if (!finalContent) {
      return res.status(400).json({ error: "Instruction content is required." });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const site = await Site.findOne({ _id: siteId, tenantId, isDeleted: false });
    if (!site) return res.status(404).json({ error: "Site not found" });

    const now = new Date();
    const dateStr = getTodayDateStr(now);
    const timeStr = formatTimeString(now);

    const instructionActivity = new DailySiteActivity({
      tenantId,
      siteId: site._id,
      userId: user._id,
      userName: user.name,
      workerRole: user.role === "contractor" ? "Contractor" : "Supervisor",
      activityType: "INSTRUCTION",
      description: finalContent,
      dateStr,
      timeStr,
      status: "ACTIVE",
      capturedAt: now,
    });

    await instructionActivity.save();

    // Broadcast socket
    try {
      const io = getIO();
      io.to(`tenant_${tenantId}`).emit("site:instruction_added", {
        siteId: site._id,
        instruction: instructionActivity,
      });
      io.emit("admin_dashboard_update");
    } catch (sErr) {}

    return res.status(201).json({
      success: true,
      message: "Instruction published to site logs.",
      instruction: instructionActivity,
    });
  } catch (error: any) {
    console.error("addSiteInstruction error:", error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * 9. GET WORKER SUMMARY STATS (Today, This Week, This Month)
 * GET /api/workers/me/summary
 */
export const getWorkerSummaryStats = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const worker = await Worker.findOne({
      tenantId,
      $or: [{ userId: user._id }, ...(user.uniqueId ? [{ uniqueId: user.uniqueId }] : [])],
      isArchived: false,
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    // Date calculations for This Week (past 7 days)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(currentYear, currentMonth - 1, 1);

    // 1. Attendance Records
    let attendanceMonth: any[] = [];
    if (worker) {
      attendanceMonth = await Attendance.find({
        tenantId,
        workerId: worker._id,
        year: currentYear,
        month: currentMonth,
      }).lean();
    }

    const todayAttendance = attendanceMonth.find((a) => a.day === currentDay);
    const monthPresentDays = attendanceMonth.filter(
      (a) => a.value === "P" || a.value === "OT"
    ).length;

    const weekAttendance = attendanceMonth.filter((a) => {
      const aDate = new Date(currentYear, currentMonth - 1, a.day);
      return aDate >= weekStart && aDate <= now && (a.value === "P" || a.value === "OT");
    }).length;

    // 2. Work Updates Activities
    const workerQuery: any = { tenantId };
    if (worker) {
      workerQuery.$or = [{ workerId: worker._id }, { userId: user._id }];
    } else {
      workerQuery.userId = user._id;
    }

    const allActivities = await DailySiteActivity.find({
      ...workerQuery,
      createdAt: { $gte: monthStart },
      activityType: { $in: ["MORNING_WORK", "EVENING_WORK"] },
    }).lean();

    const todayDateStr = getTodayDateStr(now);
    const todayMorning = allActivities.find(
      (a) => a.dateStr === todayDateStr && a.activityType === "MORNING_WORK"
    );
    const todayEvening = allActivities.find(
      (a) => a.dateStr === todayDateStr && a.activityType === "EVENING_WORK"
    );

    const weekActivities = allActivities.filter((a) => new Date(a.createdAt) >= weekStart);
    const weekMorningCount = weekActivities.filter((a) => a.activityType === "MORNING_WORK").length;
    const weekEveningCount = weekActivities.filter((a) => a.activityType === "EVENING_WORK").length;

    return res.json({
      success: true,
      today: {
        attendance: todayAttendance?.value || "unmarked",
        morningUpdate: todayMorning ? "submitted" : "pending",
        morningTime: todayMorning?.timeStr,
        eveningUpdate: todayEvening ? "submitted" : "pending",
        eveningTime: todayEvening?.timeStr,
      },
      thisWeek: {
        attendanceDays: weekAttendance,
        totalUpdates: weekActivities.length,
        morningCount: weekMorningCount,
        eveningCount: weekEveningCount,
      },
      thisMonth: {
        attendanceDays: monthPresentDays,
        totalUpdates: allActivities.length,
      },
    });
  } catch (error: any) {
    console.error("getWorkerSummaryStats error:", error);
    return res.status(500).json({ error: error.message });
  }
};
