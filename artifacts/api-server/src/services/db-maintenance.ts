import { sessionsTable, analyticsLogsTable, conversationsTable, pendingOAuthStatesTable, maintenanceStateTable, userConsentsTable, userPreferencesTable, storesTable, withAdminBypass } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const BATCH_DELETE_LIMIT = 1000;
const MAINTENANCE_KEY = "db_cleanup";
const rawRetention = parseInt(process.env.ANALYTICS_RETENTION_DAYS || "90", 10);
const ANALYTICS_RETENTION_DAYS = Number.isFinite(rawRetention) && rawRetention >= 1 ? rawRetention : 90;
const rawConvRetention = parseInt(process.env.CONVERSATION_RETENTION_DAYS || "90", 10);
const CONVERSATION_RETENTION_DAYS = Number.isFinite(rawConvRetention) && rawConvRetention >= 1 ? rawConvRetention : 90;

async function cleanExpiredSessions(): Promise<number> {
  let totalDeleted = 0;
  while (true) {
    const result = await withAdminBypass(async (scopedDb) => {
      return scopedDb.execute(
        sql`DELETE FROM ${sessionsTable} WHERE ${sessionsTable.expiresAt} < NOW() AND ctid IN (SELECT ctid FROM ${sessionsTable} WHERE ${sessionsTable.expiresAt} < NOW() LIMIT ${BATCH_DELETE_LIMIT})`
      );
    });
    const count = Number(result.rowCount ?? 0);
    totalDeleted += count;
    if (count < BATCH_DELETE_LIMIT) break;
  }
  return totalDeleted;
}

async function pruneOldAnalytics(): Promise<number> {
  let totalDeleted = 0;
  try {
    const stores = await withAdminBypass(async (scopedDb) => {
      return scopedDb.select({ storeDomain: storesTable.storeDomain, dataRetentionDays: storesTable.dataRetentionDays }).from(storesTable);
    });

    for (const store of stores) {
      const retentionDays = Math.min(store.dataRetentionDays ?? ANALYTICS_RETENTION_DAYS, ANALYTICS_RETENTION_DAYS);
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      while (true) {
        const result = await withAdminBypass(async (scopedDb) => {
          return scopedDb.execute(
            sql`DELETE FROM ${analyticsLogsTable} WHERE ${analyticsLogsTable.storeDomain} = ${store.storeDomain} AND ${analyticsLogsTable.createdAt} < ${cutoff} AND ctid IN (SELECT ctid FROM ${analyticsLogsTable} WHERE ${analyticsLogsTable.storeDomain} = ${store.storeDomain} AND ${analyticsLogsTable.createdAt} < ${cutoff} LIMIT ${BATCH_DELETE_LIMIT})`
          );
        });
        const count = Number(result.rowCount ?? 0);
        totalDeleted += count;
        if (count < BATCH_DELETE_LIMIT) break;
      }
    }
  } catch (err) {
    console.warn("[db-maintenance] Per-store analytics pruning failed:", err instanceof Error ? err.message : err);
  }
  return totalDeleted;
}

async function pruneOldConversations(): Promise<number> {
  let totalDeleted = 0;
  try {
    const stores = await withAdminBypass(async (scopedDb) => {
      return scopedDb.select({ storeDomain: storesTable.storeDomain, dataRetentionDays: storesTable.dataRetentionDays }).from(storesTable);
    });

    for (const store of stores) {
      const retentionDays = Math.min(store.dataRetentionDays ?? CONVERSATION_RETENTION_DAYS, CONVERSATION_RETENTION_DAYS);
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      while (true) {
        const result = await withAdminBypass(async (scopedDb) => {
          return scopedDb.execute(
            sql`DELETE FROM ${conversationsTable} WHERE ${conversationsTable.storeDomain} = ${store.storeDomain} AND ${conversationsTable.updatedAt} < ${cutoff} AND ctid IN (SELECT ctid FROM ${conversationsTable} WHERE ${conversationsTable.storeDomain} = ${store.storeDomain} AND ${conversationsTable.updatedAt} < ${cutoff} LIMIT ${BATCH_DELETE_LIMIT})`
          );
        });
        const count = Number(result.rowCount ?? 0);
        totalDeleted += count;
        if (count < BATCH_DELETE_LIMIT) break;
      }
    }
  } catch (err) {
    console.warn("[db-maintenance] Per-store conversation pruning failed:", err instanceof Error ? err.message : err);
  }
  return totalDeleted;
}

