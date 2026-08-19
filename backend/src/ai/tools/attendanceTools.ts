import mongoose from "mongoose";
import { Attendance } from "../../models";

export interface AttendanceFilter {
  tenantId: string;
  workerId?: string;
  workerIds?: string[];
  projectId?: string;
  year?: number;
  month?: number;
  day?: number;
}

export class AttendanceTools {
  /**
   * Fetch attendance records for tenant with optional filters
   */
  public static async getAttendanceRecords(filter: AttendanceFilter) {
    const query: any = { tenantId: new mongoose.Types.ObjectId(filter.tenantId) };

    if (filter.workerId) {
      query.workerId = new mongoose.Types.ObjectId(filter.workerId);
    } else if (filter.workerIds && filter.workerIds.length > 0) {
      query.workerId = { $in: filter.workerIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }

    if (filter.projectId) {
      query.projectId = new mongoose.Types.ObjectId(filter.projectId);
    }

    const now = new Date();
    query.year = filter.year || now.getFullYear();
    query.month = filter.month || now.getMonth() + 1;

    if (filter.day) {
      query.day = filter.day;
    }

    const records = await Attendance.find(query)
      .select("workerId year month day value dailyRate customWage finalPay overtimeHours overtimeWage timestamp")
      .lean();

    return records.map((r) => ({
      workerId: r.workerId.toString(),
      year: r.year,
      month: r.month,
      day: r.day,
      value: r.value,
      dailyRate: r.dailyRate,
      customWage: r.customWage,
      finalPay: r.finalPay,
      overtimeHours: r.overtimeHours,
      overtimeWage: r.overtimeWage,
    }));
  }
}
