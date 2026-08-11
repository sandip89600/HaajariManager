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
import recoveryRoutes from "./recoveryRoutes";

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
router.use("/export", exportRoutes);
router.use("/voice", voiceRoutes);
router.use("/sites", siteRoutes);
router.use("/subscription", subscriptionRoutes);

export default router;


