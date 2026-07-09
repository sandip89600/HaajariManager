import { Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Worker } from "../models";
import { AuthenticatedRequest } from "../middleware/auth";

function extractBalancedJson(str: string): string {
  const firstBrace = str.indexOf("{");
  if (firstBrace === -1) return str;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = firstBrace; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === "{") {
        depth++;
      } else if (char === "}") {
        depth--;
        if (depth === 0) {
          return str.substring(firstBrace, i + 1);
        }
      }
    }
  }
  return str;
}

function parseLocalCommand(text: string): { intent: string; data: any; response: string } | null {
  const t = text.toLowerCase().trim();
  if (!t) return null;

  // 1. OPEN SCREENS
  if (t === "open workers" || t === "workers kholo" || t === "workers list" || t === "show workers" || t === "workers screen" || t === "kamgar list") {
    return { intent: "OPEN_WORKERS", data: {}, response: "Workers opened." };
  }
  if (t === "open attendance" || t === "attendance kholo" || t === "attendance screen" || t === "haajari kholo" || t === "hajiri kholo") {
    return { intent: "OPEN_ATTENDANCE", data: {}, response: "Attendance opened." };
  }
  if (t === "open summary" || t === "summary kholo" || t === "summary screen" || t === "hisab kholo" || t === "hisab") {
    return { intent: "OPEN_SUMMARY", data: {}, response: "Summary opened." };
  }
  if (t === "open reports" || t === "report kholo" || t === "reports kholo" || t === "reports screen" || t === "reports") {
    return { intent: "OPEN_REPORTS", data: {}, response: "Summary opened." };
  }
  if (t === "open settings" || t === "settings kholo" || t === "setting kholo" || t === "settings screen" || t === "settings") {
    return { intent: "OPEN_SETTINGS", data: {}, response: "Settings opened." };
  }
  if (t === "open profile" || t === "profile kholo" || t === "profile screen" || t === "profile" || t === "my profile") {
    return { intent: "OPEN_PROFILE", data: {}, response: "Profile opened." };
  }
  if (t === "open dashboard" || t === "dashboard kholo" || t === "dashboard screen" || t === "dashboard" || t === "go home" || t === "home") {
    return { intent: "OPEN_DASHBOARD", data: {}, response: "Dashboard opened." };
  }
  if (t === "open subscription" || t === "subscription kholo" || t === "upgrade subscription" || t === "premium plans" || t === "upgrade plans") {
    return { intent: "OPEN_SETTINGS", data: { openUpgrade: true }, response: "Subscription opened." };
  }

  // 2. NAVIGATION
  if (t === "go back" || t === "back" || t === "piche" || t === "pichhe" || t === "wapas" || t === "go back screen") {
    return { intent: "GO_BACK", data: {}, response: "Going back." };
  }
  if (t === "go home" || t === "home" || t === "home screen") {
    return { intent: "OPEN_DASHBOARD", data: {}, response: "Dashboard opened." };
  }

  // 3. SETTINGS & LANGUAGE & THEME
  if (t === "change language to hindi" || t === "set language hindi" || t === "hindi language" || t === "hindi badlo") {
    return { intent: "CHANGE_LANGUAGE", data: { language: "hi" }, response: "Language updated." };
  }
  if (t === "change language to marathi" || t === "set language marathi" || t === "marathi language" || t === "marathi badlo") {
    return { intent: "CHANGE_LANGUAGE", data: { language: "mr" }, response: "Language updated." };
  }
  if (t === "change language to english" || t === "set language english" || t === "english language" || t === "english badlo") {
    return { intent: "CHANGE_LANGUAGE", data: { language: "en" }, response: "Language updated." };
  }
  if (t === "change theme to dark" || t === "theme to dark" || t === "dark theme" || t === "dark mode" || t === "theme dark" || t === "set dark theme") {
    return { intent: "CHANGE_THEME", data: { theme: "dark" }, response: "Theme updated." };
  }
  if (t === "change theme to light" || t === "theme to light" || t === "light theme" || t === "light mode" || t === "theme light" || t === "set light theme") {
    return { intent: "CHANGE_THEME", data: { theme: "light" }, response: "Theme updated." };
  }
  if (t === "logout" || t === "log out" || t === "sign out") {
    return { intent: "LOGOUT", data: {}, response: "Logged out." };
  }

  // 4. ATTENDANCE (MARK PRESENT/ABSENT/HALF DAY)
  const presentRegexes = [
    /^(?:mark\s+)?(.+?)\s+(?:as\s+)?present$/i,
    /^(?:mark\s+)?present\s+(?:for\s+)?(.+?)$/i,
    /^(.+?)\s+present\s+lagao$/i,
    /^(.+?)\s+ki\s+present$/i,
  ];
  for (const regex of presentRegexes) {
    const match = t.match(regex);
    if (match && match[1]) {
      const name = match[1].trim();
      if (!["mark", "lagao", "attendance", "absent", "half day", "half-day", "overtime", "details"].includes(name)) {
        return {
          intent: "MARK_PRESENT",
          data: { name: name.charAt(0).toUpperCase() + name.slice(1) },
          response: "Attendance marked."
        };
      }
    }
  }

  const absentRegexes = [
    /^(?:mark\s+)?(.+?)\s+(?:as\s+)?absent$/i,
    /^(?:mark\s+)?absent\s+(?:for\s+)?(.+?)$/i,
    /^(.+?)\s+absent\s+lagao$/i,
    /^(.+?)\s+ki\s+absent$/i,
  ];
  for (const regex of absentRegexes) {
    const match = t.match(regex);
    if (match && match[1]) {
      const name = match[1].trim();
      if (!["mark", "lagao", "attendance", "present", "half day", "half-day", "overtime", "details"].includes(name)) {
        return {
          intent: "MARK_ABSENT",
          data: { name: name.charAt(0).toUpperCase() + name.slice(1) },
          response: "Attendance marked."
        };
      }
    }
  }

  const halfDayRegexes = [
    /^(?:mark\s+)?(.+?)\s+(?:as\s+)?half\s*day$/i,
    /^(?:mark\s+)?half\s*day\s+(?:for\s+)?(.+?)$/i,
    /^(.+?)\s+half\s*day\s+lagao$/i,
    /^(.+?)\s+ki\s+half\s*day$/i,
  ];
  for (const regex of halfDayRegexes) {
    const match = t.match(regex);
    if (match && match[1]) {
      const name = match[1].trim();
      if (!["mark", "lagao", "attendance", "present", "absent", "overtime", "details"].includes(name)) {
        return {
          intent: "MARK_HALF_DAY",
          data: { name: name.charAt(0).toUpperCase() + name.slice(1) },
          response: "Attendance marked."
        };
      }
    }
  }

  if (t === "mark present" || t === "present lagao" || t === "present mark karo" || t === "present") {
    return { intent: "MARK_PRESENT", data: {}, response: "Attendance marked." };
  }
  if (t === "mark absent" || t === "absent lagao" || t === "absent mark karo" || t === "absent") {
    return { intent: "MARK_ABSENT", data: {}, response: "Attendance marked." };
  }
  if (t === "mark half day" || t === "half day lagao" || t === "half day mark karo" || t === "half day" || t === "half-day") {
    return { intent: "MARK_HALF_DAY", data: {}, response: "Attendance marked." };
  }

  // 5. OPEN WORKER DETAILS
  const detailsRegexes = [
    /^(?:open\s+|show\s+)?worker\s+details\s+(?:for\s+)?(.+?)$/i,
    /^details\s+(?:of\s+)?(.+?)$/i,
    /^show\s+worker\s+(.+?)$/i,
    /^(.+?)\s+details$/i,
  ];
  for (const regex of detailsRegexes) {
    const match = t.match(regex);
    if (match && match[1]) {
      const name = match[1].trim();
      return {
        intent: "SEARCH_WORKER",
        data: { query: name },
        response: "Worker details opened."
      };
    }
  }
  if (t === "open worker details" || t === "worker details" || t === "details") {
    return { intent: "OPEN_WORKERS", data: {}, response: "Workers opened." };
  }

  // 6. FINANCIALS (ADD PAYMENT & ADVANCE)
  const payRegexes = [
    /^(?:pay\s+|payment\s+of\s+|add\s+payment\s+of\s+)(\d+)\s+(?:to\s+)?(.+?)$/i,
    /^(?:pay\s+|payment\s+to\s+)(.+?)\s+(\d+)$/i,
    /^(?:pay\s+|payment\s+of\s+)(.+?)\s+rs\s*(\d+)$/i,
    /^(?:give\s+)?(.+?)\s+(?:pay\s+|payment\s+)?rs\s*(\d+)$/i,
  ];
  for (const regex of payRegexes) {
    const match = t.match(regex);
    if (match) {
      let amountStr = "";
      let name = "";
      if (isNaN(Number(match[1]))) {
        name = match[1].trim();
        amountStr = match[2];
      } else {
        amountStr = match[1];
        name = match[2].trim();
      }
      const amount = parseInt(amountStr);
      if (!isNaN(amount) && name) {
        return {
          intent: "ADD_PAYMENT",
          data: { amount, name: name.charAt(0).toUpperCase() + name.slice(1) },
          response: "Payment saved."
        };
      }
    }
  }

  const advanceRegexes = [
    /^(?:add\s+|give\s+)?advance\s+(?:of\s+)?(\d+)\s+(?:to\s+)?(.+?)$/i,
    /^(?:add\s+|give\s+)?advance\s+(?:to\s+)?(.+?)\s+(\d+)$/i,
    /^(?:give\s+)?(.+?)\s+(?:rs\s*)?(\d+)\s+advance$/i,
  ];
  for (const regex of advanceRegexes) {
    const match = t.match(regex);
    if (match) {
      let amountStr = "";
      let name = "";
      if (isNaN(Number(match[1]))) {
        name = match[1].trim();
        amountStr = match[2];
      } else {
        amountStr = match[1];
        name = match[2].trim();
      }
      const amount = parseInt(amountStr);
      if (!isNaN(amount) && name) {
        return {
          intent: "ADD_ADVANCE",
          data: { amount, name: name.charAt(0).toUpperCase() + name.slice(1) },
          response: "Advance recorded."
        };
      }
    }
  }

  if (t === "add payment" || t === "pay worker" || t === "payment") {
    return { intent: "ADD_PAYMENT", data: {}, response: "Payment saved." };
  }
  if (t === "add advance" || t === "give advance" || t === "advance") {
    return { intent: "ADD_ADVANCE", data: {}, response: "Advance recorded." };
  }

  return null;
}

