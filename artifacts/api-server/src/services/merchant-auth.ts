import crypto from "crypto";
import { type Request, type Response, type NextFunction } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";

const MERCHANT_TOKEN_PREFIX = "mtkn_";
const MERCHANT_SESSION_TTL_HOURS = 72;

export function generateMerchantToken(): string {
  return MERCHANT_TOKEN_PREFIX + crypto.randomBytes(32).toString("hex");
}

export async function createMerchantSession(storeDomain: string): Promise<string> {
  const token = generateMerchantToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MERCHANT_SESSION_TTL_HOURS * 60 * 60 * 1000);

  await db.insert(sessionsTable).values({
    id: token,
    storeDomain,
    createdAt: now,
    expiresAt,
  });

  return token;
}

export async function validateMerchantAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.merchant_token;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : cookieToken;

  if (!token || !token.startsWith(MERCHANT_TOKEN_PREFIX)) {
    res.status(401).json({ error: "Merchant authentication required" });
    return;
  }

  const storeDomain = req.params.storeDomain;

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.id, token),
        gt(sessionsTable.expiresAt, new Date())
      )
    );

  if (!session) {
    res.status(401).json({ error: "Invalid or expired merchant session" });
    return;
  }

  if (storeDomain && session.storeDomain !== storeDomain) {
    res.status(403).json({ error: "Access denied: token does not match store" });
    return;
  }

  next();
}

export async function validateMerchantAuthForStoreList(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.merchant_token;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : cookieToken;

  if (!token || !token.startsWith(MERCHANT_TOKEN_PREFIX)) {
    res.status(401).json({ error: "Merchant authentication required" });
    return;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.id, token),
        gt(sessionsTable.expiresAt, new Date())
      )
    );

  if (!session) {
    res.status(401).json({ error: "Invalid or expired merchant session" });
    return;
  }

  (req as Request & { merchantStoreDomain: string }).merchantStoreDomain = session.storeDomain;
  next();
}
