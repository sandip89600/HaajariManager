import { Router } from "express";
import { getAttendancePDF, getPaymentSummaryPDF, getCSV, getPrintHTML } from "../controllers/exportController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

router.use(authenticateJWT as any);

router.get("/attendance-pdf", getAttendancePDF as any);
router.get("/payment-summary", getPaymentSummaryPDF as any);
router.get("/csv", getCSV as any);
router.get("/print", getPrintHTML as any);

export default router;
