import { Router, type IRouter } from "express";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { db, storesTable } from "@workspace/db";
import { CreateSessionBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/sessions", async (req, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [store] = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.storeDomain, parsed.data.storeDomain));

  if (!store) {
    res.status(404).json({ error: "Store not found" });
    return;
  }

  const sessionId = uuidv4();

  res.status(201).json({
    sessionId,
    storeDomain: parsed.data.storeDomain,
    createdAt: new Date().toISOString(),
  });
});

export default router;
