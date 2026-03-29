import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, conversationsTable, shopKnowledgeTable, analyticsLogsTable } from "@workspace/db";
import type { Conversation, ShopKnowledge } from "@workspace/db/schema";
import { SendChatParams, SendChatBody } from "@workspace/api-zod";
import { streamChatWithProvider } from "../services/llm-service";
import { listTools, callTool, type MCPTool, type UCPDiscoveryDocument } from "../services/mcp-client";
import { fetchBlogs, fetchCollections } from "../services/graphql-client";
import { buildSystemPrompt } from "../services/system-prompt";
import { validateStoreDomain, loadFullStore } from "../services/tenant-validator";
import { validateSession } from "../services/session-validator";
import { LRUCache } from "../services/lru-cache";
import { decrypt } from "../services/encryption";
import { filterPromptInjection } from "../lib/prompt-filter";
import { sendError, sendZodError } from "../lib/error-response";

const MAX_USER_MESSAGE_LENGTH = 10_000;
const MESSAGE_WINDOW_SIZE = 20;
const MAX_MESSAGES_PER_CONVERSATION = 200;

const router: IRouter = Router();

interface ChatMessageRecord {
  role: "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
  toolResults?: Array<{ toolCallId: string; content: string }>;
  timestamp: string;
}

const knowledgeCache = new LRUCache<ShopKnowledge[]>(500, 120_000, "knowledge");

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

/**
 * Executes an MCP tool call with a GraphQL fallback for collections and blogs.
 *
 * First attempts the tool call via the MCP JSON-RPC endpoint. If it fails,
 * checks whether the tool has a known GraphQL-based fallback (collections or blogs)
 * and uses the Storefront API directly. If no fallback exists, returns a JSON error.
 */
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

async function loadOrCreateConversation(
  storeDomain: string,
  sessionId: string,
  conversationId: number | null | undefined,
  messagePreview: string
): Promise<{ conversation: Conversation; existingMessages: ChatMessageRecord[] }> {
  let conversation: Conversation | null = null;
  let existingMessages: ChatMessageRecord[] = [];

  if (conversationId != null) {
    const [conv] = await db
      .select()
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.id, conversationId),
          eq(conversationsTable.storeDomain, storeDomain),
          eq(conversationsTable.sessionId, sessionId)
        )
      );
    if (conv) {
      conversation = conv;
      existingMessages = (conv.messages as ChatMessageRecord[]) || [];
    }
  }

  if (!conversation) {
    const title = messagePreview.slice(0, 50) + (messagePreview.length > 50 ? "..." : "");
    const [newConv] = await db
      .insert(conversationsTable)
      .values({
        storeDomain,
        sessionId,
        title,
        messages: [],
      })
      .returning();
    conversation = newConv;
  }

  return { conversation, existingMessages };
}

/**
 * Builds the LLM context by applying message windowing and constructing the system prompt.
 *
 * Windowing keeps only the most recent MESSAGE_WINDOW_SIZE messages to prevent
 * context window overflow for long conversations. The system prompt is always
 * included separately (not counted in the window).
 */
function buildLLMContext(
  existingMessages: ChatMessageRecord[],
  storeDomain: string,
  knowledge: ShopKnowledge[],
  ucpDoc: UCPDiscoveryDocument | null,
  chatContext?: { productHandle?: string; collectionHandle?: string; cartToken?: string; searchMode?: boolean }
) {
  const windowedMessages = existingMessages.length > MESSAGE_WINDOW_SIZE
    ? existingMessages.slice(-MESSAGE_WINDOW_SIZE)
    : existingMessages;

  const systemPrompt = buildSystemPrompt(storeDomain, knowledge, ucpDoc, chatContext);

  const llmMessages = windowedMessages.map((m) => ({
    role: m.role,
    content: m.content,
    tool_call_id: m.toolCallId,
  }));

  return { systemPrompt, llmMessages };
}

async function appendMessages(
  conversationId: number,
  newMessages: ChatMessageRecord[]
): Promise<void> {
  const newMessagesJson = JSON.stringify(newMessages);
  const newMsgCount = newMessages.length;

  await db
    .update(conversationsTable)
    .set({
      messages: sql`CASE
        WHEN ${conversationsTable.messageCount} + ${newMsgCount} > ${MAX_MESSAGES_PER_CONVERSATION}
        THEN (
          SELECT COALESCE(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
          FROM jsonb_array_elements(${conversationsTable.messages}::jsonb || ${newMessagesJson}::jsonb)
          WITH ORDINALITY AS t(elem, ord)
          WHERE t.ord > (${conversationsTable.messageCount} + ${newMsgCount} - ${MAX_MESSAGES_PER_CONVERSATION})
        )
        ELSE ${conversationsTable.messages}::jsonb || ${newMessagesJson}::jsonb
      END`,
      messageCount: sql`LEAST(${conversationsTable.messageCount} + ${newMsgCount}, ${MAX_MESSAGES_PER_CONVERSATION})`,
    })
    .where(eq(conversationsTable.id, conversationId));
}

