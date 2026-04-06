import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { userPreferencesTable, withTenantScope } from "@workspace/db";
import {
  GetPreferencesParams,
  GetPreferencesQueryParams,
  GetPreferencesResponse,
  UpdatePreferencesParams,
  UpdatePreferencesBody,
  UpdatePreferencesResponse,
} from "@workspace/api-zod";
import { validateStoreDomain } from "../middleware";
import { validateSession } from "../middleware";
import { sendZodError } from "../lib/error-response";

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
    sendZodError(res, params.error, "GET /stores/:storeDomain/preferences", req.params);
    return;
  }

  const query = GetPreferencesQueryParams.safeParse(req.query);
  if (!query.success) {
    sendZodError(res, query.error, "GET /stores/:storeDomain/preferences query", req.query);
    return;
  }

  const prefs = await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    let [result] = await scopedDb
      .select()
      .from(userPreferencesTable)
      .where(
        and(
          eq(userPreferencesTable.storeDomain, params.data.storeDomain),
          eq(userPreferencesTable.sessionId, query.data.sessionId)
        )
      );

    if (!result) {
      [result] = await scopedDb
        .insert(userPreferencesTable)
        .values({
          storeDomain: params.data.storeDomain,
          sessionId: query.data.sessionId,
          prefs: {},
        })
        .onConflictDoUpdate({
          target: [userPreferencesTable.storeDomain, userPreferencesTable.sessionId],
          set: { updatedAt: new Date() },
        })
        .returning();
    }

    return result;
  });

  res.json(GetPreferencesResponse.parse(prefsToResponse(prefs)));
});

router.put("/stores/:storeDomain/preferences", validateStoreDomain, validateSession, async (req, res): Promise<void> => {
  const params = UpdatePreferencesParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "PUT /stores/:storeDomain/preferences", req.params);
    return;
  }

  const parsed = UpdatePreferencesBody.safeParse(req.body);
  if (!parsed.success) {
    sendZodError(res, parsed.error, "PUT /stores/:storeDomain/preferences body", req.body);
    return;
  }

  const [prefs] = await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    return scopedDb
      .insert(userPreferencesTable)
      .values({
        storeDomain: params.data.storeDomain,
        sessionId: parsed.data.sessionId,
        prefs: parsed.data.prefs,
      })
      .onConflictDoUpdate({
        target: [userPreferencesTable.storeDomain, userPreferencesTable.sessionId],
        set: { prefs: parsed.data.prefs, updatedAt: new Date() },
      })
      .returning();
  });

  res.json(UpdatePreferencesResponse.parse(prefsToResponse(prefs)));
});

export default router;
