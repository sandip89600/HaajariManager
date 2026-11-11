/// <reference types="jest" />
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "test_refresh_secret";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/haajari_test";

import request from "supertest";
import axios from "axios";
import { app } from "../src/index";
import { User, Tenant } from "../src/models";

jest.mock("axios");
jest.mock("../src/services/activityLogger", () => ({
  logActivity: jest.fn().mockResolvedValue(undefined),
}));
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Google Auth Role & UniqueId Flows", () => {
  const mockGoogleProfile = (sub: string, email: string, name: string) => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: {
        sub,
        email,
        email_verified: true,
        name,
        picture: "https://example.com/avatar.png",
      },
    } as any);
  };

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test("1. Brand-new Google user on LoginScreen (intent=login) returns requiresSignupRoleSelection", async () => {
    mockGoogleProfile("g_new_1", "newuser@example.com", "New User");
    jest.spyOn(User, "findOne").mockResolvedValue(null as any);

    const res = await request(app).post("/api/auth/google").send({
      idToken: "valid_id_token",
      intent: "login",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.requiresSignupRoleSelection).toBe(true);
    expect(res.body.requiresMobileCompletion).toBe(false);
    expect(res.body.googleProfile.email).toBe("newuser@example.com");
  });

  test("2. Contractor Google signup requires companyName", async () => {
    mockGoogleProfile("g_con_1", "contractor@example.com", "Raj Contractor");
    jest.spyOn(User, "findOne").mockResolvedValue(null as any);

    const res = await request(app).post("/api/auth/google").send({
      idToken: "valid_id_token",
      phone: "9876543210",
      role: "contractor",
      intent: "signup",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.field).toBe("companyName");
  });

  test("3. Worker (labor) Google signup succeeds without companyName and returns uniqueId", async () => {
    mockGoogleProfile("g_lab_1", "worker@example.com", "Ramesh Worker");
    jest.spyOn(User, "findOne").mockResolvedValue(null as any);
    jest.spyOn(Tenant.prototype, "save").mockResolvedValue({} as any);
    jest
      .spyOn(User.prototype, "save")
      .mockImplementation(async function (this: any) {
        if (!this.uniqueId) this.uniqueId = "HM-W-123456";
        return this;
      });
    jest.spyOn(Tenant, "findById").mockResolvedValue({
      name: "Ramesh Worker Org",
      plan: "free",
    } as any);

    const res = await request(app).post("/api/auth/google").send({
      idToken: "valid_id_token",
      phone: "9876543211",
      role: "labor",
      intent: "signup",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.role).toBe("labor");
    expect(res.body.user.uniqueId).toBe("HM-W-123456");
    expect(res.body.user.workerCategory).toBe("labour");
    expect(res.body.user.connectionStatus).toBe("not_connected");
  });

  test("4. Supervisor Google signup succeeds without companyName and returns uniqueId", async () => {
    mockGoogleProfile("g_sup_1", "supervisor@example.com", "Suresh Supervisor");
    jest.spyOn(User, "findOne").mockResolvedValue(null as any);
    jest.spyOn(Tenant.prototype, "save").mockResolvedValue({} as any);
    jest
      .spyOn(User.prototype, "save")
      .mockImplementation(async function (this: any) {
        if (!this.uniqueId) this.uniqueId = "HM-S-654321";
        return this;
      });
    jest.spyOn(Tenant, "findById").mockResolvedValue({
      name: "Suresh Supervisor Org",
      plan: "free",
    } as any);

    const res = await request(app).post("/api/auth/google").send({
      idToken: "valid_id_token",
      phone: "9876543212",
      role: "supervisor",
      intent: "signup",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.role).toBe("supervisor");
    expect(res.body.user.uniqueId).toBe("HM-S-654321");
    expect(res.body.user.connectionStatus).toBe("not_connected");
  });

  test("5. Role mismatch warning when existing contractor clicks Google signup under Worker", async () => {
    mockGoogleProfile("g_con_existing", "existing@example.com", "Existing Contractor");
    jest.spyOn(User, "findOne").mockResolvedValue({
      _id: "507f1f77bcf86cd799439011",
      role: "contractor",
      googleId: "g_con_existing",
    } as any);

    const res = await request(app).post("/api/auth/google").send({
      idToken: "valid_id_token",
      role: "labor",
      intent: "signup",
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("ROLE_MISMATCH");
    expect(res.body.message).toBe(
      "Your account has logged in with a contractor account. Please delete your account and log in with a worker account.",
    );
  });

  test("6. Existing worker logging in via Google on LoginScreen gets saved role and uniqueId", async () => {
    mockGoogleProfile("g_lab_existing", "worker2@example.com", "Worker Two");
    const mockExistingUser: any = {
      _id: "507f1f77bcf86cd799439012",
      tenantId: "507f1f77bcf86cd799439099",
      name: "Worker Two",
      phone: "9876543219",
      email: "worker2@example.com",
      role: "labor",
      uniqueId: "HM-W-778899",
      workerCategory: "mistri",
      connectionStatus: "connected",
      contractorName: "ABC Contractor",
      contractorCompany: "ABC Infra",
      isVerified: true,
      isPhoneVerified: true,
      trustedDevices: [],
      loginHistory: [],
      refreshTokens: [],
      save: jest.fn().mockResolvedValue(true),
    };
    jest.spyOn(User, "findOne").mockResolvedValue(mockExistingUser);
    jest.spyOn(Tenant, "findById").mockResolvedValue({
      name: "ABC Infra",
      plan: "pro",
    } as any);

    const res = await request(app).post("/api/auth/google").send({
      idToken: "valid_id_token",
      intent: "login",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.role).toBe("labor");
    expect(res.body.user.uniqueId).toBe("HM-W-778899");
    expect(res.body.user.workerCategory).toBe("mistri");
    expect(res.body.user.contractorName).toBe("ABC Contractor");
    expect(res.body.user.contractorCompany).toBe("ABC Infra");
    expect(res.body.user.connectionStatus).toBe("connected");
  });
});
