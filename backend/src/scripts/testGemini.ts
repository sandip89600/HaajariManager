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
    const models = ["gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash", "gemini-2.5-flash"];
    for (const m of models) {
      try {
        console.log(`Trying model: ${m}...`);
        const model = ai.getGenerativeModel({ model: m });
        const result = await model.generateContent("Hello, are you online? Respond with 'YES'.");
        console.log(`SUCCESS with model: ${m}! Response: ${result.response.text().trim()}`);
        return;
      } catch (err: any) {
        console.log(`Failed for ${m}: ${err.message}`);
      }
    }
  } catch (error: any) {
    console.error("General failure:");
    console.error("Error Code/Message:", error.message);
  }
}

testGemini();
