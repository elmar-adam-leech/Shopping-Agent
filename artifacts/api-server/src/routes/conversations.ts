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
import { validateStoreDomain } from "../middleware";
import { validateSession } from "../middleware";
import { sendError, sendZodError } from "../lib/error-response";

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
    sendZodError(res, params.error, "GET /stores/:storeDomain/conversations", req.params);
    return;
  }

  const query = ListConversationsQueryParams.safeParse(req.query);
  if (!query.success) {
    sendZodError(res, query.error, "GET /stores/:storeDomain/conversations query", req.query);
    return;
  }

  const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 200);
  const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

  const conversations = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.storeDomain, params.data.storeDomain),
        eq(conversationsTable.sessionId, query.data.sessionId)
      )
    )
    .orderBy(desc(conversationsTable.updatedAt))
    .limit(limit)
    .offset(offset);

  res.json(ListConversationsResponse.parse(conversations.map(convToResponse)));
});

router.get("/stores/:storeDomain/conversations/:conversationId", validateStoreDomain, validateSession, async (req, res): Promise<void> => {
  const params = GetConversationParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "GET /stores/:storeDomain/conversations/:conversationId", req.params);
    return;
  }

  const sessionId = (req as import("express").Request & { validatedSessionId: string }).validatedSessionId;
  if (!sessionId) {
    sendError(res, 401, "Session ID is required");
    return;
  }

  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.id, params.data.conversationId),
        eq(conversationsTable.storeDomain, params.data.storeDomain),
        eq(conversationsTable.sessionId, sessionId)
      )
    );

  if (!conv) {
    sendError(res, 404, "Conversation not found");
    return;
  }

  res.json(GetConversationResponse.parse(convToResponse(conv)));
});

router.delete("/stores/:storeDomain/conversations/:conversationId", validateStoreDomain, validateSession, async (req, res): Promise<void> => {
  const params = DeleteConversationParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "DELETE /stores/:storeDomain/conversations/:conversationId", req.params);
    return;
  }

  const sessionId = (req as import("express").Request & { validatedSessionId: string }).validatedSessionId;
  if (!sessionId) {
    sendError(res, 401, "Session ID is required");
    return;
  }

  const [deleted] = await db
    .delete(conversationsTable)
    .where(
      and(
        eq(conversationsTable.id, params.data.conversationId),
        eq(conversationsTable.storeDomain, params.data.storeDomain),
        eq(conversationsTable.sessionId, sessionId)
      )
    )
    .returning({ id: conversationsTable.id });

  if (!deleted) {
    sendError(res, 404, "Conversation not found");
    return;
  }

  res.sendStatus(204);
});

export default router;
