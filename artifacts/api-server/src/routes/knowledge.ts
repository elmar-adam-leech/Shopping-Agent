import { Router, type IRouter } from "express";
import { eq, and, isNull, isNotNull, or, ilike, sql, desc } from "drizzle-orm";
import { shopKnowledgeTable, storesTable, withTenantScope } from "@workspace/db";
import type { ShopKnowledge } from "@workspace/db/schema";
import {
  CreateKnowledgeBody,
  CreateKnowledgeParams,
  UpdateKnowledgeBody,
  UpdateKnowledgeParams,
  UpdateKnowledgeResponse,
  ListKnowledgeParams,
  ListKnowledgeQueryParams,
  ListKnowledgeResponse,
  DeleteKnowledgeParams,
  ListDeletedKnowledgeParams,
  RestoreKnowledgeParams,
  SearchKnowledgeParams,
  SearchKnowledgeQueryParams,
  TriggerKnowledgeSyncParams,
  GetKnowledgeSyncStatusParams,
  UpdateSyncSettingsParams,
  UpdateSyncSettingsBody,
} from "@workspace/api-zod";
import { validateStoreDomain, validateMerchantAuth } from "../middleware";
import { invalidateKnowledgeCache } from "../services/knowledge-cache";
import { sendError, sendZodError } from "../lib/error-response";
import { logAuditFromRequest } from "../services/audit-logger";
import { syncShopifyContent } from "../services/shopify-sync";

const router: IRouter = Router();

type KnowledgeCategory = ShopKnowledge["category"];

router.get("/stores/:storeDomain/knowledge", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const params = ListKnowledgeParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "GET /stores/:storeDomain/knowledge", req.params);
    return;
  }

  const query = ListKnowledgeQueryParams.safeParse(req.query);

  const conditions = [eq(shopKnowledgeTable.storeDomain, params.data.storeDomain), isNull(shopKnowledgeTable.deletedAt)];
  if (query.success && query.data.category) {
    conditions.push(eq(shopKnowledgeTable.category, query.data.category as KnowledgeCategory));
  }

  const entries = await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    return scopedDb
      .select()
      .from(shopKnowledgeTable)
      .where(and(...conditions))
      .orderBy(shopKnowledgeTable.sortOrder);
  });

  res.json(ListKnowledgeResponse.parse(entries));
});

router.post("/stores/:storeDomain/knowledge", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const params = CreateKnowledgeParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "POST /stores/:storeDomain/knowledge", req.params);
    return;
  }

  const parsed = CreateKnowledgeBody.safeParse(req.body);
  if (!parsed.success) {
    sendZodError(res, parsed.error, "POST /stores/:storeDomain/knowledge body", req.body);
    return;
  }

  const [entry] = await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    return scopedDb
      .insert(shopKnowledgeTable)
      .values({
        storeDomain: params.data.storeDomain,
        category: parsed.data.category as KnowledgeCategory,
        title: parsed.data.title,
        content: parsed.data.content,
        sortOrder: parsed.data.sortOrder ?? 0,
        tags: parsed.data.tags ?? [],
      })
      .returning();
  });

  invalidateKnowledgeCache(params.data.storeDomain);

  logAuditFromRequest(req, {
    storeDomain: params.data.storeDomain,
    actor: "merchant",
    action: "knowledge_created",
    resourceType: "knowledge",
    resourceId: String(entry.id),
    metadata: { category: parsed.data.category, title: parsed.data.title },
  });

  res.status(201).json(entry);
});

