import { pgTable, text, timestamp, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { storesTable } from "./stores";

export const experimentStatusEnum = pgEnum("experiment_status", ["active", "completed", "archived"]);

export interface ExperimentVariantConfig {
  brandVoice?: {
    tone: "friendly" | "professional" | "playful" | "luxury";
    personality?: string;
    greeting?: string;
    signOff?: string;
  } | null;
  customInstructions?: string | null;
  recommendationStrategy?: string;
}

export const promptExperimentsTable = pgTable("prompt_experiments", {
  id: text("id").primaryKey(),
  storeDomain: text("store_domain")
    .notNull()
    .references(() => storesTable.storeDomain, { onDelete: "cascade" }),
  name: text("name").notNull(),
  variantA: jsonb("variant_a").notNull().$type<ExperimentVariantConfig>(),
  variantB: jsonb("variant_b").notNull().$type<ExperimentVariantConfig>(),
  splitRatio: integer("split_ratio").notNull().default(50),
  status: experimentStatusEnum("status").notNull().default("active"),
  winner: text("winner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type PromptExperiment = typeof promptExperimentsTable.$inferSelect;
