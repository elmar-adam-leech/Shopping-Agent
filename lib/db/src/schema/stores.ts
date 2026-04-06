import { pgTable, text, timestamp, pgEnum, boolean, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const providerEnum = pgEnum("provider", ["openai", "anthropic", "xai", "gemini"]);
export const guardSensitivityEnum = pgEnum("guard_sensitivity", ["off", "low", "medium", "high"]);

export interface UCPCapabilitiesJson {
  version: string;
  services: Array<{
    type: string;
    transport?: string;
    url?: string;
    capabilities?: string[];
  }>;
  paymentHandlers: Array<{
    type: string;
    supportedMethods?: string[];
  }>;
  businessName?: string;
  businessUrl?: string;
  businessDescription?: string;
}

export const storesTable = pgTable("stores", {
  storeDomain: text("store_domain").primaryKey(),
  storefrontToken: text("storefront_token"),
  accessToken: text("access_token"),
  provider: providerEnum("provider").notNull().default("openai"),
  model: text("model").notNull().default("gpt-4o"),
  apiKey: text("api_key"),
  ucpCompliant: boolean("ucp_compliant").notNull().default(true),
  chatEnabled: boolean("chat_enabled").notNull().default(true),
  embedEnabled: boolean("embed_enabled").notNull().default(false),
  customerAccountClientId: text("customer_account_client_id"),
  guardSensitivity: guardSensitivityEnum("guard_sensitivity").notNull().default("medium"),
  blockedTopics: text("blocked_topics").array().notNull().default([]),
  ucpCapabilities: jsonb("ucp_capabilities").$type<UCPCapabilitiesJson | null>(),
  ucpLastDiscoveredAt: timestamp("ucp_last_discovered_at", { withTimezone: true }),
  ucpRefreshIntervalMs: integer("ucp_refresh_interval_ms").notNull().default(3600000),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStoreSchema = createInsertSchema(storesTable);
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type Store = typeof storesTable.$inferSelect;
