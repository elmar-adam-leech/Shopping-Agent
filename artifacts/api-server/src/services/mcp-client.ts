/**
 * MCP (Model Context Protocol) client for communicating with Shopify storefronts.
 *
 * MCP communication uses JSON-RPC 2.0 over HTTP POST to the store's /api/mcp endpoint.
 * Tool calls follow the MCP tools/list and tools/call methods.
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface JsonRpcResponse {
  result?: {
    tools?: MCPTool[];
    content?: Array<{ type: string; text?: string }>;
  };
  error?: { message?: string };
}

import { LRUCache } from "./lru-cache";

interface ToolsListCacheEntry {
  tools: MCPTool[];
}

const toolsListCache = new LRUCache<ToolsListCacheEntry>(500, 5 * 60 * 1000, "mcp-tools");

interface CircuitBreakerEntry {
  failures: number;
  lastFailure: number;
}

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 5 * 60 * 1000;
const circuitBreakers = new Map<string, CircuitBreakerEntry>();

function isCircuitOpen(storeDomain: string): boolean {
  const entry = circuitBreakers.get(storeDomain);
  if (!entry) return false;
  if (entry.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    if (Date.now() - entry.lastFailure > CIRCUIT_BREAKER_RESET_MS) {
      circuitBreakers.delete(storeDomain);
      return false;
    }
    return true;
  }
  return false;
}

function recordFailure(storeDomain: string): void {
  const entry = circuitBreakers.get(storeDomain) ?? { failures: 0, lastFailure: 0 };
  entry.failures++;
  entry.lastFailure = Date.now();
  circuitBreakers.set(storeDomain, entry);
}

function recordSuccess(storeDomain: string): void {
  circuitBreakers.delete(storeDomain);
}

export function invalidateToolsListCache(storeDomain: string): void {
  toolsListCache.delete(storeDomain);
}

function nextId(): string {
  return crypto.randomUUID();
}

export async function fetchMCPTools(storeDomain: string, storefrontToken: string): Promise<MCPTool[]> {
  const cached = toolsListCache.get(storeDomain);
  if (cached) return cached.tools;

  if (isCircuitOpen(storeDomain)) {
    console.warn(`[mcp-tools-list] store="${storeDomain}" circuit breaker open — using default tools`);
    return getDefaultTools();
  }

  let usedFallback = false;
  let mcpTools: MCPTool[];
  try {
    const response = await fetch(`https://${storeDomain}/api/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": storefrontToken,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: nextId(),
        method: "tools/list",
        params: {},
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.error(`[mcp-tools-list] store="${storeDomain}" status=${response.status} — falling back to default tools`);
      mcpTools = getDefaultTools();
      usedFallback = true;
      recordFailure(storeDomain);
    } else {
      const data = (await response.json()) as JsonRpcResponse;
      mcpTools = data.result?.tools || getDefaultTools();
      recordSuccess(storeDomain);
    }
  } catch (err) {
    console.error(`[mcp-tools-list] store="${storeDomain}" status=error error="${err instanceof Error ? err.message : "Unknown error"}" — falling back to default tools`);
    mcpTools = getDefaultTools();
    usedFallback = true;
    recordFailure(storeDomain);
  }

  if (!usedFallback) {
    toolsListCache.set(storeDomain, { tools: mcpTools });
  }

  return mcpTools;
}

export async function callTool(
  storeDomain: string,
  storefrontToken: string,
  toolName: string,
  args: Record<string, unknown>,
  ucpEnabled: boolean = true
): Promise<string> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": storefrontToken,
    };
    if (ucpEnabled) {
      headers["UCP-Version"] = "2026-01-11";
    }

    const response = await fetch(`https://${storeDomain}/api/mcp`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: nextId(),
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      return JSON.stringify({ error: `MCP call failed with status ${response.status}` });
    }

    const data = (await response.json()) as JsonRpcResponse;
    if (data.error) {
      return JSON.stringify({ error: data.error.message || "MCP tool error" });
    }

    if (data.result?.content) {
      return data.result.content
        .map((c) => c.text || JSON.stringify(c))
        .join("\n");
    }

    return JSON.stringify(data.result || {});
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return JSON.stringify({ error: `MCP call error: ${message}` });
  }
}

export function getDefaultTools(): MCPTool[] {
  return [
    {
      name: "search_products",
      description: "Search for products in the Shopify store",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query for products" },
          limit: { type: "number", description: "Maximum number of results" },
        },
        required: ["query"],
      },
    },
    {
      name: "get_product",
      description: "Get details of a specific product by handle or ID",
      inputSchema: {
        type: "object",
        properties: {
          handle: { type: "string", description: "Product handle/slug" },
        },
        required: ["handle"],
      },
    },
    {
      name: "get_collections",
      description: "List collections in the store",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Maximum number of results" },
        },
      },
    },
    {
      name: "create_cart",
      description: "Create a new shopping cart",
      inputSchema: {
        type: "object",
        properties: {
          lines: {
            type: "array",
            items: {
              type: "object",
              properties: {
                merchandiseId: { type: "string" },
                quantity: { type: "number" },
              },
            },
          },
        },
      },
    },
    {
      name: "add_to_cart",
      description: "Add items to an existing cart",
      inputSchema: {
        type: "object",
        properties: {
          cartId: { type: "string" },
          lines: {
            type: "array",
            items: {
              type: "object",
              properties: {
                merchandiseId: { type: "string" },
                quantity: { type: "number" },
              },
            },
          },
        },
        required: ["cartId", "lines"],
      },
    },
    {
      name: "get_cart",
      description: "Get the current cart contents",
      inputSchema: {
        type: "object",
        properties: {
          cartId: { type: "string" },
        },
        required: ["cartId"],
      },
    },
  ];
}

export function getVirtualTools(): MCPTool[] {
  return [
    {
      name: "propose_cart_edit",
      description:
        "Propose a cart modification (swap, variant change, or remove) and show a before/after preview to the customer for confirmation. The customer must confirm or cancel before the change is applied. Use this whenever a customer asks to change, swap, update, or remove a cart item.",
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["swap", "variant_change", "remove"],
            description: "Type of cart edit: swap replaces one item with another, variant_change changes size/color/etc, remove deletes an item",
          },
          oldItem: {
            type: "object",
            description: "The current item in the cart to be changed",
            properties: {
              id: { type: "string", description: "Line item or variant ID" },
              title: { type: "string", description: "Product title" },
              variantTitle: { type: "string", description: "Variant details (e.g. 'Blue / Large')" },
              price: { type: "number", description: "Current price" },
              imageUrl: { type: "string", description: "Product image URL" },
              quantity: { type: "number", description: "Current quantity" },
            },
            required: ["id", "title", "price"],
          },
          newItem: {
            type: "object",
            description: "The replacement item (required for swap and variant_change actions, omit for remove)",
            properties: {
              id: { type: "string", description: "New variant ID" },
              title: { type: "string", description: "Product title" },
              variantTitle: { type: "string", description: "Variant details (e.g. 'Red / Medium')" },
              price: { type: "number", description: "New price" },
              imageUrl: { type: "string", description: "Product image URL" },
            },
            required: ["id", "title", "price"],
          },
          reason: {
            type: "string",
            description: "Brief explanation of the proposed change",
          },
        },
        required: ["action", "oldItem"],
      },
    },
  ];
}
