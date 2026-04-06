import rateLimit from "express-rate-limit";
import type { Request } from "express";

const loadTestBypassSecret = process.env.NODE_ENV === "development"
  ? process.env.LOAD_TEST_BYPASS_SECRET
  : undefined;

function shouldBypassRateLimit(req: Request): boolean {
  if (!loadTestBypassSecret) return false;
  return req.headers["x-load-test-bypass"] === loadTestBypassSecret;
}

export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many messages sent. Please wait about a minute before trying again." },
  keyGenerator: (req) => req.ip || "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skip: shouldBypassRateLimit,
});

export const sessionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Too many session requests. Please wait about a minute before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldBypassRateLimit,
});

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Too many login attempts. Please wait about a minute before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldBypassRateLimit,
});

export const storeMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "Too many requests, please wait a moment" },
  standardHeaders: true,
  legacyHeaders: false,
});
