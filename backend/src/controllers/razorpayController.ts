import { Request, Response } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";

// Initialize Razorpay SDK using environment variables
const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error("Razorpay API credentials (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET) are missing from environment.");
  }

  return new Razorpay({
    key_id,
    key_secret,
  });
};

/**
 * STEP 1: BACKEND - Create Order
 * Endpoint: POST /api/create-order
 * Request: { amount (paise), currency, receipt }
 * Return: { order_id, amount, currency }
 * Minimum amount: 100 paise
 */
export const createOrder = async (req: Request, res: Response) => {
  try {
    const { amount, currency = "INR", receipt } = req.body;

    // Validate minimum amount (>= 100 paise)
    const numericAmount = Number(amount);
    if (!numericAmount || isNaN(numericAmount) || numericAmount < 100) {
      return res.status(400).json({
        success: false,
        error: "Invalid amount. Minimum amount must be at least 100 paise (1 INR).",
      });
    }

    const razorpay = getRazorpayInstance();

    const options = {
      amount: Math.round(numericAmount),
      currency: currency || "INR",
      receipt: receipt || `receipt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    };

    const order = await razorpay.orders.create(options);

    return res.status(200).json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
    });
  } catch (error: any) {
    console.error("[Razorpay] Error creating order:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to create Razorpay order",
    });
  }
};

/**
 * STEP 3: BACKEND - Verify Signature
 * Endpoint: POST /api/verify-payment
 * Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 * Compare generated signature with razorpay_signature
 * Return success only if signatures match
 */
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing required verification fields: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.",
      });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.status(500).json({
        success: false,
        message: "Razorpay secret key is missing on the server.",
      });
    }

    // Generate expected HMAC-SHA256 signature
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(body.toString())
      .digest("hex");

    const isSignatureValid = expectedSignature === razorpay_signature;

    if (!isSignatureValid) {
      console.warn("[Razorpay] Signature mismatch for order:", razorpay_order_id);
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature verification failed.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
    });
  } catch (error: any) {
    console.error("[Razorpay] Error verifying payment:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error during payment verification.",
    });
  }
};
