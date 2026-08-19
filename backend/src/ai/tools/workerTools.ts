import mongoose from "mongoose";
import { Worker } from "../../models";

export interface WorkerFilter {
  tenantId: string;
  name?: string;
  workerId?: string;
  projectId?: string;
  category?: string;
}

export class WorkerTools {
  /**
   * Search workers by name or category under a strict tenantId filter
   */
  public static async searchWorkers(filter: WorkerFilter) {
    const query: any = { tenantId: new mongoose.Types.ObjectId(filter.tenantId), isArchived: false };

    if (filter.workerId) {
      query._id = new mongoose.Types.ObjectId(filter.workerId);
    } else if (filter.name) {
      query.name = { $regex: filter.name, $options: "i" };
    }

    if (filter.projectId) {
      query.projectId = new mongoose.Types.ObjectId(filter.projectId);
    }

    if (filter.category) {
      query.category = { $regex: filter.category, $options: "i" };
    }

    const workers = await Worker.find(query)
      .select("name category dailyRate skillCategory paymentType pieceRateAmount subContractorName phone notes isArchived createdAt")
      .lean();

    return workers.map(w => ({
      id: w._id.toString(),
      name: w.name,
      category: w.category,
      dailyRate: w.dailyRate,
      skillCategory: w.skillCategory || "unskilled",
      paymentType: w.paymentType || "daily",
      phone: w.phone || "N/A",
      notes: w.notes || "",
    }));
  }

  /**
   * Get single worker details cleanly
   */
  public static async getWorkerById(tenantId: string, workerId: string) {
    const worker = await Worker.findOne({
      _id: new mongoose.Types.ObjectId(workerId),
      tenantId: new mongoose.Types.ObjectId(tenantId),
    }).lean();

    if (!worker) return null;

    return {
      id: worker._id.toString(),
      name: worker.name,
      category: worker.category,
      dailyRate: worker.dailyRate,
      skillCategory: worker.skillCategory,
      paymentType: worker.paymentType,
      phone: worker.phone,
      notes: worker.notes,
      isArchived: worker.isArchived,
    };
  }
}
