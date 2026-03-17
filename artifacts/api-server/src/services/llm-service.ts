import { streamChat as streamOpenAIChat } from "./llms/openai";
import { streamChat as streamAnthropicChat } from "./llms/anthropic";
import { streamChat as streamXAIChat } from "./llms/xai";
import type { LLMStreamEvent, LLMMessage, MCPToolDef } from "./llms/types";

export type { LLMStreamEvent, LLMMessage, MCPToolDef };

export async function* streamChatWithProvider(
  provider: "openai" | "anthropic" | "xai",
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: LLMMessage[],
  tools: MCPToolDef[],
  onToolCall: (name: string, args: Record<string, unknown>) => Promise<string>,
  signal?: AbortSignal
): AsyncGenerator<LLMStreamEvent> {
  switch (provider) {
    case "openai":
      yield* streamOpenAIChat(apiKey, model, systemPrompt, messages, tools, onToolCall, signal);
      break;
    case "anthropic":
      yield* streamAnthropicChat(apiKey, model, systemPrompt, messages, tools, onToolCall, signal);
      break;
    case "xai":
      yield* streamXAIChat(apiKey, model, systemPrompt, messages, tools, onToolCall, signal);
      break;
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
