import { Router, type IRouter } from "express";
import { eq, and, desc, isNull, isNotNull } from "drizzle-orm";
import { conversationsTable, withTenantScope } from "@workspace/db";
import {
  ListConversationsParams,
  ListConversationsQueryParams,
  ListConversationsResponse,
  GetConversationParams,
  GetConversationResponse,
  DeleteConversationParams,
  ListDeletedConversationsParams,
  ListDeletedConversationsQueryParams,
  RestoreConversationParams,
} from "@workspace/api-zod";
import { validateStoreDomain } from "../middleware";
import { validateSession } from "../middleware";
import { sendError, sendZodError } from "../lib/error-response";
import { logAuditFromRequest } from "../services/audit-logger";

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

  const conversations = await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    return scopedDb
      .select()
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.storeDomain, params.data.storeDomain),
          eq(conversationsTable.sessionId, query.data.sessionId),
          isNull(conversationsTable.deletedAt)
        )
      )
      .orderBy(desc(conversationsTable.updatedAt))
      .limit(limit)
      .offset(offset);
  });

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

  const conv = await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    const [result] = await scopedDb
      .select()
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.id, params.data.conversationId),
          eq(conversationsTable.storeDomain, params.data.storeDomain),
          eq(conversationsTable.sessionId, sessionId),
          isNull(conversationsTable.deletedAt)
        )
      );
    return result;
  });

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

  const deleted = await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    const [result] = await scopedDb
      .update(conversationsTable)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(conversationsTable.id, params.data.conversationId),
          eq(conversationsTable.storeDomain, params.data.storeDomain),
          eq(conversationsTable.sessionId, sessionId),
          isNull(conversationsTable.deletedAt)
        )
      )
      .returning({ id: conversationsTable.id });
    return result;
  });

  if (!deleted) {
    sendError(res, 404, "Conversation not found");
    return;
  }

  logAuditFromRequest(req, {
    storeDomain: params.data.storeDomain,
    actor: "customer",
    action: "conversation_deleted",
    resourceType: "conversation",
    resourceId: String(params.data.conversationId),
  });

  res.sendStatus(204);
});

router.get("/stores/:storeDomain/conversations/deleted", validateStoreDomain, validateSession, async (req, res): Promise<void> => {
  const params = ListDeletedConversationsParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "GET /stores/:storeDomain/conversations/deleted", req.params);
    return;
  }

  const query = ListDeletedConversationsQueryParams.safeParse(req.query);
  if (!query.success) {
    sendZodError(res, query.error, "GET /stores/:storeDomain/conversations/deleted query", req.query);
    return;
  }

  const conversations = await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    return scopedDb
      .select()
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.storeDomain, params.data.storeDomain),
          eq(conversationsTable.sessionId, query.data.sessionId),
          isNotNull(conversationsTable.deletedAt)
        )
      )
      .orderBy(desc(conversationsTable.updatedAt))
      .limit(50);
  });

  res.json(conversations.map(convToResponse));
});

router.patch("/stores/:storeDomain/conversations/:conversationId/restore", validateStoreDomain, validateSession, async (req, res): Promise<void> => {
  const params = RestoreConversationParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "PATCH /stores/:storeDomain/conversations/:conversationId/restore", req.params);
    return;
  }

  const sessionId = (req as import("express").Request & { validatedSessionId: string }).validatedSessionId;
  if (!sessionId) {
    sendError(res, 401, "Session ID is required");
    return;
  }

  const restored = await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    const [result] = await scopedDb
      .update(conversationsTable)
      .set({ deletedAt: null })
      .where(
        and(
          eq(conversationsTable.id, params.data.conversationId),
          eq(conversationsTable.storeDomain, params.data.storeDomain),
          eq(conversationsTable.sessionId, sessionId),
          isNotNull(conversationsTable.deletedAt)
        )
      )
      .returning();
    return result;
  });

  if (!restored) {
    sendError(res, 404, "Deleted conversation not found");
    return;
  }

  logAuditFromRequest(req, {
    storeDomain: params.data.storeDomain,
    actor: "customer",
    action: "conversation_restored",
    resourceType: "conversation",
    resourceId: String(params.data.conversationId),
  });

  res.json(convToResponse(restored));
});

export default router;
