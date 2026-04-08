import { scanToolResponse, logGuardEvent, type GuardSensitivity } from "./prompt-guard";
import { callTool } from "./mcp-client";
import { fetchBlogs, fetchCollections, fetchMetaobjects } from "./graphql-client";
import { callAuthenticatedMCPTool } from "./customer-account-mcp";
import { validateUCPInvokeParams } from "./ucp-client";
import type { McpConnection } from "@workspace/db/schema";
import { logAudit } from "./audit-logger";
import { INTERNAL_TOOL_NAMES, executeInternalTool, type InternalToolContext } from "./internal-tools";
import type { UserPreferencesContext } from "./system-prompt";


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
    if (toolName === "get_store_content" || toolName === "get_metaobjects") {
      const typeHandle = typeof args.type === "string" ? args.type : "";
      if (!typeHandle) {
        return JSON.stringify({ error: "type parameter is required for metaobject queries" });
      }
      const limit = typeof args.limit === "number" ? args.limit : 10;
      const data = await fetchMetaobjects(storeDomain, storefrontToken, typeHandle, limit);
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
        : toolGuard.layer === "heuristic"
          ? "tool_injection_heuristic"
          : "tool_injection_llm";
    console.warn(`[prompt-guard] Blocked tool response (${toolEventType}/${toolGuard.layer}) in "${toolName}": ${toolGuard.reason}`);
    logGuardEvent(storeDomain, sessionId, toolEventType, toolName, {
      layer: toolGuard.layer,
      category: toolGuard.category,
      reason: toolGuard.reason,
      patternsMatched: toolGuard.patternsMatched,
      heuristicScore: toolGuard.heuristicScore,
      heuristicSignals: toolGuard.heuristicSignals,
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
  userPreferences?: UserPreferencesContext | null;
}): (toolName: string, args: Record<string, unknown>) => Promise<string> {
  const { storeDomain, storefrontToken, sessionId, ucpEnabled, guardSensitivity, blockedTopics, authenticatedToolNames, activeConnection, userPreferences } = opts;

  return async function executeAndGuardTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    if (toolName === "propose_cart_edit") {
      const action = args.action as string;
      if ((action === "swap" || action === "variant_change") && !args.newItem) {
        return JSON.stringify({ error: "newItem is required for swap and variant_change actions" });
      }
      return JSON.stringify({ _cartEditPreview: true, ...args });
    }

    const startTime = Date.now();

    if (INTERNAL_TOOL_NAMES.has(toolName)) {
      try {
        const internalCtx: InternalToolContext = {
          storeDomain,
          storefrontToken,
          sessionId,
          ucpEnabled,
          userPreferences: userPreferences || null,
        };
        const result = await executeInternalTool(toolName, args, internalCtx);
        return result;
      } catch (err) {
        console.error(`[tool-guard] Internal tool "${toolName}" failed:`, err instanceof Error ? err.message : err);
        return JSON.stringify({ error: `Internal tool ${toolName} failed` });
      }
    }

    if (toolName === "ucp_invoke") {
      const service = typeof args.service === "string" ? args.service.trim() : "";
      const capability = typeof args.capability === "string" ? args.capability.trim() : "";
      if (!service || !capability) {
        return JSON.stringify({ error: "ucp_invoke requires both 'service' and 'capability' parameters" });
      }
      const params = typeof args.params === "object" && args.params !== null ? args.params as Record<string, unknown> : {};
      const validation = validateUCPInvokeParams(service, capability, params);
      if (!validation.valid) {
        return JSON.stringify({ error: validation.error });
      }
    }

    if (authenticatedToolNames.has(toolName) && !activeConnection) {
      logAudit({
        storeDomain,
        actor: "customer",
        actorId: sessionId,
        action: "tool_execution_blocked",
        resourceType: "mcp_tool",
        resourceId: toolName,
        metadata: { reason: "customer_account_required" },
      });
      return JSON.stringify({
        error: "customer_account_required",
        message: "This tool requires a connected customer account. Please connect your customer account using the 'Connect Account' button in the chat header to access order history, account details, and other personalized features.",
      });
    }
    if (activeConnection) {
      try {
        const authResult = await callAuthenticatedMCPTool(activeConnection, toolName, args);
        let authParsed: unknown;
        try { authParsed = JSON.parse(authResult); } catch {
          logAudit({
            storeDomain,
            actor: "customer",
            actorId: sessionId,
            action: "tool_execution_success",
            resourceType: "mcp_tool",
            resourceId: toolName,
            metadata: { authenticated: true, durationMs: Date.now() - startTime },
          });
          const guarded = await guardToolResult(authResult, toolName, storeDomain, sessionId, guardSensitivity, blockedTopics);
          return detectAndHandleEscalation(guarded, toolName, storeDomain, sessionId);
        }
        if (authParsed && typeof authParsed === "object" && (authParsed as Record<string, unknown>).error) {
          console.warn(`[chat] Authenticated MCP tool "${toolName}" returned error, falling back to public MCP`);
        } else {
          logAudit({
            storeDomain,
            actor: "customer",
            actorId: sessionId,
            action: "tool_execution_success",
            resourceType: "mcp_tool",
            resourceId: toolName,
            metadata: { authenticated: true, durationMs: Date.now() - startTime },
          });
          const guarded = await guardToolResult(authResult, toolName, storeDomain, sessionId, guardSensitivity, blockedTopics);
          return detectAndHandleEscalation(guarded, toolName, storeDomain, sessionId);
        }
      } catch (err) {
        console.warn(`[chat] Authenticated MCP call failed, falling back to public:`, err instanceof Error ? err.message : err);
        logAudit({
          storeDomain,
          actor: "customer",
          actorId: sessionId,
          action: "tool_execution_failed",
          resourceType: "mcp_tool",
          resourceId: toolName,
          metadata: { authenticated: true, error: err instanceof Error ? err.message : "Unknown", durationMs: Date.now() - startTime },
        });
      }
    }
    const result = await executeToolWithFallback(storeDomain, storefrontToken, toolName, args, ucpEnabled);

    logAudit({
      storeDomain,
      actor: "customer",
      actorId: sessionId,
      action: "tool_execution_success",
      resourceType: "mcp_tool",
      resourceId: toolName,
      metadata: { authenticated: false, durationMs: Date.now() - startTime },
    });

    const guarded = await guardToolResult(result, toolName, storeDomain, sessionId, guardSensitivity, blockedTopics);

    const withEscalation = detectAndHandleEscalation(guarded, toolName, storeDomain, sessionId);
    return withEscalation;
  };
}

