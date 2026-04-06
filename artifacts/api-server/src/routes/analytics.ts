import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db, analyticsLogsTable } from "@workspace/db";
import {
  GetAnalyticsParams,
  GetAnalyticsQueryParams,
  GetAnalyticsResponse,
  GetEnhancedAnalyticsParams,
  GetEnhancedAnalyticsQueryParams,
  GetEnhancedAnalyticsResponse,
  GetDailyQueriesParams,
  GetDailyQueriesResponse,
} from "@workspace/api-zod";
import { validateStoreDomain } from "../middleware";
import { validateMerchantAuth } from "../middleware";
import { sendZodError, sendError } from "../lib/error-response";

const router: IRouter = Router();

function computeDateRange(query: { days?: number; startDate?: string | Date; endDate?: string | Date }): { since: Date; until: Date } {
  const now = new Date();

  if (query.startDate && query.endDate) {
    const start = typeof query.startDate === "string" ? new Date(query.startDate) : query.startDate;
    const end = typeof query.endDate === "string" ? new Date(query.endDate) : query.endDate;
    end.setHours(23, 59, 59, 999);
    return { since: start, until: end };
  }

  const days = query.days ?? 7;
  const since = new Date();
  since.setDate(since.getDate() - days);
  return { since, until: now };
}

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

router.get("/stores/:storeDomain/analytics/enhanced", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const params = GetEnhancedAnalyticsParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "GET /stores/:storeDomain/analytics/enhanced", req.params);
    return;
  }

  const rawQuery = req.query as Record<string, string | undefined>;
  const parsedDays = rawQuery.days ? parseInt(rawQuery.days, 10) : undefined;
  if (rawQuery.days !== undefined && (isNaN(parsedDays!) || parsedDays! < 1 || parsedDays! > 365)) {
    sendError(res, 400, "Invalid 'days' parameter. Must be an integer between 1 and 365.");
    return;
  }
  if (rawQuery.startDate && isNaN(new Date(rawQuery.startDate).getTime())) {
    sendError(res, 400, "Invalid 'startDate' parameter. Use YYYY-MM-DD format.");
    return;
  }
  if (rawQuery.endDate && isNaN(new Date(rawQuery.endDate).getTime())) {
    sendError(res, 400, "Invalid 'endDate' parameter. Use YYYY-MM-DD format.");
    return;
  }
  if (rawQuery.startDate && rawQuery.endDate && new Date(rawQuery.startDate) > new Date(rawQuery.endDate)) {
    sendError(res, 400, "'startDate' must be before 'endDate'.");
    return;
  }

  const { since, until } = computeDateRange({
    days: parsedDays ?? 7,
    startDate: rawQuery.startDate,
    endDate: rawQuery.endDate,
  });

  const baseCondition = and(
    eq(analyticsLogsTable.storeDomain, params.data.storeDomain),
    gte(analyticsLogsTable.createdAt, since),
    lte(analyticsLogsTable.createdAt, until)
  );

  const [
    countsResult,
    topQueriesResult,
    dailyChatsResult,
    toolUsageResult,
    funnelResult,
    topProductsResult,
    abandonedCartsResult,
    revenueResult,
  ] = await Promise.all([
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

    db
      .select({
        toolName: sql<string>`${analyticsLogsTable.metadata}->>'toolName'`,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsLogsTable)
      .where(and(baseCondition, sql`${analyticsLogsTable.eventType} = 'tool_call'`))
      .groupBy(sql`${analyticsLogsTable.metadata}->>'toolName'`)
      .orderBy(sql`count(*) desc`)
      .limit(15),

    db
      .select({
        totalChats: sql<number>`count(*) filter (where ${analyticsLogsTable.eventType} = 'chat')::int`,
        cartCreated: sql<number>`count(*) filter (where ${analyticsLogsTable.eventType} = 'cart_created')::int`,
        checkoutStarted: sql<number>`count(*) filter (where ${analyticsLogsTable.eventType} = 'checkout_started')::int`,
        checkoutCompleted: sql<number>`count(*) filter (where ${analyticsLogsTable.eventType} = 'checkout_completed')::int`,
      })
      .from(analyticsLogsTable)
      .where(baseCondition),

    db
      .select({
        productHandle: sql<string>`${analyticsLogsTable.metadata}->>'productHandle'`,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsLogsTable)
      .where(and(baseCondition, sql`${analyticsLogsTable.eventType} = 'product_recommended'`))
      .groupBy(sql`${analyticsLogsTable.metadata}->>'productHandle'`)
      .orderBy(sql`count(*) desc`)
      .limit(10),

    db
      .select({
        count: sql<number>`count(distinct ${analyticsLogsTable.sessionId})::int`,
      })
      .from(analyticsLogsTable)
      .where(and(
        baseCondition,
        sql`${analyticsLogsTable.eventType} = 'cart_created'`,
        sql`${analyticsLogsTable.sessionId} not in (
          select ${analyticsLogsTable.sessionId} from ${analyticsLogsTable}
          where ${analyticsLogsTable.storeDomain} = ${params.data.storeDomain}
            and ${analyticsLogsTable.createdAt} >= ${since}
            and ${analyticsLogsTable.createdAt} <= ${until}
            and ${analyticsLogsTable.eventType} = 'checkout_completed'
        )`
      )),

    db
      .select({
        total: sql<number>`coalesce(sum((${analyticsLogsTable.metadata}->>'orderTotal')::numeric), 0)::float`,
      })
      .from(analyticsLogsTable)
      .where(and(baseCondition, sql`${analyticsLogsTable.eventType} = 'checkout_completed'`)),
  ]);

  const totalChats = countsResult[0]?.totalChats ?? 0;
  const totalSessions = countsResult[0]?.totalSessions ?? 0;
  const topQueries = topQueriesResult.map(r => ({ query: r.query, count: r.count }));
  const dailyChats = dailyChatsResult.map(r => ({ date: r.date, count: r.count }));
  const toolUsage = toolUsageResult
    .filter(r => r.toolName)
    .map(r => ({ toolName: r.toolName, count: r.count }));
  const conversionFunnel = {
    totalChats: funnelResult[0]?.totalChats ?? 0,
    cartCreated: funnelResult[0]?.cartCreated ?? 0,
    checkoutStarted: funnelResult[0]?.checkoutStarted ?? 0,
    checkoutCompleted: funnelResult[0]?.checkoutCompleted ?? 0,
  };
  const topProducts = topProductsResult
    .filter(r => r.productHandle)
    .map(r => ({ productHandle: r.productHandle, count: r.count }));
  const abandonedCarts = abandonedCartsResult[0]?.count ?? 0;
  const estimatedRevenue = revenueResult[0]?.total ?? 0;

  res.json(
    GetEnhancedAnalyticsResponse.parse({
      totalChats,
      totalSessions,
      topQueries,
      dailyChats,
      toolUsage,
      conversionFunnel,
      topProducts,
      abandonedCarts,
      estimatedRevenue,
    })
  );
});

