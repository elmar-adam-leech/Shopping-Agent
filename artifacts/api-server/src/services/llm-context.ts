import type { ShopKnowledge } from "@workspace/db/schema";
import type { UCPDiscoveryDocument } from "./mcp-client";
import { buildSystemPrompt } from "./system-prompt";
import type { ChatMessageRecord } from "./conversation-service";

const MESSAGE_WINDOW_SIZE = 20;

export function buildLLMContext(
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
