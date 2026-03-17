import { pgTable, serial, text, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { storesTable } from "./stores";

export const userPreferencesTable = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  storeDomain: text("store_domain")
    .notNull()
    .references(() => storesTable.storeDomain, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull(),
  prefs: jsonb("prefs").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("idx_user_preferences_store_session").on(table.storeDomain, table.sessionId),
]);

export const insertPreferencesSchema = createInsertSchema(userPreferencesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPreferences = z.infer<typeof insertPreferencesSchema>;
export type UserPreferences = typeof userPreferencesTable.$inferSelect;
