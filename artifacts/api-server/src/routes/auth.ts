import { Router, type IRouter } from "express";
import crypto from "crypto";
import { db, storesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || "";
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || "";
const APP_URL = process.env.APP_URL || "";
const SCOPES = "unauthenticated_read_product_listings,unauthenticated_read_collection_listings,unauthenticated_read_content";

router.get("/auth/install", async (req, res): Promise<void> => {
  const shop = Array.isArray(req.query.shop) ? req.query.shop[0] : req.query.shop;

  if (!shop || typeof shop !== "string") {
    res.status(400).json({ error: "Missing shop parameter" });
    return;
  }

  if (!SHOPIFY_API_KEY || !APP_URL) {
    res.status(500).json({ error: "Shopify app not configured. Set SHOPIFY_API_KEY and APP_URL." });
    return;
  }

  const state = crypto.randomBytes(16).toString("hex");

  const redirectUri = `${APP_URL}/api/auth/callback`;
  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SCOPES}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  res.redirect(installUrl);
});

router.get("/auth/callback", async (req, res): Promise<void> => {
  const { code, shop, hmac, state } = req.query as Record<string, string>;

  if (!code || !shop || !hmac) {
    res.status(400).json({ error: "Missing required parameters" });
    return;
  }

  if (SHOPIFY_API_SECRET) {
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

    if (digest !== hmac) {
      res.status(403).json({ error: "HMAC verification failed" });
      return;
    }
  }

  try {
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

    const tokenData = (await tokenResponse.json()) as { access_token: string };

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

    res.redirect(`/?installed=${encodeURIComponent(shop)}`);
  } catch (err: any) {
    console.error("OAuth callback error:", err);
    res.status(500).json({ error: "OAuth callback failed" });
  }
});

export default router;
