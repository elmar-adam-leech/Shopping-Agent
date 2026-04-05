import crypto from "crypto";
import { eq, and, gt, lt } from "drizzle-orm";
import { db, mcpConnectionsTable, pendingOAuthStatesTable, analyticsLogsTable } from "@workspace/db";
import type { McpConnection } from "@workspace/db/schema";
import { LRUCache } from "./lru-cache";
import { encrypt, decrypt } from "./encryption";

export interface CustomerAccountDiscovery {
  mcp_api: string;
  authorization_endpoint: string;
  token_endpoint: string;
}

const discoveryCache = new LRUCache<CustomerAccountDiscovery | null>(500, 60 * 60 * 1000, "customer-account-discovery");

export function invalidateDiscoveryCache(storeDomain: string): void {
  discoveryCache.delete(storeDomain);
}

export async function discoverCustomerAccountMCP(storeDomain: string): Promise<CustomerAccountDiscovery | null> {
  const cached = discoveryCache.get(storeDomain);
  if (cached !== undefined) return cached;

  try {
    const response = await fetch(`https://${storeDomain}/.well-known/customer-account-api`, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.log(`[customer-account-discovery] store="${storeDomain}" status=${response.status} — Customer Accounts MCP not available`);
      discoveryCache.set(storeDomain, null);
      return null;
    }

    const doc = (await response.json()) as Record<string, unknown>;
    const mcpApi = doc.mcp_api as string | undefined;
    const authEndpoint = doc.authorization_endpoint as string | undefined;
    const tokenEndpoint = doc.token_endpoint as string | undefined;

    if (!mcpApi || !authEndpoint || !tokenEndpoint) {
      console.warn(`[customer-account-discovery] store="${storeDomain}" — discovery document missing required fields`);
      discoveryCache.set(storeDomain, null);
      return null;
    }

    const result: CustomerAccountDiscovery = {
      mcp_api: mcpApi,
      authorization_endpoint: authEndpoint,
      token_endpoint: tokenEndpoint,
    };

    console.log(`[customer-account-discovery] store="${storeDomain}" status=ok mcp_api="${mcpApi}"`);
    discoveryCache.set(storeDomain, result);
    return result;
  } catch (err) {
    console.warn(`[customer-account-discovery] store="${storeDomain}" error="${err instanceof Error ? err.message : "Unknown"}"`);
    discoveryCache.set(storeDomain, null);
    return null;
  }
}

export function resolveClientId(store: { customerAccountClientId?: string | null; storeDomain: string }): string | null {
  if (store.customerAccountClientId) return store.customerAccountClientId;
  return process.env.SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_ID || null;
}

function getRedirectUri(): string {
  const appUrl = process.env.REPLIT_APP_URL;
  if (!appUrl) {
    console.warn("[customer-account-mcp] REPLIT_APP_URL is not set — OAuth redirect will likely fail");
  }
  return `${appUrl || ""}/api/auth/mcp/callback`;
}

export interface OAuthInitResult {
  authorizationUrl: string;
}

export async function initiateOAuth(
  storeDomain: string,
  sessionId: string,
  clientId: string,
  discovery: CustomerAccountDiscovery,
): Promise<OAuthInitResult> {
  await db.delete(pendingOAuthStatesTable).where(lt(pendingOAuthStatesTable.expiresAt, new Date()));

  const state = crypto.randomBytes(32).toString("hex");
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await db.insert(pendingOAuthStatesTable).values({
    state,
    shop: storeDomain,
    codeVerifier,
    sessionId,
    expiresAt,
  });

  const redirectUri = getRedirectUri();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "openid email customer-account-mcp-api:full",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const authorizationUrl = `${discovery.authorization_endpoint}?${params.toString()}`;
  return { authorizationUrl };
}

