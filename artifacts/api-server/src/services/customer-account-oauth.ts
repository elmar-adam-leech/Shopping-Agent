import crypto from "crypto";
import { lt, eq, and, gt } from "drizzle-orm";
import { db, mcpConnectionsTable, pendingOAuthStatesTable, withTenantScope } from "@workspace/db";
import { encrypt } from "./encryption";
import { discoverCustomerAccountMCP, resolveClientId, invalidateDiscoveryCache, type CustomerAccountDiscovery } from "./customer-account-discovery";


function getRedirectUri(): string {
  const appUrl = process.env.REPLIT_APP_URL;
  if (!appUrl) {
    console.warn("[customer-account-oauth] REPLIT_APP_URL is not set — OAuth redirect will likely fail");
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

  await withTenantScope(storeDomain, async (scopedDb) => {
    await scopedDb
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
  });

  invalidateDiscoveryCache(storeDomain);

  return { storeDomain, sessionId };
}
