import Groq from "groq-sdk";
import * as dotenv from "dotenv";
import * as path from "path";

// Load env variables
dotenv.config({ path: path.join(__dirname, "../../.env") });

async function testGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  console.log("Using Groq API Key:", apiKey ? `${apiKey.substring(0, 8)}...` : "UNDEFINED");

  if (!apiKey) {
    console.error("GROQ_API_KEY is not defined in env!");
    return;
  }

  try {
    const groq = new Groq({ apiKey });
    
    console.log("Calling groq.chat.completions.create with openai/gpt-oss-120b...");
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Are you online? Respond with YES." }
      ],
      temperature: 1,
      max_completion_tokens: 1024,
      top_p: 1,
      reasoning_effort: "medium",
    } as any);
    
    console.log("Response content:", completion.choices[0]?.message?.content);
    console.log("Success!");
  } catch (error: any) {
    console.error("Groq API call failed!");
    console.error("Error Code/Message:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

testGroq();
