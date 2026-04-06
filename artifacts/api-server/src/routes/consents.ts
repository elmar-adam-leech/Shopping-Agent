import { Router, type IRouter, type Request } from "express";
import { eq, and } from "drizzle-orm";
import {
  userConsentsTable,
  conversationsTable,
  userPreferencesTable,
  analyticsLogsTable,
  withTenantScope,
  type ConsentCategories,
} from "@workspace/db";
import { validateStoreDomain, validateSession } from "../middleware";
import { sendError } from "../lib/error-response";
import { logAuditFromRequest } from "../services/audit-logger";
import { logAnalyticsEvent } from "../services/analytics-logger";

const router: IRouter = Router();

function getValidatedSessionId(req: Request): string {
  return (req as Request & { validatedSessionId: string }).validatedSessionId;
}

function isValidConsentCategories(obj: unknown): obj is ConsentCategories {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.conversationHistory === "boolean" &&
    typeof o.preferenceStorage === "boolean" &&
    typeof o.orderHistoryAccess === "boolean" &&
    typeof o.analytics === "boolean"
  );
}

function consentToResponse(consent: typeof userConsentsTable.$inferSelect) {
  return {
    id: consent.id,
    storeDomain: consent.storeDomain,
    sessionId: consent.sessionId,
    categories: consent.categories,
    consentVersion: consent.consentVersion,
    grantedAt: consent.grantedAt,
    updatedAt: consent.updatedAt,
    createdAt: consent.createdAt,
  };
}

router.get("/stores/:storeDomain/consents", validateStoreDomain, validateSession, async (req, res): Promise<void> => {
  const storeDomain = req.params.storeDomain as string;
  const sessionId = getValidatedSessionId(req);

  const consent = await withTenantScope(storeDomain, async (scopedDb) => {
    const [result] = await scopedDb
      .select()
      .from(userConsentsTable)
      .where(
        and(
          eq(userConsentsTable.storeDomain, storeDomain),
          eq(userConsentsTable.sessionId, sessionId),
          eq(userConsentsTable.deleted, false)
        )
      );
    return result ?? null;
  });

  if (!consent) {
    res.json({
      storeDomain,
      sessionId,
      categories: {
        conversationHistory: false,
        preferenceStorage: false,
        orderHistoryAccess: false,
        analytics: false,
      },
      consentVersion: 1,
      grantedAt: null,
      hasConsented: false,
    });
    return;
  }

  res.json({ ...consentToResponse(consent), hasConsented: true });
});

router.put("/stores/:storeDomain/consents", validateStoreDomain, validateSession, async (req, res): Promise<void> => {
  const storeDomain = req.params.storeDomain as string;
  const sessionId = getValidatedSessionId(req);

  if (!req.body || typeof req.body !== "object" || !isValidConsentCategories(req.body.categories)) {
    sendError(res, 400, "Invalid request body: categories object required");
    return;
  }

  const categories = req.body.categories as ConsentCategories;

  const [consent] = await withTenantScope(storeDomain, async (scopedDb) => {
    return scopedDb
      .insert(userConsentsTable)
      .values({
        storeDomain,
        sessionId,
        categories,
        consentVersion: 1,
        grantedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userConsentsTable.storeDomain, userConsentsTable.sessionId],
        set: {
          categories,
          grantedAt: new Date(),
          updatedAt: new Date(),
          deleted: false,
        },
      })
      .returning();
  });

  logAuditFromRequest(req, {
    storeDomain,
    actor: "customer",
    actorId: sessionId,
    action: "consent_updated",
    resourceType: "user_consent",
    resourceId: String(consent.id),
    metadata: { categories },
  });

  logAnalyticsEvent(storeDomain, "consent_updated", sessionId, {
    metadata: { categories },
  });

  res.json({ ...consentToResponse(consent), hasConsented: true });
});

