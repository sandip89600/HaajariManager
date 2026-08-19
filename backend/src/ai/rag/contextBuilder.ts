import { RetrievedDataPayload } from "./retriever";
import { QueryPlan } from "./queryPlanner";

export class ContextBuilder {
  /**
   * Build token-minimized structured context string for Gemini AI prompt
   */
  public static buildContext(payload: RetrievedDataPayload, plan: QueryPlan): string {
    const monthNames = [
      "", "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const periodName = `${monthNames[payload.month] || payload.month} ${payload.year}`;

    const contextObj: any = {
      period: periodName,
      userIntent: plan.intent,
    };

    if (payload.payrollCalculations && payload.payrollCalculations.length > 0) {
      contextObj.workerPayrollSummaries = payload.payrollCalculations.map((calc) => ({
        workerName: calc.workerName,
        dailyRate: calc.dailyRate,
        presentDays: calc.presentDays,
        halfDays: calc.halfDays,
        absentDays: calc.absentDays,
        overtimeDays: calc.overtimeDays,
        totalWorkingDays: calc.totalWorkingDays,
        grossSalary: calc.grossSalary,
        totalPaid: calc.totalPaid,
        pendingAmount: calc.pendingAmount,
      }));
    } else if (plan.workerName) {
      contextObj.workerLookupResult = `No worker record found matching name '${plan.workerName}'.`;
    }

    if (payload.projects && payload.projects.length > 0) {
      contextObj.projects = payload.projects.map((p) => ({
        name: p.name,
        status: p.status,
        clientName: p.clientName,
        budget: p.budget,
        activeWorkers: p.workerCount,
      }));
    }

    if (payload.companySummary) {
      contextObj.companySummary = {
        totalWorkers: payload.companySummary.totalWorkers,
        totalGrossSalary: payload.companySummary.totalGrossSalary,
        totalPaid: payload.companySummary.totalPaid,
        totalPending: payload.companySummary.totalPending,
        totalPresentDays: payload.companySummary.totalPresentDays,
        totalHalfDays: payload.companySummary.totalHalfDays,
      };
    }

    if (plan.actionDetails) {
      contextObj.actionPendingConfirmation = plan.actionDetails;
    }

    return JSON.stringify(contextObj, null, 2);
  }
}
