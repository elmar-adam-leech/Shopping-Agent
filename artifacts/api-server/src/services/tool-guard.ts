import { scanToolResponse, logGuardEvent, type GuardSensitivity } from "./prompt-guard";
import { callTool } from "./mcp-client";
import { fetchBlogs, fetchCollections } from "./graphql-client";
import { callAuthenticatedMCPTool } from "./customer-account-mcp";
import type { McpConnection } from "@workspace/db/schema";

export async function executeToolWithFallback(
  storeDomain: string,
  storefrontToken: string,
  toolName: string,
  args: Record<string, unknown>,
  ucpEnabled: boolean = true
): Promise<string> {
  try {
    const result = await callTool(storeDomain, storefrontToken, toolName, args, ucpEnabled);
    let parsed: unknown;
    try {
      parsed = JSON.parse(result);
    } catch {
    }
    if (parsed && typeof parsed === "object" && (parsed as Record<string, unknown>).error) {
      throw new Error(String((parsed as Record<string, unknown>).error));
    }
    return result;
  } catch (err) {
    if (toolName === "get_collections" || toolName === "list_collections") {
      const limit = typeof args.limit === "number" ? args.limit : 10;
      const data = await fetchCollections(storeDomain, storefrontToken, limit);
      return JSON.stringify(data);
    }
    if (toolName === "get_blogs" || toolName === "list_blogs") {
      const limit = typeof args.limit === "number" ? args.limit : 5;
      const data = await fetchBlogs(storeDomain, storefrontToken, limit);
      return JSON.stringify(data);
    }
    return JSON.stringify({ error: `Tool ${toolName} failed and no fallback available` });
  }
}

async function guardToolResult(
  result: string,
  toolName: string,
  storeDomain: string,
  sessionId: string,
  guardSensitivity: GuardSensitivity,
  blockedTopics: string[]
): Promise<string> {
  const toolGuard = await scanToolResponse(result, guardSensitivity, blockedTopics);
  if (!toolGuard.allowed) {
    const toolEventType = toolGuard.category === "blocked_topic"
      ? "blocked_topic"
      : toolGuard.layer === "regex"
        ? "tool_injection_regex"
        : "tool_injection_llm";
    console.warn(`[prompt-guard] Blocked tool response (${toolEventType}/${toolGuard.layer}) in "${toolName}": ${toolGuard.reason}`);
    logGuardEvent(storeDomain, sessionId, toolEventType, toolName, {
      layer: toolGuard.layer,
      category: toolGuard.category,
      reason: toolGuard.reason,
      confidence: toolGuard.confidence,
    });
    return JSON.stringify({ error: "Tool response was filtered for security reasons." });
  }
  return result;
}

export function createToolExecutor(opts: {
  storeDomain: string;
  storefrontToken: string;
  sessionId: string;
  ucpEnabled: boolean;
  guardSensitivity: GuardSensitivity;
  blockedTopics: string[];
  authenticatedToolNames: Set<string>;
  activeConnection: McpConnection | null;
}): (toolName: string, args: Record<string, unknown>) => Promise<string> {
  const { storeDomain, storefrontToken, sessionId, ucpEnabled, guardSensitivity, blockedTopics, authenticatedToolNames, activeConnection } = opts;

  return async function executeAndGuardTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    if (authenticatedToolNames.has(toolName) && !activeConnection) {
      return JSON.stringify({
        error: "customer_account_required",
        message: "This tool requires a connected customer account. Please connect your customer account using the 'Connect Account' button in the chat header to access order history, account details, and other personalized features.",
      });
    }
    if (activeConnection) {
      try {
        const authResult = await callAuthenticatedMCPTool(activeConnection, toolName, args);
        let authParsed: unknown;
        try { authParsed = JSON.parse(authResult); } catch { return await guardToolResult(authResult, toolName, storeDomain, sessionId, guardSensitivity, blockedTopics); }
        if (authParsed && typeof authParsed === "object" && (authParsed as Record<string, unknown>).error) {
          console.warn(`[chat] Authenticated MCP tool "${toolName}" returned error, falling back to public MCP`);
        } else {
          return await guardToolResult(authResult, toolName, storeDomain, sessionId, guardSensitivity, blockedTopics);
        }
      } catch (err) {
        console.warn(`[chat] Authenticated MCP call failed, falling back to public:`, err instanceof Error ? err.message : err);
      }
    }
    const result = await executeToolWithFallback(storeDomain, storefrontToken, toolName, args, ucpEnabled);
    return await guardToolResult(result, toolName, storeDomain, sessionId, guardSensitivity, blockedTopics);
  };
}
