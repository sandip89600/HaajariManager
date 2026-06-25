process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://localhost:27017/haajari_test";

import request from "supertest";
import mongoose from "mongoose";
import { app } from "../src/index";
import { User, Tenant } from "../src/models";

let isMongoAvailable = true;

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    try {
      await mongoose.connect(process.env.MONGO_URI!, {
        serverSelectionTimeoutMS: 2000,
      });
    } catch (err) {
      console.warn("\n⚠️  WARNING: Local MongoDB is not reachable on port 27017.");
      console.warn("Skipping auth integration tests. Start MongoDB to run these tests.\n");
      isMongoAvailable = false;
    }
  }
});

afterAll(async () => {
  if (!isMongoAvailable) {
    await mongoose.disconnect();
    return;
  }
  try {
    await mongoose.connection.dropDatabase();
  } catch (err) {
    console.warn("Failed to drop test database:", err);
  }
  await mongoose.disconnect();
});

beforeEach(async () => {
  if (!isMongoAvailable) return;
  await User.deleteMany({});
  await Tenant.deleteMany({});
});

describe("Auth Controller Tests", () => {
  const testUser = {
    password: "securepassword123",
    name: "Test Worker",
    phone: "9876543210",
    role: "contractor" as const,
    companyName: "Test Org",
  };

  test("signup - should successfully register user and organization", async () => {
    if (!isMongoAvailable) return;
    const res = await request(app)
      .post("/api/auth/signup")
      .send(testUser);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("refreshToken");
    expect(res.body.user).toHaveProperty("id");
    expect(res.body.user.phone).toBe(testUser.phone);
    expect(res.body.user.isVerified).toBe(true);

    // Verify database entries
    const userInDb = await User.findOne({ phone: testUser.phone });
    expect(userInDb).toBeDefined();
    expect(userInDb!.name).toBe(testUser.name);

    const tenantInDb = await Tenant.findById(userInDb!.tenantId);
    expect(tenantInDb).toBeDefined();
    expect(tenantInDb!.name).toBe(testUser.companyName);
  });

  test("signup - should fail on duplicate phone", async () => {
    if (!isMongoAvailable) return;
    // Register first user
    await request(app).post("/api/auth/signup").send(testUser);

    // Attempt second registration with same phone
    const res = await request(app).post("/api/auth/signup").send(testUser);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Mobile number already registered");
  });

  test("login - should login successfully and rotate tokens", async () => {
    if (!isMongoAvailable) return;
    // Signup first
    await request(app).post("/api/auth/signup").send(testUser);

    const res = await request(app)
      .post("/api/auth/login")
      .send({
        phone: testUser.phone,
        password: testUser.password,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("refreshToken");
    expect(res.body.user.phone).toBe(testUser.phone);
  });

  test("login - should reject invalid credentials", async () => {
    if (!isMongoAvailable) return;
    // Signup first
    await request(app).post("/api/auth/signup").send(testUser);

    const res = await request(app)
      .post("/api/auth/login")
      .send({
        phone: testUser.phone,
        password: "wrongpassword",
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Invalid credentials");
  });

  test("refresh - should rotate refresh token and issue new access token", async () => {
    if (!isMongoAvailable) return;
    const signupRes = await request(app).post("/api/auth/signup").send(testUser);
    const firstRefreshToken = signupRes.body.refreshToken;
    expect(firstRefreshToken).toBeDefined();

    // Call refresh endpoint
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: firstRefreshToken });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("refreshToken");
    expect(res.body.refreshToken).not.toBe(firstRefreshToken); // Must be rotated

    // Check that the old refresh token is no longer valid
    const oldRefreshRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: firstRefreshToken });

    expect(oldRefreshRes.status).toBe(403);
  });
});
