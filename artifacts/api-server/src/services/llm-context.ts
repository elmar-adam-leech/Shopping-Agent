import type { ShopKnowledge } from "@workspace/db/schema";
import type { UCPDiscoveryDocument } from "./ucp-client";
import { buildSystemPrompt, type ChatContext, type StoreCustomization, type UserPreferencesContext } from "./system-prompt";
import type { ChatMessageRecord } from "./conversation-service";

const MESSAGE_WINDOW_SIZE = 20;

export function buildLLMContext(
  existingMessages: ChatMessageRecord[],
  storeDomain: string,
  knowledge: ShopKnowledge[],
  ucpDoc: UCPDiscoveryDocument | null,
  chatContext?: ChatContext,
  customization?: StoreCustomization,
  userPreferences?: UserPreferencesContext | null
) {
  const windowedMessages = existingMessages.length > MESSAGE_WINDOW_SIZE
    ? existingMessages.slice(-MESSAGE_WINDOW_SIZE)
    : existingMessages;

  const systemPrompt = buildSystemPrompt(storeDomain, knowledge, ucpDoc, chatContext, customization, userPreferences);

  const llmMessages = windowedMessages.map((m) => ({
    role: m.role,
    content: m.content,
    tool_call_id: m.toolCallId,
  }));

  return { systemPrompt, llmMessages };
}
