import type { LLMStreamEvent, LLMMessage, MCPToolDef } from "./openai";
import { streamChat as streamOpenAIChat } from "./openai";

export async function* streamChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: LLMMessage[],
  tools: MCPToolDef[],
  onToolCall: (name: string, args: Record<string, unknown>) => Promise<string>
): AsyncGenerator<LLMStreamEvent> {
  yield* streamOpenAIChat(apiKey, model, systemPrompt, messages, tools, onToolCall, "https://api.x.ai/v1");
}