export async function handleOAuthCallback(
  code: string,
  state: string,
): Promise<{ storeDomain: string; sessionId: string }> {
  const deletedRows = await db
    .delete(pendingOAuthStatesTable)
    .where(
      and(
        eq(pendingOAuthStatesTable.state, state),
        gt(pendingOAuthStatesTable.expiresAt, new Date()),
      )
    )
    .returning();

  if (deletedRows.length === 0) {
    throw new Error("Invalid or expired OAuth state");
  }

  const oauthState = deletedRows[0];
  const storeDomain = oauthState.shop;
  const sessionId = oauthState.sessionId;
  const codeVerifier = oauthState.codeVerifier;

  if (!sessionId || !codeVerifier) {
    throw new Error("Invalid OAuth state: missing session or code verifier");
  }

  const discovery = await discoverCustomerAccountMCP(storeDomain);
  if (!discovery) {
    throw new Error("Customer Account MCP discovery failed for store");
  }

  const { loadFullStore } = await import("./tenant-validator");
  const store = await loadFullStore(storeDomain);
  const clientId = store ? (resolveClientId(store) || "") : (process.env.SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_ID || "");
  if (!clientId) {
    throw new Error("No Customer Account API client ID configured for this store");
  }
  const redirectUri = getRedirectUri();

  const tokenResponse = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
    }).toString(),
    signal: AbortSignal.timeout(15_000),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text().catch(() => "");
    console.error(`[customer-account-oauth] Token exchange failed (${tokenResponse.status}):`, errorText.slice(0, 500));
    throw new Error("Failed to exchange authorization code for tokens");
  }

  interface TokenData {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    id_token?: string;
  }

  const tokenData = (await tokenResponse.json()) as TokenData;
  const encryptedAccessToken = encrypt(tokenData.access_token);
  const encryptedRefreshToken = tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null;
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : new Date(Date.now() + 3600 * 1000);

  await db
    .insert(mcpConnectionsTable)
    .values({
      storeDomain,
      sessionId,
      mcpType: "customer_account",
      clientId,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      mcpApiUrl: discovery.mcp_api,
      authorizationEndpoint: discovery.authorization_endpoint,
      tokenEndpoint: discovery.token_endpoint,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [mcpConnectionsTable.storeDomain, mcpConnectionsTable.sessionId, mcpConnectionsTable.mcpType],
      set: {
        clientId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        mcpApiUrl: discovery.mcp_api,
        authorizationEndpoint: discovery.authorization_endpoint,
        tokenEndpoint: discovery.token_endpoint,
        expiresAt,
        updatedAt: new Date(),
      },
    });

  invalidateDiscoveryCache(storeDomain);

  try {
    await db.insert(analyticsLogsTable).values({
      storeDomain,
      eventType: "mcp_customer_account_connect",
      sessionId,
    });
  } catch (err) {
    console.warn(`[customer-account-oauth] Failed to log connect event:`, err instanceof Error ? err.message : err);
  }

  return { storeDomain, sessionId };
}

export async function refreshTokenIfNeeded(connection: McpConnection): Promise<McpConnection> {
  if (connection.expiresAt && connection.expiresAt > new Date()) {
    return connection;
  }

  if (!connection.refreshToken || !connection.tokenEndpoint || !connection.clientId) {
    throw new Error("Cannot refresh: missing refresh token or token endpoint");
  }

  const decryptedRefreshToken = decrypt(connection.refreshToken);

  const tokenResponse = await fetch(connection.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptedRefreshToken,
      client_id: connection.clientId,
    }).toString(),
    signal: AbortSignal.timeout(15_000),
  });

  if (!tokenResponse.ok) {
    console.error(`[customer-account-oauth] Token refresh failed (${tokenResponse.status})`);
    throw new Error("Token refresh failed");
  }

  interface RefreshTokenData {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }

  const tokenData = (await tokenResponse.json()) as RefreshTokenData;
  const encryptedAccessToken = encrypt(tokenData.access_token);
  const encryptedRefreshToken = tokenData.refresh_token ? encrypt(tokenData.refresh_token) : connection.refreshToken;
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : new Date(Date.now() + 3600 * 1000);

  const [updated] = await db
    .update(mcpConnectionsTable)
    .set({
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(mcpConnectionsTable.id, connection.id))
    .returning();

  try {
    await db.insert(analyticsLogsTable).values({
      storeDomain: connection.storeDomain,
      eventType: "mcp_customer_account_refresh",
      sessionId: connection.sessionId,
    });
  } catch {
  }

  return updated;
}

export async function getActiveConnection(
  storeDomain: string,
  sessionId: string,
): Promise<McpConnection | null> {
  const [connection] = await db
    .select()
    .from(mcpConnectionsTable)
    .where(
      and(
        eq(mcpConnectionsTable.storeDomain, storeDomain),
        eq(mcpConnectionsTable.sessionId, sessionId),
        eq(mcpConnectionsTable.mcpType, "customer_account"),
      )
    );

  if (!connection) return null;

  try {
    return await refreshTokenIfNeeded(connection);
  } catch (err) {
    console.warn(`[customer-account-mcp] Failed to refresh token for store="${storeDomain}":`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function revokeConnection(
  storeDomain: string,
  sessionId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(mcpConnectionsTable)
    .where(
      and(
        eq(mcpConnectionsTable.storeDomain, storeDomain),
        eq(mcpConnectionsTable.sessionId, sessionId),
        eq(mcpConnectionsTable.mcpType, "customer_account"),
      )
    )
    .returning();

  invalidateDiscoveryCache(storeDomain);

  if (deleted.length > 0) {
    try {
      await db.insert(analyticsLogsTable).values({
        storeDomain,
        eventType: "mcp_customer_account_revoke",
        sessionId,
      });
    } catch {
    }
    return true;
  }

  return false;
}

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
