import type { Request, Response, NextFunction } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { sessionsTable, conversationsTable, withAdminBypass } from "@workspace/db";
import { logCrossTenantAttempt } from "../services/audit-logger";
import { sendError } from "../lib/error-response";

export async function crossTenantGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const rawStoreDomain = req.params.storeDomain;
  if (!rawStoreDomain || typeof rawStoreDomain !== "string") {
    next();
    return;
  }
  const storeDomain: string = rawStoreDomain;

  const rawSessionId =
    (req.query.sessionId as string | undefined) ||
    (req.body?.sessionId as string | undefined) ||
    (req.headers["x-session-id"] as string | undefined);
  const sessionId: string | undefined = typeof rawSessionId === "string" ? rawSessionId : undefined;

  if (sessionId) {
    try {
      const session = await withAdminBypass(async (scopedDb) => {
        const [result] = await scopedDb
          .select({ sd: sessionsTable.storeDomain })
          .from(sessionsTable)
          .where(eq(sessionsTable.id, sessionId));
        return result;
      });

      if (session && session.sd !== storeDomain) {
        await logCrossTenantAttempt(req, {
          storeDomain,
          attemptedResource: "session",
          attemptedResourceId: sessionId,
          ownerStoreDomain: session.sd,
        });
        sendError(res, 403, "Access denied");
        return;
      }
    } catch (err) {
      console.error("[cross-tenant-guard] DB error checking session ownership:", err instanceof Error ? err.message : err);
      sendError(res, 503, "Service temporarily unavailable");
      return;
    }
  }

  const rawConversationId = req.body?.conversationId || req.params.conversationId;
  const conversationId = typeof rawConversationId === "number"
    ? rawConversationId
    : typeof rawConversationId === "string" && /^\d+$/.test(rawConversationId)
      ? parseInt(rawConversationId, 10)
      : null;
  if (conversationId) {
    try {
      const conv = await withAdminBypass(async (scopedDb) => {
        const [result] = await scopedDb
          .select({ sd: conversationsTable.storeDomain })
          .from(conversationsTable)
          .where(and(eq(conversationsTable.id, conversationId), isNull(conversationsTable.deletedAt)));
        return result;
      });

      if (conv && conv.sd !== storeDomain) {
        await logCrossTenantAttempt(req, {
          storeDomain,
          attemptedResource: "conversation",
          attemptedResourceId: String(conversationId),
          ownerStoreDomain: conv.sd,
        });
        sendError(res, 403, "Access denied");
        return;
      }
    } catch (err) {
      console.error("[cross-tenant-guard] DB error checking conversation ownership:", err instanceof Error ? err.message : err);
      sendError(res, 503, "Service temporarily unavailable");
      return;
    }
  }

  next();
}
