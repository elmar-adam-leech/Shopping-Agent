import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { analyticsLogsTable, withTenantScope } from "@workspace/db";
import {
  GetAnalyticsParams,
  GetAnalyticsQueryParams,
  GetAnalyticsResponse,
} from "@workspace/api-zod";

const GetEnhancedAnalyticsParams = GetAnalyticsParams;
const GetEnhancedAnalyticsQueryParams = GetAnalyticsQueryParams;
const GetEnhancedAnalyticsResponse = { parse: (v: unknown) => v };
const GetDailyQueriesParams = GetAnalyticsParams;
const GetDailyQueriesResponse = { parse: (v: unknown) => v };
import { validateStoreDomain } from "../middleware";
import { validateMerchantAuth } from "../middleware";
import { sendZodError, sendError } from "../lib/error-response";

type SectionName = "overview" | "daily_chats" | "top_queries" | "tool_usage" | "conversion_funnel" | "top_products";
const ALL_SECTIONS: SectionName[] = ["overview", "daily_chats", "top_queries", "tool_usage", "conversion_funnel", "top_products"];

function escapeCsvValue(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRows(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCsvValue).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvValue).join(","));
  }
  return lines.join("\n");
}

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

  const [countsResult, topQueriesResult, dailyChatsResult] = await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    return Promise.all([
      scopedDb
        .select({
          totalChats: sql<number>`count(*) filter (where ${analyticsLogsTable.eventType} = 'chat')::int`,
          totalSessions: sql<number>`count(distinct ${analyticsLogsTable.sessionId})::int`,
        })
        .from(analyticsLogsTable)
        .where(baseCondition),

      scopedDb
        .select({
          query: sql<string>`lower(trim(${analyticsLogsTable.query}))`,
          count: sql<number>`count(*)::int`,
        })
        .from(analyticsLogsTable)
        .where(and(baseCondition, sql`${analyticsLogsTable.query} is not null`))
        .groupBy(sql`lower(trim(${analyticsLogsTable.query}))`)
        .orderBy(sql`count(*) desc`)
        .limit(10),

      scopedDb
        .select({
          date: sql<string>`${analyticsLogsTable.createdAt}::date::text`,
          count: sql<number>`count(*)::int`,
        })
        .from(analyticsLogsTable)
        .where(baseCondition)
        .groupBy(sql`${analyticsLogsTable.createdAt}::date`)
        .orderBy(sql`${analyticsLogsTable.createdAt}::date asc`),
    ]);
  });

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
  ] = await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    return Promise.all([
      scopedDb
        .select({
          totalChats: sql<number>`count(*) filter (where ${analyticsLogsTable.eventType} = 'chat')::int`,
          totalSessions: sql<number>`count(distinct ${analyticsLogsTable.sessionId})::int`,
        })
        .from(analyticsLogsTable)
        .where(baseCondition),

      scopedDb
        .select({
          query: sql<string>`lower(trim(${analyticsLogsTable.query}))`,
          count: sql<number>`count(*)::int`,
        })
        .from(analyticsLogsTable)
        .where(and(baseCondition, sql`${analyticsLogsTable.query} is not null`))
        .groupBy(sql`lower(trim(${analyticsLogsTable.query}))`)
        .orderBy(sql`count(*) desc`)
        .limit(10),

      scopedDb
        .select({
          date: sql<string>`${analyticsLogsTable.createdAt}::date::text`,
          count: sql<number>`count(*)::int`,
        })
        .from(analyticsLogsTable)
        .where(baseCondition)
        .groupBy(sql`${analyticsLogsTable.createdAt}::date`)
        .orderBy(sql`${analyticsLogsTable.createdAt}::date asc`),

      scopedDb
        .select({
          toolName: sql<string>`${analyticsLogsTable.metadata}->>'toolName'`,
          count: sql<number>`count(*)::int`,
        })
        .from(analyticsLogsTable)
        .where(and(baseCondition, sql`${analyticsLogsTable.eventType} = 'tool_call'`))
        .groupBy(sql`${analyticsLogsTable.metadata}->>'toolName'`)
        .orderBy(sql`count(*) desc`)
        .limit(15),

      scopedDb
        .select({
          totalChats: sql<number>`count(*) filter (where ${analyticsLogsTable.eventType} = 'chat')::int`,
          cartCreated: sql<number>`count(*) filter (where ${analyticsLogsTable.eventType} = 'cart_created')::int`,
          checkoutStarted: sql<number>`count(*) filter (where ${analyticsLogsTable.eventType} = 'checkout_started')::int`,
          checkoutCompleted: sql<number>`count(*) filter (where ${analyticsLogsTable.eventType} = 'checkout_completed')::int`,
        })
        .from(analyticsLogsTable)
        .where(baseCondition),

      scopedDb
        .select({
          productHandle: sql<string>`${analyticsLogsTable.metadata}->>'productHandle'`,
          count: sql<number>`count(*)::int`,
        })
        .from(analyticsLogsTable)
        .where(and(baseCondition, sql`${analyticsLogsTable.eventType} = 'product_recommended'`))
        .groupBy(sql`${analyticsLogsTable.metadata}->>'productHandle'`)
        .orderBy(sql`count(*) desc`)
        .limit(10),

      scopedDb
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

      scopedDb
        .select({
          total: sql<number>`coalesce(sum((${analyticsLogsTable.metadata}->>'orderTotal')::numeric), 0)::float`,
        })
        .from(analyticsLogsTable)
        .where(and(baseCondition, sql`${analyticsLogsTable.eventType} = 'checkout_completed'`)),
    ]);
  });

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

  const [queriesResult, countResult] = await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    return Promise.all([
      scopedDb
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

      scopedDb
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
  });

  res.json(
    GetDailyQueriesResponse.parse({
      date: dateStr,
      queries: queriesResult.map(r => ({ query: r.query, count: r.count })),
      totalEvents: countResult[0]?.total ?? 0,
    })
  );
});

