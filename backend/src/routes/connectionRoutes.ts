import { Router } from "express";
import { authenticateJWT } from "../middleware/auth";
import {
  lookupByUniqueId,
  createConnectionRequest,
  verifyConnectionCode,
  disconnectConnection,
  getContractorConnections,
  getPendingUserConnectionRequests,
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
} from "../controllers/connectionController";

const router = Router();

// Connection routes require authenticated JWT user
router.use(authenticateJWT as any);

// Unified Unique ID & Connection Code Endpoints
router.get("/lookup", lookupByUniqueId as any);
router.post("/request", createConnectionRequest as any);
router.post("/verify", verifyConnectionCode as any);
router.post("/disconnect", disconnectConnection as any);
router.get("/contractor/connections", getContractorConnections as any);
router.get("/user/pending-requests", getPendingUserConnectionRequests as any);

// Backward Compatibility Endpoints
router.get("/supervisors/search", searchSupervisors as any);
router.post("/supervisors/connection-request", sendSupervisorConnectionRequest as any);
router.post("/supervisors/connection-request/:id/accept", acceptSupervisorConnectionRequest as any);
router.post("/supervisors/connection-request/:id/decline", declineSupervisorConnectionRequest as any);
router.get("/contractor/supervisors", getContractorSupervisors as any);

router.get("/labor/search", searchLabor as any);
router.post("/labor/connection-request", sendLaborConnectionRequest as any);
router.post("/labor/connection-request/:id/accept", acceptLaborConnectionRequest as any);
router.post("/labor/connection-request/:id/decline", declineLaborConnectionRequest as any);
router.get("/contractor/labor", getContractorLabor as any);

export default router;
