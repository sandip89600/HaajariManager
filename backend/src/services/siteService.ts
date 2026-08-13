import { Site, ISite, User } from "../models";
import mongoose from "mongoose";

export class SiteService {
  /**
   * Check if a site name already exists under the same tenant
   */
  static async checkDuplicateName(tenantId: string, name: string, excludeSiteId?: string): Promise<boolean> {
    const query: any = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      isDeleted: false
    };

    if (excludeSiteId) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeSiteId) };
    }

    const existing = await Site.findOne(query);
    return !!existing;
  }

  /**
   * Create a new Site
   */
  static async createSite(data: Partial<ISite> & { tenantId: string; createdBy: string }): Promise<ISite> {
    const isDuplicate = await this.checkDuplicateName(data.tenantId, data.name || "");
    if (isDuplicate) {
      throw new Error("A site with this name already exists");
    }

    const site = new Site({
      ...data,
      tenantId: new mongoose.Types.ObjectId(data.tenantId),
      createdBy: new mongoose.Types.ObjectId(data.createdBy),
      supervisor: data.supervisor ? new mongoose.Types.ObjectId(data.supervisor) : undefined
    });

    return await site.save();
  }

  /**
   * Get Site details by ID
   */
  static async getSiteById(tenantId: string, siteId: string): Promise<ISite | null> {
    return await Site.findOne({
      _id: new mongoose.Types.ObjectId(siteId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false
    }).populate("supervisor", "name email phone role").populate("lastUpdatedBy", "name role");
  }

  /**
   * Update an existing Site
   */
  static async updateSite(tenantId: string, siteId: string, data: Partial<ISite>): Promise<ISite | null> {
    const site = await Site.findOne({
      _id: new mongoose.Types.ObjectId(siteId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false
    });

    if (!site) {
      throw new Error("Site not found");
    }

    if (data.name) {
      const isDuplicate = await this.checkDuplicateName(tenantId, data.name, siteId);
      if (isDuplicate) {
        throw new Error("A site with this name already exists");
      }
    }

    // Assign fields
    const updatableFields = ["name", "projectType", "clientName", "address", "startDate", "description", "status", "supervisor", "isArchived"];
    for (const field of updatableFields) {
      if ((data as any)[field] !== undefined) {
        if (field === "supervisor") {
          (site as any)[field] = data.supervisor ? new mongoose.Types.ObjectId(data.supervisor) : undefined;
        } else {
          (site as any)[field] = (data as any)[field];
        }
      }
    }

    return await site.save();
  }

  /**
   * Soft Delete a Site
   */
  static async deleteSite(tenantId: string, siteId: string): Promise<boolean> {
    const site = await Site.findOne({
      _id: new mongoose.Types.ObjectId(siteId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false
    });

    if (!site) {
      return false;
    }

    site.isDeleted = true;
    await site.save();
    return true;
  }

  /**
   * Query Sites with search, filter, sorting, and pagination
   */
  static async querySites(params: {
    tenantId: string;
    search?: string;
    status?: string;
    sortBy?: string;
    page?: number;
    limit?: number;
  }) {
    const { tenantId, search, status, sortBy, page = 1, limit = 10 } = params;

    const query: any = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isDeleted: false
    };

    // Filter by status (including "Archived" flag vs standard statuses)
    if (status) {
      if (status === "Archived") {
        query.isArchived = true;
      } else {
        query.status = status;
        query.isArchived = false; // Don't show archived sites when querying other statuses unless requested
      }
    } else {
      query.isArchived = false; // Default: hide archived sites from main list
    }

    // Search query resolution (Search by Site Name, Client Name, Address, Supervisor Name)
    if (search) {
      const searchRegex = new RegExp(search.trim(), "i");
      
      // Look up matching supervisors if search query could match supervisor name
      const matchingSupervisors = await User.find({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        name: searchRegex
      }).select("_id");
      
      const supervisorIds = matchingSupervisors.map(u => u._id);

      query.$or = [
        { name: searchRegex },
        { clientName: searchRegex },
        { address: searchRegex },
        { projectType: searchRegex }
      ];

      if (supervisorIds.length > 0) {
        query.$or.push({ supervisor: { $in: supervisorIds } });
      }
    }

    // Sorting definition
    let sortObj: any = { updatedAt: -1 }; // default: latest updated
    if (sortBy) {
      switch (sortBy) {
        case "Alphabetical":
          sortObj = { name: 1 };
          break;
        case "Newest":
          sortObj = { createdAt: -1 };
          break;
        case "Oldest":
          sortObj = { createdAt: 1 };
          break;
        case "Recently Updated":
          sortObj = { updatedAt: -1 };
          break;
      }
    }

    // Pagination calculations
    const skip = (page - 1) * limit;

    const [sites, total] = await Promise.all([
      Site.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate("supervisor", "name email phone role")
        .populate("lastUpdatedBy", "name role"),
      Site.countDocuments(query)
    ]);

    return {
      sites,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }
}
