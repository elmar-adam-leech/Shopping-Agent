import { Router, type IRouter } from "express";
import { eq, and, gte, sql } from "drizzle-orm";
import { db, analyticsLogsTable } from "@workspace/db";
import {
  GetAnalyticsParams,
  GetAnalyticsQueryParams,
  GetAnalyticsResponse,
} from "@workspace/api-zod";
import { validateStoreDomain } from "../services/tenant-validator";
import { validateMerchantAuth } from "../services/merchant-auth";

const router: IRouter = Router();

router.get("/stores/:storeDomain/analytics", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const params = GetAnalyticsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const query = GetAnalyticsQueryParams.safeParse(req.query);
  const days = query.success ? (query.data.days ?? 7) : 7;

  const since = new Date();
  since.setDate(since.getDate() - days);

  const baseCondition = and(
    eq(analyticsLogsTable.storeDomain, params.data.storeDomain),
    gte(analyticsLogsTable.createdAt, since)
  );

  const [chatCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(analyticsLogsTable)
    .where(and(baseCondition, eq(analyticsLogsTable.eventType, "chat")));
  const totalChats = chatCountResult?.count ?? 0;

  const [sessionCountResult] = await db
    .select({ count: sql<number>`count(distinct ${analyticsLogsTable.sessionId})::int` })
    .from(analyticsLogsTable)
    .where(baseCondition);
  const totalSessions = sessionCountResult?.count ?? 0;

  const topQueriesResult = await db
    .select({
      query: sql<string>`lower(trim(${analyticsLogsTable.query}))`,
      count: sql<number>`count(*)::int`,
    })
    .from(analyticsLogsTable)
    .where(and(baseCondition, sql`${analyticsLogsTable.query} is not null`))
    .groupBy(sql`lower(trim(${analyticsLogsTable.query}))`)
    .orderBy(sql`count(*) desc`)
    .limit(10);
  const topQueries = topQueriesResult.map(r => ({ query: r.query, count: r.count }));

  const dailyChatsResult = await db
    .select({
      date: sql<string>`${analyticsLogsTable.createdAt}::date::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(analyticsLogsTable)
    .where(baseCondition)
    .groupBy(sql`${analyticsLogsTable.createdAt}::date`)
    .orderBy(sql`${analyticsLogsTable.createdAt}::date asc`);
  const dailyChats = dailyChatsResult.map(r => ({ date: r.date, count: r.count }));

  res.json(
    GetAnalyticsResponse.parse({
      totalChats,
      totalSessions,
      topQueries,
      dailyChats,
    })
  );
});

export default router;
