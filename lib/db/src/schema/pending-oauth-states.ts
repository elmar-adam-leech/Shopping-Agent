import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const pendingOAuthStatesTable = pgTable("pending_oauth_states", {
  state: text("state").primaryKey(),
  shop: text("shop").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => [
  index("idx_pending_oauth_expires").on(table.expiresAt),
]);
