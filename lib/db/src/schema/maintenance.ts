import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const maintenanceStateTable = pgTable("maintenance_state", {
  key: text("key").primaryKey(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  running: boolean("running").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
