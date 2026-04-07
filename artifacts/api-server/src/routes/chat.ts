import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { SendChatParams, SendChatBody } from "@workspace/api-zod";
import type { McpConnection } from "@workspace/db/schema";
import { streamChatWithProvider } from "../services/llm-service";
import { type MCPTool } from "../services/mcp-client";
import { listTools } from "../services/tool-registry";
import { validateStoreDomain, loadFullStore, validateSession } from "../middleware";
import { decrypt } from "../services/encryption";
import { runPromptGuard, logGuardEvent, type GuardSensitivity } from "../services/prompt-guard";
import { sendError, sendZodError } from "../lib/error-response";
import { getActiveConnection } from "../services/customer-account-connection";
import { listAuthenticatedMCPTools } from "../services/customer-account-mcp";
import { loadOrCreateConversation, persistChatResult, type ChatMessageRecord } from "../services/conversation-service";
import { getCachedKnowledge } from "../services/knowledge-cache";
import { buildLLMContext } from "../services/llm-context";
import { fireOutputAudit } from "../services/output-audit";
import { createToolExecutor } from "../services/tool-guard";
import { trackSSEConnection, isServerShuttingDown } from "../services/shutdown";
import { eq, and } from "drizzle-orm";
import { db, userPreferencesTable, sessionsTable, withTenantScope } from "@workspace/db";
import { type UserPreferencesContext } from "../services/system-prompt";
import { extractAndSavePreferences } from "../services/preference-extractor";
import { describeImageWithVision, isVisionCapable, validateImageBase64 } from "../services/vision-describe";
import { getWishlist } from "../services/wishlist-service";
import type { WishlistItem } from "@workspace/db/schema";

const MAX_USER_MESSAGE_LENGTH = 10_000;

const ALLOWED_PREF_KEYS = new Set([
  "displayName", "units", "budget", "style",
  "topSize", "bottomSize", "shoeSize",
  "materials", "brands", "colors", "lifestyle",
]);

