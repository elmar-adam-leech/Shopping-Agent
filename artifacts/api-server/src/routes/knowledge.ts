import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, shopKnowledgeTable } from "@workspace/db";
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
import { validateStoreDomain } from "../services/tenant-validator";

const router: IRouter = Router();

router.get("/stores/:storeDomain/knowledge", validateStoreDomain, async (req, res): Promise<void> => {
  const params = ListKnowledgeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const query = ListKnowledgeQueryParams.safeParse(req.query);

  let conditions = eq(shopKnowledgeTable.storeDomain, params.data.storeDomain);

  const entries = await db
    .select()
    .from(shopKnowledgeTable)
    .where(conditions)
    .orderBy(shopKnowledgeTable.sortOrder);

  const filtered = query.success && query.data.category
    ? entries.filter((e) => e.category === query.data.category)
    : entries;

  res.json(ListKnowledgeResponse.parse(filtered));
});

router.post("/stores/:storeDomain/knowledge", validateStoreDomain, async (req, res): Promise<void> => {
  const params = CreateKnowledgeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateKnowledgeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [entry] = await db
    .insert(shopKnowledgeTable)
    .values({
      storeDomain: params.data.storeDomain,
      category: parsed.data.category as any,
      title: parsed.data.title,
      content: parsed.data.content,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning();

  res.status(201).json(entry);
});

router.patch("/stores/:storeDomain/knowledge/:knowledgeId", validateStoreDomain, async (req, res): Promise<void> => {
  const params = UpdateKnowledgeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateKnowledgeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: any = {};
  if (parsed.data.category !== undefined) updateData.category = parsed.data.category;
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
    res.status(404).json({ error: "Knowledge entry not found" });
    return;
  }

  res.json(UpdateKnowledgeResponse.parse(entry));
});

router.delete("/stores/:storeDomain/knowledge/:knowledgeId", validateStoreDomain, async (req, res): Promise<void> => {
  const params = DeleteKnowledgeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
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

  res.sendStatus(204);
});

export default router;
