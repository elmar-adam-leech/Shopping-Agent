import type { Request, Response, NextFunction } from "express";

export function cacheControl(req: Request, res: Response, next: NextFunction): void {
  const hasAuth = req.headers.authorization
    || req.cookies?.merchant_token
    || req.headers["x-session-id"]
    || req.query.sessionId
    || req.body?.sessionId;
  if (hasAuth) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
  }
  next();
}
