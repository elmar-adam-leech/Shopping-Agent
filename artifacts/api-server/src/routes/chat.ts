import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, storesTable, conversationsTable, shopKnowledgeTable, analyticsLogsTable } from "@workspace/db";
import { SendChatParams, SendChatBody } from "@workspace/api-zod";
import { streamChatWithProvider } from "../services/llm-service";
import { listTools, callTool } from "../services/mcp-client";
import { buildSystemPrompt } from "../services/system-prompt";
import { validateStoreDomain } from "../services/tenant-validator";

const router: IRouter = Router();

router.post("/stores/:storeDomain/chat", validateStoreDomain, async (req, res): Promise<void> => {
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

  const store = (req as any).store as typeof storesTable.$inferSelect;

  if (!store.apiKey) {
    res.status(400).json({ error: "Store has no LLM API key configured. Please add one in settings." });
    return;
  }

  if (!store.storefrontToken) {
    res.status(400).json({ error: "Store has no Storefront Access Token configured." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const knowledge = await db
      .select()
      .from(shopKnowledgeTable)
      .where(eq(shopKnowledgeTable.storeDomain, store.storeDomain));

    const systemPrompt = buildSystemPrompt(store.storeDomain, knowledge);

    let conversation: any = null;
    let existingMessages: any[] = [];

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
        existingMessages = (conv.messages as any[]) || [];
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

    const userMessage = {
      role: "user" as const,
      content: parsed.data.message,
      timestamp: new Date().toISOString(),
    };

    existingMessages.push(userMessage);

    res.write(`data: ${JSON.stringify({ type: "conversation_id", data: conversation.id })}\n\n`);

    let tools: any[] = [];
    try {
      tools = await listTools(store.storeDomain, store.storefrontToken);
    } catch {
      // tools will be empty, chat continues without MCP tools
    }

    const llmMessages = existingMessages.map((m: any) => ({
      role: m.role,
      content: m.content,
      tool_call_id: m.toolCallId,
    }));

    let fullAssistantContent = "";
    const toolCalls: any[] = [];
    const toolResults: any[] = [];

    const stream = streamChatWithProvider(
      store.provider,
      store.apiKey,
      store.model,
      systemPrompt,
      llmMessages,
      tools,
      async (toolName, args) => {
        return callTool(store.storeDomain, store.storefrontToken!, toolName, args);
      }
    );

    for await (const event of stream) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);

      if (event.type === "text") {
        fullAssistantContent += event.data;
      } else if (event.type === "tool_call") {
        toolCalls.push(event.data);
      } else if (event.type === "tool_result") {
        toolResults.push(event.data);
      }
    }

    const assistantMessage = {
      role: "assistant" as const,
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
  } catch (err: any) {
    console.error("Chat error:", err);
    res.write(`data: ${JSON.stringify({ type: "error", data: "An error occurred processing your message" })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
