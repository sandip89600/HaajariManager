/// <reference types="jest" />
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_jwt_secret_1234567890";
process.env.JWT_REFRESH_SECRET = "test_refresh_secret_1234567890";

import mongoose from "mongoose";
mongoose.set("bufferCommands", false);

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { signup, verifyEmail, login, registerContractor } from "../src/controllers/authController";
import { requestRecoveryOtp, verifyRecoveryOtp } from "../src/controllers/recoveryController";
import { User, Tenant, SecurityEvent, OtpCode, RecoverySession } from "../src/models";
import * as recoveryAuditService from "../src/services/recoveryAuditService";
import * as mailUtils from "../src/utils/mail";
import * as activityLogger from "../src/services/activityLogger";

describe("Email Verification & Optional Phone Acceptance Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(activityLogger, "logActivity").mockResolvedValue({} as any);
    jest.spyOn(SecurityEvent, "create").mockResolvedValue({} as any);
    jest.spyOn(recoveryAuditService, "logRecoveryEvent").mockResolvedValue({} as any);
  });

  describe("1. Signup with Optional Phone & Auto-Username", () => {
    it("successfully creates user without mobile number and dispatches email verification", async () => {
      const emailSpy = jest.spyOn(mailUtils, "sendEmailVerificationEmail").mockResolvedValue(true);
      const findUserSpy = jest.spyOn(User, "findOne").mockResolvedValue(null);
      const tenantSaveSpy = jest.spyOn(Tenant.prototype, "save").mockResolvedValue({} as any);
      
      let createdUserData: any = null;
      const userSaveSpy = jest.spyOn(User.prototype, "save").mockImplementation(function (this: any) {
        createdUserData = this;
        this._id = new mongoose.Types.ObjectId("507f1f77bcf86cd799439011");
        return Promise.resolve(this);
      });

      const req: any = {
        body: {
          name: "John Builder",
          email: "john.builder@example.com",
          password: "SecurePassword123!",
          role: "contractor",
          companyName: "Builder Ltd",
          // Note: No phone, no username
        },
        headers: {},
        socket: { remoteAddress: "127.0.0.1" },
      };

      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await signup(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.any(String),
          refreshToken: expect.any(String),
          user: expect.objectContaining({
            email: "john.builder@example.com",
            isEmailVerified: false,
          }),
          emailVerificationSent: true,
        })
      );

      // Verify that phone is undefined/empty and username is not required or stored
      expect(createdUserData.phone).toBeUndefined();
      expect(createdUserData.username).toBeUndefined();
      expect(createdUserData.emailVerificationTokenHash).toBeDefined();
      expect(createdUserData.emailVerificationExpires).toBeDefined();
      expect(emailSpy).toHaveBeenCalledWith(
        "john.builder@example.com",
        "John Builder",
        expect.any(String)
      );

      emailSpy.mockRestore();
      findUserSpy.mockRestore();
      tenantSaveSpy.mockRestore();
      userSaveSpy.mockRestore();
    });

    it("successfully registers contractor via /api/auth/register/contractor without username", async () => {
      const emailSpy = jest.spyOn(mailUtils, "sendEmailVerificationEmail").mockResolvedValue(true);
      const findUserSpy = jest.spyOn(User, "findOne").mockResolvedValue(null);
      const tenantSaveSpy = jest.spyOn(Tenant.prototype, "save").mockResolvedValue({} as any);

      let createdUserData: any = null;
      const userSaveSpy = jest.spyOn(User.prototype, "save").mockImplementation(function (this: any) {
        createdUserData = this;
        this._id = new mongoose.Types.ObjectId("507f1f77bcf86cd799439011");
        return Promise.resolve(this);
      });

      const req: any = {
        body: {
          name: "Lucky",
          email: "lucky@example.com",
          companyName: "Lucky Construction",
          password: "SecurePassword123!",
          phone: "9422758453",
          // Note: No username provided
        },
        headers: {},
        socket: { remoteAddress: "127.0.0.1" },
      };

      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await registerContractor(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.any(String),
          refreshToken: expect.any(String),
          user: expect.objectContaining({
            email: "lucky@example.com",
            name: "Lucky",
          }),
        })
      );

      expect(createdUserData.username).toBeUndefined();

      emailSpy.mockRestore();
      findUserSpy.mockRestore();
      tenantSaveSpy.mockRestore();
      userSaveSpy.mockRestore();
    });
  });

  describe("2. Email Verification via /api/auth/verify-email", () => {
    it("verifies email successfully with valid token", async () => {
      const rawToken = "sample_raw_verification_token_12345";
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      const mockUser: any = {
        _id: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
        name: "John Builder",
        email: "john.builder@example.com",
        isEmailVerified: false,
        isVerified: false,
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpires: new Date(Date.now() + 3600000), // 1 hr future
        save: jest.fn().mockResolvedValue(true),
      };

      const findSpy = jest.spyOn(User, "findOne").mockResolvedValue(mockUser);

      const req: any = {
        query: { token: rawToken },
        headers: { accept: "application/json" },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };

      await verifyEmail(req, res);

      expect(mockUser.isEmailVerified).toBe(true);
      expect(mockUser.isVerified).toBe(true);
      expect(mockUser.emailVerificationToken).toBeUndefined();
      expect(mockUser.emailVerificationTokenHash).toBeUndefined();
      expect(mockUser.emailVerificationExpires).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringMatching(/verified successfully/i),
        })
      );

      findSpy.mockRestore();
    });

    it("rejects verification when token is invalid or expired", async () => {
      const findSpy = jest.spyOn(User, "findOne").mockResolvedValue(null);

      const req: any = {
        query: { token: "expired_or_invalid_token" },
        headers: { accept: "application/json" },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };

      await verifyEmail(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringMatching(/invalid or has expired/i),
        })
      );

      findSpy.mockRestore();
    });
  });

  describe("3. Direct Login with Email and Optional Phone (No OTP required)", () => {
    it("successfully logs in using email + password directly without requiring OTP", async () => {
      const passwordHash = await bcrypt.hash("SecurePassword123!", 10);
      const mockUser: any = {
        _id: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
        name: "John Builder",
        email: "john.builder@example.com",
        username: "johnbuilder_abc12",
        role: "contractor",
        tenantId: new mongoose.Types.ObjectId("507f191e810c19729de860ea"),
        passwordHash,
        isActive: true,
        status: "active",
        otpEnabled: false,
        refreshTokens: [],
        trustedDevices: [],
        loginHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };

      const findUserSpy = jest.spyOn(User, "findOne")
        .mockResolvedValueOnce(null)     // Admin lookup
        .mockResolvedValueOnce(mockUser); // Regular user lookup

      const tenantFindSpy = jest.spyOn(Tenant, "findById").mockResolvedValue({
        _id: "507f191e810c19729de860ea",
        name: "Test Org",
      } as any);

      const req: any = {
        body: {
          identifier: "john.builder@example.com",
          password: "SecurePassword123!",
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
          refreshToken: expect.any(String),
          user: expect.objectContaining({
            email: "john.builder@example.com",
          }),
        })
      );

      findUserSpy.mockRestore();
      tenantFindSpy.mockRestore();
    });

    it("successfully logs in using phone + password directly without requiring OTP", async () => {
      const passwordHash = await bcrypt.hash("SecurePassword123!", 10);
      const mockUser: any = {
        _id: new mongoose.Types.ObjectId("507f1f77bcf86cd799439022"),
        name: "Mobile Contractor",
        phone: "9876543210",
        email: "mobile@example.com",
        role: "contractor",
        tenantId: new mongoose.Types.ObjectId("507f191e810c19729de860ea"),
        passwordHash,
        isActive: true,
        status: "active",
        otpEnabled: false,
        refreshTokens: [],
        trustedDevices: [],
        loginHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };

      const findUserSpy = jest.spyOn(User, "findOne")
        .mockResolvedValueOnce(null)     // Admin lookup
        .mockResolvedValueOnce(mockUser); // Regular user lookup

      const tenantFindSpy = jest.spyOn(Tenant, "findById").mockResolvedValue({
        _id: "507f191e810c19729de860ea",
        name: "Test Org",
      } as any);

      const req: any = {
        body: {
          phone: "9876543210",
          password: "SecurePassword123!",
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
          refreshToken: expect.any(String),
          user: expect.objectContaining({
            phone: "9876543210",
          }),
        })
      );

      findUserSpy.mockRestore();
      tenantFindSpy.mockRestore();
    });
  });

  describe("4. Account Recovery via Email (Find Account with Email & No Mobile Number)", () => {
    it("successfully sends 6-digit recovery OTP to registered email address", async () => {
      const emailOtpSpy = jest.spyOn(mailUtils, "sendPasswordRecoveryOtpEmail").mockResolvedValue(true);
      const mockUser: any = {
        _id: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
        name: "Lucky Contractor",
        email: "lucky@example.com",
        role: "contractor",
        tenantId: new mongoose.Types.ObjectId("507f191e810c19729de860ea"),
        isActive: true,
      };

      const findUserSpy = jest.spyOn(User, "findOne").mockResolvedValue(mockUser);
      const findOtpSpy = jest.spyOn(OtpCode, "findOne").mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      } as any);
      const deleteOtpSpy = jest.spyOn(OtpCode, "deleteMany").mockResolvedValue({} as any);
      const saveOtpSpy = jest.spyOn(OtpCode.prototype, "save").mockResolvedValue({} as any);

      const req: any = {
        body: { email: "lucky@example.com" },
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
          email: "lucky@example.com",
          message: expect.stringMatching(/verification code sent/i),
        })
      );

      expect(emailOtpSpy).toHaveBeenCalledWith(
        "lucky@example.com",
        "Lucky Contractor",
        expect.stringMatching(/^\d{6}$/)
      );

      emailOtpSpy.mockRestore();
      findUserSpy.mockRestore();
      findOtpSpy.mockRestore();
      deleteOtpSpy.mockRestore();
      saveOtpSpy.mockRestore();
    });

    it("successfully verifies 6-digit OTP sent to email and returns recovery session token", async () => {
      const plainOtp = "654321";
      const otpHash = await bcrypt.hash(plainOtp, 10);

      const mockUser: any = {
        _id: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
        name: "Lucky Contractor",
        email: "lucky@example.com",
        role: "contractor",
        tenantId: new mongoose.Types.ObjectId("507f191e810c19729de860ea"),
        isActive: true,
      };

      const mockActiveOtp: any = {
        phone: "lucky@example.com",
        otpCodeHash: otpHash,
        expiresAt: new Date(Date.now() + 600000),
        attemptsCount: 0,
        save: jest.fn().mockResolvedValue(true),
      };

      const findUserSpy = jest.spyOn(User, "findOne").mockResolvedValue(mockUser);
      const findOtpSpy = jest.spyOn(OtpCode, "findOne").mockResolvedValue(mockActiveOtp);
      const deleteOtpSpy = jest.spyOn(OtpCode, "deleteMany").mockResolvedValue({} as any);
      const updateSessionsSpy = jest.spyOn(RecoverySession, "updateMany").mockResolvedValue({} as any);
      const saveSessionSpy = jest.spyOn(RecoverySession.prototype, "save").mockResolvedValue({} as any);

      const req: any = {
        body: {
          email: "lucky@example.com",
          otp: plainOtp,
        },
        headers: { "user-agent": "jest-test" },
        socket: { remoteAddress: "127.0.0.1" },
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await verifyRecoveryOtp(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          recoverySessionToken: expect.any(String),
        })
      );

      findUserSpy.mockRestore();
      findOtpSpy.mockRestore();
      deleteOtpSpy.mockRestore();
      updateSessionsSpy.mockRestore();
      saveSessionSpy.mockRestore();
    });
  });
});
