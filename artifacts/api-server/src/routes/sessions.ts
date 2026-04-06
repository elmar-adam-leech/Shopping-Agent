import { Router, type IRouter } from "express";
import { v4 as uuidv4 } from "uuid";
import { eq, and } from "drizzle-orm";
import { db, storesTable, sessionsTable, promptExperimentsTable, withTenantScope } from "@workspace/db";
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

  let experimentId: string | null = null;
  let experimentVariant: string | null = null;

  try {
    const [activeExperiment] = await withTenantScope(parsed.data.storeDomain, async (scopedDb) => {
      return scopedDb
        .select()
        .from(promptExperimentsTable)
        .where(
          and(
            eq(promptExperimentsTable.storeDomain, parsed.data.storeDomain),
            eq(promptExperimentsTable.status, "active")
          )
        )
        .limit(1);
    });

    if (activeExperiment) {
      experimentId = activeExperiment.id;
      const roll = Math.random() * 100;
      experimentVariant = roll < activeExperiment.splitRatio ? "A" : "B";
    }
  } catch (err) {
    console.warn("[sessions] Failed to check for active experiment:", err instanceof Error ? err.message : err);
  }

  const sessionId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  try {
    await withTenantScope(parsed.data.storeDomain, async (scopedDb) => {
      await scopedDb.insert(sessionsTable).values({
        id: sessionId,
        storeDomain: parsed.data.storeDomain,
        experimentId,
        experimentVariant,
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
