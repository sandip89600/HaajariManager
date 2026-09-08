import { Router } from "express";
import { authenticateJWT } from "../middleware/auth";
import {
  searchSupervisors,
  sendSupervisorConnectionRequest,
  acceptSupervisorConnectionRequest,
  declineSupervisorConnectionRequest,
  getContractorSupervisors,
  searchLabor,
  sendLaborConnectionRequest,
  acceptLaborConnectionRequest,
  declineLaborConnectionRequest,
  getContractorLabor,
  getPendingUserConnectionRequests,
} from "../controllers/connectionController";

const router = Router();

// Connection routes require authenticated JWT user
router.use(authenticateJWT as any);

// Supervisor Connection Endpoints
router.get("/supervisors/search", searchSupervisors as any);
router.post("/supervisors/connection-request", sendSupervisorConnectionRequest as any);
router.post("/supervisors/connection-request/:id/accept", acceptSupervisorConnectionRequest as any);
router.post("/supervisors/connection-request/:id/decline", declineSupervisorConnectionRequest as any);
router.get("/contractor/supervisors", getContractorSupervisors as any);

// Labor Connection Endpoints
router.get("/labor/search", searchLabor as any);
router.post("/labor/connection-request", sendLaborConnectionRequest as any);
router.post("/labor/connection-request/:id/accept", acceptLaborConnectionRequest as any);
router.post("/labor/connection-request/:id/decline", declineLaborConnectionRequest as any);
router.get("/contractor/labor", getContractorLabor as any);

// User Pending Request Alerts Endpoint
router.get("/user/pending-requests", getPendingUserConnectionRequests as any);

export default router;
