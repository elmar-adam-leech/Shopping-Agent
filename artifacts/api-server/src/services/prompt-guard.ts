export type { GuardVerdict, OutputAuditResult, GuardSensitivity } from "./guard-types";
export { CONFIDENCE_THRESHOLDS, LLM_GUARD_TIMEOUT_MS, SYSTEM_PROMPT_HARDENING } from "./guard-types";
export { logGuardEvent } from "./guard-analytics";

import type { GuardVerdict, GuardSensitivity, OutputAuditResult } from "./guard-types";
import { runRegexFilter } from "./guard-regex";
import { runLLMClassifier, scanToolResponseLLM, auditOutputLLM } from "./guard-llm";

export async function runPromptGuard(
  message: string,
  sensitivity: GuardSensitivity,
  blockedTopics: string[] = []
): Promise<GuardVerdict> {
  const regexResult = runRegexFilter(message);
  if (regexResult.blocked) {
    return {
      allowed: false,
      layer: "regex",
      category: "injection",
      patternsMatched: regexResult.patternsMatched,
      reason: "Message matched known injection patterns",
    };
  }

  if (sensitivity === "off") {
    return { allowed: true, layer: "none", category: "none" };
  }

  const llmResult = await runLLMClassifier(message, blockedTopics, sensitivity);
  if (llmResult.blocked) {
    return {
      allowed: false,
      layer: "llm",
      category: llmResult.category,
      confidence: llmResult.confidence,
      reason: llmResult.reason,
    };
  }

  return { allowed: true, layer: "none", category: "none", confidence: llmResult.confidence };
}

export async function scanToolResponse(
  toolResult: string,
  sensitivity: GuardSensitivity,
  blockedTopics: string[] = []
): Promise<GuardVerdict> {
  if (sensitivity === "off") {
    return { allowed: true, layer: "none", category: "none" };
  }

  const regexResult = runRegexFilter(toolResult);
  if (regexResult.blocked) {
    return {
      allowed: false,
      layer: "regex",
      category: "injection",
      patternsMatched: regexResult.patternsMatched,
      reason: "Tool response contained injection patterns",
    };
  }

  const llmResult = await scanToolResponseLLM(toolResult, sensitivity, blockedTopics);
  if (!llmResult) {
    return { allowed: true, layer: "none", category: "none" };
  }

  return {
    allowed: !llmResult.blocked,
    layer: llmResult.blocked ? "llm" : "none",
    category: llmResult.blocked ? llmResult.category : "none",
    confidence: llmResult.confidence,
    reason: llmResult.reason,
  };
}

export async function auditOutput(
  assistantResponse: string,
  toolResults: string[],
  blockedTopics: string[] = [],
  knowledgeContext: string = ""
): Promise<OutputAuditResult> {
  return auditOutputLLM(assistantResponse, toolResults, blockedTopics, knowledgeContext);
}
