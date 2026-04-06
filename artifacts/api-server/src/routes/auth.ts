import { Router, type IRouter } from "express";
import crypto from "crypto";
import { db, storesTable, pendingOAuthStatesTable } from "@workspace/db";
import { eq, lt, gt, and, sql, isNull } from "drizzle-orm";
import { createMerchantSession } from "../middleware";
import { encrypt } from "../services/encryption";
import { SHOPIFY_DOMAIN_PATTERN } from "../lib/validation";
import { sendError } from "../lib/error-response";
import { logAuditFromRequest } from "../services/audit-logger";

const router: IRouter = Router();

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || "";
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || "";
const APP_URL = process.env.APP_URL || "";
const SCOPES = "unauthenticated_read_product_listings,unauthenticated_read_collection_listings,unauthenticated_read_content";

const STATE_TTL_MS = 10 * 60 * 1000;
const MAX_PENDING_STATES = 10000;

async function cleanExpiredStates() {
  await db.delete(pendingOAuthStatesTable).where(lt(pendingOAuthStatesTable.expiresAt, new Date()));
}

function setMerchantCookie(res: import("express").Response, token: string) {
  res.cookie("merchant_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 72 * 60 * 60 * 1000,
    path: "/",
  });
}

router.get("/auth/install", async (req, res): Promise<void> => {
  const shop = Array.isArray(req.query.shop) ? req.query.shop[0] : req.query.shop;

  if (!shop || typeof shop !== "string") {
    sendError(res, 400, "Missing shop parameter");
    return;
  }

  if (!SHOPIFY_DOMAIN_PATTERN.test(shop)) {
    sendError(res, 400, "Invalid shop domain. Must be a valid .myshopify.com domain.");
    return;
  }

  if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET || !APP_URL) {
    sendError(res, 500, "Shopify app not configured. Set SHOPIFY_API_KEY, SHOPIFY_API_SECRET, and APP_URL.");
    return;
  }

  await cleanExpiredStates();

  const [{ count: pendingCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pendingOAuthStatesTable);

  if (pendingCount >= MAX_PENDING_STATES) {
    console.warn(`[auth] OAuth pending states at capacity (${MAX_PENDING_STATES}), rejecting new install`);
    sendError(res, 503, "Server is busy, please try again later");
    return;
  }

  const state = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + STATE_TTL_MS);
  await db.insert(pendingOAuthStatesTable).values({ state, shop, expiresAt });

  const redirectUri = `${APP_URL}/api/auth/callback`;
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SCOPES}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  res.redirect(installUrl);
});

