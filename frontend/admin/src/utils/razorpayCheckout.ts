import toast from "react-hot-toast";

declare global {
  interface Window {
    Razorpay: any;
  }
}

// Dynamically load Razorpay Standard Checkout Script
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error("[Razorpay] Failed to load Razorpay checkout SDK script.");
      resolve(false);
    };
    document.body.appendChild(script);
  });
};

export interface RazorpayPaymentParams {
  amount: number; // in INR (will be converted to paise automatically)
  planName?: string;
  billingCycle?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  onSuccess?: (paymentDetails: any) => void;
  onFailure?: (error: any) => void;
}

export const startRazorpayWebCheckout = async ({
  amount,
  planName = "basic",
  billingCycle = "monthly",
  userName = "Haajari User",
  userEmail = "",
  userPhone = "",
  onSuccess,
  onFailure,
}: RazorpayPaymentParams) => {
  try {
    const isLoaded = await loadRazorpayScript();
    if (!isLoaded) {
      toast.error("Razorpay SDK failed to load. Please check your internet connection.");
      return;
    }

    const apiBaseUrl = import.meta.env.VITE_API_URL || "https://haajarimanager.onrender.com/api";
    const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_TSg4wZpi0xM7On";

    const amountInPaise = Math.round(amount * 100);

    // STEP 1: BACKEND - Create Order
    const orderRes = await fetch(`${apiBaseUrl}/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: "INR",
        receipt: `rcpt_${Date.now()}`,
      }),
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok || !orderData.success) {
      throw new Error(orderData.error || "Failed to create Razorpay payment order.");
    }

    const { order_id } = orderData;

    // STEP 2: FRONTEND - Razorpay Standard Checkout Modal
    const options = {
      key: razorpayKeyId,
      amount: amountInPaise,
      currency: "INR",
      name: "Haajari Manager",
      description: `Subscription Upgrade - ${planName.toUpperCase()} (${billingCycle})`,
      image: "https://haajarimanager.onrender.com/logo.png",
      order_id: order_id,
      prefill: {
        name: userName,
        email: userEmail,
        contact: userPhone,
      },
      notes: {
        planName,
        billingCycle,
      },
      theme: {
        color: "#F97316", // Haajari Brand Orange
      },
      handler: async function (response: any) {
        // STEP 3: BACKEND - Verify Signature
        try {
          toast.loading("Verifying payment signature...", { id: "razorpay-verify" });

          const verifyRes = await fetch(`${apiBaseUrl}/verify-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          const verifyData = await verifyRes.json();
          toast.dismiss("razorpay-verify");

          if (verifyRes.ok && verifyData.success) {
            toast.success("Payment verified successfully! 🎉");
            if (onSuccess) onSuccess(verifyData);
          } else {
            toast.error(verifyData.message || "Payment signature verification failed.");
            if (onFailure) onFailure(verifyData);
          }
        } catch (err: any) {
          toast.dismiss("razorpay-verify");
          toast.error("Network error during payment verification.");
          if (onFailure) onFailure(err);
        }
      },
      modal: {
        ondismiss: function () {
          toast.error("Payment modal cancelled by user.");
          if (onFailure) onFailure({ cancelled: true });
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", function (response: any) {
      toast.error(response.error.description || "Payment failed.");
      if (onFailure) onFailure(response.error);
    });
    rzp.open();
  } catch (err: any) {
    console.error("[Razorpay Checkout] Error:", err);
    toast.error(err.message || "Unable to launch Razorpay Checkout.");
    if (onFailure) onFailure(err);
  }
};
