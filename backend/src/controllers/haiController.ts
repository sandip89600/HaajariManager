import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { RAGManager } from "../ai/rag/ragManager";

const ragManager = new RAGManager();

export const handleHaiChat = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!tenantId) {
      return res.status(401).json({ success: false, error: "Unauthorized: Missing tenant context" });
    }

    const { message, year, month } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, error: "Message string is required" });
    }

    const result = await ragManager.processQuery({
      userMessage: message.trim(),
      tenantId: tenantId.toString(),
      userId: userId ? userId.toString() : undefined,
      userRole,
      year: year ? parseInt(year) : undefined,
      month: month ? parseInt(month) : undefined,
    });

    return res.json({
      success: true,
      answer: result.answer,
      intent: result.intent,
      sources: result.sources,
      ...(result.requiresConfirmation ? { requiresConfirmation: result.requiresConfirmation, actionPayload: result.actionPayload } : {}),
    });
  } catch (error: any) {
    console.error("[HAI Controller Error]:", error);
    return res.status(500).json({
      success: false,
      error: "An internal error occurred while processing Ask HAI request",
    });
  }
};
