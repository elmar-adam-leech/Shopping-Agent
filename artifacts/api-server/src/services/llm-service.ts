/**
 * LLM service facade that dispatches streaming chat requests to the
 * configured provider (OpenAI, Anthropic, or xAI). Each provider adapter
 * yields a uniform `LLMStreamEvent` stream so callers stay provider-agnostic.
 */

import { streamChat as streamOpenAIChat } from "./llms/openai";
import { streamChat as streamAnthropicChat } from "./llms/anthropic";
import { streamChat as streamXAIChat } from "./llms/xai";
import type { LLMStreamEvent, LLMMessage, MCPToolDef } from "./llms/types";

/**
 * Stream a chat completion through the selected LLM provider.
 *
 * @param provider  - Which LLM backend to use.
 * @param apiKey    - The API key for the chosen provider.
 * @param model     - Model identifier (e.g. "gpt-4o", "claude-sonnet-4-20250514").
 * @param systemPrompt - System-level instructions prepended to the conversation.
 * @param messages  - Conversation history.
 * @param tools     - MCP tool definitions the model may call.
 * @param onToolCall - Callback invoked when the model requests a tool execution.
 * @param signal    - Optional AbortSignal to cancel the stream.
 * @yields {LLMStreamEvent} Text deltas, tool-call events, and finish signals.
 */
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
