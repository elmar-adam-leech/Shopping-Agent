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
import { invalidateStoreCache } from "../services/tenant-validator";
import { encrypt } from "../services/encryption";
import { invalidateToolsListCache } from "../services/mcp-client";
import { invalidateSessionCacheForDomain } from "../services/session-validator";
import { invalidateKnowledgeCache } from "./chat";
import { sendError, sendZodError } from "../lib/error-response";

const router: IRouter = Router();

type ProviderValue = "openai" | "anthropic" | "xai";

function storeToResponse(store: Store) {
  const response: Record<string, unknown> = {
    storeDomain: store.storeDomain,
    storefrontToken: store.storefrontToken,
    provider: store.provider,
    model: store.model,
    hasApiKey: !!store.apiKey,
    ucpCompliant: store.ucpCompliant,
    chatEnabled: store.chatEnabled,
    embedEnabled: store.embedEnabled,
    createdAt: store.createdAt,
  };

  return response;
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
    sendZodError(res, parsed.error, "POST /stores", req.body);
    return;
  }

  const merchantDomain = (req as Request & { merchantStoreDomain: string }).merchantStoreDomain;
  if (parsed.data.storeDomain !== merchantDomain) {
    sendError(res, 403, "Cannot create store for a different domain");
    return;
  }

  const existing = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.storeDomain, parsed.data.storeDomain));

  if (existing.length > 0) {
    sendError(res, 409, "Store already exists");
    return;
  }

  let encryptedApiKey: string | undefined;
  if (parsed.data.apiKey) {
    try {
      encryptedApiKey = encrypt(parsed.data.apiKey);
    } catch (err) {
      sendError(res, 503, "Server encryption is not configured. Cannot store API keys.");
      return;
    }
  }

  const [store] = await db
    .insert(storesTable)
    .values({
      storeDomain: parsed.data.storeDomain,
      storefrontToken: parsed.data.storefrontToken,
      provider: parsed.data.provider as ProviderValue,
      model: parsed.data.model,
      apiKey: encryptedApiKey,
    })
    .returning();

  res.status(201).json(GetStoreResponse.parse(storeToResponse(store)));
});

router.get("/stores/:storeDomain", validateMerchantAuth, async (req, res): Promise<void> => {
  const params = GetStoreParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "GET /stores/:storeDomain", req.params);
    return;
  }

  const [store] = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.storeDomain, params.data.storeDomain));

  if (!store) {
    sendError(res, 404, "Store not found");
    return;
  }

  res.json(GetStoreResponse.parse(storeToResponse(store)));
});

router.patch("/stores/:storeDomain", validateMerchantAuth, async (req, res): Promise<void> => {
  const params = UpdateStoreParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "PATCH /stores/:storeDomain", req.params);
    return;
  }

  const parsed = UpdateStoreBody.safeParse(req.body);
  if (!parsed.success) {
    sendZodError(res, parsed.error, "PATCH /stores/:storeDomain body", req.body);
    return;
  }

  const updateData: Partial<Pick<Store, "storefrontToken" | "provider" | "model" | "apiKey" | "ucpCompliant" | "chatEnabled" | "embedEnabled">> = {};
  if (parsed.data.storefrontToken !== undefined) updateData.storefrontToken = parsed.data.storefrontToken;
  if (parsed.data.provider !== undefined) updateData.provider = parsed.data.provider as ProviderValue;
  if (parsed.data.model !== undefined) updateData.model = parsed.data.model;
  if (parsed.data.apiKey !== undefined) {
    if (parsed.data.apiKey) {
      try {
        updateData.apiKey = encrypt(parsed.data.apiKey);
      } catch (err) {
        sendError(res, 503, "Server encryption is not configured. Cannot store API keys.");
        return;
      }
    } else {
      updateData.apiKey = parsed.data.apiKey;
    }
  }
  if (parsed.data.ucpCompliant !== undefined) updateData.ucpCompliant = parsed.data.ucpCompliant;
  if (parsed.data.chatEnabled !== undefined) updateData.chatEnabled = parsed.data.chatEnabled;
  if (parsed.data.embedEnabled !== undefined) updateData.embedEnabled = parsed.data.embedEnabled;

  const [store] = await db
    .update(storesTable)
    .set(updateData)
    .where(eq(storesTable.storeDomain, params.data.storeDomain))
    .returning();

  if (!store) {
    sendError(res, 404, "Store not found");
    return;
  }

  invalidateStoreCache(params.data.storeDomain);
  if (parsed.data.storefrontToken !== undefined || parsed.data.ucpCompliant !== undefined) {
    invalidateToolsListCache(params.data.storeDomain);
  }
  res.json(UpdateStoreResponse.parse(storeToResponse(store)));
});

router.get("/stores/:storeDomain/public", async (req, res): Promise<void> => {
  const { storeDomain } = req.params;
  if (!storeDomain) {
    sendError(res, 400, "Missing storeDomain");
    return;
  }

  const [store] = await db
    .select()
    .from(storesTable)
    .where(eq(storesTable.storeDomain, storeDomain));

  if (!store) {
    sendError(res, 404, "Store not found");
    return;
  }

  res.json({
    storeDomain: store.storeDomain,
    chatEnabled: store.chatEnabled,
  });
});

router.delete("/stores/:storeDomain", validateMerchantAuth, async (req, res): Promise<void> => {
  const params = DeleteStoreParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "DELETE /stores/:storeDomain", req.params);
    return;
  }

  await db.delete(storesTable).where(eq(storesTable.storeDomain, params.data.storeDomain));
  invalidateStoreCache(params.data.storeDomain);
  invalidateSessionCacheForDomain(params.data.storeDomain);
  invalidateKnowledgeCache(params.data.storeDomain);
  invalidateToolsListCache(params.data.storeDomain);
  res.sendStatus(204);
});

export default router;
