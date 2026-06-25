import { Router } from "express";
import { getAttendanceForMonth, setAttendanceRecord, syncAttendance, deleteAttendanceRecord } from "../controllers/attendanceController";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

router.use(authenticateJWT as any);

router.get("/month", getAttendanceForMonth as any);
router.post("/record", setAttendanceRecord as any);
router.post("/sync", syncAttendance as any);
router.delete("/:id", deleteAttendanceRecord as any);

export default router;
