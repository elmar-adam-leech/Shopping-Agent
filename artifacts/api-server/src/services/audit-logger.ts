import { db, auditLogsTable } from "@workspace/db";
import type { Request } from "express";

export type AuditActor = "merchant" | "system" | "customer";

export interface AuditLogEntry {
  storeDomain: string;
  actor: AuditActor;
  actorId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

function extractIp(req?: Request): string | undefined {
  if (!req) return undefined;
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0]?.trim();
  return req.socket?.remoteAddress;
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      storeDomain: entry.storeDomain,
      actor: entry.actor,
      actorId: entry.actorId ?? null,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      metadata: entry.metadata ?? null,
      ipAddress: entry.ipAddress ?? null,
    });
  } catch (err) {
    console.error(
      `[audit-logger] Failed to log action="${entry.action}" resource="${entry.resourceType}" store="${entry.storeDomain}":`,
      err instanceof Error ? err.message : err,
    );
  }
}

export function logAuditFromRequest(
  req: Request,
  entry: Omit<AuditLogEntry, "ipAddress">,
): void {
  logAudit({ ...entry, ipAddress: extractIp(req) });
}

export async function logCrossTenantAttempt(
  req: Request,
  details: {
    storeDomain: string;
    attemptedResource: string;
    attemptedResourceId?: string;
    ownerStoreDomain?: string;
    actorId?: string;
  },
): Promise<void> {
  const ip = extractIp(req);
  console.warn(
    `[security] Cross-tenant access attempt: store="${details.storeDomain}" tried to access ${details.attemptedResource}="${details.attemptedResourceId}" owned by "${details.ownerStoreDomain}" from ip="${ip}"`,
  );
  await logAudit({
    storeDomain: details.storeDomain,
    actor: "system",
    actorId: details.actorId,
    action: "cross_tenant_access_attempt",
    resourceType: details.attemptedResource,
    resourceId: details.attemptedResourceId,
    metadata: {
      ownerStoreDomain: details.ownerStoreDomain,
      path: req.originalUrl,
      method: req.method,
    },
    ipAddress: ip,
  });
}
