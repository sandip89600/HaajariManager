export interface WorkerSummaryCalculation {
  workerId: string;
  workerName: string;
  dailyRate: number;
  year: number;
  month: number;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  overtimeDays: number;
  customDays: number;
  totalWorkingDays: number; // Present + (Half / 2) + Overtime
  customWageTotal: number;
  overtimeWageTotal: number;
  grossSalary: number;
  totalPaid: number;
  pendingAmount: number;
}

export class SalaryTools {
  /**
   * Authoritative backend payroll calculation for a worker in a specific month
   */
  public static calculatePayroll(
    workerId: string,
    workerName: string,
    dailyRate: number,
    year: number,
    month: number,
    attendanceRecords: any[],
    paymentRecords: any[]
  ): WorkerSummaryCalculation {
    let presentDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let overtimeDays = 0;
    let customDays = 0;
    let customWageTotal = 0;
    let overtimeWageTotal = 0;
    let grossSalary = 0;

    attendanceRecords.forEach((record) => {
      const rate = record.dailyRate !== undefined && record.dailyRate !== null ? record.dailyRate : dailyRate;
      const extraCustom = record.customWage !== undefined && record.customWage !== null ? record.customWage : 0;
      const extraOT = record.overtimeWage !== undefined && record.overtimeWage !== null ? record.overtimeWage : 0;

      let recordPay = 0;

      if (record.value === "P") {
        presentDays++;
        recordPay = rate + extraCustom + extraOT;
      } else if (record.value === "H") {
        halfDays++;
        recordPay = rate / 2 + extraCustom + extraOT;
      } else if (record.value === "OT") {
        overtimeDays++;
        recordPay = rate + extraCustom + extraOT;
      } else if (record.value === "A") {
        absentDays++;
        recordPay = extraCustom + extraOT;
      } else if (typeof record.value === "number") {
        customDays++;
        recordPay = record.value;
      } else {
        recordPay = extraCustom + extraOT;
      }

      customWageTotal += extraCustom;
      overtimeWageTotal += extraOT;
      grossSalary += recordPay;
    });

    const totalPaid = paymentRecords
      .filter((p) => (p.status ? p.status === "Completed" : true))
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const pendingAmount = grossSalary - totalPaid;
    const totalWorkingDays = presentDays + halfDays * 0.5 + overtimeDays;

    return {
      workerId,
      workerName,
      dailyRate,
      year,
      month,
      presentDays,
      halfDays,
      absentDays,
      overtimeDays,
      customDays,
      totalWorkingDays,
      customWageTotal,
      overtimeWageTotal,
      grossSalary,
      totalPaid,
      pendingAmount,
    };
  }
}
