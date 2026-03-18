import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, conversationsTable, shopKnowledgeTable, analyticsLogsTable } from "@workspace/db";
import type { Conversation, ShopKnowledge } from "@workspace/db/schema";
import { SendChatParams, SendChatBody } from "@workspace/api-zod";
import { streamChatWithProvider } from "../services/llm-service";
import { listTools, callTool, type MCPTool } from "../services/mcp-client";
import { fetchBlogs, fetchCollections } from "../services/graphql-client";
import { buildSystemPrompt } from "../services/system-prompt";
import { validateStoreDomain } from "../services/tenant-validator";
import { validateSession } from "../services/session-validator";
import { LRUCache } from "../services/lru-cache";

const router: IRouter = Router();

interface ChatMessageRecord {
  role: "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
  toolResults?: Array<{ toolCallId: string; content: string }>;
  timestamp: string;
}

const knowledgeCache = new LRUCache<ShopKnowledge[]>(500, 120_000);

export function invalidateKnowledgeCache(storeDomain: string): void {
  knowledgeCache.delete(storeDomain);
}

async function getCachedKnowledge(storeDomain: string): Promise<ShopKnowledge[]> {
  const cached = knowledgeCache.get(storeDomain);
  if (cached) return cached;

  const data = await db
    .select()
    .from(shopKnowledgeTable)
    .where(eq(shopKnowledgeTable.storeDomain, storeDomain));

  knowledgeCache.set(storeDomain, data);
  return data;
}

async function executeToolWithFallback(
  storeDomain: string,
  storefrontToken: string,
  toolName: string,
  args: Record<string, unknown>,
  ucpEnabled: boolean = true
): Promise<string> {
  try {
    const result = await callTool(storeDomain, storefrontToken, toolName, args, ucpEnabled);
    let parsed: unknown;
    try {
      parsed = JSON.parse(result);
    } catch {
    }
    if (parsed && typeof parsed === "object" && (parsed as Record<string, unknown>).error) {
      throw new Error(String((parsed as Record<string, unknown>).error));
    }
    return result;
  } catch (err) {
    if (toolName === "get_collections" || toolName === "list_collections") {
      const limit = typeof args.limit === "number" ? args.limit : 10;
      const data = await fetchCollections(storeDomain, storefrontToken, limit);
      return JSON.stringify(data);
    }
    if (toolName === "get_blogs" || toolName === "list_blogs") {
      const limit = typeof args.limit === "number" ? args.limit : 5;
      const data = await fetchBlogs(storeDomain, storefrontToken, limit);
      return JSON.stringify(data);
    }
    return JSON.stringify({ error: `Tool ${toolName} failed and no fallback available` });
  }
}