router.get("/stores/:storeDomain/analytics/export", validateStoreDomain, validateMerchantAuth, async (req, res): Promise<void> => {
  const params = GetEnhancedAnalyticsParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "GET /stores/:storeDomain/analytics/export", req.params);
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
  if ((rawQuery.startDate && !rawQuery.endDate) || (!rawQuery.startDate && rawQuery.endDate)) {
    sendError(res, 400, "Both 'startDate' and 'endDate' must be provided together.");
    return;
  }
  if (rawQuery.startDate && rawQuery.endDate && new Date(rawQuery.startDate) > new Date(rawQuery.endDate)) {
    sendError(res, 400, "'startDate' must be before 'endDate'.");
    return;
  }

  const sectionsParam = rawQuery.sections;
  let sections: SectionName[];
  if (sectionsParam) {
    const requested = sectionsParam.split(",").map(s => s.trim()) as SectionName[];
    const invalid = requested.filter(s => !ALL_SECTIONS.includes(s));
    if (invalid.length > 0) {
      sendError(res, 400, `Invalid sections: ${invalid.join(", ")}. Valid sections: ${ALL_SECTIONS.join(", ")}`);
      return;
    }
    sections = requested;
  } else {
    sections = [...ALL_SECTIONS];
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
    revenueResult,
  ] = await withTenantScope(params.data.storeDomain, async (scopedDb) => {
    return Promise.all([
      scopedDb
        .select({
          totalChats: sql<number>`count(*) filter (where ${analyticsLogsTable.eventType} = 'chat')::int`,
          totalSessions: sql<number>`count(distinct ${analyticsLogsTable.sessionId})::int`,
        })
        .from(analyticsLogsTable)
        .where(baseCondition),

      scopedDb
        .select({
          query: sql<string>`lower(trim(${analyticsLogsTable.query}))`,
          count: sql<number>`count(*)::int`,
        })
        .from(analyticsLogsTable)
        .where(and(baseCondition, sql`${analyticsLogsTable.query} is not null`))
        .groupBy(sql`lower(trim(${analyticsLogsTable.query}))`)
        .orderBy(sql`count(*) desc`)
        .limit(10),

      scopedDb
        .select({
          date: sql<string>`${analyticsLogsTable.createdAt}::date::text`,
          count: sql<number>`count(*)::int`,
        })
        .from(analyticsLogsTable)
        .where(baseCondition)
        .groupBy(sql`${analyticsLogsTable.createdAt}::date`)
        .orderBy(sql`${analyticsLogsTable.createdAt}::date asc`),

      scopedDb
        .select({
          toolName: sql<string>`${analyticsLogsTable.metadata}->>'toolName'`,
          count: sql<number>`count(*)::int`,
        })
        .from(analyticsLogsTable)
        .where(and(baseCondition, sql`${analyticsLogsTable.eventType} = 'tool_call'`))
        .groupBy(sql`${analyticsLogsTable.metadata}->>'toolName'`)
        .orderBy(sql`count(*) desc`)
        .limit(15),

      scopedDb
        .select({
          totalChats: sql<number>`count(*) filter (where ${analyticsLogsTable.eventType} = 'chat')::int`,
          cartCreated: sql<number>`count(*) filter (where ${analyticsLogsTable.eventType} = 'cart_created')::int`,
          checkoutStarted: sql<number>`count(*) filter (where ${analyticsLogsTable.eventType} = 'checkout_started')::int`,
          checkoutCompleted: sql<number>`count(*) filter (where ${analyticsLogsTable.eventType} = 'checkout_completed')::int`,
        })
        .from(analyticsLogsTable)
        .where(baseCondition),

      scopedDb
        .select({
          productHandle: sql<string>`${analyticsLogsTable.metadata}->>'productHandle'`,
          count: sql<number>`count(*)::int`,
        })
        .from(analyticsLogsTable)
        .where(and(baseCondition, sql`${analyticsLogsTable.eventType} = 'product_recommended'`))
        .groupBy(sql`${analyticsLogsTable.metadata}->>'productHandle'`)
        .orderBy(sql`count(*) desc`)
        .limit(10),

      scopedDb
        .select({
          total: sql<number>`coalesce(sum((${analyticsLogsTable.metadata}->>'orderTotal')::numeric), 0)::float`,
        })
        .from(analyticsLogsTable)
        .where(and(baseCondition, sql`${analyticsLogsTable.eventType} = 'checkout_completed'`)),
    ]);
  });

  const csvParts: string[] = [];
  const dateRangeLabel = rawQuery.startDate && rawQuery.endDate
    ? `${rawQuery.startDate} to ${rawQuery.endDate}`
    : `Last ${parsedDays ?? 7} days`;

  if (sections.includes("overview")) {
    const totalChats = countsResult[0]?.totalChats ?? 0;
    const totalSessions = countsResult[0]?.totalSessions ?? 0;
    const estimatedRevenue = revenueResult[0]?.total ?? 0;
    csvParts.push("=== Overview Metrics ===");
    csvParts.push(toCsvRows(
      ["Metric", "Value"],
      [
        ["Date Range", dateRangeLabel],
        ["Total Conversations", totalChats],
        ["Active Sessions", totalSessions],
        ["Estimated Revenue", `$${Number(estimatedRevenue).toFixed(2)}`],
      ]
    ));
  }

  if (sections.includes("daily_chats")) {
    csvParts.push("\n=== Daily Activity ===");
    const rows = dailyChatsResult.map(r => [r.date, r.count] as (string | number)[]);
    csvParts.push(toCsvRows(["Date", "Event Count"], rows));
  }

  if (sections.includes("top_queries")) {
    csvParts.push("\n=== Top Customer Queries ===");
    const rows = topQueriesResult.map((r, i) => [i + 1, r.query, r.count] as (string | number)[]);
    csvParts.push(toCsvRows(["Rank", "Query", "Count"], rows));
  }

  if (sections.includes("tool_usage")) {
    csvParts.push("\n=== Tool Usage ===");
    const rows = toolUsageResult
      .filter(r => r.toolName)
      .map(r => [r.toolName, r.count] as (string | number)[]);
    csvParts.push(toCsvRows(["Tool Name", "Count"], rows));
  }

  if (sections.includes("conversion_funnel")) {
    csvParts.push("\n=== Conversion Funnel ===");
    const funnel = funnelResult[0];
    csvParts.push(toCsvRows(
      ["Stage", "Count"],
      [
        ["Chats", funnel?.totalChats ?? 0],
        ["Carts Created", funnel?.cartCreated ?? 0],
        ["Checkouts Started", funnel?.checkoutStarted ?? 0],
        ["Checkouts Completed", funnel?.checkoutCompleted ?? 0],
      ]
    ));
  }

  if (sections.includes("top_products")) {
    csvParts.push("\n=== Top Recommended Products ===");
    const rows = topProductsResult
      .filter(r => r.productHandle)
      .map((r, i) => [i + 1, r.productHandle, r.count] as (string | number)[]);
    csvParts.push(toCsvRows(["Rank", "Product Handle", "Count"], rows));
  }

  const csvContent = csvParts.join("\n");
  const filename = `analytics-${params.data.storeDomain}-${formatDateForFilename(since)}-to-${formatDateForFilename(until)}.csv`;

  try {
    await withTenantScope(params.data.storeDomain, async (scopedDb) => {
      await scopedDb.insert(analyticsLogsTable).values({
        storeDomain: params.data.storeDomain,
        eventType: "analytics_exported",
        metadata: {
          sections,
          dateRange: dateRangeLabel,
          days: parsedDays ?? 7,
          startDate: rawQuery.startDate || null,
          endDate: rawQuery.endDate || null,
        },
      });
    });
  } catch (err) {
    console.warn("Failed to log analytics export event:", err);
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csvContent);
});

function formatDateForFilename(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default router;
