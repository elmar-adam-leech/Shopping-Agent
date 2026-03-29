import type { Response } from "express";

interface ZodLikeError {
  issues: Array<{ path: (string | number)[]; message: string }>;
}

export function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

function sanitizeInputShape(input: unknown, depth = 0): string {
  if (depth > 2) return "[nested]";
  if (input === null) return "null";
  if (input === undefined) return "undefined";
  if (Array.isArray(input)) {
    if (input.length === 0) return "[]";
    return `[${sanitizeInputShape(input[0], depth + 1)}×${input.length}]`;
  }
  const t = typeof input;
  if (t !== "object") return t;
  const obj = input as Record<string, unknown>;
  const keys = Object.keys(obj).slice(0, 20);
  const entries = keys.map(k => `${k}:${sanitizeInputShape(obj[k], depth + 1)}`);
  if (Object.keys(obj).length > 20) entries.push("...");
  return `{${entries.join(",")}}`;
}

export function formatZodError(zodError: ZodLikeError, routePath?: string, inputData?: unknown): string {
  const issues = zodError.issues.map((i: { path: (string | number)[]; message: string }) => `${i.path.join(".")}: ${i.message}`).join("; ");
  if (routePath) {
    const shape = inputData !== undefined ? ` shape=${sanitizeInputShape(inputData)}` : "";
    console.warn(`[validation] Zod failure on ${routePath}:${shape} ${issues}`);
  }
  return issues;
}

export function sendZodError(res: Response, zodError: ZodLikeError, routePath?: string, inputData?: unknown): void {
  const message = formatZodError(zodError, routePath, inputData);
  sendError(res, 400, message);
}