router.post("/stores/:storeDomain/chat", validateStoreDomain, validateSession, async (req, res): Promise<void> => {
  const params = SendChatParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SendChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const store = req.store!;

  if (!store.chatEnabled) {
    res.status(403).json({ error: "Chat is currently disabled for this store" });
    return;
  }

  if (!store.apiKey) {
    res.status(400).json({ error: "Store has no LLM API key configured. Please add one in settings." });
    return;
  }

  if (!store.storefrontToken) {
    res.status(400).json({ error: "Store has no Storefront Access Token configured." });
    return;
  }

  const isEmbedRequest = req.headers['x-embed-mode'] === 'true' || parsed.data.context?.searchMode;
  if (isEmbedRequest && !store.embedEnabled) {
    res.status(403).json({ error: "Theme embed mode is not enabled for this store." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const abortController = new AbortController();
  let clientDisconnected = false;
  req.on("close", () => {
    clientDisconnected = true;
    abortController.abort();
  });

  function safeSend(data: string): boolean {
    if (clientDisconnected) return false;
    try { res.write(data); return true; } catch (err) { console.warn("SSE write failure:", err); return false; }
  }

  try {
    const knowledge = await getCachedKnowledge(store.storeDomain);

    let conversation: Conversation | null = null;
    let existingMessages: ChatMessageRecord[] = [];

    if (parsed.data.conversationId) {
      const [conv] = await db
        .select()
        .from(conversationsTable)
        .where(
          and(
            eq(conversationsTable.id, parsed.data.conversationId),
            eq(conversationsTable.storeDomain, store.storeDomain),
            eq(conversationsTable.sessionId, parsed.data.sessionId)
          )
        );
      if (conv) {
        conversation = conv;
        existingMessages = (conv.messages as ChatMessageRecord[]) || [];
      }
    }

    if (!conversation) {
      const title = parsed.data.message.slice(0, 50) + (parsed.data.message.length > 50 ? "..." : "");
      const [newConv] = await db
        .insert(conversationsTable)
        .values({
          storeDomain: store.storeDomain,
          sessionId: parsed.data.sessionId,
          title,
          messages: [],
        })
        .returning();
      conversation = newConv;
    }

    const userMessage: ChatMessageRecord = {
      role: "user",
      content: parsed.data.message,
      timestamp: new Date().toISOString(),
    };

    existingMessages.push(userMessage);

    safeSend(`data: ${JSON.stringify({ type: "conversation_id", data: conversation.id })}\n\n`);

    const ucpEnabled = store.ucpCompliant !== false;
    let tools: MCPTool[] = [];
    let ucpDoc = null;
    try {
      const result = await listTools(store.storeDomain, store.storefrontToken, ucpEnabled);
      tools = result.tools;
      ucpDoc = result.ucpDoc;
    } catch (err) {
      console.warn(`Failed to list MCP tools for store="${store.storeDomain}":`, err instanceof Error ? err.message : err);
    }

    const chatContext = parsed.data.context ? {
      productHandle: parsed.data.context.productHandle,
      collectionHandle: parsed.data.context.collectionHandle,
      cartToken: parsed.data.context.cartToken,
      searchMode: parsed.data.context.searchMode,
    } : undefined;

    const systemPrompt = buildSystemPrompt(store.storeDomain, knowledge, ucpDoc, chatContext);

    const llmMessages = existingMessages.map((m) => ({
      role: m.role,
      content: m.content,
      tool_call_id: m.toolCallId,
    }));

    let fullAssistantContent = "";
    const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];
    const toolResults: Array<{ toolCallId: string; content: string }> = [];

    const stream = streamChatWithProvider(
      store.provider,
      store.apiKey,
      store.model,
      systemPrompt,
      llmMessages,
      tools,
      async (toolName: string, args: Record<string, unknown>) => {
        return executeToolWithFallback(store.storeDomain, store.storefrontToken!, toolName, args, ucpEnabled);
      },
      abortController.signal
    );

    for await (const event of stream) {
      if (clientDisconnected) break;
      safeSend(`data: ${JSON.stringify(event)}\n\n`);

      if (event.type === "text") {
        fullAssistantContent += event.data;
      } else if (event.type === "tool_call") {
        toolCalls.push(event.data as { id: string; name: string; arguments: string });
      } else if (event.type === "tool_result") {
        toolResults.push(event.data as { toolCallId: string; content: string });
      }
    }

    const assistantMessage: ChatMessageRecord = {
      role: "assistant",
      content: fullAssistantContent,
      toolCalls,
      toolResults,
      timestamp: new Date().toISOString(),
    };

    existingMessages.push(assistantMessage);

    await db
      .update(conversationsTable)
      .set({ messages: existingMessages })
      .where(eq(conversationsTable.id, conversation.id));

    await db.insert(analyticsLogsTable).values({
      storeDomain: store.storeDomain,
      eventType: "chat",
      query: parsed.data.message.slice(0, 500),
      sessionId: parsed.data.sessionId,
    });
  } catch (err: unknown) {
    if (clientDisconnected) return;
    console.error(`Chat error for store="${store.storeDomain}" session="${parsed.data.sessionId}":`, err);
    safeSend(`data: ${JSON.stringify({ type: "error", data: "An error occurred processing your message" })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