router.get("/auth/callback", async (req, res): Promise<void> => {
  const code = typeof req.query.code === "string" ? req.query.code : Array.isArray(req.query.code) ? String(req.query.code[0]) : undefined;
  const shop = typeof req.query.shop === "string" ? req.query.shop : Array.isArray(req.query.shop) ? String(req.query.shop[0]) : undefined;
  const hmac = typeof req.query.hmac === "string" ? req.query.hmac : Array.isArray(req.query.hmac) ? String(req.query.hmac[0]) : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : Array.isArray(req.query.state) ? String(req.query.state[0]) : undefined;

  if (!code || !shop || !hmac || !state) {
    sendError(res, 400, "Missing required parameters");
    return;
  }

  if (!SHOPIFY_DOMAIN_PATTERN.test(shop)) {
    sendError(res, 400, "Invalid shop domain format");
    return;
  }

  await cleanExpiredStates();

  if (!SHOPIFY_API_SECRET) {
    sendError(res, 500, "SHOPIFY_API_SECRET is required for OAuth callback");
    return;
  }

  const deletedRows = await db
    .delete(pendingOAuthStatesTable)
    .where(
      and(
        eq(pendingOAuthStatesTable.state, state),
        eq(pendingOAuthStatesTable.shop, shop),
        gt(pendingOAuthStatesTable.expiresAt, new Date())
      )
    )
    .returning({ state: pendingOAuthStatesTable.state });

  if (deletedRows.length === 0) {
    sendError(res, 403, "Invalid or expired OAuth state");
    return;
  }

  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "hmac") continue;
    params[key] = typeof value === "string" ? value : Array.isArray(value) ? String(value[0]) : String(value);
  }
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  const digest = crypto
    .createHmac("sha256", SHOPIFY_API_SECRET)
    .update(sortedParams)
    .digest("hex");

  if (!hmac || !/^[0-9a-f]+$/i.test(hmac)) {
    sendError(res, 403, "HMAC verification failed");
    return;
  }

  const digestBuf = Buffer.from(digest, "hex");
  const hmacBuf = Buffer.from(hmac, "hex");

  if (digestBuf.length !== hmacBuf.length || !crypto.timingSafeEqual(digestBuf, hmacBuf)) {
    sendError(res, 403, "HMAC verification failed");
    return;
  }

  try {
    interface TokenResponse {
      access_token: string;
      scope?: string;
    }

    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      let errorBody = "";
      try {
        errorBody = await tokenResponse.text();
      } catch {}
      const redactedBody = errorBody.replace(/("access_token"|"api_key"|"secret")[^,}]*/gi, '$1":"[REDACTED]"');
      console.error(`[auth] Shopify token exchange failed (${tokenResponse.status}):`, redactedBody.slice(0, 500));
      logAuditFromRequest(req, {
        storeDomain: shop,
        actor: "system",
        action: "oauth_token_exchange_failed",
        resourceType: "store",
        resourceId: shop,
        metadata: { status: tokenResponse.status },
      });
      sendError(res, 500, "Failed to exchange OAuth code");
      return;
    }

    const tokenData = (await tokenResponse.json()) as TokenResponse;

    const requiredScopes = SCOPES.split(",");
    const grantedScopes = tokenData.scope
      ? tokenData.scope.split(",").map(s => s.trim())
      : [];

    if (grantedScopes.length === 0) {
      console.warn(`[auth] No scopes returned for shop="${shop}". Required: ${requiredScopes.join(", ")}`);
      logAuditFromRequest(req, {
        storeDomain: shop,
        actor: "system",
        action: "oauth_no_scopes_returned",
        resourceType: "store",
        resourceId: shop,
        metadata: { requiredScopes },
      });
      sendError(res, 403, "No access token scopes returned. Please re-authorize with required permissions.");
      return;
    }

    const missingScopes = requiredScopes.filter(s => !grantedScopes.includes(s));
    if (missingScopes.length > 0) {
      console.warn(`[auth] Insufficient scopes for shop="${shop}". Missing: ${missingScopes.join(", ")}. Granted: ${tokenData.scope}`);
      logAuditFromRequest(req, {
        storeDomain: shop,
        actor: "system",
        action: "oauth_insufficient_scopes",
        resourceType: "store",
        resourceId: shop,
        metadata: { requiredScopes, grantedScopes, missingScopes },
      });
      sendError(res, 403, "Insufficient access token scopes. Please re-authorize with required permissions.");
      return;
    }

    const existing = await db
      .select()
      .from(storesTable)
      .where(and(eq(storesTable.storeDomain, shop), isNull(storesTable.deletedAt)));

    const encryptedAccessToken = encrypt(tokenData.access_token);
    const isUpdate = existing.length > 0;

    if (isUpdate) {
      await db
        .update(storesTable)
        .set({ accessToken: encryptedAccessToken })
        .where(eq(storesTable.storeDomain, shop));
    } else {
      await db.insert(storesTable).values({
        storeDomain: shop,
        accessToken: encryptedAccessToken,
        provider: "openai",
        model: "gpt-4o",
      });
    }

    logAuditFromRequest(req, {
      storeDomain: shop,
      actor: "merchant",
      action: isUpdate ? "oauth_token_refreshed" : "store_created_via_oauth",
      resourceType: "store",
      resourceId: shop,
      metadata: { grantedScopes: tokenData.scope },
    });

    const merchantToken = await createMerchantSession(shop);
    setMerchantCookie(res, merchantToken);

    logAuditFromRequest(req, {
      storeDomain: shop,
      actor: "merchant",
      action: "merchant_login",
      resourceType: "session",
    });

    res.redirect(`/${encodeURIComponent(shop)}/settings`);
  } catch (err: unknown) {
    console.error("[auth] OAuth callback error:", err instanceof Error ? err.message : "Unknown error");
    sendError(res, 500, "OAuth callback failed");
  }
});

router.post("/auth/login", async (req, res): Promise<void> => {
  if (process.env.NODE_ENV !== "development") {
    sendError(res, 404, "Not found");
    return;
  }

  const devSecret = process.env.DEV_AUTH_SECRET;
  if (!devSecret) {
    sendError(res, 403, "DEV_AUTH_SECRET is not configured");
    return;
  }

  const { storeDomain, secret } = req.body as { storeDomain?: string; secret?: string };

  if (!secret || typeof secret !== "string") {
    sendError(res, 403, "Invalid dev auth secret");
    return;
  }

  const secretBuf = Buffer.from(secret);
  const devSecretBuf = Buffer.from(devSecret);
  if (secretBuf.length !== devSecretBuf.length || !crypto.timingSafeEqual(secretBuf, devSecretBuf)) {
    sendError(res, 403, "Invalid dev auth secret");
    return;
  }

  if (!storeDomain || typeof storeDomain !== "string") {
    sendError(res, 400, "storeDomain is required");
    return;
  }

  const [store] = await db
    .select()
    .from(storesTable)
    .where(and(eq(storesTable.storeDomain, storeDomain), isNull(storesTable.deletedAt)));

  if (!store) {
    sendError(res, 404, "Store not found");
    return;
  }

  const merchantToken = await createMerchantSession(storeDomain);
  setMerchantCookie(res, merchantToken);

  logAuditFromRequest(req, {
    storeDomain,
    actor: "merchant",
    action: "merchant_dev_login",
    resourceType: "session",
  });

  res.json({ success: true, storeDomain });
});

export default router;
