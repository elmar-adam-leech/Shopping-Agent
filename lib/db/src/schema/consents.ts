import { pgTable, serial, text, jsonb, timestamp, boolean, uniqueIndex, index, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { storesTable } from "./stores";

export interface ConsentCategories {
  conversationHistory: boolean;
  preferenceStorage: boolean;
  orderHistoryAccess: boolean;
  analytics: boolean;
}

export const userConsentsTable = pgTable("user_consents", {
  id: serial("id").primaryKey(),
  storeDomain: text("store_domain")
    .notNull()
    .references(() => storesTable.storeDomain, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull(),
  categories: jsonb("categories").$type<ConsentCategories>().notNull().default({
    conversationHistory: false,
    preferenceStorage: false,
    orderHistoryAccess: false,
    analytics: false,
  }),
  consentVersion: integer("consent_version").notNull().default(1),
  grantedAt: timestamp("granted_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deleted: boolean("deleted").notNull().default(false),
}, (table) => [
  uniqueIndex("idx_user_consents_store_session").on(table.storeDomain, table.sessionId),
  index("idx_user_consents_deleted").on(table.deleted),
]);

export const consentCategoriesSchema = z.object({
  conversationHistory: z.boolean(),
  preferenceStorage: z.boolean(),
  orderHistoryAccess: z.boolean(),
  analytics: z.boolean(),
});

export const insertConsentSchema = createInsertSchema(userConsentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertConsent = z.infer<typeof insertConsentSchema>;
export type UserConsent = typeof userConsentsTable.$inferSelect;
