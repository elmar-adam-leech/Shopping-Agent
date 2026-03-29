import { type Request, type Response, type NextFunction } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";
import { LRUCache } from "./lru-cache";
import { sendError } from "../lib/error-response";

interface CachedSession {
  expiresAt: number;
}

const sessionCache = new LRUCache<CachedSession>(5000, 30_000);

function sessionCacheKey(sessionId: string, storeDomain: string): string {
  return `${storeDomain}::${sessionId}`;
}

export function invalidateSessionCache(sessionId: string, storeDomain: string): void {
  sessionCache.delete(sessionCacheKey(sessionId, storeDomain));
}

export function invalidateSessionCacheForDomain(storeDomain: string): void {
  sessionCache.deleteByPrefix(`${storeDomain}::`);
}

export async function validateSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const sessionId =
    (req.query.sessionId as string | undefined) ||
    (req.body?.sessionId as string | undefined) ||
    (req.headers["x-session-id"] as string | undefined);

  if (!sessionId) {
    sendError(res, 401, "Session ID is required");
    return;
  }

  const storeDomain = req.params.storeDomain as string;
  const cacheKey = sessionCacheKey(sessionId, storeDomain);

  const cached = sessionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    (req as Request & { validatedSessionId: string }).validatedSessionId = sessionId;
    next();
    return;
  }

  if (cached) {
    sessionCache.delete(cacheKey);
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.id, sessionId),
        eq(sessionsTable.storeDomain, storeDomain),
        gt(sessionsTable.expiresAt, new Date())
      )
    );

  if (!session) {
    sendError(res, 401, "Invalid or expired session");
    return;
  }

  sessionCache.set(cacheKey, { expiresAt: session.expiresAt.getTime() });
  (req as Request & { validatedSessionId: string }).validatedSessionId = sessionId;
  next();
}
