import { processVoiceCommand } from "../controllers/voiceController";
import * as dotenv from "dotenv";
import * as path from "path";
import mongoose from "mongoose";

// Load env variables
dotenv.config({ path: path.join(__dirname, "../../.env") });

async function runMockController() {
  // Connect to DB if MONGO_URI is set
  const mongoUri = process.env.MONGO_URI;
  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri);
      console.log("Connected to MongoDB Atlas.");
    } catch (err) {
      console.warn("MongoDB connection failed, proceeding offline:", err);
    }
  }

  // Create a mock request
  const mockReq: any = {
    user: {
      id: new mongoose.Types.ObjectId().toString(),
      tenantId: new mongoose.Types.ObjectId().toString(),
    },
    body: {
      audio: "UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA", // dummy WAV header base64
      mimeType: "audio/mp4",
      history: []
    }
  };

  // Create a mock response
  const mockRes: any = {
    status(code: number) {
      console.log(`[Response Status]: ${code}`);
      return this;
    },
    json(data: any) {
      console.log("[Response JSON]:", JSON.stringify(data, null, 2));
      return this;
    }
  };

  try {
    console.log("Running processVoiceCommand with mock audio...");
    await processVoiceCommand(mockReq, mockRes);
  } catch (error: any) {
    console.error("Direct execution threw an error!");
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

runMockController();
