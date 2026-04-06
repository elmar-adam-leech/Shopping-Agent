import { db, analyticsLogsTable } from "@workspace/db";

export async function logAnalyticsEvent(
  storeDomain: string,
  eventType: string,
  sessionId: string,
  extra?: { query?: string },
): Promise<boolean> {
  try {
    await db.insert(analyticsLogsTable).values({
      storeDomain,
      eventType,
      sessionId,
      ...(extra?.query !== undefined ? { query: extra.query } : {}),
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
