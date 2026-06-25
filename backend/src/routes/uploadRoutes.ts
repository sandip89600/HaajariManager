import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { isS3Configured, uploadToS3 } from "../utils/s3";
import { AuthenticatedRequest, authenticateJWT } from "../middleware/auth";

const router = Router();

// Setup Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // limit size to 5MB
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only JPEG, JPG, and PNG images are allowed"));
  },
});

router.post(
  "/",
  authenticateJWT as any,
  upload.single("image"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      // If AWS S3 is configured, upload to S3
      if (isS3Configured()) {
        const url = await uploadToS3(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
        return res.json({ url });
      }

      // Graceful local fallback: save to uploads/ folder
      const uploadsDir = path.join(__dirname, "../../uploads");
      
      // Verify uploads directory exists, if not, create it
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const uniqueSuffix = Date.now() + "_" + Math.round(Math.random() * 1e9);
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      const fileName = `${uniqueSuffix}${fileExtension}`;
      const filePath = path.join(uploadsDir, fileName);

      // Write file buffer to local disk
      fs.writeFileSync(filePath, req.file.buffer);

      // Construct server URL dynamically (supports local IP discovery)
      const host = req.get("host");
      const url = `${req.protocol}://${host}/uploads/${fileName}`;

      res.json({ url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
