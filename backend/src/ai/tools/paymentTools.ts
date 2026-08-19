import mongoose from "mongoose";
import { Payment } from "../../models";

export interface PaymentFilter {
  tenantId: string;
  workerId?: string;
  workerIds?: string[];
  year?: number;
  month?: number;
}

export class PaymentTools {
  /**
   * Fetch payment records for a worker or company within tenant scope
   */
  public static async getPayments(filter: PaymentFilter) {
    const query: any = { tenantId: new mongoose.Types.ObjectId(filter.tenantId) };

    if (filter.workerId) {
      query.workerId = new mongoose.Types.ObjectId(filter.workerId);
    } else if (filter.workerIds && filter.workerIds.length > 0) {
      query.workerId = { $in: filter.workerIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }

    if (filter.year) {
      query.year = filter.year;
    }
    if (filter.month) {
      query.month = filter.month;
    }

    const payments = await Payment.find(query)
      .select("workerId year month amount paidAt note method transactionId paidByName receivedByName status")
      .sort({ paidAt: -1 })
      .lean();

    return payments.map((p) => ({
      id: p._id.toString(),
      workerId: p.workerId.toString(),
      year: p.year,
      month: p.month,
      amount: p.amount,
      paidAt: p.paidAt,
      note: p.note || "",
      method: p.method || "Cash",
      paidByName: p.paidByName || "",
      receivedByName: p.receivedByName || "",
      status: p.status || "Completed",
    }));
  }
}
