import { Router } from "express";
import authRoutes from "./authRoutes";
import workerRoutes from "./workerRoutes";
import attendanceRoutes from "./attendanceRoutes";
import paymentRoutes from "./paymentRoutes";
import uploadRoutes from "./uploadRoutes";
import projectRoutes from "./projectRoutes";
import supervisorRoutes from "./supervisorRoutes";
import adminRoutes from "./adminRoutes";
import supportRoutes from "./supportRoutes";
import exportRoutes from "./exportRoutes";
import voiceRoutes from "./voiceRoutes";
import siteRoutes from "./siteRoutes";
import subscriptionRoutes from "./subscriptionRoutes";
import subscriptionV2Routes from "./subscriptionV2Routes";
import adminSubscriptionV2Routes from "./adminSubscriptionV2Routes";
import recoveryRoutes from "./recoveryRoutes";
import appConfigRoutes from "./appConfigRoutes";
import paymentHandoverRoutes from "./paymentHandoverRoutes";
import haiRoutes from "./haiRoutes";
import notificationRoutes from "./notificationRoutes";
import razorpayRoutes from "./razorpayRoutes";
import feedbackRoutes from "./feedbackRoutes";
import webhookRoutes from "./webhookRoutes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/recovery", recoveryRoutes);
router.use("/workers", workerRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/payments", paymentRoutes);
router.use("/upload", uploadRoutes);
router.use("/projects", projectRoutes);
router.use("/supervisors", supervisorRoutes);
router.use("/admin", adminRoutes);
router.use("/support", supportRoutes);
router.use("/feedback", feedbackRoutes);
router.use("/export", exportRoutes);
router.use("/voice", voiceRoutes);
router.use("/sites", siteRoutes);

// Version 2 Subscription & Admin Subscription APIs
router.use("/v2/subscription", subscriptionV2Routes);
router.use("/v2/admin/subscription", adminSubscriptionV2Routes);

// Legacy subscription aliases pointing to v2 for backwards safety
router.use("/subscription", subscriptionV2Routes);
router.use("/subscriptions", subscriptionV2Routes);

router.use("/webhooks", webhookRoutes);
router.use("/app", appConfigRoutes);
router.use("/payment-handover", paymentHandoverRoutes);
router.use("/hai", haiRoutes);
router.use("/notifications", notificationRoutes);
router.use("/", razorpayRoutes);

export default router;
