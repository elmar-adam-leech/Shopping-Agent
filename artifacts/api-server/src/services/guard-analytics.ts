import { analyticsLogsTable, withTenantScope } from "@workspace/db";

export async function logGuardEvent(
  storeDomain: string,
  sessionId: string,
  eventType: string,
  query: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await withTenantScope(storeDomain, async (scopedDb) => {
      await scopedDb.insert(analyticsLogsTable).values({
        storeDomain,
        eventType,
        query: query.slice(0, 500),
        sessionId,
        metadata,
      });
    });
  } catch (err) {
    console.error(`[prompt-guard] Failed to log guard event:`, err instanceof Error ? err.message : err);
  }
}
