import type { Request, Response, NextFunction } from "express";
import { db, storesTable } from "@workspace/db";
import type { Store } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { LRUCache } from "./lru-cache";
import { SHOPIFY_DOMAIN_PATTERN } from "../lib/validation";
import { sendError } from "../lib/error-response";

declare global {
  namespace Express {
    interface Request {
      store?: Store;
    }
  }
}

const storeCache = new LRUCache<Store>(500, 60_000);

export function invalidateStoreCache(storeDomain: string): void {
  storeCache.delete(storeDomain);
}

async function getCachedStore(storeDomain: string): Promise<Store | null> {
  const cached = storeCache.get(storeDomain);
  if (cached) return cached;

  const [store] = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.storeDomain, storeDomain));

  if (store) {
    storeCache.set(storeDomain, store);
  }

  return store ?? null;
}

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

  const store = await getCachedStore(storeDomain);

  if (!store) {
    sendError(res, 404, "Store not found");
    return;
  }

  req.store = store;
  next();
}
