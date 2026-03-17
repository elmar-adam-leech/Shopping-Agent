import type { LLMStreamEvent, LLMMessage } from "./llms/openai";

export type { LLMStreamEvent, LLMMessage };

export async function* streamChatWithProvider(
  provider: "openai" | "anthropic" | "xai",
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: LLMMessage[],
  tools: any[],
  onToolCall: (name: string, args: any) => Promise<string>
): AsyncGenerator<LLMStreamEvent> {
  let streamFn: typeof import("./llms/openai").streamChat;

  switch (provider) {
    case "openai": {
      const mod = await import("./llms/openai");
      streamFn = mod.streamChat;
      break;
    }
    case "anthropic": {
      const mod = await import("./llms/anthropic");
      streamFn = mod.streamChat;
      break;
    }
    case "xai": {
      const mod = await import("./llms/xai");
      streamFn = mod.streamChat;
      break;
    }
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }

  yield* streamFn(apiKey, model, systemPrompt, messages, tools, onToolCall);
}
