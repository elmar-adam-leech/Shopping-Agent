import { Router, type IRouter } from "express";
import { v4 as uuidv4 } from "uuid";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  promptExperimentsTable,
  sessionsTable,
  analyticsLogsTable,
  storesTable,
  withTenantScope,
} from "@workspace/db";
import type { ExperimentVariantConfig } from "@workspace/db/schema";
import { validateStoreDomain } from "../middleware";
import { validateMerchantAuth } from "../middleware";
import { sendError } from "../lib/error-response";

const router: IRouter = Router();

router.get("/stores/:storeDomain/experiments", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const storeDomain = req.params.storeDomain as string;

  const experiments = await withTenantScope(storeDomain, async (scopedDb) => {
    return scopedDb
      .select()
      .from(promptExperimentsTable)
      .where(eq(promptExperimentsTable.storeDomain, storeDomain))
      .orderBy(sql`${promptExperimentsTable.createdAt} desc`);
  });

  res.json(experiments);
});

router.post("/stores/:storeDomain/experiments", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const storeDomain = req.params.storeDomain as string;
  const { name, variantA, variantB, splitRatio } = req.body;

  if (!name || !variantA || !variantB) {
    sendError(res, 400, "Missing required fields: name, variantA, variantB");
    return;
  }

  const ratio = typeof splitRatio === "number" ? Math.min(100, Math.max(0, splitRatio)) : 50;

  const existing = await withTenantScope(storeDomain, async (scopedDb) => {
    return scopedDb
      .select()
      .from(promptExperimentsTable)
      .where(
        and(
          eq(promptExperimentsTable.storeDomain, storeDomain),
          eq(promptExperimentsTable.status, "active")
        )
      );
  });

  if (existing.length > 0) {
    sendError(res, 409, "An active experiment already exists for this store. Complete or archive it before creating a new one.");
    return;
  }

  const id = uuidv4();
  const now = new Date();

  await withTenantScope(storeDomain, async (scopedDb) => {
    await scopedDb.insert(promptExperimentsTable).values({
      id,
      storeDomain,
      name,
      variantA: variantA as ExperimentVariantConfig,
      variantB: variantB as ExperimentVariantConfig,
      splitRatio: ratio,
      status: "active",
      createdAt: now,
    });
  });

  const [created] = await withTenantScope(storeDomain, async (scopedDb) => {
    return scopedDb
      .select()
      .from(promptExperimentsTable)
      .where(eq(promptExperimentsTable.id, id));
  });

  res.status(201).json(created);
});

router.get("/stores/:storeDomain/experiments/:experimentId", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const storeDomain = req.params.storeDomain as string;
  const experimentId = req.params.experimentId as string;

  const [experiment] = await withTenantScope(storeDomain, async (scopedDb) => {
    return scopedDb
      .select()
      .from(promptExperimentsTable)
      .where(
        and(
          eq(promptExperimentsTable.id, experimentId),
          eq(promptExperimentsTable.storeDomain, storeDomain)
        )
      );
  });

  if (!experiment) {
    sendError(res, 404, "Experiment not found");
    return;
  }

  res.json(experiment);
});

router.post("/stores/:storeDomain/experiments/:experimentId/complete", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const storeDomain = req.params.storeDomain as string;
  const experimentId = req.params.experimentId as string;
  const { winner } = req.body;

  if (!winner || !["A", "B"].includes(winner)) {
    sendError(res, 400, "winner must be 'A' or 'B'");
    return;
  }

  const [experiment] = await withTenantScope(storeDomain, async (scopedDb) => {
    return scopedDb
      .select()
      .from(promptExperimentsTable)
      .where(
        and(
          eq(promptExperimentsTable.id, experimentId),
          eq(promptExperimentsTable.storeDomain, storeDomain)
        )
      );
  });

  if (!experiment) {
    sendError(res, 404, "Experiment not found");
    return;
  }

  if (experiment.status !== "active") {
    sendError(res, 400, "Only active experiments can be completed");
    return;
  }

  const winningConfig = winner === "A" ? experiment.variantA : experiment.variantB;

  await withTenantScope(storeDomain, async (scopedDb) => {
    await scopedDb
      .update(promptExperimentsTable)
      .set({
        status: "completed",
        winner,
        completedAt: new Date(),
      })
      .where(eq(promptExperimentsTable.id, experimentId));
  });

  const updateData: Record<string, unknown> = {};
  if (winningConfig.brandVoice !== undefined) {
    updateData.brandVoice = winningConfig.brandVoice;
  }
  if (winningConfig.customInstructions !== undefined) {
    updateData.customInstructions = winningConfig.customInstructions;
  }
  if (winningConfig.recommendationStrategy) {
    updateData.recommendationStrategy = winningConfig.recommendationStrategy;
  }

  if (Object.keys(updateData).length > 0) {
    await withTenantScope(storeDomain, async (scopedDb) => {
      await scopedDb
        .update(storesTable)
        .set(updateData)
        .where(eq(storesTable.storeDomain, storeDomain));
    });
  }

  const [updated] = await withTenantScope(storeDomain, async (scopedDb) => {
    return scopedDb
      .select()
      .from(promptExperimentsTable)
      .where(eq(promptExperimentsTable.id, experimentId));
  });

  res.json(updated);
});

