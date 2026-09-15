import { Response } from "express";
import { Payment, AuditLog, User, Worker } from "../models";
import { AuthenticatedRequest } from "../middleware/auth";
import { broadcastAdminActivity } from "../utils/socket";
import { logActivity } from "../services/activityLogger";

export const getPaymentsForMonth = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const role = req.user?.role;
    const { year, month } = req.query;

    if (!year || month === undefined || month === null || month === "") {
      return res.status(400).json({ error: "Missing year or month parameters" });
    }

    const y = parseInt(year as string);
    const m = parseInt(month as string);
    const monthFilter = { $in: [m, m + 1, ...(m > 0 ? [m - 1] : [])] };

    let query: any = {
      year: y,
      month: monthFilter,
    };

    if (role === "labor" || role === "worker") {
      const user = await User.findById(req.user?.id);
      const phoneDigits = user?.phone ? String(user.phone).replace(/\D/g, "") : "";
      const cleanPhone = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : "";
      const phoneRegex = cleanPhone ? new RegExp(cleanPhone + "$") : null;

      const matchedWorkers = await Worker.find({
        $or: [
          { userId: user?._id },
          ...(user?.uniqueId ? [{ uniqueId: user.uniqueId }] : []),
          ...(phoneRegex ? [{ phone: phoneRegex }] : []),
          ...(user?.phone ? [{ phone: user.phone }] : []),
          ...(user?.name ? [{ name: new RegExp(`^${user.name.trim()}$`, "i") }] : []),
        ],
      }).lean();

      const workerIds = matchedWorkers.map((w) => w._id);
      if (workerIds.length === 0) {
        return res.json([]);
      }
      query.workerId = { $in: workerIds };
    } else {
      query.tenantId = tenantId;
    }

    const payments = await Payment.find(query).populate("createdBy", "name").lean();
    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const addPayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const {
      workerId,
      year,
      month,
      amount,
      note,
      method,
      transactionId,
      referenceNumber,
      paidByName,
      receivedByName,
      status,
    } = req.body;

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
      transactionId,
      referenceNumber,
      paidByName,
      receivedByName,
      status: status || "Completed",
    });
    await payment.save();
    await payment.populate("createdBy", "name");

    // Socket notification
    try {
      const workerDoc = await Worker.findById(workerId).select("userId uniqueId tenantId");
      const io = (await import("../utils/socket")).getIO();
      if (workerDoc?.userId) {
        io.to(`user_${workerDoc.userId}`).emit("attendance:updated", { paymentId: payment._id });
      }
      if (workerDoc?.uniqueId) {
        io.to(`worker_${workerDoc.uniqueId}`).emit("attendance:updated", { paymentId: payment._id });
      }
      if (tenantId) {
        io.to(`tenant_${tenantId}`).emit("attendance:updated", { paymentId: payment._id });
      }
      io.emit("admin_dashboard_update");
    } catch (socketErr) {
      console.warn("[Payment Controller] Socket notification non-fatal error:", socketErr);
    }

    res.status(201).json(payment);

    // Non-blocking activity logging
    logActivity({
      req,
      action: "PAYMENT_ADDED",
      targetType: "PAYMENT",
      targetId: payment._id.toString(),
      changes: { after: payment.toObject() }
    }).catch((logErr) => {
      console.warn("[Payment Controller] Non-blocking activity log error:", logErr);
    });
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

    res.json({ success: true, message: "Payment record deleted successfully" });

    // Non-blocking activity logging
    logActivity({
      req,
      action: "PAYMENT_DELETED",
      targetType: "PAYMENT",
      targetId: id,
      changes: { before }
    }).catch((logErr) => {
      console.warn("[Payment Controller] Non-blocking activity log error:", logErr);
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
