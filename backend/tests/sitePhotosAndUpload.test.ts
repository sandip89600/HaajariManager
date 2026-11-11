/// <reference types="jest" />
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "test_refresh_secret";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/haajari_test";

import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/index";
import {
  UploadedMedia,
  User,
  Worker,
  Site,
  DailySiteActivity,
  DailySiteSession,
} from "../src/models";

describe("Persistent Media Upload & Worker Morning/Evening Site Photos", () => {
  const contractorId = "507f1f77bcf86cd799439011";
  const workerUserId = "507f1f77bcf86cd799439012";
  const workerId = "507f1f77bcf86cd799439013";
  const tenantId = "507f1f77bcf86cd799439099";
  const siteId = "507f1f77bcf86cd799439020";

  const makeToken = (id: string, role: string) =>
    jwt.sign({ id, role, tenantId }, process.env.JWT_SECRET!, {
      expiresIn: "1h",
    });

  const makeUserQuery = (doc: any) => {
    const query: any = Promise.resolve(doc);
    query.select = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(doc),
    });
    return query;
  };

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test("1. POST /api/upload stores image persistently in UploadedMedia and GET /api/upload/file/:id serves it", async () => {
    const fakeMediaId = "507f1f77bcf86cd799439055";
    const sampleBuf = Buffer.from("fake-jpeg-bytes");

    jest.spyOn(User, "findById").mockImplementation(() =>
      makeUserQuery({
        _id: workerUserId,
        isActive: true,
        status: "active",
        trustedDevices: [],
      }),
    );

    jest.spyOn(UploadedMedia, "create").mockResolvedValue({
      _id: fakeMediaId,
      data: sampleBuf,
      mimeType: "image/jpeg",
    } as any);

    const token = makeToken(workerUserId, "labor");
    const uploadRes = await request(app)
      .post("/api/upload")
      .set("Authorization", `Bearer ${token}`)
      .send({
        imageBase64: sampleBuf.toString("base64"),
        filename: "morning.jpg",
        mimeType: "image/jpeg",
      });

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.url).toContain(`/api/upload/file/${fakeMediaId}`);

    jest.spyOn(UploadedMedia, "findById").mockResolvedValue({
      _id: fakeMediaId,
      data: sampleBuf,
      mimeType: "image/jpeg",
    } as any);

    const fileRes = await request(app).get(`/api/upload/file/${fakeMediaId}`);
    expect(fileRes.status).toBe(200);
    expect(fileRes.headers["content-type"]).toContain("image/jpeg");
    expect(Buffer.from(fileRes.body).equals(sampleBuf)).toBe(true);
  });

  test("2. Worker morning photo submission is stored and returned by GET /api/sites/:siteId/photos", async () => {
    const photoUrl = "https://haajarimanager.onrender.com/api/upload/file/507f1f77bcf86cd799439055";
    const dateStr = "2026-11-11";

    jest.spyOn(User, "findById").mockImplementation((id: any) => {
      if (String(id) === workerUserId) {
        return makeUserQuery({
          _id: workerUserId,
          name: "Ramesh Worker",
          role: "labor",
          phone: "9876543210",
          uniqueId: "HM-W-123456",
          tenantId,
          contractorId,
          isActive: true,
          status: "active",
          trustedDevices: [],
        });
      }
      return makeUserQuery({
        _id: contractorId,
        name: "Raj Contractor",
        role: "contractor",
        tenantId,
        isActive: true,
        status: "active",
        trustedDevices: [],
      });
    });

    jest.spyOn(Worker, "findOne").mockReturnValue({
      sort: jest.fn().mockResolvedValue({
        _id: workerId,
        tenantId,
        userId: workerUserId,
        name: "Ramesh Worker",
        category: "labour",
        projectId: siteId,
        save: jest.fn().mockResolvedValue(true),
      }),
    } as any);

    jest.spyOn(Site, "findOne").mockResolvedValue({
      _id: siteId,
      tenantId,
      name: "Site Alpha",
      address: "Nashik",
      isDeleted: false,
    } as any);

    jest.spyOn(DailySiteActivity, "findOne").mockResolvedValue(null as any);
    jest.spyOn(DailySiteActivity.prototype, "save").mockResolvedValue({} as any);
    jest
      .spyOn(DailySiteSession, "findOneAndUpdate")
      .mockResolvedValue({} as any);

    const workerToken = makeToken(workerUserId, "labor");
    const submitRes = await request(app)
      .post(`/api/sites/${siteId}/work-updates`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({
        activityType: "MORNING_WORK",
        photo: photoUrl,
        dateStr,
        location: { latitude: 19.9975, longitude: 73.7898, accuracy: 10 },
      });

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.success).toBe(true);
    expect(submitRes.body.activity.photo).toBe(photoUrl);
    expect(submitRes.body.activity.dateStr).toBe(dateStr);

    jest.spyOn(DailySiteActivity, "find").mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: "507f1f77bcf86cd799439088",
              tenantId,
              siteId,
              workerId,
              userId: workerUserId,
              userName: "Ramesh Worker",
              workerRole: "labour",
              activityType: "MORNING_WORK",
              photo: photoUrl,
              description: "Morning Work Photo",
              dateStr,
              timeStr: "9:30 AM",
              location: { latitude: 19.9975, longitude: 73.7898 },
            },
          ]),
        }),
      }),
    } as any);

    const contractorToken = makeToken(contractorId, "contractor");
    const photosRes = await request(app)
      .get(`/api/sites/${siteId}/photos`)
      .set("Authorization", `Bearer ${contractorToken}`);

    expect(photosRes.status).toBe(200);
    expect(photosRes.body.success).toBe(true);
    expect(photosRes.body.morningCount).toBe(1);
    expect(photosRes.body.photos[0].photo).toBe(photoUrl);
    expect(photosRes.body.photos[0].workerName).toBe("Ramesh Worker");
  });
});