function detectAndHandleEscalation(
  result: string,
  toolName: string,
  storeDomain: string,
  sessionId: string
): string {
  try {
    const parsed = JSON.parse(result);
    if (parsed && typeof parsed === "object" && (parsed as Record<string, unknown>).requires_escalation === true) {
      const escalationData = parsed as Record<string, unknown>;
      const escalation: Record<string, unknown> = {
        ...escalationData,
        _escalation: true,
        _escalation_message: buildEscalationMessage(escalationData),
      };
      return JSON.stringify(escalation);
    }
  } catch {}
  return result;
}

function buildEscalationMessage(data: Record<string, unknown>): string {
  const reason = typeof data.escalation_reason === "string" ? data.escalation_reason : "This request requires human assistance.";
  const contactEmail = typeof data.contact_email === "string" ? data.contact_email : null;
  const contactPhone = typeof data.contact_phone === "string" ? data.contact_phone : null;
  const contactUrl = typeof data.contact_url === "string" ? data.contact_url : null;

  let message = `This request needs to be handled by our support team. Reason: ${reason}`;
  const contactMethods: string[] = [];
  if (contactEmail) contactMethods.push(`Email: ${contactEmail}`);
  if (contactPhone) contactMethods.push(`Phone: ${contactPhone}`);
  if (contactUrl) contactMethods.push(`Support: ${contactUrl}`);
  if (contactMethods.length > 0) {
    message += `\n\nYou can reach our support team at:\n${contactMethods.join("\n")}`;
  }
  return message;
}
