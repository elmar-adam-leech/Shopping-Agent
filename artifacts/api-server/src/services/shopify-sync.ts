import crypto from "crypto";
import { eq, and, isNull } from "drizzle-orm";
import { db, storesTable, shopKnowledgeTable, withTenantScope, withAdminBypass } from "@workspace/db";
import { shopifyGraphQL } from "./graphql-client";
import { decrypt } from "./encryption";
import { invalidateKnowledgeCache } from "./knowledge-cache";

interface SyncableContent {
  sourceId: string;
  title: string;
  content: string;
  category: "general" | "policies";
}

interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
  errors: string[];
  syncedAt: string;
}

function contentHash(title: string, content: string): string {
  return crypto.createHash("sha256").update(`${title}\n${content}`).digest("hex").slice(0, 16);
}

const PAGES_QUERY = `
  query ($cursor: String) {
    pages(first: 50, after: $cursor) {
      edges {
        node {
          id
          title
          body
          handle
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const ARTICLES_QUERY = `
  query ($cursor: String) {
    articles(first: 50, after: $cursor) {
      edges {
        node {
          id
          title
          content
          handle
          blog {
            title
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const POLICIES_QUERY = `
  query {
    shop {
      privacyPolicy {
        title
        body
        handle
      }
      refundPolicy {
        title
        body
        handle
      }
      termsOfService {
        title
        body
        handle
      }
      shippingPolicy {
        title
        body
        handle
      }
    }
  }
`;

interface ShopifyEdge<T> {
  node: T;
}

interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

async function fetchAllPages(storeDomain: string, storefrontToken: string): Promise<SyncableContent[]> {
  const items: SyncableContent[] = [];
  let cursor: string | null = null;

  for (let i = 0; i < 10; i++) {
    const data = await shopifyGraphQL(storeDomain, storefrontToken, PAGES_QUERY, { cursor });
    const pages = data.pages as { edges: ShopifyEdge<{ id: string; title: string; body: string; handle: string }>[]; pageInfo: PageInfo } | undefined;
    if (!pages?.edges) break;

    for (const edge of pages.edges) {
      const node = edge.node;
      if (node.body && node.body.trim()) {
        items.push({
          sourceId: `page:${node.id}`,
          title: node.title,
          content: node.body,
          category: "general",
        });
      }
    }

    if (!pages.pageInfo.hasNextPage) break;
    cursor = pages.pageInfo.endCursor;
  }

  return items;
}

async function fetchAllArticles(storeDomain: string, storefrontToken: string): Promise<SyncableContent[]> {
  const items: SyncableContent[] = [];
  let cursor: string | null = null;

  for (let i = 0; i < 10; i++) {
    const data = await shopifyGraphQL(storeDomain, storefrontToken, ARTICLES_QUERY, { cursor });
    const articles = data.articles as { edges: ShopifyEdge<{ id: string; title: string; content: string; handle: string; blog: { title: string } }>[]; pageInfo: PageInfo } | undefined;
    if (!articles?.edges) break;

    for (const edge of articles.edges) {
      const node = edge.node;
      if (node.content && node.content.trim()) {
        items.push({
          sourceId: `article:${node.id}`,
          title: `${node.blog.title}: ${node.title}`,
          content: node.content,
          category: "general",
        });
      }
    }

    if (!articles.pageInfo.hasNextPage) break;
    cursor = articles.pageInfo.endCursor;
  }

  return items;
}

async function fetchPolicies(storeDomain: string, storefrontToken: string): Promise<SyncableContent[]> {
  const items: SyncableContent[] = [];

  try {
    const data = await shopifyGraphQL(storeDomain, storefrontToken, POLICIES_QUERY);
    const shop = data.shop as {
      privacyPolicy?: { title: string; body: string; handle: string } | null;
      refundPolicy?: { title: string; body: string; handle: string } | null;
      termsOfService?: { title: string; body: string; handle: string } | null;
      shippingPolicy?: { title: string; body: string; handle: string } | null;
    } | undefined;

    if (!shop) return items;

    const policies = [
      { key: "privacy", data: shop.privacyPolicy },
      { key: "refund", data: shop.refundPolicy },
      { key: "terms", data: shop.termsOfService },
      { key: "shipping", data: shop.shippingPolicy },
    ];

    for (const policy of policies) {
      if (policy.data?.body?.trim()) {
        items.push({
          sourceId: `policy:${policy.key}`,
          title: policy.data.title || `${policy.key.charAt(0).toUpperCase() + policy.key.slice(1)} Policy`,
          content: policy.data.body,
          category: "policies",
        });
      }
    }
  } catch (err) {
    console.warn(`[shopify-sync] Failed to fetch policies for store="${storeDomain}":`, err instanceof Error ? err.message : err);
  }

  return items;
}

export async function syncShopifyContent(storeDomain: string): Promise<SyncResult> {
  const result: SyncResult = {
    created: 0,
    updated: 0,
    deleted: 0,
    unchanged: 0,
    errors: [],
    syncedAt: new Date().toISOString(),
  };

  const [store] = await withAdminBypass(async (scopedDb) => {
    return scopedDb
      .select({ storefrontToken: storesTable.storefrontToken, accessToken: storesTable.accessToken })
      .from(storesTable)
      .where(and(eq(storesTable.storeDomain, storeDomain), isNull(storesTable.deletedAt)));
  });

  if (!store) {
    result.errors.push("Store not found");
    return result;
  }

  const token = store.storefrontToken;
  if (!token) {
    result.errors.push("No storefront token configured. Please complete Shopify OAuth first.");
    return result;
  }

  let remoteContent: SyncableContent[] = [];
  try {
    const [pages, articles, policies] = await Promise.all([
      fetchAllPages(storeDomain, token).catch(err => {
        result.errors.push(`Pages fetch failed: ${err instanceof Error ? err.message : String(err)}`);
        return [] as SyncableContent[];
      }),
      fetchAllArticles(storeDomain, token).catch(err => {
        result.errors.push(`Articles fetch failed: ${err instanceof Error ? err.message : String(err)}`);
        return [] as SyncableContent[];
      }),
      fetchPolicies(storeDomain, token),
    ]);
    remoteContent = [...pages, ...articles, ...policies];
  } catch (err) {
    result.errors.push(`Failed to fetch Shopify content: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  if (remoteContent.length === 0 && result.errors.length === 0) {
    await withAdminBypass(async (scopedDb) => {
      await scopedDb.update(storesTable).set({ knowledgeLastSyncedAt: new Date() }).where(eq(storesTable.storeDomain, storeDomain));
    });
    return result;
  }

  const existingSynced = await withTenantScope(storeDomain, async (scopedDb) => {
    return scopedDb
      .select()
      .from(shopKnowledgeTable)
      .where(
        and(
          eq(shopKnowledgeTable.storeDomain, storeDomain),
          eq(shopKnowledgeTable.source, "synced"),
          isNull(shopKnowledgeTable.deletedAt)
        )
      );
  });

  const existingBySourceId = new Map(existingSynced.map(e => [e.sourceId!, e]));
  const remoteSourceIds = new Set(remoteContent.map(r => r.sourceId));

  for (const remote of remoteContent) {
    const hash = contentHash(remote.title, remote.content);
    const existing = existingBySourceId.get(remote.sourceId);

    if (existing) {
      if (existing.contentHash !== hash) {
        try {
          await withTenantScope(storeDomain, async (scopedDb) => {
            await scopedDb
              .update(shopKnowledgeTable)
              .set({
                title: remote.title,
                content: remote.content,
                contentHash: hash,
                lastSyncedAt: new Date(),
                category: remote.category,
              })
              .where(eq(shopKnowledgeTable.id, existing.id));
          });
          result.updated++;
        } catch (err) {
          result.errors.push(`Failed to update "${remote.title}": ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        await withTenantScope(storeDomain, async (scopedDb) => {
          await scopedDb
            .update(shopKnowledgeTable)
            .set({ lastSyncedAt: new Date() })
            .where(eq(shopKnowledgeTable.id, existing.id));
        });
        result.unchanged++;
      }
    } else {
      try {
        await withTenantScope(storeDomain, async (scopedDb) => {
          await scopedDb.insert(shopKnowledgeTable).values({
            storeDomain,
            category: remote.category,
            title: remote.title,
            content: remote.content,
            source: "synced",
            sourceId: remote.sourceId,
            contentHash: hash,
            lastSyncedAt: new Date(),
            sortOrder: 0,
            tags: [],
          });
        });
        result.created++;
      } catch (err) {
        result.errors.push(`Failed to create "${remote.title}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  for (const existing of existingSynced) {
    if (existing.sourceId && !remoteSourceIds.has(existing.sourceId)) {
      try {
        await withTenantScope(storeDomain, async (scopedDb) => {
          await scopedDb
            .update(shopKnowledgeTable)
            .set({ deletedAt: new Date() })
            .where(eq(shopKnowledgeTable.id, existing.id));
        });
        result.deleted++;
      } catch (err) {
        result.errors.push(`Failed to delete "${existing.title}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  await withAdminBypass(async (scopedDb) => {
    await scopedDb.update(storesTable).set({ knowledgeLastSyncedAt: new Date() }).where(eq(storesTable.storeDomain, storeDomain));
  });

  invalidateKnowledgeCache(storeDomain);

  console.log(`[shopify-sync] Sync complete for store="${storeDomain}": created=${result.created}, updated=${result.updated}, deleted=${result.deleted}, unchanged=${result.unchanged}, errors=${result.errors.length}`);

  return result;
}

const SYNC_INTERVALS: Record<string, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

export async function runAutoSync(): Promise<void> {
  try {
    const stores = await withAdminBypass(async (scopedDb) => {
      return scopedDb
        .select({
          storeDomain: storesTable.storeDomain,
          syncFrequency: storesTable.syncFrequency,
          knowledgeLastSyncedAt: storesTable.knowledgeLastSyncedAt,
        })
        .from(storesTable)
        .where(isNull(storesTable.deletedAt));
    });

    for (const store of stores) {
      if (store.syncFrequency === "manual") continue;

      const interval = SYNC_INTERVALS[store.syncFrequency];
      if (!interval) continue;

      const lastSynced = store.knowledgeLastSyncedAt?.getTime() ?? 0;
      if (Date.now() - lastSynced < interval) continue;

      try {
        console.log(`[shopify-sync] Auto-syncing store="${store.storeDomain}" (frequency=${store.syncFrequency})`);
        await syncShopifyContent(store.storeDomain);
      } catch (err) {
        console.warn(`[shopify-sync] Auto-sync failed for store="${store.storeDomain}":`, err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.warn("[shopify-sync] Auto-sync check failed:", err instanceof Error ? err.message : err);
  }
}
