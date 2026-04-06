import { scanToolResponse, logGuardEvent, type GuardSensitivity } from "./prompt-guard";
import { callTool } from "./mcp-client";
import { fetchBlogs, fetchCollections } from "./graphql-client";
import { callAuthenticatedMCPTool } from "./customer-account-mcp";
import { logAnalyticsEvent } from "./analytics-logger";
import type { McpConnection } from "@workspace/db/schema";
import { logAudit } from "./audit-logger";

const CART_TOOLS = new Set(["create_cart", "add_to_cart", "update_cart"]);
const CHECKOUT_TOOLS = new Set(["create_checkout", "get_checkout_url"]);
const CHECKOUT_COMPLETE_TOOLS = new Set(["complete_checkout", "checkout_complete", "process_checkout"]);
const PRODUCT_TOOLS = new Set(["search_products", "get_product", "get_product_by_handle"]);

const ORDER_TOOL_ANALYTICS: Record<string, string> = {
  get_orders: "order_history_query",
  get_order_status: "order_status_query",
  request_return: "return_request",
};

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

  function logToolAnalytics(toolName: string, args: Record<string, unknown>, guardedResult: string): void {
    logAnalyticsEvent(storeDomain, "tool_call", sessionId, {
      metadata: { toolName, args: Object.keys(args) },
    }).catch(() => {});

    if (CART_TOOLS.has(toolName)) {
      logAnalyticsEvent(storeDomain, "cart_created", sessionId, {
        metadata: { toolName },
      }).catch(() => {});
    }

    if (CHECKOUT_TOOLS.has(toolName)) {
      logAnalyticsEvent(storeDomain, "checkout_started", sessionId, {
        metadata: { toolName },
      }).catch(() => {});
    }

    if (CHECKOUT_COMPLETE_TOOLS.has(toolName)) {
      try {
        const parsed = JSON.parse(guardedResult);
        const orderTotal = parsed?.totalPrice?.amount || parsed?.total_price || parsed?.totalAmount || parsed?.order?.total_price;
        logAnalyticsEvent(storeDomain, "checkout_completed", sessionId, {
          metadata: {
            toolName,
            ...(orderTotal !== undefined ? { orderTotal: Number(orderTotal) } : {}),
          },
        }).catch(() => {});
      } catch {
        logAnalyticsEvent(storeDomain, "checkout_completed", sessionId, {
          metadata: { toolName },
        }).catch(() => {});
      }
    }

    if (PRODUCT_TOOLS.has(toolName)) {
      try {
        const parsed = JSON.parse(guardedResult);
        const handles: string[] = [];
        if (Array.isArray(parsed?.products)) {
          for (const p of parsed.products.slice(0, 5)) {
            if (p.handle) handles.push(p.handle);
          }
        } else if (parsed?.handle) {
          handles.push(parsed.handle);
        }
        for (const handle of handles) {
          logAnalyticsEvent(storeDomain, "product_recommended", sessionId, {
            metadata: { productHandle: handle, toolName },
          }).catch(() => {});
        }
      } catch {}
    }
  }

  return async function executeAndGuardTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    const startTime = Date.now();

    const orderEventType = ORDER_TOOL_ANALYTICS[toolName];
    if (orderEventType) {
      logAnalyticsEvent(storeDomain, orderEventType, sessionId, {
        query: typeof args.order_id === "string" ? args.order_id : toolName,
      }).catch(() => {});
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
          logToolAnalytics(toolName, args, guarded);
          return guarded;
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
          logToolAnalytics(toolName, args, guarded);
          return guarded;
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
    logToolAnalytics(toolName, args, guarded);
    return guarded;
  };
}
