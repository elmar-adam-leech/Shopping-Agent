import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storesRouter from "./stores";
import knowledgeRouter from "./knowledge";
import chatRouter from "./chat";
import cartRouter from "./cart";
import conversationsRouter from "./conversations";
import preferencesRouter from "./preferences";
import sessionsRouter from "./sessions";
import authRouter from "./auth";
import mcpAuthRouter from "./mcp-auth";
import webhooksRouter from "./webhooks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(mcpAuthRouter);
router.use(sessionsRouter);
router.use(storesRouter);
router.use(knowledgeRouter);
router.use(chatRouter);
router.use(cartRouter);
router.use(conversationsRouter);
router.use(preferencesRouter);
router.use(webhooksRouter);

export default router;
