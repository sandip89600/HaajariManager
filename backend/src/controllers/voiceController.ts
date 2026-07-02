import { Response } from "express";
import Groq, { toFile } from "groq-sdk";
import { Worker } from "../models";
import { AuthenticatedRequest } from "../middleware/auth";

export const processVoice = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const history = req.body.history
      ? typeof req.body.history === "string"
        ? JSON.parse(req.body.history)
        : req.body.history
      : [];

    let audioBuffer: Buffer;
    let mimeType: string;
    let fileName: string;

    // Dual compatibility check: multipart/form-data file vs. base64 JSON payload
    if (req.file) {
      audioBuffer = req.file.buffer;
      mimeType = req.file.mimetype;
      fileName = req.file.originalname || "audio.m4a";
    } else if (req.body.audio && req.body.mimeType) {
      audioBuffer = Buffer.from(req.body.audio, "base64");
      mimeType = req.body.mimeType;
      fileName = mimeType.includes("m4a") ? "audio.m4a" : "audio.mp4";
    } else {
      return res.status(400).json({ error: "No audio file or base64 audio payload provided" });
    }

    // Audio duration check
    if (audioBuffer.length === 0) {
      return res.status(400).json({ error: "Audio file is empty" });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.warn("[Voice] GROQ_API_KEY is not defined in environment variables.");
      return res.json({
        success: false,
        transcript: "[Voice Assistant API Key Missing]",
        action: "UNKNOWN",
        data: {},
        response: "Please set the GROQ_API_KEY in backend/.env file to start using voice commands.",
      });
    }

    // Retrieve active worker names for this tenant to help Groq match names phonetically
    const activeWorkers = await Worker.find({ tenantId, isArchived: false }, "name");
    const workerNames = activeWorkers.map((w) => w.name);

    // Initialize Groq SDK
    const groq = new Groq({ apiKey });

    // 1. Perform Speech-to-Text using Whisper Large v3 (fully in-memory via toFile)
    console.log("[Voice] Transcribing audio with Whisper Large v3...");
    const transcription = await groq.audio.transcriptions.create({
      file: await toFile(audioBuffer, fileName, { type: mimeType }),
      model: "whisper-large-v3",
    });

    const transcriptText = transcription.text;
    console.log("[Voice] Whisper Transcription:", transcriptText);

    // 2. Call reasoning model to analyze intent
    const systemInstruction = `
You are the AI Voice Assistant for "Haajari" (a worker attendance and payment management app).
The user is a contractor, builder, or supervisor. They will speak commands in Hindi, English, or Hinglish.
Your task is to analyze the user's transcription text and identify their intent.

Here is the list of existing workers in the system:
${JSON.stringify(workerNames)}

If the user mentions a name, match it against this list. If you find a close match or phonetic match (e.g. "Subham" matches "Shubham", "Mohan Lal" matches "Mohan", "Raju" matches "Raju"), use the EXACT name from the list in your output. If no match is found, use the name they spoke.

Supported actions and their required fields:
1. ADD_WORKER: Add a new worker.
   Fields:
   - name (string, required)
   - dailyRate (number, optional)
   - category (string, optional - must be one of: "labour", "bai", "mistri", "bandkam", "plaster", "tiles", "sutar")
   - phone (string, optional)
   - address (string, optional)
2. UPDATE_WORKER: Edit worker details.
   Fields:
   - name (string, required to identify)
   - dailyRate (number, optional)
   - category (string, optional)
   - phone (string, optional)
3. DELETE_WORKER: Remove a worker.
   Fields:
   - name (string, required)
4. MARK_ATTENDANCE: Record attendance for a worker.
   Fields:
   - name (string, required)
   - status (string, required - must be one of: "Present", "Absent", "Half Day", "Overtime")
   - date (string, optional - YYYY-MM-DD, defaults to today. If user says "aaj" or "today", it's today. If user says "kal" or "yesterday", it's yesterday)
   - overtimeHours (number, optional - only if status is "Overtime")
   - advance (number, optional - if they mention advance amount, e.g. "500 advance")
5. ADD_PAYMENT: Record a payment made to a worker.
   Fields:
   - name (string, required)
   - amount (number, required)
   - method (string, optional - "Cash", "UPI", "Bank Transfer")
   - note (string, optional)
6. ADD_ADVANCE: Record an advance taken by a worker (stored in their attendance's customWage field).
   Fields:
   - name (string, required)
   - amount (number, required)
   - date (string, optional - YYYY-MM-DD, defaults to today)
7. SEARCH_WORKER: Search for a worker.
   Fields:
   - query (string, required)
8. OPEN_SCREEN: Navigate to a specific screen in the app.
   Fields:
   - screen (string, required - must be one of: "Workers", "Attendance", "Summary", "Settings", "Dashboard")
9. SHOW_SUMMARY: Show the monthly payment or attendance summary.
   Fields:
   - month (number, optional - 0-11, where 0 is January, 11 is December)
   - year (number, optional)
10. SHOW_REPORT: Show a report.
    Fields:
    - type (string, optional - "attendance", "payment")

If the command lacks required information (like name or daily rate for adding a worker, or name/status for attendance), set action to "INCOMPLETE" and ask for the missing details in the "response" field of the JSON.
Keep context of the conversation using the provided history.

You must respond with a JSON object in this exact format:
{
  "action": "ADD_WORKER" | "UPDATE_WORKER" | "DELETE_WORKER" | "MARK_ATTENDANCE" | "ADD_PAYMENT" | "ADD_ADVANCE" | "SEARCH_WORKER" | "OPEN_SCREEN" | "SHOW_SUMMARY" | "SHOW_REPORT" | "INCOMPLETE" | "UNKNOWN",
  "data": {
     // corresponding fields for the action
  },
  "response": "A short, polite text response confirming the action or asking a follow-up question. Use the same language the user spoke (Hinglish/Hindi/English)."
}
`;

    const messages: any[] = [
      {
        role: "system",
        content: systemInstruction,
      },
    ];

    // Add conversation history
    if (history && history.length > 0) {
      history.forEach((h: any) => {
        messages.push({
          role: h.role === "user" ? "user" : "assistant",
          content: h.text || h.parts?.[0]?.text || "",
        });
      });
    }

    // Add current user message with transcript
    messages.push({
      role: "user",
      content: `User transcript: "${transcriptText}"\n\nAnalyze the intent and return the structured JSON object.`,
    });

    console.log("[Voice] Calling openai/gpt-oss-120b model on Groq for command parsing...");
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages,
      temperature: 1,
      max_completion_tokens: 1024,
      top_p: 1,
      reasoning_effort: "medium",
    } as any);

    const completionText = completion.choices[0]?.message?.content || "{}";
    console.log("[Voice] Groq parser output:", completionText);

    try {
      let jsonResponseText = completionText.trim();
      // Extract JSON if wrapped in markdown code blocks
      if (jsonResponseText.includes("```")) {
        const match = jsonResponseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
          jsonResponseText = match[1].trim();
        }
      }

      const parsedResult = JSON.parse(jsonResponseText);
      const commandAction = parsedResult.action || "UNKNOWN";
      const commandData = parsedResult.data || {};
      const commandResponse = parsedResult.response || "I processed your request.";

      // Inject transcript and return dual-compatible format
      return res.json({
        success: true,
        transcript: transcriptText,
        action: commandAction,
        data: commandData,
        response: commandResponse,
        command: {
          action: commandAction,
          name: commandData.name || "",
          category: commandData.category || "",
          dailyRate: commandData.dailyRate || 0,
          ...commandData,
        },
      });
    } catch (parseError) {
      console.error("[Voice] Failed to parse Groq response as JSON:", completionText, parseError);
      return res.status(500).json({
        error: "AI failed to produce a structured action",
        raw: completionText,
      });
    }
  } catch (error: any) {
    console.error("[Voice] Error processing voice command:", error);
    return res.status(500).json({ error: error.message });
  }
};

// Keep processVoiceCommand alias for backward compatibility
export const processVoiceCommand = processVoice;
