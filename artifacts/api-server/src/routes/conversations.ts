import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, conversationsTable } from "@workspace/db";
import {
  ListConversationsParams,
  ListConversationsQueryParams,
  ListConversationsResponse,
  GetConversationParams,
  GetConversationResponse,
  DeleteConversationParams,
} from "@workspace/api-zod";
import { validateStoreDomain } from "../services/tenant-validator";
import { validateSession } from "../services/session-validator";

const router: IRouter = Router();

function convToResponse(conv: typeof conversationsTable.$inferSelect) {
  return {
    id: conv.id,
    storeDomain: conv.storeDomain,
    sessionId: conv.sessionId,
    title: conv.title,
    messages: (conv.messages as Array<Record<string, unknown>>) || [],
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
  };
}

router.get("/stores/:storeDomain/conversations", validateStoreDomain, validateSession, async (req, res): Promise<void> => {
  const params = ListConversationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const query = ListConversationsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conversations = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.storeDomain, params.data.storeDomain),
        eq(conversationsTable.sessionId, query.data.sessionId)
      )
    )
    .orderBy(desc(conversationsTable.updatedAt));

  res.json(ListConversationsResponse.parse(conversations.map(convToResponse)));
});

router.get("/stores/:storeDomain/conversations/:conversationId", validateStoreDomain, validateSession, async (req, res): Promise<void> => {
  const params = GetConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.id, params.data.conversationId),
        eq(conversationsTable.storeDomain, params.data.storeDomain)
      )
    );

  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  res.json(GetConversationResponse.parse(convToResponse(conv)));
});

router.delete("/stores/:storeDomain/conversations/:conversationId", validateStoreDomain, validateSession, async (req, res): Promise<void> => {
  const params = DeleteConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .delete(conversationsTable)
    .where(
      and(
        eq(conversationsTable.id, params.data.conversationId),
        eq(conversationsTable.storeDomain, params.data.storeDomain)
      )
    );

  res.sendStatus(204);
});

export default router;
