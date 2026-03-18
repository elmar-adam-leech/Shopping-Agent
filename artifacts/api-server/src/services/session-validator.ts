import { type Request, type Response, type NextFunction } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";

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
    res.status(401).json({ error: "Session ID is required" });
    return;
  }

  const storeDomain = req.params.storeDomain as string;

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
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  (req as Request & { validatedSessionId: string }).validatedSessionId = sessionId;
  next();
}
