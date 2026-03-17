import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import router from "./routes";

const app: Express = express();

app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many requests, please wait a moment" },
  keyGenerator: (req) => {
    return req.body?.sessionId || "anonymous";
  },
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

app.post("/api/sessions", sessionLimiter);
app.post("/api/auth/login", loginLimiter);
app.use("/api/stores/:storeDomain/chat", chatLimiter);
app.use("/api", router);

export default app;
