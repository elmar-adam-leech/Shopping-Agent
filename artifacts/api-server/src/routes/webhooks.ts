import { Router, type IRouter, type Request, type Response } from "express";
import {
  verifyWebhookHmac,
  isIdempotent,
  handleProductWebhook,
  handleInventoryWebhook,
  handleOrderWebhook,
  handleAppUninstalled,
  logWebhookDelivery,
  getWebhookRegistrations,
  getWebhookDeliveryLog,
  registerWebhooks,
} from "../services/webhook-service";
import { validateStoreDomain, validateMerchantAuth } from "../middleware";
import { sendError } from "../lib/error-response";
import { logAuditFromRequest } from "../services/audit-logger";

const router: IRouter = Router();

router.post("/webhooks/shopify", async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  const hmacHeader = req.headers["x-shopify-hmac-sha256"];
  const topic = req.headers["x-shopify-topic"] as string | undefined;
  const shopDomain = req.headers["x-shopify-shop-domain"] as string | undefined;
  const webhookId = req.headers["x-shopify-webhook-id"] as string | undefined;

  if (!hmacHeader || typeof hmacHeader !== "string") {
    sendError(res, 401, "Missing HMAC signature");
    return;
  }

  if (!topic || !shopDomain) {
    sendError(res, 400, "Missing required Shopify webhook headers");
    return;
  }

  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    sendError(res, 400, "Missing raw body for HMAC verification");
    return;
  }

  if (!verifyWebhookHmac(rawBody, hmacHeader)) {
    console.warn(`[webhooks] HMAC verification failed for topic="${topic}" shop="${shopDomain}"`);
    await logWebhookDelivery(shopDomain, topic, webhookId || null, null, "hmac_failed", Date.now() - startTime, "HMAC verification failed");
    sendError(res, 401, "HMAC verification failed");
    return;
  }

  if (webhookId && isIdempotent(webhookId, topic)) {
    console.log(`[webhooks] Duplicate webhook ignored: id="${webhookId}" topic="${topic}" shop="${shopDomain}"`);
    res.status(200).json({ status: "duplicate" });
    return;
  }

  res.status(200).json({ status: "accepted" });

  const payload = req.body as Record<string, unknown>;

  try {
    switch (topic) {
      case "products/create":
      case "products/update":
      case "products/delete":
        await handleProductWebhook(shopDomain, topic, payload);
        break;
      case "inventory_levels/update":
        await handleInventoryWebhook(shopDomain, payload);
        break;
      case "orders/updated":
        await handleOrderWebhook(shopDomain, payload);
        break;
      case "app/uninstalled":
        await handleAppUninstalled(shopDomain);
        break;
      default:
        console.warn(`[webhooks] Unhandled topic="${topic}" for shop="${shopDomain}"`);
    }

    await logWebhookDelivery(
      shopDomain,
      topic,
      webhookId || null,
      payload,
      "processed",
      Date.now() - startTime,
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[webhooks] Processing error for topic="${topic}" shop="${shopDomain}":`, errorMsg);
    await logWebhookDelivery(
      shopDomain,
      topic,
      webhookId || null,
      payload,
      "error",
      Date.now() - startTime,
      errorMsg,
    );
  }
});

router.get(
  "/stores/:storeDomain/webhooks",
  validateStoreDomain,
  validateMerchantAuth,
  async (req, res): Promise<void> => {
    const storeDomain = req.params.storeDomain as string;
    try {
      const registrations = await getWebhookRegistrations(storeDomain);
      res.json({ webhooks: registrations });
    } catch (err) {
      console.error(`[webhooks] Failed to fetch registrations for store="${storeDomain}":`, err instanceof Error ? err.message : err);
      sendError(res, 500, "Failed to fetch webhook registrations");
    }
  },
);

router.get(
  "/stores/:storeDomain/webhooks/delivery-log",
  validateStoreDomain,
  validateMerchantAuth,
  async (req, res): Promise<void> => {
    const storeDomain = req.params.storeDomain as string;
    const limitParam = req.query.limit;
    const limit = typeof limitParam === "string" ? Math.min(parseInt(limitParam, 10) || 50, 100) : 50;
    try {
      const logs = await getWebhookDeliveryLog(storeDomain, limit);
      res.json({ deliveryLogs: logs });
    } catch (err) {
      console.error(`[webhooks] Failed to fetch delivery log for store="${storeDomain}":`, err instanceof Error ? err.message : err);
      sendError(res, 500, "Failed to fetch webhook delivery log");
    }
  },
);

router.post(
  "/stores/:storeDomain/webhooks/re-register",
  validateStoreDomain,
  validateMerchantAuth,
  async (req, res): Promise<void> => {
    const storeDomain = req.params.storeDomain as string;
    try {
      logAuditFromRequest(req, {
        storeDomain,
        actor: "merchant",
        action: "webhooks_re_register",
        resourceType: "webhook",
      });

      const result = await registerWebhooks(storeDomain);
      res.json({
        success: true,
        registered: result.registered,
        failed: result.failed,
      });
    } catch (err) {
      console.error(`[webhooks] Re-registration failed for store="${storeDomain}":`, err instanceof Error ? err.message : err);
      sendError(res, 500, "Failed to re-register webhooks");
    }
  },
);

export default router;
