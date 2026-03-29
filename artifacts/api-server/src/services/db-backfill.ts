import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function backfillMessageCounts(): Promise<void> {
  try {
    const result = await db.execute(sql`
      UPDATE conversations
      SET message_count = jsonb_array_length(messages)
      WHERE message_count = 0
        AND jsonb_array_length(messages) > 0
    `);
    const rowCount = (result as { rowCount?: number }).rowCount ?? 0;
    if (rowCount > 0) {
      console.log(`[backfill] Updated message_count for ${rowCount} existing conversations`);
    }
  } catch (err) {
    console.warn("[backfill] message_count backfill failed (non-fatal):", err instanceof Error ? err.message : err);
  }
}