async function purgeExpiredConsentData(): Promise<number> {
  let totalDeleted = 0;
  try {
    const stores = await withAdminBypass(async (scopedDb) => {
      return scopedDb.select({ storeDomain: storesTable.storeDomain, dataRetentionDays: storesTable.dataRetentionDays }).from(storesTable);
    });

    for (const store of stores) {
      const retentionDays = store.dataRetentionDays ?? 90;
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      const deletedConsents = await withAdminBypass(async (scopedDb) => {
        const result = await scopedDb.execute(
          sql`DELETE FROM ${userConsentsTable} WHERE ${userConsentsTable.storeDomain} = ${store.storeDomain} AND ${userConsentsTable.deleted} = true AND ${userConsentsTable.updatedAt} < ${cutoff}`
        );
        return Number(result.rowCount ?? 0);
      });

      const deletedPrefs = await withAdminBypass(async (scopedDb) => {
        const result = await scopedDb.execute(
          sql`DELETE FROM ${userPreferencesTable} WHERE ${userPreferencesTable.storeDomain} = ${store.storeDomain} AND ${userPreferencesTable.updatedAt} < ${cutoff} AND NOT EXISTS (SELECT 1 FROM ${userConsentsTable} WHERE ${userConsentsTable.storeDomain} = ${store.storeDomain} AND ${userConsentsTable.sessionId} = ${userPreferencesTable.sessionId} AND ${userConsentsTable.deleted} = false)`
        );
        return Number(result.rowCount ?? 0);
      });

      totalDeleted += deletedConsents + deletedPrefs;
    }
  } catch (err) {
    console.warn("[db-maintenance] Consent data purging failed:", err instanceof Error ? err.message : err);
  }
  return totalDeleted;
}

async function cleanExpiredOAuthStates(): Promise<number> {
  const result = await withAdminBypass(async (scopedDb) => {
    return scopedDb
      .delete(pendingOAuthStatesTable)
      .where(sql`${pendingOAuthStatesTable.expiresAt} < NOW()`);
  });
  return Number((result as unknown as { rowCount?: number }).rowCount ?? 0);
}

async function ensureMaintenanceRow(): Promise<void> {
  await withAdminBypass(async (scopedDb) => {
    await scopedDb.execute(
      sql`INSERT INTO ${maintenanceStateTable} (key, running, updated_at) VALUES (${MAINTENANCE_KEY}, false, NOW()) ON CONFLICT (key) DO NOTHING`
    );
  });
}

async function tryAcquireLock(): Promise<boolean> {
  const result = await withAdminBypass(async (scopedDb) => {
    return scopedDb.execute(
      sql`UPDATE ${maintenanceStateTable} SET running = true, updated_at = NOW() WHERE key = ${MAINTENANCE_KEY} AND running = false RETURNING key`
    );
  });
  return Number(result.rowCount ?? 0) > 0;
}

async function releaseLock(markLastRun: boolean): Promise<void> {
  await withAdminBypass(async (scopedDb) => {
    if (markLastRun) {
      await scopedDb
        .update(maintenanceStateTable)
        .set({ running: false, lastRunAt: new Date(), updatedAt: new Date() })
        .where(eq(maintenanceStateTable.key, MAINTENANCE_KEY));
    } else {
      await scopedDb
        .update(maintenanceStateTable)
        .set({ running: false, updatedAt: new Date() })
        .where(eq(maintenanceStateTable.key, MAINTENANCE_KEY));
    }
  });
}

async function getLastRunAt(): Promise<Date | null> {
  const rows = await withAdminBypass(async (scopedDb) => {
    return scopedDb
      .select({ lastRunAt: maintenanceStateTable.lastRunAt })
      .from(maintenanceStateTable)
      .where(eq(maintenanceStateTable.key, MAINTENANCE_KEY));
  });
  return rows[0]?.lastRunAt ?? null;
}

async function clearStaleRunningFlag(): Promise<void> {
  await withAdminBypass(async (scopedDb) => {
    await scopedDb.execute(
      sql`UPDATE ${maintenanceStateTable} SET running = false, updated_at = NOW() WHERE key = ${MAINTENANCE_KEY} AND running = true AND updated_at < NOW() - INTERVAL '10 minutes'`
    );
  });
}

