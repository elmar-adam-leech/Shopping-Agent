import crypto from "crypto";
import { db, webhookRegistrationsTable, webhookDeliveryLogsTable, storesTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { decrypt } from "./encryption";
import { invalidateToolsListCache } from "./mcp-client";
import { invalidateStoreCache } from "../middleware";
import { invalidateKnowledgeCache } from "./knowledge-cache";
import { logAudit } from "./audit-logger";

const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || "";
const APP_URL = process.env.APP_URL || "";

const WEBHOOK_TOPICS = [
  "products/update",
  "products/create",
  "products/delete",
  "inventory_levels/update",
  "orders/updated",
  "app/uninstalled",
] as const;

export type WebhookTopic = (typeof WEBHOOK_TOPICS)[number];

const processedWebhookIds = new Map<string, number>();
const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;
const MAX_PROCESSED_IDS = 10000;

function cleanProcessedIds(): void {
  const cutoff = Date.now() - IDEMPOTENCY_WINDOW_MS;
  for (const [key, timestamp] of processedWebhookIds) {
    if (timestamp < cutoff) {
      processedWebhookIds.delete(key);
    }
  }
}

setInterval(cleanProcessedIds, 60_000).unref();

export function isIdempotent(webhookId: string, topic: string): boolean {
  const key = `${topic}:${webhookId}`;
  if (processedWebhookIds.has(key)) {
    return true;
  }
  if (processedWebhookIds.size >= MAX_PROCESSED_IDS) {
    cleanProcessedIds();
  }
  processedWebhookIds.set(key, Date.now());
  return false;
}

export function verifyWebhookHmac(rawBody: Buffer, hmacHeader: string): boolean {
  if (!SHOPIFY_API_SECRET) return false;
  const computed = crypto
    .createHmac("sha256", SHOPIFY_API_SECRET)
    .update(rawBody)
    .digest("base64");
  try {
    const computedBuf = Buffer.from(computed);
    const receivedBuf = Buffer.from(hmacHeader);
    if (computedBuf.length !== receivedBuf.length) return false;
    return crypto.timingSafeEqual(computedBuf, receivedBuf);
  } catch {
    return false;
  }
}

export interface InventoryEntry {
  inventoryItemId: string;
  available: number;
  updatedAt: number;
}

const inventoryIndex = new Map<string, Map<string, InventoryEntry>>();

export function getInventoryForStore(storeDomain: string): Map<string, InventoryEntry> | undefined {
  return inventoryIndex.get(storeDomain);
}

export function updateInventoryEntry(
  storeDomain: string,
  inventoryItemId: string,
  available: number,
): void {
  if (!inventoryIndex.has(storeDomain)) {
    inventoryIndex.set(storeDomain, new Map());
  }
  inventoryIndex.get(storeDomain)!.set(inventoryItemId, {
    inventoryItemId,
    available,
    updatedAt: Date.now(),
  });
}

export function isItemAvailable(storeDomain: string, inventoryItemId: string): boolean | null {
  const storeInventory = inventoryIndex.get(storeDomain);
  if (!storeInventory) return null;
  const entry = storeInventory.get(inventoryItemId);
  if (!entry) return null;
  return entry.available > 0;
}

export function clearStoreInventory(storeDomain: string): void {
  inventoryIndex.delete(storeDomain);
}

export interface ActiveSession {
  storeDomain: string;
  sessionId: string;
  customerEmail?: string;
  send: (event: Record<string, unknown>) => boolean;
}

const activeSessions = new Map<string, ActiveSession[]>();

export function registerActiveSession(session: ActiveSession): void {
  const key = session.storeDomain;
  if (!activeSessions.has(key)) {
    activeSessions.set(key, []);
  }
  activeSessions.get(key)!.push(session);
}

export function unregisterActiveSession(storeDomain: string, sessionId: string): void {
  const sessions = activeSessions.get(storeDomain);
  if (!sessions) return;
  const filtered = sessions.filter(s => s.sessionId !== sessionId);
  if (filtered.length === 0) {
    activeSessions.delete(storeDomain);
  } else {
    activeSessions.set(storeDomain, filtered);
  }
}

export function notifyActiveSessions(
  storeDomain: string,
  event: Record<string, unknown>,
  filterFn?: (session: ActiveSession) => boolean,
): number {
  const sessions = activeSessions.get(storeDomain);
  if (!sessions || sessions.length === 0) return 0;
  let notified = 0;
  for (const session of sessions) {
    if (filterFn && !filterFn(session)) continue;
    try {
      if (session.send(event)) notified++;
    } catch {
    }
  }
  return notified;
}

export async function registerWebhooks(storeDomain: string): Promise<{
  registered: string[];
  failed: string[];
}> {
  const [store] = await db
    .select({ accessToken: storesTable.accessToken })
    .from(storesTable)
    .where(eq(storesTable.storeDomain, storeDomain));

  if (!store?.accessToken) {
    console.warn(`[webhooks] No access token for store="${storeDomain}"`);
    return { registered: [], failed: WEBHOOK_TOPICS.slice() };
  }

  let decryptedToken: string;
  try {
    decryptedToken = decrypt(store.accessToken);
  } catch {
    console.error(`[webhooks] Failed to decrypt access token for store="${storeDomain}"`);
    return { registered: [], failed: WEBHOOK_TOPICS.slice() };
  }

  const registered: string[] = [];
  const failed: string[] = [];

  for (const topic of WEBHOOK_TOPICS) {
    const callbackUrl = `${APP_URL}/api/webhooks/shopify`;
    try {
      const response = await fetch(`https://${storeDomain}/admin/api/2024-01/webhooks.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": decryptedToken,
        },
        body: JSON.stringify({
          webhook: {
            topic,
            address: callbackUrl,
            format: "json",
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        const data = (await response.json()) as { webhook?: { id?: number } };
        const shopifyId = data.webhook?.id ? String(data.webhook.id) : null;

        await db
          .insert(webhookRegistrationsTable)
          .values({
            storeDomain,
            topic,
            shopifyWebhookId: shopifyId,
            callbackUrl,
            active: true,
            failureCount: 0,
            registeredAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [webhookRegistrationsTable.storeDomain, webhookRegistrationsTable.topic],
            set: {
              shopifyWebhookId: shopifyId,
              callbackUrl,
              active: true,
              failureCount: 0,
              registeredAt: new Date(),
            },
          });

        registered.push(topic);
        console.log(`[webhooks] Registered "${topic}" for store="${storeDomain}" (id=${shopifyId})`);
      } else {
        const errorText = await response.text().catch(() => "");
        console.warn(`[webhooks] Failed to register "${topic}" for store="${storeDomain}": ${response.status} ${errorText.slice(0, 200)}`);
        failed.push(topic);
      }
    } catch (err) {
      console.error(`[webhooks] Error registering "${topic}" for store="${storeDomain}":`, err instanceof Error ? err.message : err);
      failed.push(topic);
    }
  }

  await logAudit({
    storeDomain,
    actor: "system",
    action: "webhooks_registered",
    resourceType: "webhook",
    metadata: { registered, failed },
  });

  return { registered, failed };
}

export async function handleProductWebhook(
  storeDomain: string,
  topic: string,
  _payload: Record<string, unknown>,
): Promise<void> {
  invalidateToolsListCache(storeDomain);
  invalidateStoreCache(storeDomain);
  console.log(`[webhooks] Cache invalidated for "${topic}" on store="${storeDomain}"`);

  notifyActiveSessions(storeDomain, {
    type: "webhook_event",
    data: {
      topic,
      message: topic === "products/create"
        ? "New product added to the store!"
        : topic === "products/delete"
          ? "A product was removed from the store."
          : "Product information has been updated.",
    },
  });
}

export async function handleInventoryWebhook(
  storeDomain: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const inventoryItemId = payload.inventory_item_id
    ? String(payload.inventory_item_id)
    : undefined;
  const available = typeof payload.available === "number" ? payload.available : undefined;

  if (inventoryItemId && available !== undefined) {
    updateInventoryEntry(storeDomain, inventoryItemId, available);
    console.log(`[webhooks] Inventory updated for item="${inventoryItemId}" available=${available} store="${storeDomain}"`);
  }

  invalidateToolsListCache(storeDomain);
}

export async function handleOrderWebhook(
  storeDomain: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const email = typeof payload.email === "string" ? payload.email : undefined;
  const orderName = typeof payload.name === "string" ? payload.name : undefined;
  const financialStatus = typeof payload.financial_status === "string" ? payload.financial_status : undefined;
  const fulfillmentStatus = typeof payload.fulfillment_status === "string" ? payload.fulfillment_status : null;

  let statusMessage = `Order ${orderName || "update"} status changed`;
  if (fulfillmentStatus === "fulfilled") {
    statusMessage = `Your order ${orderName || ""} has been fulfilled!`;
  } else if (fulfillmentStatus === "partial") {
    statusMessage = `Your order ${orderName || ""} has been partially fulfilled.`;
  } else if (financialStatus === "paid") {
    statusMessage = `Your order ${orderName || ""} payment confirmed!`;
  } else if (financialStatus === "refunded") {
    statusMessage = `Your order ${orderName || ""} has been refunded.`;
  }

  notifyActiveSessions(
    storeDomain,
    {
      type: "order_update",
      data: {
        orderName,
        financialStatus,
        fulfillmentStatus,
        message: statusMessage,
      },
    },
    email ? (session) => session.customerEmail === email : undefined,
  );
}

export async function handleAppUninstalled(storeDomain: string): Promise<void> {
  console.log(`[webhooks] App uninstalled for store="${storeDomain}"`);

  await db
    .update(storesTable)
    .set({ deletedAt: new Date() })
    .where(eq(storesTable.storeDomain, storeDomain));

  await db
    .update(webhookRegistrationsTable)
    .set({ active: false })
    .where(eq(webhookRegistrationsTable.storeDomain, storeDomain));

  invalidateStoreCache(storeDomain);
  invalidateToolsListCache(storeDomain);
  invalidateKnowledgeCache(storeDomain);
  clearStoreInventory(storeDomain);

  await logAudit({
    storeDomain,
    actor: "system",
    action: "app_uninstalled_webhook",
    resourceType: "store",
    resourceId: storeDomain,
  });
}

const PII_FIELDS = new Set([
  "email", "phone", "first_name", "last_name", "name", "address1", "address2",
  "city", "zip", "province", "country", "company", "latitude", "longitude",
  "customer", "billing_address", "shipping_address", "note",
]);

function redactPayload(payload: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!payload) return null;
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (PII_FIELDS.has(key)) {
      redacted[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      redacted[key] = redactPayload(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

export async function logWebhookDelivery(
  storeDomain: string,
  topic: string,
  shopifyWebhookId: string | null,
  payload: Record<string, unknown> | null,
  status: string,
  processingTimeMs: number,
  error?: string,
): Promise<void> {
  try {
    await db.insert(webhookDeliveryLogsTable).values({
      storeDomain,
      topic,
      shopifyWebhookId,
      payload: redactPayload(payload),
      status,
      processingTimeMs,
      error: error || null,
      idempotencyKey: shopifyWebhookId ? `${topic}:${shopifyWebhookId}` : null,
    });

    if (status === "processed") {
      await db
        .update(webhookRegistrationsTable)
        .set({ lastDeliveryAt: new Date() })
        .where(
          and(
            eq(webhookRegistrationsTable.storeDomain, storeDomain),
            eq(webhookRegistrationsTable.topic, topic),
          ),
        );
    } else if (status === "error") {
      await db
        .update(webhookRegistrationsTable)
        .set({
          lastDeliveryAt: new Date(),
          failureCount: sql`${webhookRegistrationsTable.failureCount} + 1`,
        })
        .where(
          and(
            eq(webhookRegistrationsTable.storeDomain, storeDomain),
            eq(webhookRegistrationsTable.topic, topic),
          ),
        );
    }
  } catch (err) {
    console.error(`[webhooks] Failed to log delivery:`, err instanceof Error ? err.message : err);
  }
}

export async function getWebhookRegistrations(storeDomain: string) {
  return db
    .select()
    .from(webhookRegistrationsTable)
    .where(eq(webhookRegistrationsTable.storeDomain, storeDomain));
}

export async function getWebhookDeliveryLog(storeDomain: string, limit = 50) {
  return db
    .select()
    .from(webhookDeliveryLogsTable)
    .where(eq(webhookDeliveryLogsTable.storeDomain, storeDomain))
    .orderBy(desc(webhookDeliveryLogsTable.receivedAt))
    .limit(limit);
}
