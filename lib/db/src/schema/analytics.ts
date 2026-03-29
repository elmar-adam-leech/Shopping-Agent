import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { storesTable } from "./stores";

export const analyticsLogsTable = pgTable("analytics_logs", {
  id: serial("id").primaryKey(),
  storeDomain: text("store_domain")
    .notNull()
    .references(() => storesTable.storeDomain, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  query: text("query"),
  sessionId: text("session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_analytics_store_created").on(table.storeDomain, table.createdAt),
  index("idx_analytics_event_type").on(table.eventType),
  index("idx_analytics_store_created_event").on(table.storeDomain, table.createdAt, table.eventType),
  index("idx_analytics_query_notnull").on(table.storeDomain, table.query).where(sql`query IS NOT NULL`),
  index("idx_analytics_session").on(table.sessionId),
  index("idx_analytics_query_normalized").using("btree", sql`lower(trim(${table.query}))`).where(sql`${table.query} is not null`),
]);

export const insertAnalyticsSchema = createInsertSchema(analyticsLogsTable).omit({ id: true, createdAt: true });
export type InsertAnalytics = z.infer<typeof insertAnalyticsSchema>;
export type AnalyticsLog = typeof analyticsLogsTable.$inferSelect;
