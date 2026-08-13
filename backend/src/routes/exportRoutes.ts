import { Router } from "express";
import { getAttendancePDF, getPaymentSummaryPDF, getCSV, getPrintHTML } from "../controllers/exportController";
import { authenticateJWT } from "../middleware/auth";
import { checkFeatureAccess } from "../middleware/featureAccess";

const router = Router();

router.use(authenticateJWT as any);

router.get("/attendance-pdf", checkFeatureAccess("advancedReports") as any, getAttendancePDF as any);
router.get("/payment-summary", checkFeatureAccess("advancedReports") as any, getPaymentSummaryPDF as any);
router.get("/csv", checkFeatureAccess("advancedReports") as any, getCSV as any);
router.get("/print", checkFeatureAccess("advancedReports") as any, getPrintHTML as any);

export default router;