router.patch("/stores/:storeDomain/knowledge/:knowledgeId", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const params = UpdateKnowledgeParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "PATCH /stores/:storeDomain/knowledge/:knowledgeId", req.params);
    return;
  }

  const parsed = UpdateKnowledgeBody.safeParse(req.body);
  if (!parsed.success) {
    sendZodError(res, parsed.error, "PATCH /stores/:storeDomain/knowledge/:knowledgeId body", req.body);
    return;
  }

  const updateData: Partial<Pick<ShopKnowledge, "category" | "title" | "content" | "sortOrder" | "tags">> = {};
  if (parsed.data.category !== undefined) updateData.category = parsed.data.category as KnowledgeCategory;
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.content !== undefined) updateData.content = parsed.data.content;
  if (parsed.data.sortOrder !== undefined) updateData.sortOrder = parsed.data.sortOrder;
  if (parsed.data.tags !== undefined) updateData.tags = parsed.data.tags;

  const [entry] = await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    return scopedDb
      .update(shopKnowledgeTable)
      .set(updateData)
      .where(
        and(
          eq(shopKnowledgeTable.id, params.data.knowledgeId),
          eq(shopKnowledgeTable.storeDomain, params.data.storeDomain)
        )
      )
      .returning();
  });

  if (!entry) {
    sendError(res, 404, "Knowledge entry not found");
    return;
  }

  invalidateKnowledgeCache(params.data.storeDomain);

  logAuditFromRequest(req, {
    storeDomain: params.data.storeDomain,
    actor: "merchant",
    action: "knowledge_updated",
    resourceType: "knowledge",
    resourceId: String(params.data.knowledgeId),
    metadata: { changedFields: Object.keys(parsed.data).filter(k => parsed.data[k as keyof typeof parsed.data] !== undefined) },
  });

  res.json(UpdateKnowledgeResponse.parse(entry));
});

router.delete("/stores/:storeDomain/knowledge/:knowledgeId", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const params = DeleteKnowledgeParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "DELETE /stores/:storeDomain/knowledge/:knowledgeId", req.params);
    return;
  }

  await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    await scopedDb
      .update(shopKnowledgeTable)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(shopKnowledgeTable.id, params.data.knowledgeId),
          eq(shopKnowledgeTable.storeDomain, params.data.storeDomain),
          isNull(shopKnowledgeTable.deletedAt)
        )
      );
  });

  invalidateKnowledgeCache(params.data.storeDomain);

  logAuditFromRequest(req, {
    storeDomain: params.data.storeDomain,
    actor: "merchant",
    action: "knowledge_deleted",
    resourceType: "knowledge",
    resourceId: String(params.data.knowledgeId),
  });

  res.sendStatus(204);
});

router.get("/stores/:storeDomain/knowledge/deleted", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const params = ListDeletedKnowledgeParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "GET /stores/:storeDomain/knowledge/deleted", req.params);
    return;
  }

  const entries = await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    return scopedDb
      .select()
      .from(shopKnowledgeTable)
      .where(
        and(
          eq(shopKnowledgeTable.storeDomain, params.data.storeDomain),
          isNotNull(shopKnowledgeTable.deletedAt)
        )
      )
      .orderBy(shopKnowledgeTable.deletedAt);
  });

  res.json(entries);
});

router.patch("/stores/:storeDomain/knowledge/:knowledgeId/restore", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const params = RestoreKnowledgeParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "PATCH /stores/:storeDomain/knowledge/:knowledgeId/restore", req.params);
    return;
  }

  const restored = await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    const [result] = await scopedDb
      .update(shopKnowledgeTable)
      .set({ deletedAt: null })
      .where(
        and(
          eq(shopKnowledgeTable.id, Number(params.data.knowledgeId)),
          eq(shopKnowledgeTable.storeDomain, params.data.storeDomain),
          isNotNull(shopKnowledgeTable.deletedAt)
        )
      )
      .returning();
    return result;
  });

  if (!restored) {
    sendError(res, 404, "Deleted knowledge entry not found");
    return;
  }

  invalidateKnowledgeCache(params.data.storeDomain);

  logAuditFromRequest(req, {
    storeDomain: params.data.storeDomain,
    actor: "merchant",
    action: "knowledge_restored",
    resourceType: "knowledge",
    resourceId: String(params.data.knowledgeId),
  });

  res.json(restored);
});

router.get("/stores/:storeDomain/knowledge/search", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const params = SearchKnowledgeParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "GET /stores/:storeDomain/knowledge/search", req.params);
    return;
  }

  const query = SearchKnowledgeQueryParams.safeParse(req.query);
  if (!query.success) {
    sendZodError(res, query.error, "GET /stores/:storeDomain/knowledge/search query", req.query);
    return;
  }

  const searchTerm = `%${query.data.q}%`;
  const conditions = [
    eq(shopKnowledgeTable.storeDomain, params.data.storeDomain),
    isNull(shopKnowledgeTable.deletedAt),
    or(
      ilike(shopKnowledgeTable.title, searchTerm),
      ilike(shopKnowledgeTable.content, searchTerm),
      sql`EXISTS (SELECT 1 FROM unnest(${shopKnowledgeTable.tags}) AS tag WHERE tag ILIKE ${searchTerm})`
    ),
  ];

  if (query.data.tag) {
    conditions.push(
      sql`${query.data.tag} = ANY(${shopKnowledgeTable.tags})`
    );
  }

  const entries = await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    return scopedDb
      .select()
      .from(shopKnowledgeTable)
      .where(and(...conditions))
      .orderBy(shopKnowledgeTable.sortOrder);
  });

  res.json(entries);
});