async function persistChatResult(
  conversationId: number,
  storeDomain: string,
  sessionId: string,
  newMessages: ChatMessageRecord[],
  userQuery: string
): Promise<{ conversationSaved: boolean; analyticsSaved: boolean }> {
  let conversationSaved = true;
  let analyticsSaved = true;

  try {
    await appendMessages(conversationId, newMessages);
  } catch (err) {
    conversationSaved = false;
    console.error(`[chat] FAILED to save conversation id="${conversationId}" store="${storeDomain}":`, err instanceof Error ? err.message : "Unknown error");
  }

  try {
    await db.insert(analyticsLogsTable).values({
      storeDomain,
      eventType: "chat",
      query: userQuery.slice(0, 500),
      sessionId,
    });
  } catch (err) {
    analyticsSaved = false;
    console.error(`[chat] FAILED to insert analytics log store="${storeDomain}":`, err instanceof Error ? err.message : "Unknown error");
  }

  return { conversationSaved, analyticsSaved };
}

router.post("/stores/:storeDomain/chat", validateStoreDomain, validateSession, async (req, res): Promise<void> => {
  const params = SendChatParams.safeParse(req.params);
  if (!params.success) {
    sendZodError(res, params.error, "POST /stores/:storeDomain/chat", req.params);
    return;
  }

  const parsed = SendChatBody.safeParse(req.body);
  if (!parsed.success) {
    sendZodError(res, parsed.error, "POST /stores/:storeDomain/chat body", req.body);
    return;
  }

  const storeDomainParam = req.params.storeDomain as string;
  const store = req.store ?? await loadFullStore(storeDomainParam);

  if (!store) {
    sendError(res, 404, "Store not found");
    return;
  }

  if (!store.chatEnabled) {
    sendError(res, 403, "Chat is currently disabled for this store");
    return;
  }

  if (!store.apiKey) {
    sendError(res, 400, "Store has no LLM API key configured. Please add one in settings.");
    return;
  }

  if (!store.storefrontToken) {
    sendError(res, 400, "Store has no Storefront Access Token configured.");
    return;
  }

  const isEmbedRequest = req.headers['x-embed-mode'] === 'true' || parsed.data.context?.searchMode;
  if (isEmbedRequest && !store.embedEnabled) {
    sendError(res, 403, "Theme embed mode is not enabled for this store.");
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

    const { conversation, existingMessages } = await loadOrCreateConversation(
      store.storeDomain,
      parsed.data.sessionId,
      parsed.data.conversationId,
      parsed.data.message
    );

    const truncatedMessage = parsed.data.message.length > MAX_USER_MESSAGE_LENGTH
      ? parsed.data.message.slice(0, MAX_USER_MESSAGE_LENGTH)
      : parsed.data.message;

    const { message: filteredMessage, filtered } = filterPromptInjection(truncatedMessage);
    if (filtered) {
      console.warn(`[prompt-filter] Filtered injection attempt from store="${store.storeDomain}" session="${parsed.data.sessionId}"`);
    }

    const userMessage: ChatMessageRecord = {
      role: "user",
      content: filteredMessage,
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

    const { systemPrompt, llmMessages } = buildLLMContext(
      existingMessages,
      store.storeDomain,
      knowledge,
      ucpDoc,
      chatContext
    );

    let fullAssistantContent = "";
    const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];
    const toolResults: Array<{ toolCallId: string; content: string }> = [];

    let decryptedApiKey: string;
    try {
      decryptedApiKey = decrypt(store.apiKey);
    } catch (err) {
      console.error(`[chat] Decryption failed for store="${store.storeDomain}":`, err instanceof Error ? err.message : err);
      safeSend(`data: ${JSON.stringify({ type: "error", data: "API key configuration error. Please re-save your API key in settings." })}\n\n`);
      return;
    }

    const stream = streamChatWithProvider(
      store.provider,
      decryptedApiKey,
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

    const newMessages = [userMessage, assistantMessage];

    const { conversationSaved, analyticsSaved } = await persistChatResult(
      conversation.id,
      store.storeDomain,
      parsed.data.sessionId,
      newMessages,
      filteredMessage
    );

    if (!conversationSaved) {
      safeSend(`data: ${JSON.stringify({ type: "warning", data: "Your conversation may not have been saved. Responses might be lost on refresh." })}\n\n`);
    }
    if (!analyticsSaved) {
      console.warn(`[chat] Analytics persistence failed for store="${store.storeDomain}" session="${parsed.data.sessionId}"`);
    }
  } catch (err: unknown) {
    if (clientDisconnected) return;
    console.error(`[chat] Error store="${store.storeDomain}":`, err instanceof Error ? err.message : "Unknown error");

    let errorMessage = "An error occurred processing your message. Please try again.";
    if (err instanceof Error) {
      if (err.name === "AbortError" || err.message.includes("aborted")) {
        return;
      }
      if (err.message.includes("ECONNREFUSED") || err.message.includes("ENOTFOUND")) {
        errorMessage = "Unable to reach the AI provider. Please check your internet connection and try again.";
      } else if (err.message.includes("timeout") || err.message.includes("ETIMEDOUT")) {
        errorMessage = "The request timed out. Please try again with a shorter message.";
      } else if (err.message.includes("database") || err.message.includes("connection")) {
        errorMessage = "A temporary service issue occurred. Please try again in a moment.";
      }
    }
    safeSend(`data: ${JSON.stringify({ type: "error", data: errorMessage })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
