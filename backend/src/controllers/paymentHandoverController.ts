import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { PaymentHandover, PaymentProof } from "../models";

export const getHandovers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized: No tenant ID found" });
    }
    const handovers = await PaymentHandover.find({ tenantId }).sort({ createdAt: -1 });
    res.json(handovers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createHandover = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized: No tenant ID found" });
    }
    const { amount, recipientName, notes, siteId, status } = req.body;

    if (!amount || !recipientName) {
      return res.status(400).json({ error: "Amount and recipient name are required" });
    }

    const handover = new PaymentHandover({
      tenantId,
      siteId,
      amount,
      recipientName,
      notes,
      status: status || "Completed"
    });
    await handover.save();

    res.status(201).json({ success: true, handover });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getProofs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized: No tenant ID found" });
    }
    const proofs = await PaymentProof.find({ tenantId }).sort({ uploadedAt: -1 });
    res.json(proofs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createProof = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized: No tenant ID found" });
    }
    const { proofUri, notes, paymentId } = req.body;

    if (!proofUri) {
      return res.status(400).json({ error: "Proof URI is required" });
    }

    const proof = new PaymentProof({
      tenantId,
      paymentId,
      proofUri,
      notes
    });
    await proof.save();

    res.status(201).json({ success: true, proof });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
