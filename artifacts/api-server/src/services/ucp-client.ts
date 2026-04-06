import type { MCPTool } from "./mcp-client";
import { LRUCache } from "./lru-cache";

export interface UCPDiscoveryDocument {
  version: string;
  business: {
    name?: string;
    url?: string;
    description?: string;
  };
  services?: Array<{
    type: string;
    transport?: string;
    url?: string;
    capabilities?: string[];
  }>;
  payment_handlers?: Array<{
    type: string;
    supported_methods?: string[];
  }>;
}

const ucpCache = new LRUCache<UCPDiscoveryDocument | null>(1000, 5 * 60 * 1000, "ucp-discovery");

export async function discoverUCPCapabilities(storeDomain: string): Promise<UCPDiscoveryDocument | null> {
  const cached = ucpCache.get(storeDomain);
  if (cached !== undefined) return cached;

  try {
    const response = await fetch(`https://${storeDomain}/.well-known/ucp`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "UCP-Version": "2026-01-11",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.log(`[ucp-discovery] store="${storeDomain}" status=${response.status} — UCP not available, continuing with standard MCP tools`);
      ucpCache.set(storeDomain, null);
      return null;
    }

    const doc = (await response.json()) as UCPDiscoveryDocument;
    console.log(`[ucp-discovery] store="${storeDomain}" status=ok version=${doc.version}`);
    ucpCache.set(storeDomain, doc);
    return doc;
  } catch (err) {
    console.warn(`[ucp-discovery] store="${storeDomain}" status=error error="${err instanceof Error ? err.message : "Unknown error"}" — continuing with standard MCP tools`);
    ucpCache.set(storeDomain, null);
    return null;
  }
}

export function getUCPTools(): MCPTool[] {
  return [
    {
      name: "create_checkout",
      description: "Create a new UCP checkout session for purchasing items",
      inputSchema: {
        type: "object",
        properties: {
          line_items: {
            type: "array",
            description: "Items to include in the checkout",
            items: {
              type: "object",
              properties: {
                product_id: { type: "string", description: "Product identifier" },
                variant_id: { type: "string", description: "Variant identifier" },
                quantity: { type: "number", description: "Quantity to purchase" },
              },
              required: ["product_id", "quantity"],
            },
          },
          customer_email: { type: "string", description: "Customer email address" },
        },
        required: ["line_items"],
      },
    },
    {
      name: "update_checkout",
      description: "Update an existing UCP checkout session (modify items, shipping, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          checkout_session_id: { type: "string", description: "The checkout session ID" },
          line_items: {
            type: "array",
            description: "Updated line items",
            items: {
              type: "object",
              properties: {
                product_id: { type: "string" },
                variant_id: { type: "string" },
                quantity: { type: "number" },
              },
            },
          },
          shipping_address: {
            type: "object",
            description: "Shipping address",
            properties: {
              line1: { type: "string" },
              city: { type: "string" },
              state: { type: "string" },
              postal_code: { type: "string" },
              country: { type: "string" },
            },
          },
        },
        required: ["checkout_session_id"],
      },
    },
    {
      name: "complete_checkout",
      description: "Complete/finalize a UCP checkout session to place the order",
      inputSchema: {
        type: "object",
        properties: {
          checkout_session_id: { type: "string", description: "The checkout session ID to complete" },
          payment_method: { type: "string", description: "Payment method identifier" },
        },
        required: ["checkout_session_id"],
      },
    },
    {
      name: "get_order_status",
      description: "Get the status of an order including fulfillment and tracking information",
      inputSchema: {
        type: "object",
        properties: {
          order_id: { type: "string", description: "The order ID to look up" },
        },
        required: ["order_id"],
      },
    },
  ];
}

const UCP_CAPABILITY_TO_TOOLS: Record<string, string[]> = {
  checkout: ["create_checkout", "update_checkout", "complete_checkout"],
  orders: ["get_order_status"],
};

export function getUCPToolsForCapabilities(ucpDoc: UCPDiscoveryDocument): MCPTool[] {
  const allUcpTools = getUCPTools();
  const allowedToolNames = new Set<string>();

  if (ucpDoc.services) {
    for (const service of ucpDoc.services) {
      const capTools = UCP_CAPABILITY_TO_TOOLS[service.type];
      if (capTools) {
        for (const t of capTools) allowedToolNames.add(t);
      }
      if (service.capabilities) {
        for (const cap of service.capabilities) {
          const mapped = UCP_CAPABILITY_TO_TOOLS[cap];
          if (mapped) {
            for (const t of mapped) allowedToolNames.add(t);
          }
        }
      }
    }
  }

  if (allowedToolNames.size === 0) {
    return allUcpTools;
  }

  return allUcpTools.filter(t => allowedToolNames.has(t.name));
}
