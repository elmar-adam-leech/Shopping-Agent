/**
 * Session validation middleware for consumer-facing (shopper) sessions.
 *
 * Sessions are identified by a session ID passed as a query parameter,
 * request body field, or `x-session-id` header. Valid sessions are cached
 * in an LRU cache (30 s TTL, 5 000 entries) to avoid repeated database
 * lookups on every request.
 *
 * On success the validated session ID is attached to `req.validatedSessionId`.
 */

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

/** Remove a session from the in-memory cache, forcing the next validation to hit the database. */
export function invalidateSessionCache(sessionId: string, storeDomain: string): void {
  sessionCache.delete(sessionCacheKey(sessionId, storeDomain));
}

/** Remove all sessions for a given store domain from the in-memory cache. */
export function invalidateSessionCacheForDomain(storeDomain: string): void {
  sessionCache.deleteByPrefix(`${storeDomain}::`);
}

/**
 * Express middleware that validates a shopper session.
 * Reads the session ID from query params, request body, or the `x-session-id` header,
 * then checks the LRU cache (or database) for a valid, non-expired session.
 * Attaches `req.validatedSessionId` on success; responds 401 on failure.
 */
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