async function runMaintenance(): Promise<void> {
  try {
    await clearStaleRunningFlag();
  } catch (err) {
    console.warn("[db-maintenance] Failed to clear stale running flag:", err instanceof Error ? err.message : err);
  }

  let acquired = false;
  try {
    acquired = await tryAcquireLock();
  } catch (err) {
    console.warn("[db-maintenance] Failed to acquire lock:", err instanceof Error ? err.message : err);
    return;
  }

  if (!acquired) {
    console.log("[db-maintenance] Skipping run — another instance is already running");
    return;
  }

  try {
    try {
      const sessionsDeleted = await cleanExpiredSessions();
      if (sessionsDeleted > 0) {
        console.log(`[db-maintenance] Cleaned ${sessionsDeleted} expired sessions`);
      }
    } catch (err) {
      console.warn("[db-maintenance] Session cleanup failed:", err instanceof Error ? err.message : err);
    }

    try {
      const analyticsDeleted = await pruneOldAnalytics();
      if (analyticsDeleted > 0) {
        console.log(`[db-maintenance] Pruned ${analyticsDeleted} analytics logs older than ${ANALYTICS_RETENTION_DAYS} days`);
      }
    } catch (err) {
      console.warn("[db-maintenance] Analytics pruning failed:", err instanceof Error ? err.message : err);
    }

    try {
      const conversationsDeleted = await pruneOldConversations();
      if (conversationsDeleted > 0) {
        console.log(`[db-maintenance] Pruned ${conversationsDeleted} conversations older than ${CONVERSATION_RETENTION_DAYS} days`);
      }
    } catch (err) {
      console.warn("[db-maintenance] Conversation pruning failed:", err instanceof Error ? err.message : err);
    }

    try {
      const oauthDeleted = await cleanExpiredOAuthStates();
      if (oauthDeleted > 0) {
        console.log(`[db-maintenance] Cleaned ${oauthDeleted} expired OAuth states`);
      }
    } catch (err) {
      console.warn("[db-maintenance] OAuth state cleanup failed:", err instanceof Error ? err.message : err);
    }

    try {
      const consentDataDeleted = await purgeExpiredConsentData();
      if (consentDataDeleted > 0) {
        console.log(`[db-maintenance] Purged ${consentDataDeleted} expired consent/preference records`);
      }
    } catch (err) {
      console.warn("[db-maintenance] Consent data purging failed:", err instanceof Error ? err.message : err);
    }

    await releaseLock(true);
  } catch (err) {
    console.error("[db-maintenance] Unexpected error during maintenance:", err instanceof Error ? err.message : err);
    try {
      await releaseLock(false);
    } catch {
    }
  }
}

let maintenanceTimer: ReturnType<typeof setTimeout> | null = null;
let maintenanceInterval: ReturnType<typeof setInterval> | null = null;
let currentMaintenancePromise: Promise<void> | null = null;

function runMaintenanceTracked(): void {
  currentMaintenancePromise = runMaintenance()
    .catch((err) => {
      console.error("[db-maintenance] Unhandled maintenance error:", err instanceof Error ? err.message : err);
    })
    .finally(() => {
      currentMaintenancePromise = null;
    });
}

export async function waitForMaintenance(): Promise<void> {
  if (currentMaintenancePromise) {
    await currentMaintenancePromise;
  }
}

export async function startDbMaintenance(): Promise<void> {
  try {
    await ensureMaintenanceRow();
  } catch (err) {
    console.warn("[db-maintenance] Failed to ensure maintenance row, will create on first run:", err instanceof Error ? err.message : err);
  }

  let delayMs = 0;
  try {
    const lastRun = await getLastRunAt();
    if (lastRun) {
      const elapsed = Date.now() - lastRun.getTime();
      const remaining = CLEANUP_INTERVAL_MS - elapsed;
      if (remaining > 0) {
        delayMs = remaining;
        console.log(`[db-maintenance] Last run was ${Math.round(elapsed / 1000)}s ago, scheduling next run in ${Math.round(remaining / 1000)}s`);
      }
    }
  } catch (err) {
    console.warn("[db-maintenance] Failed to check last run time:", err instanceof Error ? err.message : err);
  }

  maintenanceTimer = setTimeout(() => {
    maintenanceTimer = null;
    runMaintenanceTracked();
    maintenanceInterval = setInterval(runMaintenanceTracked, CLEANUP_INTERVAL_MS);
  }, delayMs);
}

export function stopDbMaintenance(): void {
  if (maintenanceTimer) {
    clearTimeout(maintenanceTimer);
    maintenanceTimer = null;
  }
  if (maintenanceInterval) {
    clearInterval(maintenanceInterval);
    maintenanceInterval = null;
  }
}
