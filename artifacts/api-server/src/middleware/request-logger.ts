import type { Request, Response, NextFunction } from "express";

const SKIP_PATHS = new Set(["/healthz", "/api/healthz"]);

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (SKIP_PATHS.has(req.path)) {
    next();
    return;
  }

  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[request] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });

  next();
}
