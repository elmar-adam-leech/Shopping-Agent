import crypto from "crypto";
import type { McpConnection } from "@workspace/db/schema";
import { decrypt } from "./encryption";

interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export async function listAuthenticatedMCPTools(
  connection: McpConnection,
): Promise<MCPTool[]> {
  if (!connection.accessToken || !connection.mcpApiUrl) {
    return [];
  }

  const decryptedToken = decrypt(connection.accessToken);

  try {
    const response = await fetch(connection.mcpApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${decryptedToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "tools/list",
        params: {},
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.warn(`[customer-account-mcp] tools/list failed with status ${response.status}`);
      return [];
    }

    interface JsonRpcToolsResponse {
      result?: { tools?: MCPTool[] };
      error?: { message?: string };
    }

    const data = (await response.json()) as JsonRpcToolsResponse;
    return data.result?.tools || [];
  } catch (err) {
    console.warn(`[customer-account-mcp] tools/list error:`, err instanceof Error ? err.message : err);
    return [];
  }
}

export async function callAuthenticatedMCPTool(
  connection: McpConnection,
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  if (!connection.accessToken || !connection.mcpApiUrl) {
    throw new Error("Invalid connection: missing access token or MCP API URL");
  }

  const decryptedToken = decrypt(connection.accessToken);

  const response = await fetch(connection.mcpApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${decryptedToken}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    return JSON.stringify({ error: `Authenticated MCP call failed with status ${response.status}` });
  }

  interface JsonRpcResponse {
    result?: {
      content?: Array<{ type: string; text?: string }>;
    };
    error?: { message?: string };
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
}
