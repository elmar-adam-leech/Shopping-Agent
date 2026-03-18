import { db, sessionsTable, analyticsLogsTable } from "@workspace/db";
import { lt, sql } from "drizzle-orm";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const rawRetention = parseInt(process.env.ANALYTICS_RETENTION_DAYS || "90", 10);
const ANALYTICS_RETENTION_DAYS = Number.isFinite(rawRetention) && rawRetention >= 1 ? rawRetention : 90;

async function cleanExpiredSessions(): Promise<number> {
  const result = await db
    .delete(sessionsTable)
    .where(lt(sessionsTable.expiresAt, new Date()))
    .returning({ id: sessionsTable.id });
  return result.length;
}

async function pruneOldAnalytics(): Promise<number> {
  const cutoff = new Date(Date.now() - ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await db
    .delete(analyticsLogsTable)
    .where(lt(analyticsLogsTable.createdAt, cutoff))
    .returning({ id: analyticsLogsTable.id });
  return result.length;
}

async function runMaintenance(): Promise<void> {
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
}

let maintenanceInterval: ReturnType<typeof setInterval> | null = null;

export function startDbMaintenance(): void {
  runMaintenance();
  maintenanceInterval = setInterval(runMaintenance, CLEANUP_INTERVAL_MS);
}

export function stopDbMaintenance(): void {
  if (maintenanceInterval) {
    clearInterval(maintenanceInterval);
    maintenanceInterval = null;
  }
}
