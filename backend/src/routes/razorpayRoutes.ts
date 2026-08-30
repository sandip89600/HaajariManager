import { Router } from "express";
import { createOrder, verifyPayment } from "../controllers/razorpayController";

const router = Router();

// Standard Razorpay endpoints
router.post("/create-order", createOrder);
router.post("/verify-payment", verifyPayment);

export default router;