// Helper to perform Gemini API call with 3-tier backoff retries for 503 Service Unavailable
async function callGeminiWithRetry(model: any, parts: any[], retries = 3, delay = 2000): Promise<any> {
  while (retries >= 0) {
    try {
      return await model.generateContent(parts);
    } catch (err: any) {
      const isRetryable = err.status === 503 || err.status === 429 || (err.message && (err.message.includes("503") || err.message.includes("429") || err.message.includes("Service Unavailable") || err.message.includes("Too Many Requests")));
      if (isRetryable && retries > 0) {
        console.warn(`[Voice] Gemini retryable error encountered. Retrying in ${delay / 1000}s... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries--;
        delay += 2000;
      } else {
        throw err;
      }
    }
  }
}

async function generateSarvamTTS(text: string, userLanguage: string): Promise<string> {
  const sarvamKey = process.env.SARVAM_API_KEY || "";
  if (!sarvamKey || !text || text.trim() === "") return "";
  try {
    const languageMap: Record<string, string> = {
      hi: "hi-IN",
      mr: "mr-IN",
      en: "en-IN",
      gu: "gu-IN",
      ta: "ta-IN",
      te: "te-IN",
      kn: "kn-IN",
      bn: "bn-IN",
      pa: "pa-IN"
    };
    const targetLang = languageMap[userLanguage] || "en-IN";

    const ttsResponse = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": sarvamKey
      },
      body: JSON.stringify({
        text: text,
        speaker: "anushka",
        model: "bulbul:v3",
        target_language_code: targetLang,
        properties: {
          pace: 1.0,
          temperature: 0.6
        }
      })
    });

    if (ttsResponse.ok) {
      const ttsResult = await ttsResponse.json() as any;
      if (ttsResult.audios && ttsResult.audios[0]) {
        return ttsResult.audios[0];
      }
    } else {
      const errTxt = await ttsResponse.text();
      console.error(`[Voice] Sarvam TTS helper failed with status ${ttsResponse.status}:`, errTxt);
    }
  } catch (ttsErr) {
    console.error("[Voice] Failed to generate Sarvam TTS in helper:", ttsErr);
  }
  return "";
}

export const processVoice = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userLanguage = req.body.currentLanguage || req.body.language || "en";
    const currentScreen = req.body.currentScreen || "Unknown";
    const screenContext = req.body.screenContext || {};
    
    // Additional context fields from App Context Engine
    const currentUser = req.body.currentUser || screenContext.currentUser || "User";
    const currentRole = req.body.currentRole || screenContext.currentRole || "contractor";
    const currentTheme = req.body.currentTheme || screenContext.currentTheme || "light";
    const currentSubscription = req.body.currentSubscription || screenContext.currentSubscription || "free";
    const selectedMonth = req.body.selectedMonth !== undefined ? req.body.selectedMonth : (screenContext.selectedMonth !== undefined ? screenContext.selectedMonth : new Date().getMonth());
    const selectedYear = req.body.selectedYear !== undefined ? req.body.selectedYear : (screenContext.selectedYear !== undefined ? screenContext.selectedYear : new Date().getFullYear());
    
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
        intent: "NONE",
        action: "NONE",
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

    // Enforce strict schema outputs to optimize performance and prevent malformed JSON
    const responseSchemaProperties = {
      intent: {
        type: "STRING",
        description: "The parsed user intent. Must be one of the supported intents or NONE.",
        enum: [
          "ADD_WORKER",
          "UPDATE_WORKER",
          "DELETE_WORKER",
          "READ_WORKER",
          "SEARCH_WORKER",
          "MARK_PRESENT",
          "MARK_ABSENT",
          "MARK_HALF_DAY",
          "MARK_OVERTIME",
          "ADD_PAYMENT",
          "DELETE_PAYMENT",
          "ADD_ADVANCE",
          "DELETE_ADVANCE",
          "OPEN_DASHBOARD",
          "OPEN_WORKERS",
          "OPEN_ATTENDANCE",
          "OPEN_SUMMARY",
          "OPEN_REPORTS",
          "OPEN_SETTINGS",
          "OPEN_PROFILE",
          "OPEN_SUBSCRIPTION",
          "CHANGE_LANGUAGE",
          "CHANGE_THEME",
          "EXPORT_PDF",
          "EXPORT_CSV",
          "LOGOUT",
          "DELETE_ACCOUNT",
          "INCOMPLETE",
          "NONE"
        ]
      },
      worker: {
        type: "STRING",
        description: "Exact matched worker name from the system list (if applicable)."
      },
      amount: {
        type: "NUMBER",
        description: "Numeric value for payment amount, wage, daily rate, or advance (if applicable)."
      },
      date: {
        type: "STRING",
        description: "Target date in YYYY-MM-DD format (if applicable)."
      },
      language: {
        type: "STRING",
        description: "App language code like 'hi', 'en', 'mr', 'gu', 'ta', 'te' (if applicable)."
      },
      theme: {
        type: "STRING",
        description: "App theme state like 'dark' or 'light' (if applicable)."
      },
      query: {
        type: "STRING",
        description: "Search query string, category name, or worker name filter (if applicable)."
      },
      type: {
        type: "STRING",
        description: "Report type, like 'attendance' or 'summary' (if applicable)."
      },
      response: {
        type: "STRING",
        description: "Spoken or text response back to the user."
      },
      transcript: {
        type: "STRING",
        description: "Accurate transcription of the user's spoken audio."
      }
    };

    // Schema for Voice/Live (short confirmations)
    const voiceSchema = {
      type: "OBJECT",
      properties: {
        ...responseSchemaProperties,
        response: {
          type: "STRING",
          description: "A short, spoken confirmation in the user's active language (maximum 4 words) like 'Rahul marked present.' or 'Summary opened.'"
        }
      },
      required: ["intent", "response", "transcript"]
    };

    // Schema for Chat (rich analytics/markdown)
    const chatSchema = {
      type: "OBJECT",
      properties: {
        ...responseSchemaProperties,
        response: {
          type: "STRING",
          description: "Detailed, helpful conversational response answering the user's question, using rich formatting, bullet points, or markdown tables for analytics where appropriate."
        }
      },
      required: ["intent", "response", "transcript"]
    };

    // Initialize Gemini SDK with consolidated Gemini 2.5 Flash model
    const ai = new GoogleGenerativeAI(apiKey);
    let model;

    let systemInstruction = "";

    if (mode === "voice") {
      // 1. Voice mode model
      model = ai.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: voiceSchema as any,
        },
      });

      systemInstruction = `
You are Ask HAI.
HAI means Haajari Artificial Intelligence.
You are not a chatbot.
You are not an assistant that explains things.
You are an Intent Parsing Engine.
Your only responsibility is:
1 Understand user request.
2 Extract intent.
3 Return structured JSON.
4 Never execute actions.
5 Never return explanations.
6 Never return markdown.
7 Never return conversational text.
Return JSON only.

Today's Date is "${todayStr}".
Active User: "${currentUser}", Role: "${currentRole}", Plan: "${currentSubscription}".
Active App Language: "${userLanguage}". Active Screen: "${currentScreen}". Active Worker: "${screenContext.selectedWorkerName || ""}".
Active Month: "${selectedMonth}" (0-11), Active Year: "${selectedYear}".

IMPORTANT CRITICAL RULES (HAI VOICE):
1. Low Latency: Return only JSON matching the schema.
2. Voice Confirmation: Set the "response" property to a short spoken confirmation (maximum 4 words) in the user's active language (e.g. "Rahul added." or "Attendance marked.").
3. Support Hindi, Marathi, English, Gujarati, Tamil, Telugu, Kannada, Punjabi, and Hinglish.
4. If details are missing or the command is incomplete, return intent "INCOMPLETE" and ask for the missing field in 4 words or less.
5. If the user does not mention a name but "selectedWorkerName" is active in context ("${screenContext.selectedWorkerName || ""}"), use it.
6. Match worker names against the system list below. If a user speaks a phonetic variation (e.g. "Rahul ko", "Shubham", "Mohan Lal"), use the EXACT name from the list.

Existing Workers List:
${JSON.stringify(workerDetails)}
`;
    } else if (mode === "live") {
      // 2. Live mode model
      model = ai.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: voiceSchema as any,
        },
      });

      systemInstruction = `
You are Ask HAI.
HAI means Haajari Artificial Intelligence.
You are not a chatbot.
You are not an assistant that explains things.
You are an Intent Parsing Engine.
Your only responsibility is:
1 Understand user request.
2 Extract intent.
3 Return structured JSON.
4 Never execute actions.
5 Never return explanations.
6 Never return markdown.
7 Never return conversational text.
Return JSON only.

Today's Date is "${todayStr}".
Active User: "${currentUser}", Role: "${currentRole}", Plan: "${currentSubscription}".
Active App Language: "${userLanguage}". Active Screen: "${currentScreen}". Active Worker: "${screenContext.selectedWorkerName || ""}".
Active Month: "${selectedMonth}" (0-11), Active Year: "${selectedYear}".

IMPORTANT CRITICAL RULES (HAI LIVE):
1. Continuous Speech: Speech is recorded in short chunks. If the transcript is cut off, incomplete, or contains noise, return intent "INCOMPLETE" and set the "response" property to an empty string ("").
2. No conversational fluff: Confirmations must be extremely crisp (maximum 3 words).
3. Resolve screen/worker context implicitly. E.g. if the user says "present mark karo" and is viewing Rahul, return intent "MARK_PRESENT" for worker Rahul.
4. Supported intents are navigation (e.g. OPEN_SUMMARY, GO_BACK) and actions (e.g. MARK_PRESENT, ADD_PAYMENT).
5. Match worker names against the system list below. Use phonetic matching.

Existing Workers List:
${JSON.stringify(workerDetails)}
`;
    } else {
      // 3. Chat mode model
      model = ai.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: chatSchema as any,
        },
      });

      systemInstruction = `
You are Ask HAI.
HAI means Haajari Artificial Intelligence.
You are not a chatbot.
You are not an assistant that explains things.
You are an Intent Parsing Engine.
Your only responsibility is:
1 Understand user request.
2 Extract intent.
3 Return structured JSON.
4 Never execute actions.
5 Never return explanations (except inside the 'response' property of the returned JSON).
6 Never return markdown (except inside the 'response' property of the returned JSON).
7 Never return conversational text (except inside the 'response' property of the returned JSON).
Return JSON only.

Today's Date is "${todayStr}".
Active User: "${currentUser}", Role: "${currentRole}", Plan: "${currentSubscription}".
Active App Language: "${userLanguage}". Active Screen: "${currentScreen}". Active Worker: "${screenContext.selectedWorkerName || ""}".
Active Month: "${selectedMonth}" (0-11), Active Year: "${selectedYear}".

IMPORTANT CRITICAL RULES (HAI CHAT):
1. Provide rich, detailed conversational answers with bullet points and markdown tables for reports/analytics where helpful inside the 'response' property of the returned JSON.
2. If the user asks questions about workers, pending payments, or attendance, analyze the worker details list and summarize them in the response.
3. If the user requests an action (e.g. "Rahul ko present lagao" or "Add a worker Shubham with rate 600"), set the corresponding "intent" (e.g. MARK_PRESENT, ADD_WORKER) so the app can execute it, and write a confirmation in "response". If no action is needed, return intent "NONE".
4. Resolve worker names using phonetic matches from the list.

Existing Workers List:
${JSON.stringify(workerDetails)}
`;
    }



    // Resolve inputs and transcribe audio first
    let transcriptText = "";

    let audioBuffer: Buffer | null = null;
    let mimeType = "";

    if (req.body.text) {
      transcriptText = req.body.text;
    } else {
      if (req.file) {
        audioBuffer = req.file.buffer;
        mimeType = req.file.mimetype;
      } else if (req.body.audio && req.body.mimeType) {
        audioBuffer = Buffer.from(req.body.audio, "base64");
        mimeType = req.body.mimeType;
      }

      if (audioBuffer && audioBuffer.length > 0) {
        console.log("[Voice] Transcribing audio with Sarvam AI Speech API...");
        try {
          const sarvamKey = process.env.SARVAM_API_KEY || "";
          if (!sarvamKey) {
            throw new Error("SARVAM_API_KEY is not defined in environment variables.");
          }

          const formData = new FormData();
          const audioBlob = new Blob([audioBuffer], { type: mimeType || "audio/wav" });
          formData.append("file", audioBlob, "audio.wav");
          formData.append("model", "saaras:v3");
          formData.append("mode", "transcribe");

          const sarvamResponse = await fetch("https://api.sarvam.ai/speech-to-text", {
            method: "POST",
            headers: {
              "api-subscription-key": sarvamKey,
            },
            body: formData,
          });

          if (!sarvamResponse.ok) {
            const errText = await sarvamResponse.text();
            throw new Error(`Sarvam STT REST API returned status ${sarvamResponse.status}: ${errText}`);
          }

          const sarvamResult = await sarvamResponse.json() as any;
          transcriptText = (sarvamResult.transcript || "").trim();
          console.log("[Voice] Sarvam AI Transcription result:", transcriptText);
        } catch (sarvamErr: any) {
          console.error("[Voice] Sarvam STT failed, falling back to Gemini:", sarvamErr);
          const transcriptionModel = ai.getGenerativeModel({ model: "gemini-2.5-flash" });
          const transcriptionParts = [
            {
              inlineData: {
                mimeType: mimeType,
                data: audioBuffer.toString("base64")
              }
            },
            { text: "Listen to the attached audio file. Transcribe the audio command accurately and output ONLY the plain text transcription. Do not add any extra labels, formatting, or commentary." }
          ];
          const transcriptionResult = await callGeminiWithRetry(transcriptionModel, transcriptionParts);
          transcriptText = (transcriptionResult.response.text() || "").trim();
        }
      } else {
        return res.status(400).json({ error: "No audio file, base64 audio payload, or text input provided" });
      }
    }

    // Layer 1: Local Command Engine Filter
    if (transcriptText) {
      const localCommand = parseLocalCommand(transcriptText);
      if (localCommand) {
        console.log(`[Voice] Local Command matched backend-side: "${transcriptText}" ->`, localCommand.intent);
        const commandData = {
          name: localCommand.data.name || "",
          category: localCommand.data.category || "",
          dailyRate: localCommand.data.amount || 0,
          amount: localCommand.data.amount || 0,
          date: localCommand.data.date || "",
          language: localCommand.data.language || "",
          theme: localCommand.data.theme || "",
          query: localCommand.data.query || "",
          type: localCommand.data.type || "",
          screen: localCommand.data.query || "",
        };
        const audioBase64 = await generateSarvamTTS(localCommand.response, userLanguage);
        return res.json({
          success: true,
          transcript: transcriptText,
          intent: localCommand.intent,
          action: localCommand.intent,
          data: commandData,
          response: localCommand.response,
          audio: audioBase64 || undefined,
          command: {
            action: localCommand.intent,
            ...commandData,
          },
        });
      }
    }

    // Layer 2: Gemini AI Engine for complex reasoning/parsing
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

    // 3. Add text prompt
    parts.push({
      text: `User command text: "${transcriptText}"\n\nAnalyze the intent and return the structured JSON object, setting the 'transcript' property to the user's text prompt.`
    });

    // Call Gemini API
    console.log(`[Voice] Calling Gemini API (${model.model})...`);
    const result = await callGeminiWithRetry(model, parts);
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

      // Balance braces to exclude any duplicate closing brackets or trailing text
      jsonResponseText = extractBalancedJson(jsonResponseText);

      const parsedResult = JSON.parse(jsonResponseText);
      const commandIntent = parsedResult.intent || "NONE";
      const commandResponse = parsedResult.response || "I processed your request.";
      const transcriptText = parsedResult.transcript || req.body.text || "[Audio Transcribed]";

      // Map structured outputs to standard data payload structure
      const commandData = {
        name: parsedResult.worker || "",
        category: parsedResult.query || "",
        dailyRate: parsedResult.amount || 0,
        amount: parsedResult.amount || 0,
        date: parsedResult.date || "",
        language: parsedResult.language || "",
        theme: parsedResult.theme || "",
        query: parsedResult.query || "",
        type: parsedResult.type || "",
        screen: parsedResult.query || "",
      };

      // Return dual-compatible format (action + intent) for maximum resilience
      const audioBase64 = await generateSarvamTTS(commandResponse, userLanguage);
      return res.json({
        success: true,
        transcript: transcriptText,
        intent: commandIntent,
        action: commandIntent, // mapped to action for backwards compatibility
        data: commandData,
        response: commandResponse,
        audio: audioBase64 || undefined,
        command: {
          action: commandIntent,
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

