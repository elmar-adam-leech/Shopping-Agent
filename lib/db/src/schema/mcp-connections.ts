import { pgTable, serial, text, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { storesTable } from "./stores";
import { sessionsTable } from "./sessions";

export const mcpTypeEnum = pgEnum("mcp_type", ["storefront", "customer_account", "ucp"]);

export const mcpConnectionsTable = pgTable("mcp_connections", {
  id: serial("id").primaryKey(),
  storeDomain: text("store_domain")
    .notNull()
    .references(() => storesTable.storeDomain, { onDelete: "cascade" }),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessionsTable.id, { onDelete: "cascade" }),
  mcpType: mcpTypeEnum("mcp_type").notNull().default("storefront"),
  clientId: text("client_id"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  mcpApiUrl: text("mcp_api_url"),
  authorizationEndpoint: text("authorization_endpoint"),
  tokenEndpoint: text("token_endpoint"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_mcp_connections_unique").on(table.storeDomain, table.sessionId, table.mcpType),
]);

export type McpConnection = typeof mcpConnectionsTable.$inferSelect;
