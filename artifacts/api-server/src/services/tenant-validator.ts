import type { Request, Response, NextFunction } from "express";
import { db, storesTable } from "@workspace/db";
import type { Store } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      store?: Store;
    }
  }
}

const STORE_CACHE_TTL_MS = 60_000;

interface StoreCacheEntry {
  store: Store;
  fetchedAt: number;
}

const storeCache = new Map<string, StoreCacheEntry>();

export function invalidateStoreCache(storeDomain: string): void {
  storeCache.delete(storeDomain);
}

async function getCachedStore(storeDomain: string): Promise<Store | null> {
  const cached = storeCache.get(storeDomain);
  if (cached && Date.now() - cached.fetchedAt < STORE_CACHE_TTL_MS) {
    return cached.store;
  }

  const [store] = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.storeDomain, storeDomain));

  if (store) {
    storeCache.set(storeDomain, { store, fetchedAt: Date.now() });
  } else {
    storeCache.delete(storeDomain);
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
    res.status(400).json({ error: "Store domain is required" });
    return;
  }

  const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  if (!domainPattern.test(storeDomain)) {
    res.status(400).json({ error: "Invalid store domain format" });
    return;
  }

  const store = await getCachedStore(storeDomain);

  if (!store) {
    res.status(404).json({ error: "Store not found" });
    return;
  }

  req.store = store;
  next();
}
