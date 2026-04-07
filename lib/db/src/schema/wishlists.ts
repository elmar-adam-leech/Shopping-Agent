import { pgTable, serial, text, jsonb, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { storesTable } from "./stores";

export interface WishlistItem {
  productId: string;
  variantId?: string;
  title: string;
  handle?: string;
  imageUrl?: string;
  price?: string;
  currencyCode?: string;
  addedAt: string;
}

export const wishlistsTable = pgTable("wishlists", {
  id: serial("id").primaryKey(),
  storeDomain: text("store_domain")
    .notNull()
    .references(() => storesTable.storeDomain, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull(),
  items: jsonb("items").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("idx_wishlists_store_session").on(table.storeDomain, table.sessionId),
  index("idx_wishlists_store_domain").on(table.storeDomain),
]);

export const insertWishlistSchema = createInsertSchema(wishlistsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWishlist = z.infer<typeof insertWishlistSchema>;
export type Wishlist = typeof wishlistsTable.$inferSelect;
