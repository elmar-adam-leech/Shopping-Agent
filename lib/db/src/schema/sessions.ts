import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  storeDomain: text("store_domain").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("idx_sessions_expires_at").on(table.expiresAt),
]);

export type Session = typeof sessionsTable.$inferSelect;
