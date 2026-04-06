import { db, analyticsLogsTable, storesTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { logAnalyticsEvent } from "./analytics-logger";

export interface RecoveryCartItem {
  title: string;
  quantity: number;
  price: number;
  variantId?: string;
  imageUrl?: string | null;
}

export interface AbandonedCheckoutData {
  hasAbandonedCheckout: boolean;
  sessionId?: string;
  cartItems?: RecoveryCartItem[];
  cartTotal?: number;
  abandonedAt?: string;
  checkoutUrl?: string | null;
}

const CART_EVENT_TYPES = ["cart_created", "add_to_cart", "checkout_started"];
const COMPLETED_EVENT_TYPE = "checkout_completed";
const RECOVERY_PROMPTED_EVENT = "checkout_recovery_prompted";
const RECOVERY_DISMISSED_EVENT = "checkout_recovery_dismissed";
const PROMPT_SUPPRESSION_HOURS = 24;

function validateCheckoutUrl(url: string, storeDomain: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      console.warn(`[checkout-recovery] Rejected non-HTTPS checkout URL: ${parsed.protocol}`);
      return null;
    }
    const normalizedStore = storeDomain.replace(/\.myshopify\.com$/, "");
    const allowedHosts = [
      storeDomain,
      `${normalizedStore}.myshopify.com`,
      "checkout.shopify.com",
    ];
    if (allowedHosts.some(h => parsed.hostname === h)) {
      return url;
    }
    console.warn(`[checkout-recovery] Rejected checkout URL with untrusted host: ${parsed.hostname}`);
    return null;
  } catch {
    return null;
  }
}

function parseCartItem(item: Record<string, unknown>): RecoveryCartItem {
  return {
    title: String(item.title || "Unknown item"),
    quantity: Number(item.quantity || 1),
    price: Number(item.price || 0),
    variantId: item.variantId ? String(item.variantId) : undefined,
    imageUrl: item.imageUrl ? String(item.imageUrl) : null,
  };
}

function reconstructCart(
  cartEvents: Array<{ eventType: string; metadata: unknown; createdAt: Date }>,
): { items: RecoveryCartItem[]; checkoutUrl: string | null; storeDomain: string | null } {
  let snapshotItems: RecoveryCartItem[] | null = null;
  const additiveItems: RecoveryCartItem[] = [];
  let checkoutUrl: string | null = null;

  for (const event of cartEvents) {
    if (!CART_EVENT_TYPES.includes(event.eventType)) continue;
    const meta = event.metadata as Record<string, unknown> | null;
    if (!meta) continue;

    if (meta.checkoutUrl && typeof meta.checkoutUrl === "string") {
      checkoutUrl = meta.checkoutUrl;
    }

    const items = meta.items as Array<Record<string, unknown>> | undefined;

    if (event.eventType === "cart_created" || event.eventType === "checkout_started") {
      if (items && Array.isArray(items) && items.length > 0) {
        snapshotItems = items.map(parseCartItem);
      }
    } else if (event.eventType === "add_to_cart") {
      if (items && Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          additiveItems.push(parseCartItem(item));
        }
      } else if (meta.title && typeof meta.title === "string") {
        additiveItems.push(parseCartItem(meta as Record<string, unknown>));
      }
    }
  }

  if (snapshotItems !== null) {
    return { items: snapshotItems, checkoutUrl, storeDomain: null };
  }

  const merged = new Map<string, RecoveryCartItem>();
  for (const item of additiveItems) {
    const key = item.variantId || item.title;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity = Math.max(existing.quantity, item.quantity);
    } else {
      merged.set(key, { ...item });
    }
  }

  return { items: Array.from(merged.values()), checkoutUrl, storeDomain: null };
}

export async function checkForAbandonedCheckout(
  storeDomain: string,
  sessionId: string,
): Promise<AbandonedCheckoutData> {
  const [store] = await db
    .select({
      checkoutRecoveryEnabled: storesTable.checkoutRecoveryEnabled,
      checkoutRecoveryDelayMinutes: storesTable.checkoutRecoveryDelayMinutes,
    })
    .from(storesTable)
    .where(eq(storesTable.storeDomain, storeDomain));

  if (!store || !store.checkoutRecoveryEnabled) {
    return { hasAbandonedCheckout: false };
  }

  const delayMs = store.checkoutRecoveryDelayMinutes * 60 * 1000;
  const cutoffTime = new Date(Date.now() - delayMs);

  const cartEvents = await db
    .select({
      eventType: analyticsLogsTable.eventType,
      metadata: analyticsLogsTable.metadata,
      createdAt: analyticsLogsTable.createdAt,
    })
    .from(analyticsLogsTable)
    .where(
      and(
        eq(analyticsLogsTable.storeDomain, storeDomain),
        eq(analyticsLogsTable.sessionId, sessionId),
        inArray(analyticsLogsTable.eventType, [
          ...CART_EVENT_TYPES,
          COMPLETED_EVENT_TYPE,
          RECOVERY_PROMPTED_EVENT,
          RECOVERY_DISMISSED_EVENT,
        ]),
      ),
    )
    .orderBy(analyticsLogsTable.createdAt);

  const hasCartActivity = cartEvents.some(e => CART_EVENT_TYPES.includes(e.eventType));
  const hasCompleted = cartEvents.some(e => e.eventType === COMPLETED_EVENT_TYPE);

  if (!hasCartActivity || hasCompleted) {
    return { hasAbandonedCheckout: false };
  }

  const suppressionCutoff = new Date(Date.now() - PROMPT_SUPPRESSION_HOURS * 60 * 60 * 1000);
  const recentlyPrompted = cartEvents.some(
    e => (e.eventType === RECOVERY_PROMPTED_EVENT || e.eventType === RECOVERY_DISMISSED_EVENT)
      && e.createdAt > suppressionCutoff,
  );

  if (recentlyPrompted) {
    return { hasAbandonedCheckout: false };
  }

  const lastCartEvent = [...cartEvents]
    .filter(e => CART_EVENT_TYPES.includes(e.eventType))
    .pop();

  if (!lastCartEvent || lastCartEvent.createdAt > cutoffTime) {
    return { hasAbandonedCheckout: false };
  }

  const { items, checkoutUrl: rawCheckoutUrl } = reconstructCart(cartEvents);
  const checkoutUrl = rawCheckoutUrl ? validateCheckoutUrl(rawCheckoutUrl, storeDomain) : null;
  const cartTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return {
    hasAbandonedCheckout: true,
    sessionId,
    cartItems: items,
    cartTotal,
    abandonedAt: lastCartEvent.createdAt.toISOString(),
    checkoutUrl,
  };
}

export async function logRecoveryEvent(
  storeDomain: string,
  sessionId: string,
  action: "prompted" | "resumed" | "dismissed" | "converted",
  metadata?: Record<string, unknown>,
): Promise<void> {
  const eventType = `checkout_recovery_${action}`;
  await logAnalyticsEvent(storeDomain, eventType, sessionId, { metadata });
}
