import { Router } from "express";
import { getPaymentsForMonth, addPayment, deletePayment } from "../controllers/paymentController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

router.use(authenticateJWT as any);

router.get("/month", getPaymentsForMonth as any);
router.post("/", addPayment as any);
router.delete("/:id", deletePayment as any);

export default router;
