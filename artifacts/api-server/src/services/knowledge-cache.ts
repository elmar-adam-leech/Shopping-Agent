import { eq, and, isNull } from "drizzle-orm";
import { shopKnowledgeTable, withTenantScope } from "@workspace/db";
import type { ShopKnowledge } from "@workspace/db/schema";
import { LRUCache } from "./lru-cache";

const knowledgeCache = new LRUCache<ShopKnowledge[]>(500, 120_000, "knowledge");

export function invalidateKnowledgeCache(storeDomain: string): void {
  knowledgeCache.delete(storeDomain);
}

export async function getCachedKnowledge(storeDomain: string): Promise<ShopKnowledge[]> {
  const cached = knowledgeCache.get(storeDomain);
  if (cached) return cached;

  const data = await withTenantScope(storeDomain, async (scopedDb) => {
    return scopedDb
      .select()
      .from(shopKnowledgeTable)
      .where(and(eq(shopKnowledgeTable.storeDomain, storeDomain), isNull(shopKnowledgeTable.deletedAt)));
  });

  knowledgeCache.set(storeDomain, data);
  return data;
}
