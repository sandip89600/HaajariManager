import mongoose from "mongoose";
import { Worker, Attendance, Payment } from "../../models";
import { SalaryTools } from "./salaryTools";

export interface MonthlyReportFilter {
  tenantId: string;
  year: number;
  month: number;
  projectId?: string;
}

export class ReportTools {
  public static async getMonthlyCompanySummary(filter: MonthlyReportFilter) {
    const tenantObjectId = new mongoose.Types.ObjectId(filter.tenantId);
    const workerQuery: any = { tenantId: tenantObjectId, isArchived: false };
    if (filter.projectId) {
      workerQuery.projectId = new mongoose.Types.ObjectId(filter.projectId);
    }

    const workers = await Worker.find(workerQuery).lean();
    const workerIds = workers.map((w) => w._id);

    const attendanceRecords = await Attendance.find({
      tenantId: tenantObjectId,
      workerId: { $in: workerIds },
      year: filter.year,
      month: filter.month,
    }).lean();

    const paymentRecords = await Payment.find({
      tenantId: tenantObjectId,
      workerId: { $in: workerIds },
      year: filter.year,
      month: filter.month,
    }).lean();

    const workerSummaries = workers.map((worker) => {
      const wAttendance = attendanceRecords.filter((a) => a.workerId.toString() === worker._id.toString());
      const wPayments = paymentRecords.filter((p) => p.workerId.toString() === worker._id.toString());

      return SalaryTools.calculatePayroll(
        worker._id.toString(),
        worker.name,
        worker.dailyRate,
        filter.year,
        filter.month,
        wAttendance,
        wPayments
      );
    });

    const totalWorkers = workers.length;
    const totalGrossSalary = workerSummaries.reduce((sum, s) => sum + s.grossSalary, 0);
    const totalPaid = workerSummaries.reduce((sum, s) => sum + s.totalPaid, 0);
    const totalPending = workerSummaries.reduce((sum, s) => sum + s.pendingAmount, 0);
    const totalPresentDays = workerSummaries.reduce((sum, s) => sum + s.presentDays, 0);
    const totalHalfDays = workerSummaries.reduce((sum, s) => sum + s.halfDays, 0);

    return {
      year: filter.year,
      month: filter.month,
      totalWorkers,
      totalGrossSalary,
      totalPaid,
      totalPending,
      totalPresentDays,
      totalHalfDays,
      workerSummaries,
    };
  }
}