router.post("/stores/:storeDomain/knowledge/sync", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const params = TriggerKnowledgeSyncParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "POST /stores/:storeDomain/knowledge/sync", req.params);
    return;
  }

  try {
    const result = await syncShopifyContent(params.data.storeDomain);

    logAuditFromRequest(req, {
      storeDomain: params.data.storeDomain,
      actor: "merchant",
      action: "knowledge_sync_triggered",
      resourceType: "knowledge",
      metadata: { created: result.created, updated: result.updated, deleted: result.deleted, errors: result.errors.length },
    });

    res.json(result);
  } catch (err) {
    console.error("[knowledge] Sync failed:", err instanceof Error ? err.message : err);
    sendError(res, 500, "Sync failed");
  }
});

router.get("/stores/:storeDomain/knowledge/sync/status", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const params = GetKnowledgeSyncStatusParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "GET /stores/:storeDomain/knowledge/sync/status", req.params);
    return;
  }

  const [store] = await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    return scopedDb
      .select({
        syncFrequency: storesTable.syncFrequency,
        knowledgeLastSyncedAt: storesTable.knowledgeLastSyncedAt,
      })
      .from(storesTable)
      .where(eq(storesTable.storeDomain, params.data.storeDomain));
  });

  if (!store) {
    sendError(res, 404, "Store not found");
    return;
  }

  const syncedEntries = await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    const result = await scopedDb
      .select({ count: sql<number>`count(*)::int` })
      .from(shopKnowledgeTable)
      .where(
        and(
          eq(shopKnowledgeTable.storeDomain, params.data.storeDomain),
          eq(shopKnowledgeTable.source, "synced"),
          isNull(shopKnowledgeTable.deletedAt)
        )
      );
    return result[0]?.count ?? 0;
  });

  res.json({
    syncFrequency: store.syncFrequency,
    lastSyncedAt: store.knowledgeLastSyncedAt?.toISOString() ?? null,
    syncedEntryCount: syncedEntries,
  });
});

router.patch("/stores/:storeDomain/knowledge/sync/settings", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const params = UpdateSyncSettingsParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "PATCH /stores/:storeDomain/knowledge/sync/settings", req.params);
    return;
  }

  const parsed = UpdateSyncSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    sendZodError(res, parsed.error, "PATCH /stores/:storeDomain/knowledge/sync/settings body", req.body);
    return;
  }

  await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    await scopedDb
      .update(storesTable)
      .set({ syncFrequency: parsed.data.syncFrequency as "manual" | "daily" | "weekly" })
      .where(eq(storesTable.storeDomain, params.data.storeDomain));
  });

  const [store] = await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    return scopedDb
      .select({
        syncFrequency: storesTable.syncFrequency,
        knowledgeLastSyncedAt: storesTable.knowledgeLastSyncedAt,
      })
      .from(storesTable)
      .where(eq(storesTable.storeDomain, params.data.storeDomain));
  });

  const syncedEntries = await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    const result = await scopedDb
      .select({ count: sql<number>`count(*)::int` })
      .from(shopKnowledgeTable)
      .where(
        and(
          eq(shopKnowledgeTable.storeDomain, params.data.storeDomain),
          eq(shopKnowledgeTable.source, "synced"),
          isNull(shopKnowledgeTable.deletedAt)
        )
      );
    return result[0]?.count ?? 0;
  });

  logAuditFromRequest(req, {
    storeDomain: params.data.storeDomain,
    actor: "merchant",
    action: "sync_settings_updated",
    resourceType: "store",
    metadata: { syncFrequency: parsed.data.syncFrequency },
  });

  res.json({
    syncFrequency: store?.syncFrequency ?? parsed.data.syncFrequency,
    lastSyncedAt: store?.knowledgeLastSyncedAt?.toISOString() ?? null,
    syncedEntryCount: syncedEntries,
  });
});

export default router;
