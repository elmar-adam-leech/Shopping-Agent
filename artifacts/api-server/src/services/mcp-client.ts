// UCP compliance added per ucp.dev

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPToolResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
}

interface JsonRpcResponse {
  result?: {
    tools?: MCPTool[];
    content?: Array<{ type: string; text?: string }>;
  };
  error?: { message?: string };
}

// UCP compliance added per ucp.dev
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

// UCP compliance added per ucp.dev
interface UCPCacheEntry {
  document: UCPDiscoveryDocument | null;
  fetchedAt: number;
}

const UCP_CACHE_TTL_MS = 5 * 60 * 1000;
const ucpCache = new Map<string, UCPCacheEntry>();

let requestId = 0;
function nextId() {
  return ++requestId;
}

// UCP compliance added per ucp.dev
export async function discoverUCPCapabilities(storeDomain: string): Promise<UCPDiscoveryDocument | null> {
  const cached = ucpCache.get(storeDomain);
  if (cached && Date.now() - cached.fetchedAt < UCP_CACHE_TTL_MS) {
    return cached.document;
  }

  try {
    const response = await fetch(`https://${storeDomain}/.well-known/ucp`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "UCP-Version": "2026-01-11",
      },
    });

    if (!response.ok) {
      console.log(`UCP discovery not available for ${storeDomain} (${response.status}) — continuing with standard MCP tools`);
      ucpCache.set(storeDomain, { document: null, fetchedAt: Date.now() });
      return null;
    }

    const doc = (await response.json()) as UCPDiscoveryDocument;
    console.log(`UCP discovery successful for ${storeDomain}: version=${doc.version}`);
    ucpCache.set(storeDomain, { document: doc, fetchedAt: Date.now() });
    return doc;
  } catch (err) {
    console.log(`UCP discovery failed for ${storeDomain}: ${err instanceof Error ? err.message : "Unknown error"} — continuing with standard MCP tools`);
    ucpCache.set(storeDomain, { document: null, fetchedAt: Date.now() });
    return null;
  }
}

// UCP compliance added per ucp.dev
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

// UCP compliance added per ucp.dev
const UCP_CAPABILITY_TO_TOOLS: Record<string, string[]> = {
  checkout: ["create_checkout", "update_checkout", "complete_checkout"],
  orders: ["get_order_status"],
};

function getUCPToolsForCapabilities(ucpDoc: UCPDiscoveryDocument): MCPTool[] {
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

export async function listTools(storeDomain: string, storefrontToken: string, ucpEnabled: boolean = true): Promise<{ tools: MCPTool[]; ucpDoc: UCPDiscoveryDocument | null }> {
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
    });

    if (!response.ok) {
      console.error(`MCP tools/list failed: ${response.status}`);
      mcpTools = getDefaultTools();
    } else {
      const data = (await response.json()) as JsonRpcResponse;
      mcpTools = data.result?.tools || getDefaultTools();
    }
  } catch (err) {
    console.error("MCP tools/list error:", err);
    mcpTools = getDefaultTools();
  }

  // UCP compliance added per ucp.dev — discovery performed after tools/list
  const ucpToolNames = new Set(getUCPTools().map(t => t.name));
  let ucpDoc: UCPDiscoveryDocument | null = null;

  if (ucpEnabled) {
    ucpDoc = await discoverUCPCapabilities(storeDomain);

    if (ucpDoc) {
      const ucpTools = getUCPToolsForCapabilities(ucpDoc);
      const existingNames = new Set(mcpTools.map(t => t.name));
      for (const tool of ucpTools) {
        if (!existingNames.has(tool.name)) {
          mcpTools.push(tool);
        }
      }
    }
  } else {
    mcpTools = mcpTools.filter(t => !ucpToolNames.has(t.name));
  }

  return { tools: mcpTools, ucpDoc };
}

export async function callTool(
  storeDomain: string,
  storefrontToken: string,
  toolName: string,
  args: Record<string, unknown>,
  ucpEnabled: boolean = true
): Promise<string> {
  try {
    // UCP compliance added per ucp.dev
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

function getDefaultTools(): MCPTool[] {
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