router.post("/stores/:storeDomain/experiments/:experimentId/archive", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const storeDomain = req.params.storeDomain as string;
  const experimentId = req.params.experimentId as string;

  const [experiment] = await withTenantScope(storeDomain, async (scopedDb) => {
    return scopedDb
      .select()
      .from(promptExperimentsTable)
      .where(
        and(
          eq(promptExperimentsTable.id, experimentId),
          eq(promptExperimentsTable.storeDomain, storeDomain)
        )
      );
  });

  if (!experiment) {
    sendError(res, 404, "Experiment not found");
    return;
  }

  if (experiment.status === "archived") {
    sendError(res, 400, "Experiment is already archived");
    return;
  }

  await withTenantScope(storeDomain, async (scopedDb) => {
    await scopedDb
      .update(promptExperimentsTable)
      .set({ status: "archived" })
      .where(eq(promptExperimentsTable.id, experimentId));
  });

  const [updated] = await withTenantScope(storeDomain, async (scopedDb) => {
    return scopedDb
      .select()
      .from(promptExperimentsTable)
      .where(eq(promptExperimentsTable.id, experimentId));
  });

  res.json(updated);
});

router.get("/stores/:storeDomain/experiments/:experimentId/analytics", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const storeDomain = req.params.storeDomain as string;
  const experimentId = req.params.experimentId as string;

  const [experiment] = await withTenantScope(storeDomain, async (scopedDb) => {
    return scopedDb
      .select()
      .from(promptExperimentsTable)
      .where(
        and(
          eq(promptExperimentsTable.id, experimentId),
          eq(promptExperimentsTable.storeDomain, storeDomain)
        )
      );
  });

  if (!experiment) {
    sendError(res, 404, "Experiment not found");
    return;
  }

  const buildVariantMetrics = async (variant: string) => {
    const result = await withTenantScope(storeDomain, async (scopedDb) => {
      const sessionIds = scopedDb
        .select({ id: sessionsTable.id })
        .from(sessionsTable)
        .where(
          and(
            eq(sessionsTable.storeDomain, storeDomain),
            eq(sessionsTable.experimentId, experimentId),
            eq(sessionsTable.experimentVariant, variant)
          )
        );

      const [counts] = await scopedDb
        .select({
          sessionCount: sql<number>`count(distinct ${sessionsTable.id})::int`,
        })
        .from(sessionsTable)
        .where(
          and(
            eq(sessionsTable.storeDomain, storeDomain),
            eq(sessionsTable.experimentId, experimentId),
            eq(sessionsTable.experimentVariant, variant)
          )
        );

      const [chatCounts] = await scopedDb
        .select({
          totalChats: sql<number>`count(*) filter (where ${analyticsLogsTable.eventType} = 'chat')::int`,
          cartCreated: sql<number>`count(*) filter (where ${analyticsLogsTable.eventType} = 'cart_created')::int`,
          checkoutCompleted: sql<number>`count(*) filter (where ${analyticsLogsTable.eventType} = 'checkout_completed')::int`,
        })
        .from(analyticsLogsTable)
        .where(
          and(
            eq(analyticsLogsTable.storeDomain, storeDomain),
            sql`${analyticsLogsTable.sessionId} in (${sessionIds})`
          )
        );

      const toolUsage = await scopedDb
        .select({
          toolName: sql<string>`${analyticsLogsTable.metadata}->>'toolName'`,
          count: sql<number>`count(*)::int`,
        })
        .from(analyticsLogsTable)
        .where(
          and(
            eq(analyticsLogsTable.storeDomain, storeDomain),
            sql`${analyticsLogsTable.eventType} = 'tool_call'`,
            sql`${analyticsLogsTable.sessionId} in (${sessionIds})`
          )
        )
        .groupBy(sql`${analyticsLogsTable.metadata}->>'toolName'`)
        .orderBy(sql`count(*) desc`)
        .limit(10);

      const sessionCount = counts?.sessionCount ?? 0;
      const totalChats = chatCounts?.totalChats ?? 0;
      const cartCreated = chatCounts?.cartCreated ?? 0;
      const checkoutCompleted = chatCounts?.checkoutCompleted ?? 0;

      return {
        variant,
        sessionCount,
        totalChats,
        avgMessagesPerSession: sessionCount > 0 ? Math.round((totalChats / sessionCount) * 100) / 100 : 0,
        cartCreated,
        checkoutCompleted,
        conversionRate: sessionCount > 0 ? Math.round((checkoutCompleted / sessionCount) * 10000) / 100 : 0,
        toolUsage: toolUsage.filter(t => t.toolName).map(t => ({ toolName: t.toolName, count: t.count })),
      };
    });

    return result;
  };

  const [variantA, variantB] = await Promise.all([
    buildVariantMetrics("A"),
    buildVariantMetrics("B"),
  ]);

  res.json({
    experimentId: experiment.id,
    experimentName: experiment.name,
    status: experiment.status,
    variantA,
    variantB,
  });
});

export default router;
