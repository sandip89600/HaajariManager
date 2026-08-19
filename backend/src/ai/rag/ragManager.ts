import { GoogleGenerativeAI } from "@google/generative-ai";
import { QueryPlanner } from "./queryPlanner";
import { Retriever } from "./retriever";
import { ContextBuilder } from "./contextBuilder";
import { ResponseValidator, ValidatedResponse } from "./responseValidator";
import { RAGLogger } from "./ragLogger";
import { HAAJARI_SYSTEM_PROMPT } from "../prompts/haiSystemPrompt";

export interface RAGProcessOptions {
  userMessage: string;
  tenantId: string;
  userId?: string;
  userRole?: string;
  year?: number;
  month?: number;
}

export class RAGManager {
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  public async processQuery(options: RAGProcessOptions): Promise<ValidatedResponse> {
    const startTime = Date.now();
    let retrievalTimeMs = 0;
    let aiTimeMs = 0;

    try {
      // 1. Intent Detection & Query Planning
      const plan = QueryPlanner.plan(options.userMessage, options.year, options.month);

      // 2. Data Retrieval (Enforces strict tenantId isolation)
      const fetchStart = Date.now();
      const retrievedData = await Retriever.retrieve(options.tenantId, plan);
      retrievalTimeMs = Date.now() - fetchStart;

      // 3. Build Structured JSON Context
      const contextString = ContextBuilder.buildContext(retrievedData, plan);

      // 4. Call AI LLM Engine (Gemini)
      const aiStart = Date.now();
      let rawAiResponse = "";

      if (this.genAI) {
        const modelName = process.env.AI_MODEL || "gemini-1.5-flash";
        const model = this.genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: HAAJARI_SYSTEM_PROMPT,
        });

        const promptText = `
User Query: "${options.userMessage}"

Retrieved Database Context & Verified Calculations:
${contextString}

Instructions:
Answer the user's question clearly, accurately, and concisely in the user's language using ONLY the context provided above.
`;

        const result = await model.generateContent(promptText);
        rawAiResponse = result.response.text();
      } else {
        // Fallback context summary if GEMINI_API_KEY is not configured
        rawAiResponse = RAGManager.buildStaticFallbackResponse(retrievedData, plan);
      }

      aiTimeMs = Date.now() - aiStart;

      // 5. Validate AI Output & Apply Safety Guards
      const validated = ResponseValidator.validate(rawAiResponse, plan, retrievedData);

      // 6. Log RAG execution details safely
      const totalDurationMs = Date.now() - startTime;
      RAGLogger.log({
        userId: options.userId,
        tenantId: options.tenantId,
        intent: plan.intent,
        toolsUsed: plan.dataSources,
        retrievalDurationMs: retrievalTimeMs,
        aiDurationMs: aiTimeMs,
        totalDurationMs,
        success: true,
      });

      return validated;
    } catch (error: any) {
      RAGLogger.logError(options.userId, options.tenantId, error);

      return {
        answer: "Sorry, an error occurred while processing your request. Please try again.",
        intent: "ERROR",
        sources: [],
      };
    }
  }

  private static buildStaticFallbackResponse(retrievedData: any, plan: any): string {
    if (retrievedData.payrollCalculations && retrievedData.payrollCalculations.length > 0) {
      const calc = retrievedData.payrollCalculations[0];
      return `${calc.workerName} ne ${calc.presentDays} full days aur ${calc.halfDays} half days kaam kiya hai. Total payable: ₹${calc.grossSalary}, Paid: ₹${calc.totalPaid}, Pending: ₹${calc.pendingAmount}.`;
    }
    return "Database query succeeded, but AI engine is not configured.";
  }
}
