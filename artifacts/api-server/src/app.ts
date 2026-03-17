import express, { type Express } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import router from "./routes";

const app: Express = express();

app.use(cors());
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

app.use("/api/stores/:storeDomain/chat", chatLimiter);
app.use("/api", router);

export default app;
