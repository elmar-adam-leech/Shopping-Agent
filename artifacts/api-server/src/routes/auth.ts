import { Router, type IRouter } from "express";
import crypto from "crypto";
import { db, storesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createMerchantSession } from "../services/merchant-auth";

const router: IRouter = Router();

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || "";
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || "";
const APP_URL = process.env.APP_URL || "";
const SCOPES = "unauthenticated_read_product_listings,unauthenticated_read_collection_listings,unauthenticated_read_content";

const pendingStates = new Map<string, { shop: string; createdAt: number }>();
const STATE_TTL_MS = 10 * 60 * 1000;

const SHOPIFY_DOMAIN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

function cleanExpiredStates() {
  const now = Date.now();
  for (const [key, value] of pendingStates) {
    if (now - value.createdAt > STATE_TTL_MS) {
      pendingStates.delete(key);
    }
  }
}

router.get("/auth/install", async (req, res): Promise<void> => {
  const shop = Array.isArray(req.query.shop) ? req.query.shop[0] : req.query.shop;

  if (!shop || typeof shop !== "string") {
    res.status(400).json({ error: "Missing shop parameter" });
    return;
  }

  if (!SHOPIFY_DOMAIN_PATTERN.test(shop)) {
    res.status(400).json({ error: "Invalid shop domain. Must be a valid .myshopify.com domain." });
    return;
  }

  if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET || !APP_URL) {
    res.status(500).json({ error: "Shopify app not configured. Set SHOPIFY_API_KEY, SHOPIFY_API_SECRET, and APP_URL." });
    return;
  }

  cleanExpiredStates();
  const state = crypto.randomBytes(16).toString("hex");
  pendingStates.set(state, { shop, createdAt: Date.now() });

  const redirectUri = `${APP_URL}/api/auth/callback`;
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SCOPES}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  res.redirect(installUrl);
});

router.get("/auth/callback", async (req, res): Promise<void> => {
  const { code, shop, hmac, state } = req.query as Record<string, string>;

  if (!code || !shop || !hmac || !state) {
    res.status(400).json({ error: "Missing required parameters" });
    return;
  }

  if (!SHOPIFY_DOMAIN_PATTERN.test(shop)) {
    res.status(400).json({ error: "Invalid shop domain format" });
    return;
  }

  if (!SHOPIFY_API_SECRET) {
    res.status(500).json({ error: "SHOPIFY_API_SECRET is required for OAuth callback" });
    return;
  }

  const pendingState = pendingStates.get(state);
  if (!pendingState || pendingState.shop !== shop) {
    res.status(403).json({ error: "Invalid or expired OAuth state" });
    return;
  }
  pendingStates.delete(state);

  const params = { ...req.query } as Record<string, string>;
  delete params.hmac;
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  const digest = crypto
    .createHmac("sha256", SHOPIFY_API_SECRET)
    .update(sortedParams)
    .digest("hex");

  if (!hmac || !/^[0-9a-f]+$/i.test(hmac)) {
    res.status(403).json({ error: "HMAC verification failed" });
    return;
  }

  const digestBuf = Buffer.from(digest, "hex");
  const hmacBuf = Buffer.from(hmac, "hex");

  if (digestBuf.length !== hmacBuf.length || !crypto.timingSafeEqual(digestBuf, hmacBuf)) {
    res.status(403).json({ error: "HMAC verification failed" });
    return;
  }

  try {
    interface TokenResponse {
      access_token: string;
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
      res.status(500).json({ error: "Failed to exchange OAuth code" });
      return;
    }

    const tokenData = (await tokenResponse.json()) as TokenResponse;

    const existing = await db
      .select()
      .from(storesTable)
      .where(eq(storesTable.storeDomain, shop));

    if (existing.length > 0) {
      await db
        .update(storesTable)
        .set({ accessToken: tokenData.access_token })
        .where(eq(storesTable.storeDomain, shop));
    } else {
      await db.insert(storesTable).values({
        storeDomain: shop,
        accessToken: tokenData.access_token,
        provider: "openai",
        model: "gpt-4o",
      });
    }

    const merchantToken = await createMerchantSession(shop);
    res.cookie("merchant_token", merchantToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 72 * 60 * 60 * 1000,
      path: "/",
    });
    res.redirect(`/${encodeURIComponent(shop)}/settings`);
  } catch (err: unknown) {
    console.error("OAuth callback error:", err);
    res.status(500).json({ error: "OAuth callback failed" });
  }
});

router.post("/auth/login", async (req, res): Promise<void> => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { storeDomain } = req.body as { storeDomain?: string };

  if (!storeDomain || typeof storeDomain !== "string") {
    res.status(400).json({ error: "storeDomain is required" });
    return;
  }

  const [store] = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.storeDomain, storeDomain));

  if (!store) {
    res.status(404).json({ error: "Store not found" });
    return;
  }

  const merchantToken = await createMerchantSession(storeDomain);
  res.cookie("merchant_token", merchantToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 72 * 60 * 60 * 1000,
    path: "/",
  });

  res.json({ success: true, storeDomain });
});

export default router;
