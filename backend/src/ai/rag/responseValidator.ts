import { QueryPlan } from "./queryPlanner";

export interface ValidatedResponse {
  answer: string;
  intent: string;
  sources: string[];
  requiresConfirmation?: boolean;
  actionPayload?: any;
}

export class ResponseValidator {
  public static validate(rawAnswer: string, plan: QueryPlan, retrievedData: any): ValidatedResponse {
    let answer = rawAnswer.trim();

    // Guard 1: Empty or failed response fallback
    if (!answer) {
      answer = "I apologize, but I could not generate a complete response based on your current Haajari records.";
    }

    // Guard 2: Action requests require explicit confirmation
    let requiresConfirmation = false;
    let actionPayload: any = undefined;

    if (plan.intent === "ACTION_REQUEST" && plan.actionDetails) {
      requiresConfirmation = true;
      actionPayload = plan.actionDetails;
    }

    return {
      answer,
      intent: plan.intent,
      sources: plan.dataSources,
      ...(requiresConfirmation ? { requiresConfirmation, actionPayload } : {}),
    };
  }
}
