import { pgTable, serial, text, integer, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { storesTable } from "./stores";

export const knowledgeCategoryEnum = pgEnum("knowledge_category", [
  "general",
  "sizing",
  "compatibility",
  "required_accessories",
  "restrictions",
  "policies",
  "custom",
]);

export const shopKnowledgeTable = pgTable("shop_knowledge", {
  id: serial("id").primaryKey(),
  storeDomain: text("store_domain")
    .notNull()
    .references(() => storesTable.storeDomain, { onDelete: "cascade" }),
  category: knowledgeCategoryEnum("category").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_shop_knowledge_store_category").on(table.storeDomain, table.category),
]);

export const insertKnowledgeSchema = createInsertSchema(shopKnowledgeTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKnowledge = z.infer<typeof insertKnowledgeSchema>;
export type ShopKnowledge = typeof shopKnowledgeTable.$inferSelect;
