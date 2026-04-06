import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, shopKnowledgeTable } from "@workspace/db";
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
} from "@workspace/api-zod";
import { validateStoreDomain, validateMerchantAuth } from "../middleware";
import { invalidateKnowledgeCache } from "../services/knowledge-cache";
import { sendError, sendZodError } from "../lib/error-response";

const router: IRouter = Router();

type KnowledgeCategory = ShopKnowledge["category"];

router.get("/stores/:storeDomain/knowledge", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const params = ListKnowledgeParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "GET /stores/:storeDomain/knowledge", req.params);
    return;
  }

  const query = ListKnowledgeQueryParams.safeParse(req.query);

  const conditions = [eq(shopKnowledgeTable.storeDomain, params.data.storeDomain)];
  if (query.success && query.data.category) {
    conditions.push(eq(shopKnowledgeTable.category, query.data.category as KnowledgeCategory));
  }

  const entries = await db
    .select()
    .from(shopKnowledgeTable)
    .where(and(...conditions))
    .orderBy(shopKnowledgeTable.sortOrder);

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

  const [entry] = await db
    .insert(shopKnowledgeTable)
    .values({
      storeDomain: params.data.storeDomain,
      category: parsed.data.category as KnowledgeCategory,
      title: parsed.data.title,
      content: parsed.data.content,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning();

  invalidateKnowledgeCache(params.data.storeDomain);
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

  const updateData: Partial<Pick<ShopKnowledge, "category" | "title" | "content" | "sortOrder">> = {};
  if (parsed.data.category !== undefined) updateData.category = parsed.data.category as KnowledgeCategory;
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.content !== undefined) updateData.content = parsed.data.content;
  if (parsed.data.sortOrder !== undefined) updateData.sortOrder = parsed.data.sortOrder;

  const [entry] = await db
    .update(shopKnowledgeTable)
    .set(updateData)
    .where(
      and(
        eq(shopKnowledgeTable.id, params.data.knowledgeId),
        eq(shopKnowledgeTable.storeDomain, params.data.storeDomain)
      )
    )
    .returning();

  if (!entry) {
    sendError(res, 404, "Knowledge entry not found");
    return;
  }

  invalidateKnowledgeCache(params.data.storeDomain);
  res.json(UpdateKnowledgeResponse.parse(entry));
});

router.delete("/stores/:storeDomain/knowledge/:knowledgeId", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const params = DeleteKnowledgeParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "DELETE /stores/:storeDomain/knowledge/:knowledgeId", req.params);
    return;
  }

  await db
    .delete(shopKnowledgeTable)
    .where(
      and(
        eq(shopKnowledgeTable.id, params.data.knowledgeId),
        eq(shopKnowledgeTable.storeDomain, params.data.storeDomain)
      )
    );

  invalidateKnowledgeCache(params.data.storeDomain);
  res.sendStatus(204);
});

export default router;
