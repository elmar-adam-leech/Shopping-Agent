import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import router from "./routes";
import { sendError } from "./lib/error-response";
import {
  requestLogger,
  compress,
  cacheControl,
  chatLimiter,
  sessionLimiter,
  loginLimiter,
  storeMutationLimiter,
} from "./middleware";

const app: Express = express();

app.set("trust proxy", 1);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : undefined;

const isProduction = process.env.NODE_ENV === "production";

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(requestLogger);

app.use(cors({
  credentials: true,
  origin: allowedOrigins
    ? allowedOrigins
    : isProduction
      ? false
      : true,
}));

app.use(compress);

app.use("/api", cacheControl);

app.post("/api/sessions", sessionLimiter);
app.post("/api/auth/login", loginLimiter);
app.use("/api/stores/:storeDomain/chat", chatLimiter);
app.post("/api/stores", storeMutationLimiter);
app.patch("/api/stores/:storeDomain", storeMutationLimiter);
app.delete("/api/stores/:storeDomain", storeMutationLimiter);
app.use("/api", router);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[app] Unhandled error:", err.message);
  sendError(res, 500, "Internal server error");
});

export default app;
