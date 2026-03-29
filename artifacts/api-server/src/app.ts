import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { sendError } from "./lib/error-response";

const app: Express = express();

app.set("trust proxy", 1);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : undefined;

const isProduction = process.env.NODE_ENV === "production";

app.use(cors({
  credentials: true,
  origin: allowedOrigins
    ? allowedOrigins
    : isProduction
      ? false
      : true,
}));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many requests, please wait a moment" },
  keyGenerator: (req) => req.ip || "unknown",
  validate: false,
});

const sessionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Too many session requests, please wait a moment" },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Too many login attempts, please wait a moment" },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", (req: Request, res: Response, next: NextFunction) => {
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
});

app.post("/api/sessions", sessionLimiter);
app.post("/api/auth/login", loginLimiter);
app.use("/api/stores/:storeDomain/chat", chatLimiter);
app.use("/api", router);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err.message);
  sendError(res, 500, "Internal server error");
});

export default app;
