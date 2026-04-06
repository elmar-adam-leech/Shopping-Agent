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
import { getActiveConnection } from "../services/customer-account-oauth";
import { listAuthenticatedMCPTools } from "../services/customer-account-mcp";
import { loadOrCreateConversation, persistChatResult, type ChatMessageRecord } from "../services/conversation-service";
import { getCachedKnowledge } from "../services/knowledge-cache";
import { buildLLMContext } from "../services/llm-context";
import { fireOutputAudit } from "../services/output-audit";
import { createToolExecutor } from "../services/tool-guard";

const MAX_USER_MESSAGE_LENGTH = 10_000;

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

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

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

    const truncatedMessage = parsed.data.message.length > MAX_USER_MESSAGE_LENGTH
      ? parsed.data.message.slice(0, MAX_USER_MESSAGE_LENGTH)
      : parsed.data.message;

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
        confidence: guardVerdict.confidence,
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
      console.warn(`Failed to list MCP tools for store="${store.storeDomain}":`, err instanceof Error ? err.message : err);
    }

    const validatedSessionId = (req as unknown as { validatedSessionId: string }).validatedSessionId;
    let customerAccountConnection: McpConnection | null = null;
    try {
      customerAccountConnection = await getActiveConnection(store.storeDomain, validatedSessionId);
    } catch (err) {
      console.warn(`[chat] Failed to check customer account connection:`, err instanceof Error ? err.message : err);
    }

    const authenticatedToolNames = new Set<string>();
    if (customerAccountConnection) {
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
    }

    const chatContext = parsed.data.context ? {
      productHandle: parsed.data.context.productHandle,
      collectionHandle: parsed.data.context.collectionHandle,
      cartToken: parsed.data.context.cartToken,
      searchMode: parsed.data.context.searchMode,
      customerAccountConnected: !!customerAccountConnection,
      customerAccountStoreDomain: customerAccountConnection ? store.storeDomain : undefined,
    } : {
      customerAccountConnected: !!customerAccountConnection,
      customerAccountStoreDomain: customerAccountConnection ? store.storeDomain : undefined,
    };

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

    const executeAndGuardTool = createToolExecutor({
      storeDomain: store.storeDomain,
      storefrontToken: store.storefrontToken,
      sessionId: parsed.data.sessionId,
      ucpEnabled,
      guardSensitivity,
      blockedTopics,
      authenticatedToolNames,
      activeConnection: customerAccountConnection,
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

export default router;
