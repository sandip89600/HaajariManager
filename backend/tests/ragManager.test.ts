/// <reference types="jest" />
process.env.NODE_ENV = "test";

import { QueryPlanner } from "../src/ai/rag/queryPlanner";
import { SalaryTools } from "../src/ai/tools/salaryTools";
import { ResponseValidator } from "../src/ai/rag/responseValidator";
import { ContextBuilder } from "../src/ai/rag/contextBuilder";

describe("Smart RAG Manager Components Test Suite", () => {
  describe("QueryPlanner Intent & Entity Extraction", () => {
    test("detects salary/payment query for specific worker and month", () => {
      const plan = QueryPlanner.plan("Ramesh ka August ka payment kitna pending hai?");
      expect(plan.intent).toBe("SALARY_CALCULATION");
      expect(plan.workerName).toBe("Ramesh");
      expect(plan.month).toBe(8);
      expect(plan.dataSources).toContain("workers");
      expect(plan.dataSources).toContain("attendance");
      expect(plan.dataSources).toContain("payments");
    });

    test("detects attendance query", () => {
      const plan = QueryPlanner.plan("How many days did Ramesh work this month?");
      expect(plan.intent).toBe("ATTENDANCE_SUMMARY");
      expect(plan.workerName).toBe("Ramesh");
    });

    test("detects action request requiring confirmation", () => {
      const plan = QueryPlanner.plan("Ramesh ko ₹5,000 payment kar do");
      expect(plan.intent).toBe("ACTION_REQUEST");
      expect(plan.actionDetails).toBeDefined();
      expect(plan.actionDetails?.requiresConfirmation).toBe(true);
    });

    test("detects company-wide monthly report query", () => {
      const plan = QueryPlanner.plan("Show monthly labour cost report");
      expect(plan.intent).toBe("COMPANY_MONTHLY_REPORT");
    });
  });

  describe("SalaryTools Authoritative Calculations", () => {
    test("calculates gross salary, working days, paid amount, and pending balance correctly", () => {
      const attendance = [
        { value: "P", dailyRate: 800 },
        { value: "P", dailyRate: 800 },
        { value: "H", dailyRate: 800 },
        { value: "A", dailyRate: 800 },
        { value: "OT", dailyRate: 800, overtimeWage: 200 },
      ];
      const payments = [{ amount: 1000, status: "Completed" }];

      const summary = SalaryTools.calculatePayroll(
        "worker123",
        "Ramesh",
        800,
        2026,
        8,
        attendance,
        payments
      );

      // Present: 2 * 800 = 1600
      // Half: 1 * 400 = 400
      // OT: 1 * 800 + 200 = 1000
      // Total Gross: 1600 + 400 + 1000 = 3000
      // Total Paid: 1000
      // Pending: 2000
      expect(summary.presentDays).toBe(2);
      expect(summary.halfDays).toBe(1);
      expect(summary.absentDays).toBe(1);
      expect(summary.overtimeDays).toBe(1);
      expect(summary.grossSalary).toBe(3000);
      expect(summary.totalPaid).toBe(1000);
      expect(summary.pendingAmount).toBe(2000);
      expect(summary.totalWorkingDays).toBe(3.5);
    });
  });

  describe("ContextBuilder & ResponseValidator Safety", () => {
    test("contextBuilder constructs minimal structured JSON string", () => {
      const payload: any = {
        tenantId: "tenant1",
        intent: "SALARY_CALCULATION",
        year: 2026,
        month: 8,
        workers: [{ id: "w1", name: "Ramesh", dailyRate: 800 }],
        attendance: [],
        payments: [],
        payrollCalculations: [
          {
            workerId: "w1",
            workerName: "Ramesh",
            dailyRate: 800,
            presentDays: 20,
            halfDays: 2,
            grossSalary: 16800,
            totalPaid: 10000,
            pendingAmount: 6800,
          },
        ],
      };
      const plan = QueryPlanner.plan("Ramesh ka payment");
      const contextStr = ContextBuilder.buildContext(payload, plan);

      expect(contextStr).toContain("Ramesh");
      expect(contextStr).toContain("16800");
    });

    test("responseValidator attaches requiresConfirmation for action requests", () => {
      const plan = QueryPlanner.plan("Ramesh ko ₹5000 payment kar do");
      const validated = ResponseValidator.validate(
        "Confirm payment of ₹5,000 for Ramesh?",
        plan,
        {}
      );

      expect(validated.requiresConfirmation).toBe(true);
      expect(validated.actionPayload).toBeDefined();
    });
  });
});
