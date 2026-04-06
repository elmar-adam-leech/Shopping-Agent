import { eq, and } from "drizzle-orm";
import { db, mcpConnectionsTable } from "@workspace/db";
import type { McpConnection } from "@workspace/db/schema";
import { encrypt, decrypt } from "./encryption";
import { invalidateDiscoveryCache } from "./customer-account-discovery";
import { logAnalyticsEvent } from "./analytics-logger";

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
    console.error(`[customer-account-connection] Token refresh failed (${tokenResponse.status})`);
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

  await logAnalyticsEvent(connection.storeDomain, "mcp_customer_account_refresh", connection.sessionId);

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
    console.warn(`[customer-account-connection] Failed to refresh token for store="${storeDomain}":`, err instanceof Error ? err.message : err);
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
    await logAnalyticsEvent(storeDomain, "mcp_customer_account_revoke", sessionId);
    return true;
  }

  return false;
}
