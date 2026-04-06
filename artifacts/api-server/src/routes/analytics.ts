import { Router, type IRouter } from "express";
import { eq, and, gte, sql } from "drizzle-orm";
import { db, analyticsLogsTable } from "@workspace/db";
import {
  GetAnalyticsParams,
  GetAnalyticsQueryParams,
  GetAnalyticsResponse,
} from "@workspace/api-zod";
import { validateStoreDomain } from "../middleware";
import { validateMerchantAuth } from "../middleware";
import { sendZodError } from "../lib/error-response";

const router: IRouter = Router();

router.get("/stores/:storeDomain/analytics", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const params = GetAnalyticsParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "GET /stores/:storeDomain/analytics", req.params);
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

  const [countsResult, topQueriesResult, dailyChatsResult] = await Promise.all([
    db
      .select({
        totalChats: sql<number>`count(*) filter (where ${analyticsLogsTable.eventType} = 'chat')::int`,
        totalSessions: sql<number>`count(distinct ${analyticsLogsTable.sessionId})::int`,
      })
      .from(analyticsLogsTable)
      .where(baseCondition),

    db
      .select({
        query: sql<string>`lower(trim(${analyticsLogsTable.query}))`,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsLogsTable)
      .where(and(baseCondition, sql`${analyticsLogsTable.query} is not null`))
      .groupBy(sql`lower(trim(${analyticsLogsTable.query}))`)
      .orderBy(sql`count(*) desc`)
      .limit(10),

    db
      .select({
        date: sql<string>`${analyticsLogsTable.createdAt}::date::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsLogsTable)
      .where(baseCondition)
      .groupBy(sql`${analyticsLogsTable.createdAt}::date`)
      .orderBy(sql`${analyticsLogsTable.createdAt}::date asc`),
  ]);

  const totalChats = countsResult[0]?.totalChats ?? 0;
  const totalSessions = countsResult[0]?.totalSessions ?? 0;
  const topQueries = topQueriesResult.map(r => ({ query: r.query, count: r.count }));
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
