import { db, analyticsLogsTable } from "@workspace/db";

export async function logAnalyticsEvent(
  storeDomain: string,
  eventType: string,
  sessionId: string,
  extra?: { query?: string; metadata?: Record<string, unknown> },
): Promise<boolean> {
  try {
    await db.insert(analyticsLogsTable).values({
      storeDomain,
      eventType,
      sessionId,
      ...(extra?.query !== undefined ? { query: extra.query } : {}),
      ...(extra?.metadata !== undefined ? { metadata: extra.metadata } : {}),
    });
    return true;
  } catch (err) {
    console.warn(
      `[analytics-logger] Failed to log event="${eventType}" store="${storeDomain}":`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}