router.post("/stores/:storeDomain/consents/export", validateStoreDomain, validateSession, async (req, res): Promise<void> => {
  const storeDomain = req.params.storeDomain as string;
  const sessionId = getValidatedSessionId(req);

  const exportData = await withTenantScope(storeDomain, async (scopedDb) => {
    const [consent] = await scopedDb
      .select()
      .from(userConsentsTable)
      .where(
        and(
          eq(userConsentsTable.storeDomain, storeDomain),
          eq(userConsentsTable.sessionId, sessionId),
          eq(userConsentsTable.deleted, false)
        )
      );

    const conversations = await scopedDb
      .select()
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.storeDomain, storeDomain),
          eq(conversationsTable.sessionId, sessionId)
        )
      );

    const [preferences] = await scopedDb
      .select()
      .from(userPreferencesTable)
      .where(
        and(
          eq(userPreferencesTable.storeDomain, storeDomain),
          eq(userPreferencesTable.sessionId, sessionId)
        )
      );

    const analytics = await scopedDb
      .select()
      .from(analyticsLogsTable)
      .where(
        and(
          eq(analyticsLogsTable.storeDomain, storeDomain),
          eq(analyticsLogsTable.sessionId, sessionId)
        )
      );

    return {
      exportDate: new Date().toISOString(),
      storeDomain,
      sessionId,
      consent: consent ? consentToResponse(consent) : null,
      conversations: conversations.map(c => ({
        id: c.id,
        title: c.title,
        messages: c.messages,
        messageCount: c.messageCount,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      preferences: preferences ? { prefs: preferences.prefs, createdAt: preferences.createdAt, updatedAt: preferences.updatedAt } : null,
      analyticsEvents: analytics.map(a => ({
        eventType: a.eventType,
        query: a.query,
        metadata: a.metadata,
        createdAt: a.createdAt,
      })),
    };
  });

  logAuditFromRequest(req, {
    storeDomain,
    actor: "customer",
    actorId: sessionId,
    action: "data_export_requested",
    resourceType: "user_data",
    resourceId: sessionId,
    metadata: { recordCounts: { conversations: exportData.conversations.length, analyticsEvents: exportData.analyticsEvents.length } },
  });

  logAnalyticsEvent(storeDomain, "data_export_requested", sessionId);

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="data-export-${sessionId.slice(0, 8)}.json"`);
  res.json(exportData);
});

router.post("/stores/:storeDomain/consents/delete", validateStoreDomain, validateSession, async (req, res): Promise<void> => {
  const storeDomain = req.params.storeDomain as string;
  const sessionId = getValidatedSessionId(req);

  await withTenantScope(storeDomain, async (scopedDb) => {
    await scopedDb
      .update(userConsentsTable)
      .set({ deleted: true, updatedAt: new Date() })
      .where(
        and(
          eq(userConsentsTable.storeDomain, storeDomain),
          eq(userConsentsTable.sessionId, sessionId)
        )
      );

    await scopedDb
      .delete(conversationsTable)
      .where(
        and(
          eq(conversationsTable.storeDomain, storeDomain),
          eq(conversationsTable.sessionId, sessionId)
        )
      );

    await scopedDb
      .delete(userPreferencesTable)
      .where(
        and(
          eq(userPreferencesTable.storeDomain, storeDomain),
          eq(userPreferencesTable.sessionId, sessionId)
        )
      );

    await scopedDb
      .delete(analyticsLogsTable)
      .where(
        and(
          eq(analyticsLogsTable.storeDomain, storeDomain),
          eq(analyticsLogsTable.sessionId, sessionId)
        )
      );
  });

  logAuditFromRequest(req, {
    storeDomain,
    actor: "customer",
    actorId: sessionId,
    action: "data_deletion_requested",
    resourceType: "user_data",
    resourceId: sessionId,
    metadata: { type: "full_session_deletion" },
  });

  logAnalyticsEvent(storeDomain, "data_deletion_requested", sessionId);

  res.json({ success: true, message: "All session data has been deleted." });
});

export default router;
