import type { LLMMessage, LLMStreamEvent, MCPToolDef } from "./types";
import { streamChat as streamChatEngine } from "./chat-stream";
import { createChatAdapter } from "./chat-adapter";

export async function* streamChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: LLMMessage[],
  tools: MCPToolDef[],
  onToolCall: (name: string, args: Record<string, unknown>) => Promise<string>,
  signal?: AbortSignal
): AsyncGenerator<LLMStreamEvent> {
  const adapter = createChatAdapter("https://api.x.ai/v1");
  yield* streamChatEngine(adapter, apiKey, model, systemPrompt, messages, tools, onToolCall, signal);
}