const router: IRouter = Router();

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

  if (isServerShuttingDown()) {
    sendError(res, 503, "Server is shutting down. Please retry shortly.");
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  trackSSEConnection(res);

  const abortController = new AbortController();
  let clientDisconnected = false;
  let auditOwnsStream = false;
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

    let truncatedMessage = parsed.data.message.length > MAX_USER_MESSAGE_LENGTH
      ? parsed.data.message.slice(0, MAX_USER_MESSAGE_LENGTH)
      : parsed.data.message;

    if (parsed.data.imageBase64) {
      const imageValidation = validateImageBase64(parsed.data.imageBase64);
      if (!imageValidation.valid) {
        safeSend(`data: ${JSON.stringify({ type: "conversation_id", data: conversation.id })}\n\n`);
        safeSend(`data: ${JSON.stringify({ type: "error", data: imageValidation.error })}\n\n`);
        res.end();
        return;
      }

      if (!isVisionCapable(store.provider)) {
        safeSend(`data: ${JSON.stringify({ type: "conversation_id", data: conversation.id })}\n\n`);
        safeSend(`data: ${JSON.stringify({ type: "error", data: "Visual search is not available with your current AI provider. Please configure an OpenAI or Gemini model to use image search." })}\n\n`);
        res.end();
        return;
      }

      let decryptedKey: string;
      try {
        decryptedKey = decrypt(store.apiKey);
      } catch {
        safeSend(`data: ${JSON.stringify({ type: "error", data: "API key configuration error." })}\n\n`);
        res.end();
        return;
      }

      try {
        const imageDescription = await describeImageWithVision(
          store.provider,
          decryptedKey,
          store.model,
          parsed.data.imageBase64,
          truncatedMessage
        );
        truncatedMessage = `[Visual Search] The user uploaded an image. Image description: ${imageDescription}\n\nUser's message: ${truncatedMessage}`;
        console.log(`[chat] Vision description generated for store="${store.storeDomain}"`);
      } catch (err) {
        console.error(`[chat] Vision description failed for store="${store.storeDomain}":`, err instanceof Error ? err.message : err);
        safeSend(`data: ${JSON.stringify({ type: "conversation_id", data: conversation.id })}\n\n`);
        safeSend(`data: ${JSON.stringify({ type: "error", data: "Failed to analyze the uploaded image. Please try again or describe what you're looking for instead." })}\n\n`);
        res.end();
        return;
      }
    }

    const guardSensitivity = (store.guardSensitivity ?? "medium") as GuardSensitivity;
    const blockedTopics = store.blockedTopics ?? [];

    const guardVerdict = await runPromptGuard(truncatedMessage, guardSensitivity, blockedTopics);
    if (!guardVerdict.allowed) {
      const eventType = guardVerdict.category === "blocked_topic"
        ? "blocked_topic"
        : guardVerdict.layer === "regex"
          ? "prompt_injection_regex"
          : "prompt_injection_llm";
      console.warn(`[prompt-guard] Blocked attempt (${eventType}/${guardVerdict.layer}) from store="${store.storeDomain}" session="${parsed.data.sessionId}": ${guardVerdict.reason}`);
      logGuardEvent(store.storeDomain, parsed.data.sessionId, eventType, truncatedMessage, {
        layer: guardVerdict.layer,
        category: guardVerdict.category,
        reason: guardVerdict.reason,
        patternsMatched: guardVerdict.patternsMatched,
      });
      safeSend(`data: ${JSON.stringify({ type: "conversation_id", data: conversation.id })}\n\n`);
      safeSend(`data: ${JSON.stringify({ type: "text", data: "I'm here to help you shop! Could you rephrase your question about our products or services?" })}\n\n`);
      res.end();
      return;
    }

    const userMessage: ChatMessageRecord = {
      id: randomUUID(),
      role: "user",
      content: truncatedMessage,
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
      console.warn(`[chat] Failed to list MCP tools for store="${store.storeDomain}":`, err instanceof Error ? err.message : err);
    }

    const validatedSessionId = (req as unknown as { validatedSessionId: string }).validatedSessionId;
    let customerAccountConnection: McpConnection | null = null;
    try {
      customerAccountConnection = await getActiveConnection(store.storeDomain, validatedSessionId);
    } catch (err) {
      console.warn(`[chat] Failed to check customer account connection:`, err instanceof Error ? err.message : err);
    }

    const orderHistoryConsentGranted = true;

    const authenticatedToolNames = new Set<string>();
    if (customerAccountConnection && orderHistoryConsentGranted) {
      try {
        const authTools = await listAuthenticatedMCPTools(customerAccountConnection);
        if (authTools.length > 0) {
          const existingNames = new Set(tools.map(t => t.name));
          for (const tool of authTools) {
            if (!existingNames.has(tool.name)) {
              tools.push(tool);
              authenticatedToolNames.add(tool.name);
            }
          }
          console.log(`[chat] Merged ${authTools.length} authenticated MCP tools for store="${store.storeDomain}"`);
        }
      } catch (err) {
        console.warn(`[chat] Failed to list authenticated MCP tools:`, err instanceof Error ? err.message : err);
      }
    } else if (customerAccountConnection && !orderHistoryConsentGranted) {
      console.log(`[chat] Skipping authenticated MCP tools — order history consent not granted for store="${store.storeDomain}"`);
    }

    let userPreferences: UserPreferencesContext | null = null;
    {
      try {
        const [prefsRow] = await db
          .select()
          .from(userPreferencesTable)
          .where(
            and(
              eq(userPreferencesTable.storeDomain, store.storeDomain),
              eq(userPreferencesTable.sessionId, parsed.data.sessionId)
            )
          );
        if (prefsRow && prefsRow.prefs && typeof prefsRow.prefs === "object") {
          const raw = prefsRow.prefs as Record<string, unknown>;
          const cleaned: UserPreferencesContext = {};
          for (const [k, v] of Object.entries(raw)) {
            if (ALLOWED_PREF_KEYS.has(k) && v && typeof v === "string" && v.trim()) {
              cleaned[k] = v.trim();
            }
          }
          if (Object.keys(cleaned).length > 0) {
            userPreferences = cleaned;
          }
        }
      } catch (err) {
        console.warn("[chat] Failed to fetch user preferences:", err instanceof Error ? err.message : err);
      }
    }

    let wishlistItems: WishlistItem[] = [];
    try {
      wishlistItems = await getWishlist(store.storeDomain, parsed.data.sessionId);
    } catch (err) {
      console.warn("[chat] Failed to fetch wishlist:", err instanceof Error ? err.message : err);
    }

    const isReturningUser = !!(userPreferences && Object.keys(userPreferences).length > 0) && existingMessages.length <= 1;

    const wishlistContext = wishlistItems.length > 0
      ? { itemCount: wishlistItems.length, itemTitles: wishlistItems.map(i => i.title) }
      : null;

    const chatContext = parsed.data.context ? {
      productHandle: parsed.data.context.productHandle,
      collectionHandle: parsed.data.context.collectionHandle,
      cartToken: parsed.data.context.cartToken,
      searchMode: parsed.data.context.searchMode,
      customerAccountConnected: !!customerAccountConnection,
      customerAccountStoreDomain: customerAccountConnection ? store.storeDomain : undefined,
      isReturningUser,
      wishlistContext,
    } : {
      customerAccountConnected: !!customerAccountConnection,
      customerAccountStoreDomain: customerAccountConnection ? store.storeDomain : undefined,
      isReturningUser,
      wishlistContext,
    };

    let customization = {
      brandVoice: store.brandVoice,
      customInstructions: store.customInstructions,
      recommendationStrategy: store.recommendationStrategy,
    };

    const { systemPrompt, llmMessages } = buildLLMContext(
      existingMessages,
      store.storeDomain,
      knowledge,
      ucpDoc,
      chatContext,
      customization,
      userPreferences
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

    const executeAndGuardTool = createToolExecutor({
      storeDomain: store.storeDomain,
      storefrontToken: store.storefrontToken,
      sessionId: parsed.data.sessionId,
      ucpEnabled,
      guardSensitivity,
      blockedTopics,
      authenticatedToolNames,
      activeConnection: customerAccountConnection,
      userPreferences,
    });

    const stream = streamChatWithProvider(
      store.provider,
      decryptedApiKey,
      store.model,
      systemPrompt,
      llmMessages,
      tools,
      executeAndGuardTool,
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

    const assistantMessageId = randomUUID();
    const assistantMessage: ChatMessageRecord = {
      id: assistantMessageId,
      role: "assistant",
      content: fullAssistantContent,
      toolCalls,
      toolResults,
      timestamp: new Date().toISOString(),
    };

    safeSend(`data: ${JSON.stringify({ type: "message_id", data: assistantMessageId })}\n\n`);

    const newMessages = [userMessage, assistantMessage];

    const { conversationSaved, analyticsSaved } = await persistChatResult(
      conversation.id,
      store.storeDomain,
      parsed.data.sessionId,
      newMessages,
      truncatedMessage
    );

    if (!conversationSaved) {
      safeSend(`data: ${JSON.stringify({ type: "warning", data: "Your conversation may not have been saved. Responses might be lost on refresh." })}\n\n`);
    }
    if (!analyticsSaved) {
      console.warn(`[chat] Analytics persistence failed for store="${store.storeDomain}" session="${parsed.data.sessionId}"`);
    }

    {
      extractAndSavePreferences(
        store.storeDomain,
        parsed.data.sessionId,
        truncatedMessage,
        fullAssistantContent
      ).then((extracted) => {
        if (extracted) {
          console.log(`[chat] Auto-extracted preferences for store="${store.storeDomain}" session="${parsed.data.sessionId}":`, Object.keys(extracted).join(", "));
          safeSend(`data: ${JSON.stringify({ type: "preferences_updated", data: extracted })}\n\n`);
        }
      }).catch((err) => {
        console.warn("[chat] Preference extraction failed:", err instanceof Error ? err.message : err);
      });
    }

    if (fullAssistantContent && conversationSaved) {
      const toolResultTexts = toolResults.map(tr => tr.content);
      const knowledgeContext = knowledge.map(k => `[${k.category}] ${k.title}: ${k.content}`).join("\n");
      auditOwnsStream = true;
      fireOutputAudit(
        fullAssistantContent,
        toolResultTexts,
        blockedTopics,
        knowledgeContext,
        conversation.id,
        store.storeDomain,
        parsed.data.sessionId,
        assistantMessageId,
        safeSend,
        () => { try { res.end(); } catch {} }
      );
      return;
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
    if (!auditOwnsStream) {
      res.end();
    }
  }
});

router.post("/stores/:storeDomain/feedback", validateStoreDomain, validateSession, async (req, res) => {
  const storeDomain = req.params.storeDomain as string;
  const sessionId = (req as unknown as { validatedSessionId: string }).validatedSessionId;
  const { rating, comment } = req.body ?? {};
  if (!rating || !["positive", "negative"].includes(rating)) {
    return sendError(res, 400, "rating must be 'positive' or 'negative'");
  }
  console.log(`[feedback] store=${storeDomain} rating=${rating} hasComment=${!!comment}`);
  res.json({ success: true });
});

export default router;
