/// <reference types="jest" />
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "test_refresh_secret";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/haajari_test";

import request from "supertest";
import { app } from "../src/index";

describe("Keep-Alive Ping & Health Endpoints", () => {
  test("GET /ping returns 200 OK quickly without DB dependency", async () => {
    const res = await request(app).get("/ping");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      status: "OK",
      service: "Haajari Manager API",
    });
    expect(typeof res.body.uptime).toBe("number");
    expect(typeof res.body.timestamp).toBe("string");
  });

  test("GET /api/ping returns 200 OK", async () => {
    const res = await request(app).get("/api/ping");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      status: "OK",
      service: "Haajari Manager API",
    });
  });

  test("GET /api/health returns 200 OK", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "OK",
      service: "Haajari Manager API",
    });
  });
});
