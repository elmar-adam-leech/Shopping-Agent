import { pgTable, serial, text, jsonb, timestamp, index, pgEnum } from "drizzle-orm/pg-core";

export const auditActorEnum = pgEnum("audit_actor", ["merchant", "system", "customer"]);

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  storeDomain: text("store_domain").notNull(),
  actor: auditActorEnum("actor").notNull().default("system"),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  metadata: jsonb("metadata"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_audit_logs_store_created").on(table.storeDomain, table.createdAt),
  index("idx_audit_logs_action").on(table.action),
  index("idx_audit_logs_resource").on(table.resourceType, table.resourceId),
  index("idx_audit_logs_actor").on(table.actor, table.actorId),
]);

export type AuditLog = typeof auditLogsTable.$inferSelect;
