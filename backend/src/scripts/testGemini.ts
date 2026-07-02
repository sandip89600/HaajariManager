import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import * as path from "path";

// Load env variables
dotenv.config({ path: path.join(__dirname, "../../.env") });

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log("Using API Key:", apiKey ? `${apiKey.substring(0, 8)}...` : "UNDEFINED");

  if (!apiKey) {
    console.error("GEMINI_API_KEY is not defined in env!");
    return;
  }

  try {
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    console.log("Calling model.generateContent with text prompt...");
    const result = await model.generateContent("Hello, are you online? Respond with 'YES'.");
    console.log("Response text:", result.response.text());
    console.log("Success!");
  } catch (error: any) {
    console.error("Gemini API call failed!");
    console.error("Error Code/Message:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

testGemini();
