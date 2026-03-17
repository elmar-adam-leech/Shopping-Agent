export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface MCPToolResult {
  content: Array<{ type: string; text?: string; [key: string]: any }>;
  isError?: boolean;
}

let requestId = 0;
function nextId() {
  return ++requestId;
}

export async function listTools(storeDomain: string, storefrontToken: string): Promise<MCPTool[]> {
  const url = `https://${storeDomain}/api/2025-01/graphql.json`;

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
      return getDefaultTools();
    }

    const data = await response.json();
    if (data.result?.tools) {
      return data.result.tools;
    }
    return getDefaultTools();
  } catch (err) {
    console.error("MCP tools/list error:", err);
    return getDefaultTools();
  }
}

export async function callTool(
  storeDomain: string,
  storefrontToken: string,
  toolName: string,
  args: any
): Promise<string> {
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
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }),
    });

    if (!response.ok) {
      return JSON.stringify({ error: `MCP call failed with status ${response.status}` });
    }

    const data = await response.json();
    if (data.error) {
      return JSON.stringify({ error: data.error.message || "MCP tool error" });
    }

    if (data.result?.content) {
      return data.result.content
        .map((c: any) => c.text || JSON.stringify(c))
        .join("\n");
    }

    return JSON.stringify(data.result || {});
  } catch (err: any) {
    return JSON.stringify({ error: `MCP call error: ${err.message}` });
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
