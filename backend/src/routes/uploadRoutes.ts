import { Router, Response } from "express";
import multer = require("multer");
import path = require("path");
import fs = require("fs");
import { isS3Configured, uploadToS3 } from "../utils/s3";
import { AuthenticatedRequest, authenticateJWT } from "../middleware/auth";

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

      // Graceful local fallback: save to uploads/ folder
      const uploadsDir = path.join(__dirname, "../../uploads");
      
      // Verify uploads directory exists, if not, create it
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

      // Write file buffer to local disk
      fs.writeFileSync(filePath, fileBuffer);

      // Construct server URL dynamically (supports local IP discovery)
      const host = req.get("host");
      const url = `${req.protocol}://${host}/uploads/${fileName}`;

      res.json({ url });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: error.message || "Failed to upload image" });
    }
  }
);

export default router;
