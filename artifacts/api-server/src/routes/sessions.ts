import { Router, type IRouter } from "express";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { db, storesTable, sessionsTable, withTenantScope } from "@workspace/db";
import { CreateSessionBody } from "@workspace/api-zod";
import { sendError, sendZodError } from "../lib/error-response";

const SESSION_TTL_HOURS = 24;

const router: IRouter = Router();

router.post("/sessions", async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    sendZodError(res, parsed.error, "POST /sessions", req.body);
    return;
  }

  let store;
  try {
    const [result] = await db
      .select()
      .from(storesTable)
      .where(eq(storesTable.storeDomain, parsed.data.storeDomain));
    store = result;
  } catch (err) {
    console.error("[sessions] Database error during store lookup:", err instanceof Error ? err.message : err);
    sendError(res, 503, "Service temporarily unavailable. Please try again in a moment.");
    return;
  }

  if (!store) {
    sendError(res, 404, "Store not found");
    return;
  }

  if (!store.chatEnabled) {
    sendError(res, 403, "Chat is currently disabled for this store");
    return;
  }

  const sessionId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  try {
    await withTenantScope(parsed.data.storeDomain, async (scopedDb) => {
      await scopedDb.insert(sessionsTable).values({
        id: sessionId,
        storeDomain: parsed.data.storeDomain,
        createdAt: now,
        expiresAt,
      });
    });
  } catch (err) {
    console.error("[sessions] Database error during session creation:", err instanceof Error ? err.message : err);
    sendError(res, 503, "Service temporarily unavailable. Please try again in a moment.");
    return;
  }

  res.status(201).json({
    sessionId,
    storeDomain: parsed.data.storeDomain,
    createdAt: now.toISOString(),
  });
});

export default router;
