import type { Request, Response, NextFunction } from "express";
import { db, storesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function validateStoreDomain(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const storeDomain = Array.isArray(req.params.storeDomain)
    ? req.params.storeDomain[0]
    : req.params.storeDomain;

  if (!storeDomain) {
    res.status(400).json({ error: "Store domain is required" });
    return;
  }

  const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
  if (!domainPattern.test(storeDomain)) {
    res.status(400).json({ error: "Invalid store domain format" });
    return;
  }

  const [store] = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.storeDomain, storeDomain));

  if (!store) {
    res.status(404).json({ error: "Store not found" });
    return;
  }

  (req as any).store = store;
  next();
}
