/// <reference types="jest" />
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_jwt_secret_1234567890";
process.env.JWT_REFRESH_SECRET = "test_refresh_secret_1234567890";

import mongoose from "mongoose";
mongoose.set("bufferCommands", false);

import { firebasePhoneLogin, claimWorkerProfile, login, sendOtp, PERMANENT_ADMIN } from "../src/controllers/authController";
import { requestRecoveryOtp } from "../src/controllers/recoveryController";
import * as firebaseAdminConfig from "../src/config/firebaseAdmin";
import * as activityLogger from "../src/services/activityLogger";
import * as recoveryAuditService from "../src/services/recoveryAuditService";
import { User, Worker, OtpCode, SecurityEvent, Tenant, RecoverySession, AuditLog } from "../src/models";
import { activeOtpChannel } from "../src/services/otpProvider";
import bcrypt from "bcryptjs";

describe("Firebase Phone Auth T1–T10 Acceptance Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(activityLogger, "logActivity").mockResolvedValue({} as any);
    jest.spyOn(recoveryAuditService, "logRecoveryEvent").mockResolvedValue({} as any);
    jest.spyOn(AuditLog, "create").mockResolvedValue({} as any);
  });

  // T7: Invalid / missing / tampered token validation
  describe("T7: Token Validation and Rejection Policy", () => {
    it("returns HTTP 400 when idToken is missing", async () => {
      const req: any = { body: {} };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await firebasePhoneLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("idToken is required"),
        })
      );
    });

    it("returns HTTP 401 on invalid, tampered or expired token", async () => {
      const verifySpy = jest.spyOn(firebaseAdminConfig, "verifyFirebaseIdToken").mockResolvedValueOnce({
        verified: false,
        statusCode: 401,
        error: "Invalid or expired Firebase ID token.",
      });

      const req: any = { body: { idToken: "invalid_tampered_token" } };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await firebasePhoneLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("Invalid or expired"),
        })
      );
      verifySpy.mockRestore();
    });
  });

  // T6: Phone mismatch check (Token Phone A vs Body Phone B)
  describe("T6: Token Phone vs Body Phone Integrity", () => {
    it("returns HTTP 400 when client body.phone differs from token verified phone", async () => {
      const verifySpy = jest.spyOn(firebaseAdminConfig, "verifyFirebaseIdToken").mockResolvedValueOnce({
        verified: true,
        phone: "+919876543210",
        uid: "firebase_uid_123",
      });

      const req: any = {
        body: {
          idToken: "valid_token_phone_a",
          phone: "9123456789", // Phone B
        },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await firebasePhoneLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("does not match"),
        })
      );
      verifySpy.mockRestore();
    });
  });

  // T8: Suspended / Deactivated account policy
  describe("T8: Suspended and Deactivated Accounts", () => {
    it("returns HTTP 403 when user status is suspended", async () => {
      const verifySpy = jest.spyOn(firebaseAdminConfig, "verifyFirebaseIdToken").mockResolvedValueOnce({
        verified: true,
        phone: "+919876543210",
        uid: "firebase_uid_123",
      });

      const userFindSpy = jest.spyOn(User, "findOne").mockResolvedValueOnce({
        _id: "user_123",
        phone: "9876543210",
        status: "suspended",
        isActive: true,
        role: "contractor",
      } as any);

      const req: any = { body: { idToken: "valid_token" } };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await firebasePhoneLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("suspended or deactivated"),
        })
      );

      verifySpy.mockRestore();
      userFindSpy.mockRestore();
    });

    it("returns HTTP 403 when user isActive is false", async () => {
      const verifySpy = jest.spyOn(firebaseAdminConfig, "verifyFirebaseIdToken").mockResolvedValueOnce({
        verified: true,
        phone: "+919876543210",
        uid: "firebase_uid_123",
      });

      const userFindSpy = jest.spyOn(User, "findOne").mockResolvedValueOnce({
        _id: "user_123",
        phone: "9876543210",
        status: "active",
        isActive: false,
        role: "contractor",
      } as any);

      const req: any = { body: { idToken: "valid_token" } };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await firebasePhoneLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("suspended or deactivated"),
        })
      );

      verifySpy.mockRestore();
      userFindSpy.mockRestore();
    });
  });

  // T9: PERMANENT_ADMIN protection
  describe("T9: Administrative Credentials Protection", () => {
    it("returns HTTP 403 when phone belongs to PERMANENT_ADMIN", async () => {
      const verifySpy = jest.spyOn(firebaseAdminConfig, "verifyFirebaseIdToken").mockResolvedValueOnce({
        verified: true,
        phone: `+91${PERMANENT_ADMIN.phone}`,
        uid: "admin_firebase_uid",
      });

      const userFindSpy = jest.spyOn(User, "findOne").mockResolvedValueOnce({
        _id: "admin_user_id",
        name: PERMANENT_ADMIN.name,
        email: PERMANENT_ADMIN.email,
        phone: PERMANENT_ADMIN.phone,
        role: "admin",
        isActive: true,
        status: "active",
      } as any);

      const req: any = { body: { idToken: "admin_token" } };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await firebasePhoneLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("cannot sign in via phone OTP alone"),
        })
      );

      verifySpy.mockRestore();
      userFindSpy.mockRestore();
    });
  });

  // T4: Unregistered Phone
  describe("T4: Unregistered Phone Handling", () => {
    it("returns isNewUser: true without automatically creating a user account", async () => {
      const verifySpy = jest.spyOn(firebaseAdminConfig, "verifyFirebaseIdToken").mockResolvedValueOnce({
        verified: true,
        phone: "+919999888877",
        uid: "new_firebase_uid",
      });

      const userFindSpy = jest.spyOn(User, "findOne").mockResolvedValueOnce(null);
      const workerFindSpy = jest.spyOn(Worker, "find").mockResolvedValueOnce([]);

      const req: any = { body: { idToken: "valid_new_phone_token" } };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await firebasePhoneLogin(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          isNewUser: true,
          phone: "9999888877",
          firebaseUid: "new_firebase_uid",
        })
      );

      verifySpy.mockRestore();
      userFindSpy.mockRestore();
      workerFindSpy.mockRestore();
    });
  });

  // T3: Registered user returns existing Haajari JWT session
  describe("T3: Registered User Login", () => {
    it("returns standard Haajari JWT session for registered active user", async () => {
      const verifySpy = jest.spyOn(firebaseAdminConfig, "verifyFirebaseIdToken").mockResolvedValueOnce({
        verified: true,
        phone: "+919876543210",
        uid: "registered_uid",
      });

      const mockSave = jest.fn().mockResolvedValue(true);
      const userFindSpy = jest.spyOn(User, "findOne").mockResolvedValueOnce({
        _id: "507f1f77bcf86cd799439011",
        name: "Test Contractor",
        phone: "9876543210",
        email: "test@example.com",
        role: "contractor",
        tenantId: "507f191e810c19729de860ea",
        isActive: true,
        status: "active",
        save: mockSave,
      } as any);

      const req: any = { body: { idToken: "registered_user_token" } };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await firebasePhoneLogin(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: expect.any(String),
          refreshToken: expect.any(String),
          user: expect.objectContaining({
            phone: "9876543210",
            role: "contractor",
            isPhoneVerified: true,
          }),
        })
      );

      expect(mockSave).toHaveBeenCalled();
      verifySpy.mockRestore();
      userFindSpy.mockRestore();
    });
  });

  // T5: Invited worker profile claim
  describe("T5: Invited Worker Profile Claim", () => {
    it("rejects claim if profile is already claimed by another user", async () => {
      const verifySpy = jest.spyOn(firebaseAdminConfig, "verifyFirebaseIdToken").mockResolvedValueOnce({
        verified: true,
        phone: "+919876543210",
      });

      const workerFindSpy = jest.spyOn(Worker, "findOne").mockResolvedValueOnce({
        _id: "worker_1",
        phone: "9876543210",
        isClaimed: true,
        userId: "different_user_id",
      } as any);

      const req: any = {
        body: { idToken: "worker_token", phone: "9876543210" },
        user: { id: "current_user_id" },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await claimWorkerProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("already been claimed"),
        })
      );

      verifySpy.mockRestore();
      workerFindSpy.mockRestore();
    });

    it("succeeds when worker profile is unclaimed and phone matches", async () => {
      const verifySpy = jest.spyOn(firebaseAdminConfig, "verifyFirebaseIdToken").mockResolvedValueOnce({
        verified: true,
        phone: "+919876543210",
      });

      const mockSave = jest.fn().mockResolvedValue(true);
      const workerFindSpy = jest.spyOn(Worker, "findOne").mockResolvedValueOnce({
        _id: "worker_1",
        name: "Raju Worker",
        phone: "9876543210",
        category: "Mason",
        dailyRate: 700,
        isClaimed: false,
        save: mockSave,
      } as any);

      const req: any = {
        body: { idToken: "worker_token", phone: "9876543210" },
        user: { id: "current_user_id" },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await claimWorkerProfile(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          worker: expect.objectContaining({
            id: "worker_1",
            isClaimed: true,
          }),
        })
      );

      expect(mockSave).toHaveBeenCalled();
      verifySpy.mockRestore();
      workerFindSpy.mockRestore();
    });
  });

  // T1: Existing password login regression test
  describe("T1: Existing Password Login Compatibility", () => {
    it("successfully authenticates with valid credentials", async () => {
      const mockHashedPassword = await bcrypt.hash("securepassword123", 10);
      const mockSave = jest.fn().mockResolvedValue(true);

      const userFindSpy = jest.spyOn(User, "findOne")
        .mockResolvedValueOnce(null) // Admin lookup
        .mockResolvedValueOnce({    // User lookup
          _id: "507f1f77bcf86cd799439011",
          name: "Test Contractor",
          phone: "9876543210",
          passwordHash: mockHashedPassword,
          role: "contractor",
          tenantId: "507f191e810c19729de860ea",
          isActive: true,
          status: "active",
          refreshTokens: [],
          trustedDevices: [],
          loginHistory: [],
          save: mockSave,
        } as any);

      const tenantFindSpy = jest.spyOn(Tenant, "findById").mockResolvedValue({
        _id: "507f191e810c19729de860ea",
        name: "Test Org",
      } as any);

      const secEventSpy = jest.spyOn(SecurityEvent, "create").mockResolvedValue({} as any);

      const req: any = {
        body: {
          phone: "9876543210",
          password: "securepassword123",
        },
        headers: { "user-agent": "jest-test" },
        socket: { remoteAddress: "127.0.0.1" },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await login(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.any(String),
          user: expect.objectContaining({
            phone: "9876543210",
            role: "contractor",
          }),
        })
      );

      userFindSpy.mockRestore();
      tenantFindSpy.mockRestore();
      secEventSpy.mockRestore();
    });
  });

  // T2: Existing direct SMS OTP login regression test
  describe("T2: Existing Direct SMS OTP Login", () => {
    it("dispatches OTP code when target phone exists", async () => {
      const userFindSpy = jest.spyOn(User, "findOne").mockResolvedValueOnce({
        _id: "507f1f77bcf86cd799439011",
        name: "Test Contractor",
        phone: "9876543210",
        role: "contractor",
        isActive: true,
      } as any);

      const otpFindSpy = jest.spyOn(OtpCode, "findOne").mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      } as any);
      const deleteManySpy = jest.spyOn(OtpCode, "deleteMany").mockResolvedValue({} as any);
      const otpSaveSpy = jest.spyOn(OtpCode.prototype, "save").mockResolvedValue({} as any);
      const otpSendSpy = jest.spyOn(activeOtpChannel, "send").mockResolvedValue({ success: true, provider: "MockChannel" });

      const req: any = {
        body: { phone: "9876543210" },
        headers: {},
        socket: { remoteAddress: "127.0.0.1" },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await sendOtp(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("OTP sent"),
        })
      );

      userFindSpy.mockRestore();
      otpFindSpy.mockRestore();
      deleteManySpy.mockRestore();
      otpSaveSpy.mockRestore();
      otpSendSpy.mockRestore();
    });
  });

  // T10: Existing /api/recovery/* password recovery regression test
  describe("T10: Password Recovery Unchanged", () => {
    it("handles recovery request for registered mobile number", async () => {
      const userFindSpy = jest.spyOn(User, "findOne").mockResolvedValueOnce({
        _id: "507f1f77bcf86cd799439011",
        name: "Test Contractor",
        phone: "9876543210",
        role: "contractor",
        isActive: true,
      } as any);

      const otpFindSpy = jest.spyOn(OtpCode, "findOne").mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      } as any);
      const deleteManySpy = jest.spyOn(OtpCode, "deleteMany").mockResolvedValue({} as any);
      const otpSaveSpy = jest.spyOn(OtpCode.prototype, "save").mockResolvedValue({} as any);
      const recoverySaveSpy = jest.spyOn(RecoverySession.prototype, "save").mockResolvedValue({} as any);
      const otpSendSpy = jest.spyOn(activeOtpChannel, "send").mockResolvedValue({ success: true, provider: "MockChannel" });

      const req: any = {
        body: { phone: "9876543210" },
        headers: { "user-agent": "jest-test" },
        socket: { remoteAddress: "127.0.0.1" },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await requestRecoveryOtp(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining("Verification code sent"),
        })
      );

      userFindSpy.mockRestore();
      otpFindSpy.mockRestore();
      deleteManySpy.mockRestore();
      otpSaveSpy.mockRestore();
      recoverySaveSpy.mockRestore();
      otpSendSpy.mockRestore();
    });
  });
});
