import { eq, and, sql, isNull } from "drizzle-orm";
import { conversationsTable, withTenantScope } from "@workspace/db";
import type { Conversation } from "@workspace/db/schema";
import { logAnalyticsEvent } from "./analytics-logger";

const MAX_MESSAGES_PER_CONVERSATION = 200;

export interface ChatMessageRecord {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
  toolResults?: Array<{ toolCallId: string; content: string }>;
  timestamp: string;
}

export async function loadOrCreateConversation(
  storeDomain: string,
  sessionId: string,
  conversationId: number | null | undefined,
  messagePreview: string
): Promise<{ conversation: Conversation; existingMessages: ChatMessageRecord[] }> {
  return withTenantScope(storeDomain, async (scopedDb) => {
    let conversation: Conversation | null = null;
    let existingMessages: ChatMessageRecord[] = [];

    if (conversationId != null) {
      const [conv] = await scopedDb
        .select()
        .from(conversationsTable)
        .where(
          and(
            eq(conversationsTable.id, conversationId),
            eq(conversationsTable.storeDomain, storeDomain),
            eq(conversationsTable.sessionId, sessionId),
            isNull(conversationsTable.deletedAt)
          )
        );
      if (conv) {
        conversation = conv;
        existingMessages = (conv.messages as ChatMessageRecord[]) || [];
      }
    }

    if (!conversation) {
      const title = messagePreview.slice(0, 50) + (messagePreview.length > 50 ? "..." : "");
      const [newConv] = await scopedDb
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
  });
}

export async function appendMessages(
  conversationId: number,
  storeDomain: string,
  newMessages: ChatMessageRecord[]
): Promise<void> {
  const newMessagesJson = JSON.stringify(newMessages);
  const newMsgCount = newMessages.length;

  await withTenantScope(storeDomain, async (scopedDb) => {
    await scopedDb
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
  });
}

export async function persistChatResult(
  conversationId: number,
  storeDomain: string,
  sessionId: string,
  newMessages: ChatMessageRecord[],
  userQuery: string
): Promise<{ conversationSaved: boolean; analyticsSaved: boolean }> {
  let conversationSaved = true;
  let analyticsSaved = true;

  try {
    await appendMessages(conversationId, storeDomain, newMessages);
  } catch (err) {
    conversationSaved = false;
    console.error(`[chat] FAILED to save conversation id="${conversationId}" store="${storeDomain}":`, err instanceof Error ? err.message : "Unknown error");
  }

  const analyticsResult = await logAnalyticsEvent(storeDomain, "chat", sessionId, { query: userQuery.slice(0, 500) });
  if (!analyticsResult) {
    analyticsSaved = false;
  }

  return { conversationSaved, analyticsSaved };
}
