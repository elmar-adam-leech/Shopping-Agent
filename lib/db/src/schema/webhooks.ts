import { pgTable, text, timestamp, boolean, jsonb, integer, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";
import { storesTable } from "./stores";

export const webhookRegistrationsTable = pgTable("webhook_registrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeDomain: text("store_domain")
    .notNull()
    .references(() => storesTable.storeDomain),
  topic: text("topic").notNull(),
  shopifyWebhookId: text("shopify_webhook_id"),
  callbackUrl: text("callback_url").notNull(),
  active: boolean("active").notNull().default(true),
  registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
  lastDeliveryAt: timestamp("last_delivery_at", { withTimezone: true }),
  failureCount: integer("failure_count").notNull().default(0),
}, (table) => [
  uniqueIndex("webhook_reg_store_topic_idx").on(table.storeDomain, table.topic),
]);

export type WebhookRegistration = typeof webhookRegistrationsTable.$inferSelect;

export const webhookDeliveryLogsTable = pgTable("webhook_delivery_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeDomain: text("store_domain")
    .notNull()
    .references(() => storesTable.storeDomain),
  topic: text("topic").notNull(),
  shopifyWebhookId: text("shopify_webhook_id"),
  payload: jsonb("payload"),
  status: text("status").notNull().default("received"),
  processingTimeMs: integer("processing_time_ms"),
  error: text("error"),
  idempotencyKey: text("idempotency_key"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("webhook_delivery_store_idx").on(table.storeDomain),
  index("webhook_delivery_received_idx").on(table.receivedAt),
]);

export type WebhookDeliveryLog = typeof webhookDeliveryLogsTable.$inferSelect;
