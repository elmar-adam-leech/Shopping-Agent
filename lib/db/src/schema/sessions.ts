import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { storesTable } from "./stores";

export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  storeDomain: text("store_domain")
    .notNull()
    .references(() => storesTable.storeDomain, { onDelete: "cascade" }),
  experimentId: text("experiment_id"),
  experimentVariant: text("experiment_variant"),
  detectedLanguage: text("detected_language"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("idx_sessions_expires_at").on(table.expiresAt),
  index("idx_sessions_store_expires").on(table.storeDomain, table.expiresAt),
]);

export type Session = typeof sessionsTable.$inferSelect;
