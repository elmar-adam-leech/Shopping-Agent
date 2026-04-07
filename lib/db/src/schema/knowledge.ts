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

export const knowledgeSourceEnum = pgEnum("knowledge_source", [
  "manual",
  "synced",
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
  tags: text("tags").array().notNull().default([]),
  source: knowledgeSourceEnum("source").notNull().default("manual"),
  sourceId: text("source_id"),
  contentHash: text("content_hash"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("idx_shop_knowledge_store_category").on(table.storeDomain, table.category),
  index("idx_shop_knowledge_source").on(table.storeDomain, table.source),
  index("idx_shop_knowledge_source_id").on(table.storeDomain, table.sourceId),
]);

export const knowledgeVersionsTable = pgTable("knowledge_versions", {
  id: serial("id").primaryKey(),
  knowledgeId: integer("knowledge_id")
    .notNull()
    .references(() => shopKnowledgeTable.id, { onDelete: "cascade" }),
  storeDomain: text("store_domain")
    .notNull()
    .references(() => storesTable.storeDomain, { onDelete: "cascade" }),
  category: knowledgeCategoryEnum("category").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  tags: text("tags").array().notNull().default([]),
  versionNumber: integer("version_number").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_knowledge_versions_knowledge_id").on(table.knowledgeId),
  index("idx_knowledge_versions_store").on(table.storeDomain),
]);

export const insertKnowledgeSchema = createInsertSchema(shopKnowledgeTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKnowledge = z.infer<typeof insertKnowledgeSchema>;
export type ShopKnowledge = typeof shopKnowledgeTable.$inferSelect;
export type KnowledgeVersion = typeof knowledgeVersionsTable.$inferSelect;
