import { Router, type IRouter } from "express";
import { eq, and, gte, sql } from "drizzle-orm";
import { db, analyticsLogsTable } from "@workspace/db";
import {
  GetAnalyticsParams,
  GetAnalyticsQueryParams,
  GetAnalyticsResponse,
} from "@workspace/api-zod";
import { validateStoreDomain } from "../services/tenant-validator";

const router: IRouter = Router();

router.get("/stores/:storeDomain/analytics", validateStoreDomain, async (req, res): Promise<void> => {
  const params = GetAnalyticsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const query = GetAnalyticsQueryParams.safeParse(req.query);
  const days = query.success ? (query.data.days ?? 7) : 7;

  const since = new Date();
  since.setDate(since.getDate() - days);

  const logs = await db
    .select()
    .from(analyticsLogsTable)
    .where(
      and(
        eq(analyticsLogsTable.storeDomain, params.data.storeDomain),
        gte(analyticsLogsTable.createdAt, since)
      )
    );

  const totalChats = logs.filter((l) => l.eventType === "chat").length;

  const sessionSet = new Set(logs.map((l) => l.sessionId).filter(Boolean));
  const totalSessions = sessionSet.size;

  const queryCounts = new Map<string, number>();
  for (const log of logs) {
    if (log.query) {
      const q = log.query.toLowerCase().trim();
      queryCounts.set(q, (queryCounts.get(q) || 0) + 1);
    }
  }
  const topQueries = Array.from(queryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([query, count]) => ({ query, count }));

  const dailyCounts = new Map<string, number>();
  for (const log of logs) {
    const date = log.createdAt.toISOString().split("T")[0];
    dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
  }
  const dailyChats = Array.from(dailyCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));

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
