import { Response } from "express";
import { Payment, AuditLog } from "../models";
import { AuthenticatedRequest } from "../middleware/auth";
import { broadcastAdminActivity } from "../utils/socket";

export const getPaymentsForMonth = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: "Missing year or month parameters" });
    }

    const payments = await Payment.find({
      tenantId,
      year: parseInt(year as string),
      month: parseInt(month as string),
    }).populate("createdBy", "name");
    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const addPayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { workerId, year, month, amount, note, method } = req.body;

    if (!workerId || year === undefined || month === undefined || amount === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const payment = new Payment({
      tenantId,
      workerId,
      year,
      month,
      amount,
      note,
      method: method || "Cash",
      createdBy: userId,
    });
    await payment.save();
    await payment.populate("createdBy", "name");

    const auditLog = new AuditLog({
      tenantId,
      userId,
      action: "CREATE",
      targetType: "PAYMENT",
      targetId: payment._id.toString(),
      changes: { after: payment.toObject() },
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.status(201).json(payment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deletePayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const { id } = req.params;

    const payment = await Payment.findOne({ _id: id, tenantId });
    if (!payment) {
      return res.status(404).json({ error: "Payment record not found" });
    }

    const before = payment.toObject();
    await Payment.deleteOne({ _id: id, tenantId });

    const auditLog = new AuditLog({
      tenantId,
      userId,
      action: "DELETE",
      targetType: "PAYMENT",
      targetId: id,
      changes: { before },
    });
    await auditLog.save();
    broadcastAdminActivity(auditLog);

    res.json({ success: true, message: "Payment record deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