router.get("/stores/:storeDomain/analytics/daily-queries", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const params = GetDailyQueriesParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "GET /stores/:storeDomain/analytics/daily-queries", req.params);
    return;
  }

  const dateStr = req.query.date as string | undefined;
  if (!dateStr) {
    sendError(res, 400, "Missing required query parameter: date");
    return;
  }

  const targetDate = new Date(dateStr);
  if (isNaN(targetDate.getTime())) {
    sendError(res, 400, "Invalid date format. Use YYYY-MM-DD.");
    return;
  }

  const dayStart = new Date(dateStr + "T00:00:00.000Z");
  const dayEnd = new Date(dateStr + "T23:59:59.999Z");

  const [queriesResult, countResult] = await Promise.all([
    db
      .select({
        query: sql<string>`lower(trim(${analyticsLogsTable.query}))`,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsLogsTable)
      .where(and(
        eq(analyticsLogsTable.storeDomain, params.data.storeDomain),
        gte(analyticsLogsTable.createdAt, dayStart),
        lte(analyticsLogsTable.createdAt, dayEnd),
        sql`${analyticsLogsTable.query} is not null`
      ))
      .groupBy(sql`lower(trim(${analyticsLogsTable.query}))`)
      .orderBy(sql`count(*) desc`)
      .limit(20),

    db
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(analyticsLogsTable)
      .where(and(
        eq(analyticsLogsTable.storeDomain, params.data.storeDomain),
        gte(analyticsLogsTable.createdAt, dayStart),
        lte(analyticsLogsTable.createdAt, dayEnd)
      )),
  ]);

  res.json(
    GetDailyQueriesResponse.parse({
      date: dateStr,
      queries: queriesResult.map(r => ({ query: r.query, count: r.count })),
      totalEvents: countResult[0]?.total ?? 0,
    })
  );
});

export default router;
