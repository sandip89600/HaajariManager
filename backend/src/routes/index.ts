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

const router = Router();

router.use("/auth", authRoutes);
router.use("/workers", workerRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/payments", paymentRoutes);
router.use("/upload", uploadRoutes);
router.use("/projects", projectRoutes);
router.use("/supervisors", supervisorRoutes);
router.use("/admin", adminRoutes);
router.use("/support", supportRoutes);
router.use("/export", exportRoutes);

export default router;


