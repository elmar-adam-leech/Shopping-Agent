import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, userPreferencesTable } from "@workspace/db";
import {
  GetPreferencesParams,
  GetPreferencesQueryParams,
  GetPreferencesResponse,
  UpdatePreferencesParams,
  UpdatePreferencesBody,
  UpdatePreferencesResponse,
} from "@workspace/api-zod";
import { validateStoreDomain } from "../services/tenant-validator";
import { validateSession } from "../services/session-validator";

const router: IRouter = Router();

function prefsToResponse(prefs: typeof userPreferencesTable.$inferSelect) {
  return {
    id: prefs.id,
    storeDomain: prefs.storeDomain,
    sessionId: prefs.sessionId,
    prefs: prefs.prefs,
    createdAt: prefs.createdAt,
    updatedAt: prefs.updatedAt,
  };
}

router.get("/stores/:storeDomain/preferences", validateStoreDomain, validateSession, async (req, res): Promise<void> => {
  const params = GetPreferencesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const query = GetPreferencesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let [prefs] = await db
    .select()
    .from(userPreferencesTable)
    .where(
      and(
        eq(userPreferencesTable.storeDomain, params.data.storeDomain),
        eq(userPreferencesTable.sessionId, query.data.sessionId)
      )
    );

  if (!prefs) {
    [prefs] = await db
      .insert(userPreferencesTable)
      .values({
        storeDomain: params.data.storeDomain,
        sessionId: query.data.sessionId,
        prefs: {},
      })
      .returning();
  }

  res.json(GetPreferencesResponse.parse(prefsToResponse(prefs)));
});

router.put("/stores/:storeDomain/preferences", validateStoreDomain, validateSession, async (req, res): Promise<void> => {
  const params = UpdatePreferencesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(userPreferencesTable)
    .where(
      and(
        eq(userPreferencesTable.storeDomain, params.data.storeDomain),
        eq(userPreferencesTable.sessionId, parsed.data.sessionId)
      )
    );

  let prefs;
  if (existing.length > 0) {
    [prefs] = await db
      .update(userPreferencesTable)
      .set({ prefs: parsed.data.prefs })
      .where(eq(userPreferencesTable.id, existing[0].id))
      .returning();
  } else {
    [prefs] = await db
      .insert(userPreferencesTable)
      .values({
        storeDomain: params.data.storeDomain,
        sessionId: parsed.data.sessionId,
        prefs: parsed.data.prefs,
      })
      .returning();
  }

  res.json(UpdatePreferencesResponse.parse(prefsToResponse(prefs)));
});

export default router;
