import mongoose from "mongoose";
import { Project, Worker } from "../../models";

export interface ProjectFilter {
  tenantId: string;
  name?: string;
  projectId?: string;
}

export class ProjectTools {
  public static async getProjects(filter: ProjectFilter) {
    const query: any = { tenantId: new mongoose.Types.ObjectId(filter.tenantId) };

    if (filter.projectId) {
      query._id = new mongoose.Types.ObjectId(filter.projectId);
    } else if (filter.name) {
      query.name = { $regex: filter.name, $options: "i" };
    }

    const projects = await Project.find(query).lean();

    const projectSummaries = await Promise.all(
      projects.map(async (p) => {
        const workerCount = await Worker.countDocuments({
          tenantId: new mongoose.Types.ObjectId(filter.tenantId),
          projectId: p._id,
          isArchived: false,
        });

        return {
          id: p._id.toString(),
          name: p.name,
          location: p.location || "N/A",
          status: p.status,
          clientName: p.clientName || "N/A",
          budget: p.budget || 0,
          workerCount,
        };
      })
    );

    return projectSummaries;
  }
}
