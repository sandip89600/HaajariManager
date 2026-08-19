import { QueryPlan } from "./queryPlanner";
import { WorkerTools } from "../tools/workerTools";
import { AttendanceTools } from "../tools/attendanceTools";
import { PaymentTools } from "../tools/paymentTools";
import { SalaryTools, WorkerSummaryCalculation } from "../tools/salaryTools";
import { ProjectTools } from "../tools/projectTools";
import { ReportTools } from "../tools/reportTools";

export interface RetrievedDataPayload {
  tenantId: string;
  intent: string;
  year: number;
  month: number;
  workers: any[];
  attendance: any[];
  payments: any[];
  projects?: any[];
  payrollCalculations: WorkerSummaryCalculation[];
  companySummary?: any;
}

export class Retriever {
  public static async retrieve(tenantId: string, plan: QueryPlan): Promise<RetrievedDataPayload> {
    const year = plan.year;
    const month = plan.month;

    // 1. Fetch Workers (strict tenant scope)
    const workers = await WorkerTools.searchWorkers({
      tenantId,
      name: plan.workerName,
    });

    const workerIds = workers.map((w) => w.id);

    // 2. Fetch Attendance (strict tenant scope)
    let attendance: any[] = [];
    if (workerIds.length > 0 && plan.dataSources.includes("attendance")) {
      attendance = await AttendanceTools.getAttendanceRecords({
        tenantId,
        workerIds,
        year,
        month,
      });
    }

    // 3. Fetch Payments (strict tenant scope)
    let payments: any[] = [];
    if (workerIds.length > 0 && plan.dataSources.includes("payments")) {
      payments = await PaymentTools.getPayments({
        tenantId,
        workerIds,
        year,
        month,
      });
    }

    // 4. Calculate Authoritative Payroll Summaries
    const payrollCalculations: WorkerSummaryCalculation[] = workers.map((w) => {
      const wAttendance = attendance.filter((a) => a.workerId === w.id);
      const wPayments = payments.filter((p) => p.workerId === w.id);

      return SalaryTools.calculatePayroll(
        w.id,
        w.name,
        w.dailyRate,
        year,
        month,
        wAttendance,
        wPayments
      );
    });

    // 5. Fetch Projects if relevant
    let projects: any[] = [];
    if (plan.dataSources.includes("projects")) {
      projects = await ProjectTools.getProjects({ tenantId });
    }

    // 6. Company Summary if report intent
    let companySummary: any = undefined;
    if (plan.intent === "COMPANY_MONTHLY_REPORT") {
      companySummary = await ReportTools.getMonthlyCompanySummary({
        tenantId,
        year,
        month,
      });
    }

    return {
      tenantId,
      intent: plan.intent,
      year,
      month,
      workers,
      attendance,
      payments,
      projects,
      payrollCalculations,
      companySummary,
    };
  }
}
