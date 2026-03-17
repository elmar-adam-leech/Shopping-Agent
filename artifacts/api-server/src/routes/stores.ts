import { Router, type IRouter, type Request } from "express";
import { eq } from "drizzle-orm";
import { db, storesTable } from "@workspace/db";
import type { Store } from "@workspace/db/schema";
import {
  CreateStoreBody,
  UpdateStoreBody,
  GetStoreParams,
  GetStoreResponse,
  UpdateStoreParams,
  UpdateStoreResponse,
  ListStoresResponse,
  DeleteStoreParams,
} from "@workspace/api-zod";
import { validateMerchantAuth, validateMerchantAuthForStoreList } from "../services/merchant-auth";

const router: IRouter = Router();

type ProviderValue = "openai" | "anthropic" | "xai";

function storeToResponse(store: Store) {
  return {
    storeDomain: store.storeDomain,
    storefrontToken: store.storefrontToken,
    provider: store.provider,
    model: store.model,
    hasApiKey: !!store.apiKey,
    ucpCompliant: store.ucpCompliant,
    createdAt: store.createdAt,
  };
}

router.get("/stores", validateMerchantAuthForStoreList, async (req, res): Promise<void> => {
  const merchantDomain = (req as Request & { merchantStoreDomain: string }).merchantStoreDomain;
  const stores = await db.select().from(storesTable)
    .where(eq(storesTable.storeDomain, merchantDomain))
    .orderBy(storesTable.createdAt);
  res.json(ListStoresResponse.parse(stores.map(storeToResponse)));
});

router.post("/stores", validateMerchantAuthForStoreList, async (req, res): Promise<void> => {
  const parsed = CreateStoreBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const merchantDomain = (req as Request & { merchantStoreDomain: string }).merchantStoreDomain;
  if (parsed.data.storeDomain !== merchantDomain) {
    res.status(403).json({ error: "Cannot create store for a different domain" });
    return;
  }

  const existing = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.storeDomain, parsed.data.storeDomain));

  if (existing.length > 0) {
    res.status(409).json({ error: "Store already exists" });
    return;
  }

  const [store] = await db
    .insert(storesTable)
    .values({
      storeDomain: parsed.data.storeDomain,
      storefrontToken: parsed.data.storefrontToken,
      provider: parsed.data.provider as ProviderValue,
      model: parsed.data.model,
      apiKey: parsed.data.apiKey,
    })
    .returning();

  res.status(201).json(GetStoreResponse.parse(storeToResponse(store)));
});

router.get("/stores/:storeDomain", validateMerchantAuth, async (req, res): Promise<void> => {
  const params = GetStoreParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [store] = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.storeDomain, params.data.storeDomain));

  if (!store) {
    res.status(404).json({ error: "Store not found" });
    return;
  }

  res.json(GetStoreResponse.parse(storeToResponse(store)));
});

router.patch("/stores/:storeDomain", validateMerchantAuth, async (req, res): Promise<void> => {
  const params = UpdateStoreParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateStoreBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Partial<Pick<Store, "storefrontToken" | "provider" | "model" | "apiKey" | "ucpCompliant">> = {};
  if (parsed.data.storefrontToken !== undefined) updateData.storefrontToken = parsed.data.storefrontToken;
  if (parsed.data.provider !== undefined) updateData.provider = parsed.data.provider as ProviderValue;
  if (parsed.data.model !== undefined) updateData.model = parsed.data.model;
  if (parsed.data.apiKey !== undefined) updateData.apiKey = parsed.data.apiKey;
  if (parsed.data.ucpCompliant !== undefined) updateData.ucpCompliant = parsed.data.ucpCompliant;

  const [store] = await db
    .update(storesTable)
    .set(updateData)
    .where(eq(storesTable.storeDomain, params.data.storeDomain))
    .returning();

  if (!store) {
    res.status(404).json({ error: "Store not found" });
    return;
  }

  res.json(UpdateStoreResponse.parse(storeToResponse(store)));
});

router.delete("/stores/:storeDomain", validateMerchantAuth, async (req, res): Promise<void> => {
  const params = DeleteStoreParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(storesTable).where(eq(storesTable.storeDomain, params.data.storeDomain));
  res.sendStatus(204);
});

export default router;
