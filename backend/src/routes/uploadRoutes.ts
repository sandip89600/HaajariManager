import { Router, Request, Response } from "express";
import multer = require("multer");
import path = require("path");
import fs = require("fs");
import mongoose from "mongoose";
import { isS3Configured, uploadToS3 } from "../utils/s3";
import { AuthenticatedRequest, authenticateJWT } from "../middleware/auth";
import { UploadedMedia } from "../models";

const router = Router();

// Setup Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // limit size to 15MB
  },
  fileFilter: (req: any, file: any, cb: any) => {
    const filetypes = /jpeg|jpg|png|webp|m4a|mp3|wav|aac|ogg|caf|3gp|webm/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype || extname) {
      return cb(null, true);
    }
    cb(new Error("Only image and audio files are allowed"));
  },
});

router.post(
  "/",
  authenticateJWT as any,
  (req, res, next) => {
    const contentType = req.headers["content-type"] || "";
    if (contentType.includes("application/json")) {
      return next();
    }
    upload.any()(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({ error: err.message || "Failed to process uploaded file" });
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      let fileBuffer: Buffer | null = null;
      let originalName = "upload.jpg";
      let mimeType = "image/jpeg";

      const uploadedFile = (req as any).file || ((req as any).files && (req as any).files[0]);
      if (uploadedFile) {
        fileBuffer = uploadedFile.buffer;
        originalName = uploadedFile.originalname || "upload.jpg";
        mimeType = uploadedFile.mimetype || "image/jpeg";
      } else if (req.body?.imageBase64 || req.body?.image || req.body?.photo) {

        const rawBase64 = req.body.imageBase64 || req.body.image || req.body.photo;
        const matches = typeof rawBase64 === "string" ? rawBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/) : null;
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          fileBuffer = Buffer.from(matches[2], "base64");
        } else if (typeof rawBase64 === "string") {
          fileBuffer = Buffer.from(rawBase64, "base64");
        }
        originalName = req.body.filename || req.body.name || `photo_${Date.now()}.jpg`;
        if (req.body.mimeType) mimeType = req.body.mimeType;
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return res.status(400).json({ error: "No image file provided" });
      }

      // If AWS S3 is configured, upload to S3
      if (isS3Configured()) {
        const url = await uploadToS3(fileBuffer, originalName, mimeType);
        return res.json({ url });
      }

      // Persistent MongoDB media fallback (survives Render ephemeral disk restarts/sleeps)
      const forwardedProto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0]?.trim();
      const protocol = forwardedProto || (process.env.NODE_ENV === "production" ? "https" : req.protocol);
      const host = req.get("host");

      try {
        const mediaDoc = await UploadedMedia.create({
          data: fileBuffer,
          mimeType,
          originalName,
          size: fileBuffer.length,
          uploadedBy: req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined,
        });
        const persistentUrl = `${protocol}://${host}/api/upload/file/${mediaDoc._id.toString()}`;
        return res.json({ url: persistentUrl });
      } catch (dbErr: any) {
        console.warn("MongoDB media storage fallback failed, using local disk:", dbErr?.message || dbErr);
      }

      // Graceful local disk fallback (dev/offline only)
      const uploadsDir = path.join(__dirname, "../../uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const uniqueSuffix = Date.now() + "_" + Math.round(Math.random() * 1e9);
      let fileExtension = path.extname(originalName).toLowerCase();
      if (!fileExtension || fileExtension === ".") {
        fileExtension = mimeType.includes("png") ? ".png" : ".jpg";
      }
      const fileName = `${uniqueSuffix}${fileExtension}`;
      const filePath = path.join(uploadsDir, fileName);

      fs.writeFileSync(filePath, fileBuffer);

      const url = `${protocol}://${host}/uploads/${fileName}`;
      res.json({ url });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: error.message || "Failed to upload image" });
    }
  }
);

router.get("/file/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid media ID" });
    }
    const media = await UploadedMedia.findById(id);
    if (!media) {
      return res.status(404).json({ error: "Media file not found" });
    }
    res.setHeader("Content-Type", media.mimeType || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.send(media.data);
  } catch (error: any) {
    console.error("Serve uploaded media error:", error);
    return res.status(500).json({ error: "Failed to load media file" });
  }
});

export default router;
