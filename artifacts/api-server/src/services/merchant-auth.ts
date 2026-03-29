/**
 * Merchant authentication service.
 *
 * Provides token-based authentication for merchant dashboard routes.
 * Tokens use the `mtkn_` prefix and are stored as session rows in the
 * database with a configurable TTL. Two middleware variants are exported:
 *
 * - `validateMerchantAuth` — expects a `:storeDomain` route param and
 *   verifies the token belongs to that store.
 * - `validateMerchantAuthForStoreList` — used on routes without a store
 *   param; attaches the authenticated store domain to `req.merchantStoreDomain`.
 */

import crypto from "crypto";
import { type Request, type Response, type NextFunction } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";
import { sendError } from "../lib/error-response";

const MERCHANT_TOKEN_PREFIX = "mtkn_";
const MERCHANT_SESSION_TTL_HOURS = 72;

/** Generate a cryptographically random merchant authentication token with the `mtkn_` prefix. */
export function generateMerchantToken(): string {
  return MERCHANT_TOKEN_PREFIX + crypto.randomBytes(32).toString("hex");
}

/**
 * Create a new merchant session for the given store domain.
 * Inserts a session row in the database and returns the generated token.
 */
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

function extractToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.merchant_token;
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : cookieToken;
}

async function lookupValidSession(token: string) {
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.id, token),
        gt(sessionsTable.expiresAt, new Date())
      )
    );
  return session ?? null;
}

interface MerchantAuthOptions {
  requireStoreDomainParam: boolean;
}

async function validateMerchantAuthCore(
  req: Request,
  res: Response,
  next: NextFunction,
  options: MerchantAuthOptions
): Promise<void> {
  const token = extractToken(req);

  if (!token || !token.startsWith(MERCHANT_TOKEN_PREFIX)) {
    sendError(res, 401, "Merchant authentication required");
    return;
  }

  const session = await lookupValidSession(token);

  if (!session) {
    sendError(res, 401, "Invalid or expired merchant session");
    return;
  }

  if (options.requireStoreDomainParam) {
    const storeDomain = req.params.storeDomain;
    if (storeDomain && session.storeDomain !== storeDomain) {
      sendError(res, 403, "Access denied: token does not match store");
      return;
    }
  } else {
    (req as Request & { merchantStoreDomain: string }).merchantStoreDomain = session.storeDomain;
  }

  next();
}

/** Express middleware that validates a merchant token and checks it matches the `:storeDomain` route param. */
export async function validateMerchantAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  return validateMerchantAuthCore(req, res, next, { requireStoreDomainParam: true });
}

/** Express middleware that validates a merchant token without a store param; sets `req.merchantStoreDomain`. */
export async function validateMerchantAuthForStoreList(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  return validateMerchantAuthCore(req, res, next, { requireStoreDomainParam: false });
}
