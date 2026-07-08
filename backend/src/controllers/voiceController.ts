import { Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Worker } from "../models";
import { AuthenticatedRequest } from "../middleware/auth";

export const processVoice = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userLanguage = req.body.language || "en";
    const currentScreen = req.body.currentScreen || "Unknown";
    const screenContext = req.body.screenContext || {};
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const history = req.body.history
      ? typeof req.body.history === "string"
        ? JSON.parse(req.body.history)
        : req.body.history
      : [];

    const mode = req.body.mode || "chat"; // voice | chat | live
    const liveContext = req.body.liveContext || "";

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[Voice] GEMINI_API_KEY is not defined in environment variables.");
      return res.json({
        success: false,
        transcript: "[Voice Assistant API Key Missing]",
        action: "UNKNOWN",
        data: {},
        response: "Please set the GEMINI_API_KEY in backend/.env file to start using voice commands.",
      });
    }

    // Retrieve active workers for this tenant to help Gemini matching and detail lookups
    const activeWorkers = await Worker.find(
      { tenantId, isArchived: false },
      "name dailyRate category phone address"
    );
    const workerDetails = activeWorkers.map((w) => ({
      name: w.name,
      dailyRate: w.dailyRate,
      category: w.category,
      phone: w.phone || "Not provided",
      address: w.address || "Not provided",
    }));

    // Initialize Gemini SDK
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({
      model: "gemini-3.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    let systemInstruction = "";

    if (mode === "voice") {
      systemInstruction = `
You are the Voice Action Engine (HAI Voice) for "HAI" (a worker attendance and payment management app).
Your sole purpose is to parse quick voice commands into structured JSON actions.
The user is a contractor, builder, or supervisor.
The user's currently selected app language is "${userLanguage}".
Today's Date is "${todayStr}". (Use this to resolve "today", "yesterday", or date queries).

IMPORTANT CRITICAL RULES (HAI VOICE):
1. Optimize for extremely low latency. Never generate long text or conversational chat.
2. In the "response" property, write ONLY a short confirmation of the action performed (maximum 4 words) in the user's spoken language (e.g. "Rahul added." or "Attendance marked." or "Opening summary.").
3. Do not ask conversational follow-up questions. If details are missing, return action "INCOMPLETE" and ask for the missing field in 4 words or less.
4. Support English, Hindi, Hinglish, Marathi, and regional languages.
5. If the transcript is cut off or the sentence is incomplete (e.g. the user paused or is still speaking), return action "INCOMPLETE" and set the "response" property to an empty string ("").

---
## LIVE APPLICATION STATE CONTEXT
Screen: "${currentScreen}"
Details: ${JSON.stringify(screenContext)}

## STATE CONTEXT RESOLUTION RULES:
- If a worker's name is omitted but "selectedWorkerName" is present in "screenContext", copy it to the "name" field of the data.

---
Here is the list of existing workers with their details in the system:
${JSON.stringify(workerDetails)}

If the user mentions a name, match it against this list. If you find a close match or phonetic match (e.g. "Subham" matches "Shubham", "Mohan Lal" matches "Mohan", "Raju" matches "Raju"), use the EXACT name from the list in your output. If no match is found, use the name they spoke.

Supported actions:
- ADD_WORKER (name, dailyRate, category: "labour"|"bai"|"mistri"|"bandkam"|"plaster"|"tiles"|"sutar", phone, address)
- UPDATE_WORKER (name, dailyRate, category, phone)
- DELETE_WORKER (name)
- MARK_ATTENDANCE (name, status: "Present"|"Absent"|"Half Day"|"Overtime", date: YYYY-MM-DD, overtimeHours, advance)
- ADD_PAYMENT (name, amount, method, note)
- ADD_ADVANCE (name, amount, date)
- SEARCH_WORKER (query)
- OPEN_SCREEN (screen: "Workers"|"Attendance"|"Summary"|"Settings"|"Dashboard"|"Profile"|"Subscription"|"Reports")
- SHOW_SUMMARY (month, year)
- SHOW_REPORT (type)
- EXPORT_PDF (type: "attendance"|"summary")
- GO_BACK
- SWITCH_THEME

You must respond ONLY with a JSON object in this exact format:
{
  "action": "ADD_WORKER" | "UPDATE_WORKER" | "DELETE_WORKER" | "MARK_ATTENDANCE" | "ADD_PAYMENT" | "ADD_ADVANCE" | "SEARCH_WORKER" | "OPEN_SCREEN" | "SHOW_SUMMARY" | "SHOW_REPORT" | "EXPORT_PDF" | "GO_BACK" | "SWITCH_THEME" | "INCOMPLETE" | "UNKNOWN",
  "data": {
     // corresponding fields for the action
  },
  "response": "very short confirmation (max 4 words)",
  "transcript": "Audio transcript"
}
`;
    } else if (mode === "live") {
      systemInstruction = `
You are the Real-time AI Copilot (HAI Live) for the "HAI" app.
You continuously understand the app state and help the user navigate and execute commands on-the-fly.
The user's currently selected app language is "${userLanguage}".
Today's Date is "${todayStr}". (Use this to resolve "today", "yesterday", or date queries).

IMPORTANT CRITICAL RULES (HAI LIVE):
1. No chat bubbles are displayed. You must act as a seamless real-time assistant.
2. Keep responses brief, direct, and action-oriented.
3. Automatically resolve worker names, dates, or screen details from context.
4. If the transcript is cut off or the sentence is incomplete, return action "INCOMPLETE" and set the "response" property to an empty string ("").

---
## LIVE APPLICATION STATE CONTEXT
Screen: "${currentScreen}"
Details: ${JSON.stringify(screenContext)}

## STATE CONTEXT RESOLUTION RULES:
- Resolve names and screen context implicitly. E.g. "present mark karo" -> check context for worker.
- If missing details, ask a very quick follow-up question.

---
Here is the list of existing workers with details:
${JSON.stringify(workerDetails)}

Supported actions:
- ADD_WORKER
- UPDATE_WORKER
- DELETE_WORKER
- MARK_ATTENDANCE
- ADD_PAYMENT
- ADD_ADVANCE
- SEARCH_WORKER
- OPEN_SCREEN
- SHOW_SUMMARY
- SHOW_REPORT
- EXPORT_PDF
- GO_BACK
- SWITCH_THEME

You must respond ONLY with a JSON object in this exact format:
{
  "action": "ADD_WORKER" | "UPDATE_WORKER" | "DELETE_WORKER" | "MARK_ATTENDANCE" | "ADD_PAYMENT" | "ADD_ADVANCE" | "SEARCH_WORKER" | "OPEN_SCREEN" | "SHOW_SUMMARY" | "SHOW_REPORT" | "EXPORT_PDF" | "GO_BACK" | "SWITCH_THEME" | "INCOMPLETE" | "UNKNOWN",
  "data": {
     // corresponding fields for the action
  },
  "response": "crisp confirmation statement",
  "transcript": "Audio transcript"
}
`;
    } else {
      systemInstruction = `
You are the Intelligent Conversational AI Assistant (HAI Chat) for "HAI" (a worker attendance and payment management app).
You handle long-running conversations, provide analytics, explain attendance, overtime, payroll, and suggest workforce optimizations.
The user's currently selected app language is "${userLanguage}".

IMPORTANT CRITICAL RULES (HAI CHAT):
1. Provide rich, helpful, conversational answers.
2. Support Markdown list formatting and bold text.
3. If they ask questions like "Who is absent today?" or "Show monthly summary", use the list of workers to formulate rich details in your response text.
4. Explain terms like overtime, check payments, subscription status, etc.

---
## LIVE APPLICATION STATE CONTEXT
Screen: "${currentScreen}"
Details: ${JSON.stringify(screenContext)}

---
Here is the list of existing workers with details:
${JSON.stringify(workerDetails)}

Supported actions:
- ADD_WORKER
- UPDATE_WORKER
- DELETE_WORKER
- MARK_ATTENDANCE
- ADD_PAYMENT
- ADD_ADVANCE
- SEARCH_WORKER
- OPEN_SCREEN
- SHOW_SUMMARY
- SHOW_REPORT
- EXPORT_PDF
- GO_BACK
- SWITCH_THEME

You must respond ONLY with a JSON object in this exact format:
{
  "action": "ADD_WORKER" | "UPDATE_WORKER" | "DELETE_WORKER" | "MARK_ATTENDANCE" | "ADD_PAYMENT" | "ADD_ADVANCE" | "SEARCH_WORKER" | "OPEN_SCREEN" | "SHOW_SUMMARY" | "SHOW_REPORT" | "EXPORT_PDF" | "GO_BACK" | "SWITCH_THEME" | "INCOMPLETE" | "UNKNOWN",
  "data": {
     // corresponding fields for the action
  },
  "response": "detailed conversational explanation with rich details",
  "transcript": "Audio transcript"
}
`;
    }

    // Construct request parts for Gemini
    const parts: any[] = [];

    // 1. Add system instructions and context
    let instructionContext = systemInstruction;
    if (history && history.length > 0) {
      instructionContext += "\n\nCONVERSATION HISTORY:\n" + history.map((h: any) => {
        const roleName = h.role === "user" ? "User" : "HAI Assistant";
        return `${roleName}: ${h.text || h.parts?.[0]?.text || ""}`;
      }).join("\n");
    }
    parts.push({ text: instructionContext });

    if (liveContext) {
      parts.push({
        text: `Previous incomplete speech context: "${liveContext}"\nCombine this previous context with the new transcribed audio/text command to understand the full user sentence.`
      });
    }

    // 2. Add image part if present
    if (req.body.image) {
      console.log("[Voice] Adding image attachment to Gemini prompt...");
      const imageBase64 = req.body.image.replace(/^data:image\/\w+;base64,/, "");
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: imageBase64
        }
      });
      parts.push({
        text: "Analyze the attached image. If it is a worker card, ID card, or document, perform OCR/information extraction and execute the appropriate action (defaulting to ADD_WORKER with details like name, dailyRate, etc.)."
      });
    }

    // 3. Add audio or text inputs
    if (req.body.text) {
      console.log("[Voice] Processing text input directly with Gemini:", req.body.text);
      parts.push({
        text: `User text prompt: "${req.body.text}"\n\nAnalyze the intent and return the structured JSON object, setting the 'transcript' property to the user's text prompt.`
      });
    } else {
      let audioBuffer: Buffer;
      let mimeType: string;

      if (req.file) {
        audioBuffer = req.file.buffer;
        mimeType = req.file.mimetype;
      } else if (req.body.audio && req.body.mimeType) {
        audioBuffer = Buffer.from(req.body.audio, "base64");
        mimeType = req.body.mimeType;
      } else {
        return res.status(400).json({ error: "No audio file, base64 audio payload, or text input provided" });
      }

      if (audioBuffer.length === 0) {
        return res.status(400).json({ error: "Audio file is empty" });
      }

      console.log("[Voice] Processing audio input with Gemini. MimeType:", mimeType);
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: audioBuffer.toString("base64")
        }
      });
      parts.push({
        text: "Listen to the attached audio file. First, transcribe it accurately in its spoken language, and populate the 'transcript' field of the output JSON. Then, analyze the spoken command's intent and execute the appropriate action."
      });
    }

    // Call Gemini API
    console.log("[Voice] Calling Gemini API (gemini-3.5-flash)...");
    const result = await model.generateContent(parts);
    const completionText = result.response.text() || "{}";
    console.log("[Voice] Gemini parser output:", completionText);

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
      const transcriptText = parsedResult.transcript || req.body.text || "[Audio Transcribed]";

      // Return dual-compatible format
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
      console.error("[Voice] Failed to parse Gemini response as JSON:", completionText, parseError);
      return res.status(500).json({
        error: "AI failed to produce a structured action",
        raw: completionText,
      });
    }
  } catch (error: any) {
    console.error("[Voice] Error processing voice command via Gemini:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const processVoiceCommand = processVoice;
