/**
 * Tenant (store) validation middleware.
 *
 * Ensures the `:storeDomain` route parameter refers to a registered and
 * valid Shopify store. Validated stores are cached in an LRU cache (60 s TTL,
 * 500 entries) to reduce database hits.
 *
 * On success the full `Store` object is attached to `req.store`.
 */

import type { Request, Response, NextFunction } from "express";
import { db, storesTable } from "@workspace/db";
import type { Store } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { LRUCache } from "./lru-cache";
import { SHOPIFY_DOMAIN_PATTERN } from "../lib/validation";
import { sendError } from "../lib/error-response";

interface CachedStoreValidation {
  storeDomain: string;
  provider: "openai" | "anthropic" | "xai";
  model: string;
  ucpCompliant: boolean;
  chatEnabled: boolean;
  embedEnabled: boolean;
  welcomeMessage: string | null;
  createdAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      store?: Store;
      storeValidation?: CachedStoreValidation;
    }
  }
}

const storeValidationCache = new LRUCache<CachedStoreValidation>(500, 60_000, "store-validation");
const storeCredentialCache = new LRUCache<Store>(200, 30_000, "store-credentials");

/** Remove a store from the in-memory cache, forcing the next lookup to hit the database. */
export function invalidateStoreCache(storeDomain: string): void {
  storeValidationCache.delete(storeDomain);
  storeCredentialCache.delete(storeDomain);
}

function toValidationEntry(store: Store): CachedStoreValidation {
  return {
    storeDomain: store.storeDomain,
    provider: store.provider,
    model: store.model,
    ucpCompliant: store.ucpCompliant,
    chatEnabled: store.chatEnabled,
    embedEnabled: store.embedEnabled,
    welcomeMessage: store.welcomeMessage ?? null,
    createdAt: store.createdAt,
  };
}

export async function getCachedStorePublicInfo(storeDomain: string): Promise<CachedStoreValidation | null> {
  const cached = storeValidationCache.get(storeDomain);
  if (cached) return cached;

  const [store] = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.storeDomain, storeDomain));

  if (store) {
    const entry = toValidationEntry(store);
    storeValidationCache.set(storeDomain, entry);
    return entry;
  }

  return null;
}

export async function loadFullStore(storeDomain: string): Promise<Store | null> {
  const cachedFull = storeCredentialCache.get(storeDomain);
  if (cachedFull) return cachedFull;

  const [store] = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.storeDomain, storeDomain));

  if (store) {
    storeValidationCache.set(storeDomain, toValidationEntry(store));
    storeCredentialCache.set(storeDomain, store);
  }

  return store ?? null;
}

/**
 * Express middleware that validates the `:storeDomain` route parameter.
 * Checks format against `SHOPIFY_DOMAIN_PATTERN`, then looks up the store
 * in the LRU cache or database. Attaches `req.store` on success;
 * responds 400 (bad format) or 404 (not found) on failure.
 */
export async function validateStoreDomain(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const storeDomain = Array.isArray(req.params.storeDomain)
    ? req.params.storeDomain[0]
    : req.params.storeDomain;

  if (!storeDomain) {
    sendError(res, 400, "Store domain is required");
    return;
  }

  if (!SHOPIFY_DOMAIN_PATTERN.test(storeDomain)) {
    sendError(res, 400, "Invalid store domain format");
    return;
  }

  const cached = storeValidationCache.get(storeDomain);
  if (cached) {
    req.storeValidation = cached;
    next();
    return;
  }

  let store: Store | null;
  try {
    store = await loadFullStore(storeDomain);
  } catch (err) {
    console.error(`[tenant-validator] Database error looking up store="${storeDomain}":`, err instanceof Error ? err.message : err);
    sendError(res, 503, "Service temporarily unavailable. Please try again in a moment.");
    return;
  }

  if (!store) {
    sendError(res, 404, "Store not found");
    return;
  }

  req.store = store;
  req.storeValidation = toValidationEntry(store);
  next();
}
